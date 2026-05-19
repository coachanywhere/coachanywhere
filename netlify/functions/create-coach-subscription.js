// netlify/functions/create-coach-subscription.js
// Creates a Stripe Checkout for an athlete subscribing to a coach package

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { packageName, packagePrice, coachName, coachId, athleteId, athleteEmail } = JSON.parse(event.body);

    // Create a one-time price on the fly (or use pre-created price IDs)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: athleteEmail,
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: {
            name: `${packageName} — ${coachName}`,
            description: `CoachAnywhere coaching package with ${coachName}`
          },
          unit_amount: packagePrice * 100 // Stripe uses cents
        },
        quantity: 1
      }],
      metadata: {
        type: "coach_package",
        coach_id: coachId,
        athlete_id: athleteId,
        package_name: packageName,
        package_price: packagePrice
      },
      success_url: `${process.env.APP_URL}/athlete-dashboard.html?payment=success`,
      cancel_url: `${process.env.APP_URL}/select-coach.html?payment=cancelled`,
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
