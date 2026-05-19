// netlify/functions/create-coach-tier-checkout.js
// Creates a Stripe Checkout session for a coach's platform tier
// subscription. Called from coach-profile-setup.html submitProfile()
// when a new coach completes setup. The webhook then flips
// profile_status to 'Live' and stores the subscription IDs on the
// profiles row.
//
// Foundation pricing only — fortnightly variants aren't in env yet.
// Level 4 — Verified Elite Coach uses the L4 base price (the only
// L4 SKU defined).

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const TIER_PRICES = {
  "Level 1 — Development Coach":    process.env.STRIPE_COACH_L1_FOUNDATION_PRICE_ID,
  "Level 2 — Performance Coach":    process.env.STRIPE_COACH_L2_FOUNDATION_PRICE_ID,
  "Level 3 — Elite Coach":          process.env.STRIPE_COACH_L3_FOUNDATION_PRICE_ID,
  "Level 4 — Verified Elite Coach": process.env.STRIPE_COACH_L4_PRICE_ID
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { tier, coachId, coachEmail } = JSON.parse(event.body);

    const priceId = TIER_PRICES[tier];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid tier or price not configured for: " + tier })
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: coachEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        coach_id: coachId,
        type: "coach_tier",
        tier: tier
      },
      success_url: `${process.env.APP_URL}/coach-dashboard.html?tier=success`,
      cancel_url:  `${process.env.APP_URL}/coach-profile-setup.html?tier=cancelled`
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error("Coach tier checkout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
