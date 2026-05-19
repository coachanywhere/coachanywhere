// netlify/functions/create-spotlight-checkout.js
// Creates a Stripe Checkout session for Spotlight subscription
// Called from coach-dashboard.html when coach clicks "Activate Spotlight"

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const SPOTLIGHT_PRICES = {
  "Level 1 — Development Coach": process.env.STRIPE_SPOTLIGHT_L1_PRICE_ID, // $29/mo
  "Level 2 — Performance Coach": process.env.STRIPE_SPOTLIGHT_L2_PRICE_ID, // $49/mo
  "Level 3 — Elite Coach":       process.env.STRIPE_SPOTLIGHT_L3_PRICE_ID, // $79/mo
  "Level 4 — Verified Elite Coach": null // Free - no checkout needed
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { tier, coachId, coachEmail } = JSON.parse(event.body);

    // Level 4 is free - just activate directly
    if (tier === "Level 4 — Verified Elite Coach") {
      return {
        statusCode: 200,
        body: JSON.stringify({ free: true })
      };
    }

    const priceId = SPOTLIGHT_PRICES[tier];
    if (!priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid tier or price not configured" })
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: coachEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        coach_id: coachId,
        type: "spotlight",
        tier: tier
      },
      success_url: `${process.env.APP_URL}/coach-dashboard.html?spotlight=success`,
      cancel_url: `${process.env.APP_URL}/coach-dashboard.html?spotlight=cancelled`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error("Stripe checkout error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
