// =============================================================================
// /.netlify/functions/pilot-payout-handler.js
// -----------------------------------------------------------------------------
// Stripe webhook for invoice.payment_succeeded on pilot subscriptions.
// Manual-payouts mode (B2): records a pending pilot_payouts row that the
// admin marks as paid after they've completed the bank transfer.
//
// This replaces pilot-topup-handler.js (which used Connect transfers).
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET_PILOT_PAYOUT     signing secret for this endpoint
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// $60 in cents - what we owe each coach per active athlete per invoice cycle.
const COACH_PAYOUT_CENTS = 6000;

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  // ── Verify webhook signature ────────────────────────────────────────────
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET_PILOT_PAYOUT
    );
  } catch (err) {
    console.error("[pilot-payout] signature failed:", err.message);
    return { statusCode: 400, body: `Webhook signature error: ${err.message}` };
  }

  if (stripeEvent.type !== "invoice.payment_succeeded") {
    return { statusCode: 200, body: "ignored" };
  }

  const invoice = stripeEvent.data.object;

  // ── Pull subscription metadata ──────────────────────────────────────────
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  } catch (err) {
    console.error("[pilot-payout] could not fetch subscription:", err.message);
    return { statusCode: 200, body: "subscription fetch failed" };
  }

  const meta = subscription.metadata || {};
  if (meta.is_pilot !== "true") {
    return { statusCode: 200, body: "not a pilot subscription" };
  }

  const coachId   = meta.coach_id;
  const athleteId = meta.athlete_id;
  if (!coachId || !athleteId) {
    console.error("[pilot-payout] missing metadata", meta);
    return { statusCode: 200, body: "missing metadata" };
  }

  const month = new Date(invoice.created * 1000).toISOString().slice(0, 7);

  // ── Find matching subscriptions row to link ─────────────────────────────
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("coach_id",   coachId)
    .eq("is_pilot",   true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Idempotent insert ───────────────────────────────────────────────────
  // (subscription_id, month) is unique — webhook retries hit the unique
  // constraint and we treat that as success.
  const { data: payout, error: insErr } = await supabase
    .from("pilot_payouts")
    .insert({
      coach_id:           coachId,
      athlete_id:         athleteId,
      subscription_id:    subRow ? subRow.id : null,
      stripe_invoice_id:  invoice.id,
      month:              month,
      amount_cents:       COACH_PAYOUT_CENTS,
      status:             "pending"
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      // Already exists for this sub+month - retry is a no-op
      return { statusCode: 200, body: "already recorded" };
    }
    console.error("[pilot-payout] insert failed:", insErr);
    return { statusCode: 500, body: insErr.message };
  }

  console.log("[pilot-payout] recorded:", {
    payout_id: payout.id,
    coach_id:  coachId,
    athlete_id: athleteId,
    month:     month,
    amount:    "$" + (COACH_PAYOUT_CENTS / 100).toFixed(2)
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      payout_id: payout.id,
      message: "Pilot payout recorded. Admin will mark as paid after bank transfer."
    })
  };
};
