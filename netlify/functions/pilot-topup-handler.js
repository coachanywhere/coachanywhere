const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  // ── Verify the webhook signature ────────────────────────────────────────
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET_PILOT_TOPUP
    );
  } catch(err) {
    console.error("[pilot-topup] signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook signature error: ${err.message}` };
  }

  // ── Only handle invoice.payment_succeeded ───────────────────────────────
  if(stripeEvent.type !== "invoice.payment_succeeded"){
    return { statusCode: 200, body: "ignored" };
  }

  const invoice = stripeEvent.data.object;

  // Pull the metadata from the parent subscription
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const meta = subscription.metadata || {};

  // ── Only pilot subscriptions get the top-up ────────────────────────────
  if(meta.is_pilot !== "true"){
    return { statusCode: 200, body: "not a pilot subscription" };
  }

  const coachId   = meta.coach_id;
  const athleteId = meta.athlete_id;
  const month     = new Date(invoice.created * 1000).toISOString().slice(0, 7);

  // Find the subscriptions row to link the audit log
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("coach_id",   coachId)
    .eq("is_pilot",   true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Idempotent insert into pilot_topups ────────────────────────────────
  // The (subscription_id, month) unique constraint means a retry of the same
  // webhook will get a unique-violation error, which we treat as "already done."
  const TOPUP_CENTS = 2080;
  const { data: topup, error: topupErr } = await supabase
    .from("pilot_topups")
    .insert({
      coach_id:           coachId,
      athlete_id:         athleteId,
      subscription_id:    subRow ? subRow.id : null,
      stripe_invoice_id:  invoice.id,
      month,
      amount_cents:       TOPUP_CENTS,
      status:             "pending"
    })
    .select()
    .single();

  if(topupErr){
    if(topupErr.code === "23505"){
      // Unique violation — top-up for this sub/month already exists. Done.
      return { statusCode: 200, body: "already processed" };
    }
    console.error("[pilot-topup] insert failed:", topupErr);
    return { statusCode: 500, body: topupErr.message };
  }

  // ── Resolve coach's connected Stripe account ────────────────────────────
  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", coachId)
    .maybeSingle();

  if(!coachProfile || !coachProfile.stripe_account_id){
    await supabase.from("pilot_topups").update({
      status: "failed",
      error_message: "coach has no stripe_account_id"
    }).eq("id", topup.id);
    return { statusCode: 200, body: "coach not connected" };
  }

  // ── Trigger the Connect transfer ────────────────────────────────────────
  try {
    const transfer = await stripe.transfers.create({
      amount:        TOPUP_CENTS,
      currency:      "aud",
      destination:   coachProfile.stripe_account_id,
      transfer_group:`pilot_topup_${topup.id}`,
      metadata: {
        coach_id:       coachId,
        athlete_id:     athleteId,
        subscription_id:subRow ? subRow.id : "",
        month,
        kind:           "pilot_topup"
      }
    });
    await supabase.from("pilot_topups").update({
      stripe_transfer_id: transfer.id,
      status:             "sent",
      sent_at:            new Date().toISOString()
    }).eq("id", topup.id);

    return { statusCode: 200, body: JSON.stringify({ transfer_id: transfer.id }) };

  } catch(err) {
    console.error("[pilot-topup] transfer failed:", err.message);
    await supabase.from("pilot_topups").update({
      status:        "failed",
      error_message: err.message
    }).eq("id", topup.id);
    return { statusCode: 500, body: err.message };
  }
};
