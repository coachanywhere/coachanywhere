// netlify/functions/cancel-subscription.js
// Server-side cancellation flow for athlete packages, coach tier
// subscriptions, and Spotlight. Called from the in-app cancellation
// modal in athlete-dashboard.html and coach-dashboard.html.
//
// Flow:
//   1. Verify the caller's JWT and that they own the row they're
//      cancelling.
//   2. Write the cancellation_* fields (reason / detail / offer
//      outcome / cancelled_at) to the right table.
//   3. If a Stripe subscription ID is recorded on the row, schedule
//      a cancel-at-period-end via the Stripe API. The actual
//      'cancelled' status flip happens later when Stripe fires
//      customer.subscription.deleted — stripe-webhook.js handles it.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });
  if (event.httpMethod !== "POST")    return cors({ statusCode: 405, body: "Method not allowed" });

  // ── Auth ─────────────────────────────────────────────────────
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return cors(json(401, { error: "missing token" }));

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: userRes, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userRes?.user) return cors(json(401, { error: "invalid token" }));
  const userId = userRes.user.id;

  // ── Body ─────────────────────────────────────────────────────
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}
  const { type, id, reason, detail, feedback_offer } = body;
  if (!type || !id) return cors(json(400, { error: "missing type or id" }));

  const ALLOWED_REASONS = new Set([
    "too_expensive", "not_using", "found_another",
    "issue_coach",   "taking_break", "other"
  ]);
  if (reason && !ALLOWED_REASONS.has(reason)) {
    return cors(json(400, { error: "invalid reason" }));
  }

  const nowISO = new Date().toISOString();
  let stripeSubId = null;
  let rowType = null;

  try {
    if (type === "athlete_sub") {
      // Ownership — subscriptions.athlete_id must equal the caller.
      const { data: sub } = await sb.from("subscriptions")
        .select("id, athlete_id, stripe_subscription_id")
        .eq("id", id).maybeSingle();
      if (!sub) return cors(json(404, { error: "subscription not found" }));
      if (sub.athlete_id !== userId) return cors(json(403, { error: "not your subscription" }));

      stripeSubId = sub.stripe_subscription_id;
      const { error: upErr } = await sb.from("subscriptions").update({
        cancelled_at:                nowISO,
        cancellation_reason:         reason || null,
        cancellation_detail:         detail || null,
        cancellation_feedback_offer: feedback_offer || "none",
        updated_at:                  nowISO
      }).eq("id", id);
      if (upErr) throw upErr;
      rowType = "athlete_sub";

    } else if (type === "coach_tier") {
      // Ownership — id must be the caller's own profile id.
      if (id !== userId) return cors(json(403, { error: "not your profile" }));
      const { data: prof } = await sb.from("profiles")
        .select("tier_stripe_subscription_id")
        .eq("id", userId).maybeSingle();
      stripeSubId = prof?.tier_stripe_subscription_id;
      const { error: upErr } = await sb.from("profiles").update({
        tier_cancelled_at:                nowISO,
        tier_cancellation_reason:         reason || null,
        tier_cancellation_detail:         detail || null,
        tier_cancellation_feedback_offer: feedback_offer || "none"
      }).eq("id", userId);
      if (upErr) throw upErr;
      rowType = "coach_tier";

    } else if (type === "spotlight") {
      if (id !== userId) return cors(json(403, { error: "not your profile" }));
      const { data: prof } = await sb.from("profiles")
        .select("spotlight_stripe_subscription_id")
        .eq("id", userId).maybeSingle();
      stripeSubId = prof?.spotlight_stripe_subscription_id;
      const { error: upErr } = await sb.from("profiles").update({
        spotlight_cancelled_at:                nowISO,
        spotlight_cancellation_reason:         reason || null,
        spotlight_cancellation_detail:         detail || null,
        spotlight_cancellation_feedback_offer: feedback_offer || "none"
      }).eq("id", userId);
      if (upErr) throw upErr;
      rowType = "spotlight";

    } else {
      return cors(json(400, { error: "unknown type: " + type }));
    }
  } catch (e) {
    console.error("[cancel-subscription] DB write failed:", e?.message || e);
    return cors(json(500, { error: "DB write failed: " + (e?.message || e) }));
  }

  // ── Stripe — schedule cancel at period end ───────────────────
  // Best-effort. If there's no recorded Stripe sub ID (legacy row, or
  // one-shot 'mode: payment' checkout), our DB now has the reason and
  // the row is logically cancelled — we just can't tell Stripe.
  let stripeResult = "no_stripe_id";
  if (stripeSubId) {
    try {
      await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
      stripeResult = "scheduled_at_period_end";
    } catch (e) {
      console.error("[cancel-subscription] Stripe update failed:", e?.message || e);
      stripeResult = "stripe_error";
    }
  }

  console.log("[cancel-subscription] success", {
    userId, rowType, reason, feedback_offer, stripeResult
  });
  return cors(json(200, {
    success: true,
    stripe:  stripeResult,
    type:    rowType
  }));
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  };
}

function cors(resp) {
  return {
    ...resp,
    headers: {
      ...(resp.headers || {}),
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  };
}
