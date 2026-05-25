// netlify/functions/create-bundle-subscription.js
// Creates a Stripe Checkout session for an athlete subscribing to a coach's
// monthly bundle (Starter / Standard / Pro), priced by the coach's tier.
// Called from select-coach.html when an athlete clicks "Subscribe".
//
// 20/80 SPLIT via Stripe Connect: the subscription uses
// application_fee_percent: 20 with transfer_data.destination = the coach's
// connected account, so 80% routes to the coach and 20% to the platform.
//
// 🔴 STRIPE CONNECT DEPENDENCY (launch-critical, NOT yet built):
//   This requires the coach to have a connected Stripe account id stored on
//   their profile (expected column: profiles.stripe_connect_id). That column
//   and the Connect onboarding flow do NOT exist yet. Until they do, EVERY
//   coach reads as "no connect account" and the subscription is BLOCKED with a
//   clear message — the athlete is never charged. When Connect onboarding is
//   built (adds profiles.stripe_connect_id + onboarding), this function works
//   unchanged. We read the coach profile with select('*') so the missing
//   column simply reads as undefined rather than erroring.
//
// On successful payment the Stripe webhook (stripe-webhook.js, metadata
// type='bundle') writes the athlete_subscriptions row and links athlete_coaches.
//
// Required env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY,
//   APP_URL, and the 12 STRIPE_BUNDLE_<BUNDLE>_L<n> price IDs.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const BUNDLE_TYPES = ["starter", "standard", "pro"];
const RATE = { 1: 48, 2: 72, 3: 108, 4: 144 };

// bundle + tier level → env var holding the Stripe price ID
const PRICE_ENV = {
  starter:  { 1: "STRIPE_BUNDLE_STARTER_L1",  2: "STRIPE_BUNDLE_STARTER_L2",  3: "STRIPE_BUNDLE_STARTER_L3",  4: "STRIPE_BUNDLE_STARTER_L4" },
  standard: { 1: "STRIPE_BUNDLE_STANDARD_L1", 2: "STRIPE_BUNDLE_STANDARD_L2", 3: "STRIPE_BUNDLE_STANDARD_L3", 4: "STRIPE_BUNDLE_STANDARD_L4" },
  pro:      { 1: "STRIPE_BUNDLE_PRO_L1",      2: "STRIPE_BUNDLE_PRO_L2",      3: "STRIPE_BUNDLE_PRO_L3",      4: "STRIPE_BUNDLE_PRO_L4" }
};

function monthlyPrice(bundle, level) {
  const r = RATE[level];
  if (!r) return null;
  if (bundle === "starter")  return Math.round(r * 50 / 60);
  if (bundle === "standard") return Math.round(r * 2) + 49;
  if (bundle === "pro")      return Math.round(r * 200 / 60) + 49 + 40;
  return null;
}
function tierLevel(selected_tier) {
  const m = String(selected_tier || "").match(/[1-4]/);
  return m ? Number(m[0]) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors({ statusCode: 204 });
  if (event.httpMethod !== "POST")    return cors(json(405, { error: "method_not_allowed" }));

  // ── Auth: the athlete must be signed in ──
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return cors(json(401, { error: "missing token" }));

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: userRes, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userRes?.user) return cors(json(401, { error: "invalid token" }));
  const athleteId = userRes.user.id;

  // ── Body ──
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}
  const coachId = (body.coachId || "").trim();
  const bundleType = (body.bundleType || "").trim();
  if (!coachId) return cors(json(400, { error: "missing coachId" }));
  if (!BUNDLE_TYPES.includes(bundleType)) return cors(json(400, { error: "invalid bundleType" }));
  if (coachId === athleteId) return cors(json(400, { error: "cannot subscribe to yourself" }));

  // ── Load the coach (select * so a missing stripe_connect_id just reads undefined) ──
  const { data: coach, error: coachErr } = await sb.from("profiles").select("*").eq("id", coachId).maybeSingle();
  if (coachErr || !coach) return cors(json(404, { error: "coach not found" }));
  if (coach.role !== "coach") return cors(json(400, { error: "not a coach" }));

  // Bundle must be one this coach offers.
  const active = Array.isArray(coach.bundles_active) ? coach.bundles_active : BUNDLE_TYPES;
  if (!active.includes(bundleType)) return cors(json(400, { error: "coach does not offer this package" }));

  const level = tierLevel(coach.selected_tier);
  if (!level) return cors(json(400, { error: "coach tier not set" }));

  // ── Stripe Connect gate ──
  // No connected account → block gracefully, athlete is NOT charged.
  if (!coach.stripe_connect_id) {
    return cors(json(200, {
      blocked: true,
      reason: "no_connect_account",
      message: "This coach hasn't completed payment setup yet — try again soon."
    }));
  }

  // ── Resolve the Stripe price + snapshot price ──
  const priceId = process.env[PRICE_ENV[bundleType][level]];
  if (!priceId) {
    console.error("[create-bundle-subscription] missing price env:", PRICE_ENV[bundleType][level]);
    return cors(json(500, { error: "pricing_not_configured" }));
  }
  const price = monthlyPrice(bundleType, level);

  // ── Create the subscription Checkout session (destination charge, 20% fee) ──
  try {
    const appUrl = process.env.APP_URL || "https://app.coachanywhere247.com";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        application_fee_percent: 20,
        transfer_data: { destination: coach.stripe_connect_id },
        metadata: {
          type: "bundle",
          athlete_id: athleteId,
          coach_id: coachId,
          bundle_type: bundleType,
          monthly_price: String(price)
        }
      },
      metadata: {
        type: "bundle",
        athlete_id: athleteId,
        coach_id: coachId,
        bundle_type: bundleType,
        monthly_price: String(price)
      },
      success_url: appUrl + "/athlete-dashboard.html?subscribed=1",
      cancel_url:  appUrl + "/select-coach.html"
    });
    return cors(json(200, { url: session.url }));
  } catch (e) {
    console.error("[create-bundle-subscription] stripe error:", e?.message || e);
    return cors(json(500, { error: "checkout_failed" }));
  }
};

function json(statusCode, payload) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}
function cors(resp) {
  return {
    ...resp,
    headers: {
      ...(resp.headers || {}),
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  };
}
