// =============================================================================
// /.netlify/functions/create-bundle-subscription.js
// -----------------------------------------------------------------------------
// Creates a Stripe Checkout session for athlete bundle / pilot subscriptions.
// Manual-payouts mode (B2): no Connect destination, no application_fee.
// The full $49 lands in the CoachAnywhere platform account.
//
// Required env vars:
//   STRIPE_SECRET_KEY                Stripe secret (sk_test_* or sk_live_*)
//   STRIPE_PILOT_PRICE_ID            $49 AUD pilot price ID
//   SUPABASE_URL                     https://rtaxjewvshhpdnkpojjn.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY        service-role key (for write access)
//   SITE_URL                         e.g. https://coachanywhere247.com
// =============================================================================

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { coachId, bundleType, athleteId, athleteEmail } = body;

  if (!coachId || !bundleType || !athleteId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" })
    };
  }

  // ── Resolve Stripe Price ID ─────────────────────────────────────────────
  let priceId;
  if (bundleType === "pilot") {
    priceId = process.env.STRIPE_PILOT_PRICE_ID;
    if (!priceId) {
      console.error("[create-bundle-subscription] STRIPE_PILOT_PRICE_ID not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Pilot price not configured" })
      };
    }
  } else {
    // Post-pilot bundles will map here via {bundle, tier} → price_id table.
    // Not used during the manual-payouts pilot.
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Only pilot subscriptions supported in current mode" })
    };
  }

  // ── Look up coach (sanity check + load name for metadata) ───────────────
  const { data: coach, error: coachErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, pilot_status")
    .eq("id", coachId)
    .maybeSingle();

  if (coachErr || !coach) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Coach not found" })
    };
  }
  if (coach.role !== "coach") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Selected user is not a coach" })
    };
  }

  // ── Create Checkout session ─────────────────────────────────────────────
  // No transfer_data, no application_fee. Money lands in platform account;
  // pilot-payout-handler.js webhook records what's owed to the coach.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: athleteEmail || undefined,
      subscription_data: {
        metadata: {
          athlete_id:  athleteId,
          coach_id:    coach.id,
          coach_name:  (coach.first_name || "") + " " + (coach.last_name || ""),
          bundle:      bundleType,
          is_pilot:    bundleType === "pilot" ? "true" : "false"
        }
      },
      success_url: process.env.SITE_URL + "/athlete-dashboard.html?subscribed=1",
      cancel_url:  process.env.SITE_URL + "/select-coach.html?cancelled=1"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error("[create-bundle-subscription] Stripe error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
