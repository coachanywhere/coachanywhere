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
    // Dispatch on metadata.type: 'spotlight' or 'coach_tier'.
    case "checkout.session.completed": {
      const type = session.metadata?.type;
      const coachId = session.metadata?.coach_id;
      if (!coachId) break;

      if (type === "spotlight") {
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

      if (type === "coach_tier") {
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
        .select("id")
        .eq("tier_stripe_subscription_id", subscriptionId);
      if (tierCoaches && tierCoaches.length) {
        await supabase
          .from("profiles")
          .update({
            tier_status: "cancelled",
            profile_status: "Cancelled"
          })
          .eq("tier_stripe_subscription_id", subscriptionId);
        console.log("Coach tier cancelled for subscription:", subscriptionId);
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
      console.log("Payment failed processed for subscription:", subscriptionId);
      break;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
