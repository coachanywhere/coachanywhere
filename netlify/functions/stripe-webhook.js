// netlify/functions/stripe-webhook.js
// Handles Stripe webhook events to auto-activate/deactivate Spotlight
// Set this URL in Stripe Dashboard → Webhooks → Add endpoint:
// https://<YOUR-NETLIFY-DOMAIN>/.netlify/functions/stripe-webhook

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key (not anon) for admin writes
);

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const session = stripeEvent.data.object;

  switch (stripeEvent.type) {

    // ── PAYMENT SUCCESSFUL → ACTIVATE SUBSCRIPTION ──
    // Dispatch on metadata.type: 'spotlight' | 'coach_tier' | 'coach_package'.
    case "checkout.session.completed": {
      const type = session.metadata?.type;
      const coachId   = session.metadata?.coach_id;
      const athleteId = session.metadata?.athlete_id;

      if (type === "spotlight" && coachId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            spotlight_active: true,
            spotlight_pending: false,
            spotlight_stripe_customer_id: session.customer,
            spotlight_stripe_subscription_id: session.subscription,
            spotlight_activated_at: new Date().toISOString(),
            spotlight_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", coachId);
        if (error) console.error("Spotlight activation error:", error);
        else console.log("Spotlight activated for coach:", coachId);
        break;
      }

      if (type === "coach_tier" && coachId) {
        // First-time tier subscription complete — flip the coach Live and
        // stash their Stripe IDs so future events can find them.
        const { error } = await supabase
          .from("profiles")
          .update({
            profile_status: "Live",
            tier_stripe_customer_id: session.customer,
            tier_stripe_subscription_id: session.subscription,
            tier_activated_at: new Date().toISOString(),
            tier_status: "active"
          })
          .eq("id", coachId);
        if (error) console.error("Coach tier activation error:", error);
        else console.log("Coach tier activated:", coachId, session.metadata?.tier);
        break;
      }

      if (type === "coach_package" && athleteId && coachId) {
        // Athlete just bought a coaching package. Write the subscription row
        // with Stripe IDs so we can update / cancel via the API later. Also
        // insert the athlete_coaches link so the coach sees them.
        // Mode for coach_package checkouts is currently 'payment' (one-shot)
        // in create-coach-subscription.js — session.subscription will be null
        // for those, but we still capture customer + session id. If this is
        // ever switched to a recurring subscription, the same code captures
        // session.subscription correctly.
        const packageName  = session.metadata?.package_name  || null;
        const packagePrice = session.metadata?.package_price || null;

        const subRow = {
          athlete_id:             athleteId,
          coach_id:               coachId,
          status:                 "active",
          package_name:           packageName,
          stripe_customer_id:     session.customer || null,
          stripe_subscription_id: session.subscription || null,
          updated_at:             new Date().toISOString()
        };

        // Upsert by stripe_subscription_id when available, else just insert.
        if (subRow.stripe_subscription_id) {
          const { data: existing } = await supabase.from("subscriptions")
            .select("id").eq("stripe_subscription_id", subRow.stripe_subscription_id).maybeSingle();
          if (existing) {
            await supabase.from("subscriptions").update(subRow).eq("id", existing.id);
          } else {
            await supabase.from("subscriptions").insert(subRow);
          }
        } else {
          // No Stripe sub ID (one-shot payment). Insert a fresh row.
          await supabase.from("subscriptions").insert(subRow);
        }

        // Link athlete to coach (idempotent — unique constraint on the pair).
        await supabase.from("athlete_coaches")
          .upsert({ athlete_id: athleteId, coach_id: coachId }, { onConflict: "athlete_id,coach_id" });

        console.log("Coach package subscription activated:",
          { athleteId, coachId, packageName, subscription: session.subscription });
        break;
      }

      if (type === "bundle" && athleteId && coachId) {
        // Athlete subscribed to a coach's monthly bundle. Write the
        // athlete_subscriptions row + link athlete_coaches. (mode:subscription,
        // so session.subscription is set — fetch it for the period dates.)
        const bundleType   = session.metadata?.bundle_type || null;
        const monthlyPrice = session.metadata?.monthly_price ? Number(session.metadata.monthly_price) : null;
        let periodStart = null, periodEnd = null;
        try {
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            if (sub.current_period_start) periodStart = new Date(sub.current_period_start * 1000).toISOString();
            if (sub.current_period_end)   periodEnd   = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch (e) { console.error("bundle sub retrieve failed:", e?.message || e); }

        const row = {
          athlete_id: athleteId,
          coach_id: coachId,
          bundle_type: bundleType,
          monthly_price: monthlyPrice,
          stripe_subscription_id: session.subscription || null,
          status: "active",
          current_period_start: periodStart,
          current_period_end: periodEnd
        };
        if (row.stripe_subscription_id) {
          const { data: existing } = await supabase.from("athlete_subscriptions")
            .select("id").eq("stripe_subscription_id", row.stripe_subscription_id).maybeSingle();
          if (existing) await supabase.from("athlete_subscriptions").update(row).eq("id", existing.id);
          else          await supabase.from("athlete_subscriptions").insert(row);
        } else {
          await supabase.from("athlete_subscriptions").insert(row);
        }
        await supabase.from("athlete_coaches")
          .upsert({ athlete_id: athleteId, coach_id: coachId }, { onConflict: "athlete_id,coach_id" });
        console.log("Athlete bundle subscription activated:",
          { athleteId, coachId, bundleType, subscription: session.subscription });
        break;
      }

      break;
    }

    // ── SUBSCRIPTION RENEWED → EXTEND ──
    // Stripe doesn't tell us which "kind" of sub this is in the invoice
    // event metadata, so we look up by subscription ID in both tables.
    case "invoice.payment_succeeded": {
      const subscriptionId = session.subscription;
      if (!subscriptionId) break;

      // Spotlight extension
      const { data: spotlightCoaches } = await supabase
        .from("profiles")
        .select("id")
        .eq("spotlight_stripe_subscription_id", subscriptionId);
      if (spotlightCoaches && spotlightCoaches.length) {
        await supabase
          .from("profiles")
          .update({
            spotlight_active: true,
            spotlight_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("spotlight_stripe_subscription_id", subscriptionId);
        console.log("Spotlight renewed for subscription:", subscriptionId);
      }

      // Coach tier renewal — flips back to active if it was past_due, and
      // keeps profile_status='Live'.
      const { data: tierCoaches } = await supabase
        .from("profiles")
        .select("id, tier_status")
        .eq("tier_stripe_subscription_id", subscriptionId);
      if (tierCoaches && tierCoaches.length) {
        await supabase
          .from("profiles")
          .update({
            tier_status: "active",
            profile_status: "Live"
          })
          .eq("tier_stripe_subscription_id", subscriptionId);
        console.log("Coach tier renewed for subscription:", subscriptionId);
      }

      // Athlete package subscription renewal — flips back to active if
      // previously past_due. Mirrors the tier-renewal grace pattern.
      const { data: pkgSubs } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("stripe_subscription_id", subscriptionId);
      if (pkgSubs && pkgSubs.length) {
        await supabase
          .from("subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete package renewed for subscription:", subscriptionId);
      }

      // Athlete BUNDLE subscription renewal — flip active + refresh period dates.
      const { data: bundleSubs } = await supabase
        .from("athlete_subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId);
      if (bundleSubs && bundleSubs.length) {
        const patch = { status: "active" };
        const period = session.lines?.data?.[0]?.period;
        if (period?.start) patch.current_period_start = new Date(period.start * 1000).toISOString();
        if (period?.end)   patch.current_period_end   = new Date(period.end * 1000).toISOString();
        await supabase.from("athlete_subscriptions")
          .update(patch).eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete bundle renewed for subscription:", subscriptionId);
      }
      break;
    }

    // ── SUBSCRIPTION CANCELLED → DEACTIVATE ──
    case "customer.subscription.deleted": {
      const subscriptionId = session.id;

      // Spotlight cancellation
      await supabase
        .from("profiles")
        .update({
          spotlight_active: false,
          spotlight_pending: false,
          spotlight_stripe_subscription_id: null,
          spotlight_expires_at: null
        })
        .eq("spotlight_stripe_subscription_id", subscriptionId);

      // Tier cancellation — coach is no longer Live on the platform.
      const { data: tierCoaches } = await supabase
        .from("profiles")
        .select("id, tier_cancelled_at")
        .eq("tier_stripe_subscription_id", subscriptionId);
      if (tierCoaches && tierCoaches.length) {
        const patch = {
          tier_status: "cancelled",
          profile_status: "Cancelled"
        };
        // If the user hasn't explicitly cancelled via the in-app modal, stamp
        // the cancellation moment now so the dashboard panel can count it.
        if (!tierCoaches[0].tier_cancelled_at) patch.tier_cancelled_at = new Date().toISOString();
        await supabase
          .from("profiles")
          .update(patch)
          .eq("tier_stripe_subscription_id", subscriptionId);
        console.log("Coach tier cancelled for subscription:", subscriptionId);
      }

      // Athlete package subscription cancellation — flip status + stamp
      // cancelled_at if it wasn't already set by the in-app modal.
      const { data: pkgSubs } = await supabase
        .from("subscriptions")
        .select("id, cancelled_at")
        .eq("stripe_subscription_id", subscriptionId);
      if (pkgSubs && pkgSubs.length) {
        const patch = {
          status:     "cancelled",
          updated_at: new Date().toISOString()
        };
        if (!pkgSubs[0].cancelled_at) patch.cancelled_at = new Date().toISOString();
        await supabase
          .from("subscriptions")
          .update(patch)
          .eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete package cancelled for subscription:", subscriptionId);
      }

      // Athlete BUNDLE subscription cancellation — flip status + stamp.
      const { data: bundleSubs } = await supabase
        .from("athlete_subscriptions")
        .select("id, cancelled_at")
        .eq("stripe_subscription_id", subscriptionId);
      if (bundleSubs && bundleSubs.length) {
        const patch = { status: "cancelled" };
        if (!bundleSubs[0].cancelled_at) patch.cancelled_at = new Date().toISOString();
        await supabase.from("athlete_subscriptions")
          .update(patch).eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete bundle cancelled for subscription:", subscriptionId);
      }
      break;
    }

    // ── PAYMENT FAILED → DEACTIVATE / FLAG ──
    case "invoice.payment_failed": {
      const subscriptionId = session.subscription;
      if (!subscriptionId) break;

      // Spotlight deactivation
      await supabase
        .from("profiles")
        .update({ spotlight_active: false })
        .eq("spotlight_stripe_subscription_id", subscriptionId);

      // Tier — mark past_due. We deliberately don't flip profile_status to
      // Cancelled here so the coach has time to update their card before
      // their profile actually goes dark.
      const { data: tierCoaches } = await supabase
        .from("profiles")
        .select("id")
        .eq("tier_stripe_subscription_id", subscriptionId);
      if (tierCoaches && tierCoaches.length) {
        await supabase
          .from("profiles")
          .update({ tier_status: "past_due" })
          .eq("tier_stripe_subscription_id", subscriptionId);
        console.log("Coach tier marked past_due for subscription:", subscriptionId);
      }

      // Athlete package payment failure — mirror the tier grace pattern.
      // Mark past_due, keep the row visible so the coach still sees them
      // on their athletes list while the athlete updates their card.
      const { data: pkgSubs } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId);
      if (pkgSubs && pkgSubs.length) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete package marked past_due for subscription:", subscriptionId);
      }

      // Athlete BUNDLE subscription payment failure — mark past_due.
      const { data: bundleSubs } = await supabase
        .from("athlete_subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId);
      if (bundleSubs && bundleSubs.length) {
        await supabase.from("athlete_subscriptions")
          .update({ status: "past_due" }).eq("stripe_subscription_id", subscriptionId);
        console.log("Athlete bundle marked past_due for subscription:", subscriptionId);
      }
      console.log("Payment failed processed for subscription:", subscriptionId);
      break;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
