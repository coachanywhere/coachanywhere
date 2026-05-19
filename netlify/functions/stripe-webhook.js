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

    // ── PAYMENT SUCCESSFUL → ACTIVATE SPOTLIGHT ──
    case "checkout.session.completed": {
      if (session.metadata?.type !== "spotlight") break;
      const coachId = session.metadata.coach_id;
      if (!coachId) break;

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

      if (error) console.error("Supabase update error:", error);
      else console.log("Spotlight activated for coach:", coachId);
      break;
    }

    // ── SUBSCRIPTION RENEWED → EXTEND SPOTLIGHT ──
    case "invoice.payment_succeeded": {
      const subscriptionId = session.subscription;
      if (!subscriptionId) break;

      // Find coach by subscription ID and extend
      const { data: coaches } = await supabase
        .from("profiles")
        .select("id")
        .eq("spotlight_stripe_subscription_id", subscriptionId);

      if (coaches && coaches.length > 0) {
        await supabase
          .from("profiles")
          .update({
            spotlight_active: true,
            spotlight_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("spotlight_stripe_subscription_id", subscriptionId);
        console.log("Spotlight renewed for subscription:", subscriptionId);
      }
      break;
    }

    // ── SUBSCRIPTION CANCELLED → DEACTIVATE SPOTLIGHT ──
    case "customer.subscription.deleted": {
      const subscriptionId = session.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          spotlight_active: false,
          spotlight_pending: false,
          spotlight_stripe_subscription_id: null,
          spotlight_expires_at: null
        })
        .eq("spotlight_stripe_subscription_id", subscriptionId);

      if (error) console.error("Supabase deactivation error:", error);
      else console.log("Spotlight deactivated for subscription:", subscriptionId);
      break;
    }

    // ── PAYMENT FAILED → DEACTIVATE SPOTLIGHT ──
    case "invoice.payment_failed": {
      const subscriptionId = session.subscription;
      if (!subscriptionId) break;

      await supabase
        .from("profiles")
        .update({ spotlight_active: false })
        .eq("spotlight_stripe_subscription_id", subscriptionId);

      console.log("Spotlight deactivated due to payment failure:", subscriptionId);
      break;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
