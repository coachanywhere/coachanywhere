// netlify/functions/record-cancellation-feedback.js
// Records cancellation reason + free-text detail + save-offer outcome on
// a subscription WITHOUT cancelling it. Used when a user picks a reason
// in the cancellation modal but then accepts the save offer — we want to
// remember why they almost left, and what they responded to, but the
// subscription stays fully active.
//
// Pair with cancel-subscription.js: that one sets cancelled_at and calls
// Stripe to schedule cancel-at-period-end. This one does NEITHER.

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

  // ── Write feedback fields only — no cancelled_at, no Stripe ──
  try {
    if (type === "athlete_sub") {
      // Ownership — subscription.athlete_id must equal the caller.
      const { data: sub } = await sb.from("subscriptions")
        .select("id, athlete_id")
        .eq("id", id).maybeSingle();
      if (!sub) return cors(json(404, { error: "subscription not found" }));
      if (sub.athlete_id !== userId) return cors(json(403, { error: "not your subscription" }));

      const { error: upErr } = await sb.from("subscriptions").update({
        cancellation_reason:         reason || null,
        cancellation_detail:         detail || null,
        cancellation_feedback_offer: feedback_offer || null,
        updated_at:                  new Date().toISOString()
        // NOTE: cancelled_at deliberately NOT set — the row stays active.
      }).eq("id", id);
      if (upErr) throw upErr;

    } else if (type === "coach_tier") {
      if (id !== userId) return cors(json(403, { error: "not your profile" }));
      const { error: upErr } = await sb.from("profiles").update({
        tier_cancellation_reason:         reason || null,
        tier_cancellation_detail:         detail || null,
        tier_cancellation_feedback_offer: feedback_offer || null
        // NOTE: tier_cancelled_at deliberately NOT set.
      }).eq("id", userId);
      if (upErr) throw upErr;

    } else if (type === "spotlight") {
      if (id !== userId) return cors(json(403, { error: "not your profile" }));
      const { error: upErr } = await sb.from("profiles").update({
        spotlight_cancellation_reason:         reason || null,
        spotlight_cancellation_detail:         detail || null,
        spotlight_cancellation_feedback_offer: feedback_offer || null
        // NOTE: spotlight_cancelled_at deliberately NOT set.
      }).eq("id", userId);
      if (upErr) throw upErr;

    } else {
      return cors(json(400, { error: "unknown type: " + type }));
    }
  } catch (e) {
    console.error("[record-cancellation-feedback] DB write failed:", e?.message || e);
    return cors(json(500, { error: "DB write failed: " + (e?.message || e) }));
  }

  console.log("[record-cancellation-feedback] success", {
    userId, type, reason, feedback_offer
  });
  return cors(json(200, { success: true, type, cancelled: false }));
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
