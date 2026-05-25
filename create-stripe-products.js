// ═══════════════════════════════════════════════════════════════
// CoachAnywhere — Create ALL Stripe Products in One Go
// ═══════════════════════════════════════════════════════════════
//
// HOW TO RUN:
// 1. Make sure Node.js is installed → type: node --version
// 2. In your terminal, navigate to the folder this file is in
// 3. Run: npm install stripe
// 4. Run with your Stripe secret key in the env, e.g.:
//      PowerShell:  $env:STRIPE_SECRET_KEY="sk_test_..."; node create-stripe-products.js
//      bash:        STRIPE_SECRET_KEY=sk_test_... node create-stripe-products.js
// 5. Copy the Price IDs printed at the end into Netlify env vars
//
// ═══════════════════════════════════════════════════════════════

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error("✖ STRIPE_SECRET_KEY env var is not set. See instructions at the top of this file.");
  process.exit(1);
}
const stripe = require("stripe")(STRIPE_KEY);

async function createProduct(name, description, prices) {
  const product = await stripe.products.create({ name, description });
  const createdPrices = [];
  for (const p of prices) {
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.amount,
      currency: "aud",
      ...(p.recurring ? { recurring: { interval: "month" } } : {}),
      nickname: p.nickname
    });
    createdPrices.push({
      nickname: p.nickname,
      priceId: price.id,
      amount: "$" + (p.amount / 100).toFixed(2),
      type: p.recurring ? "recurring" : "one-off"
    });
  }
  return { name, prices: createdPrices };
}

async function run() {
  console.log("\n🚀 Creating all CoachAnywhere Stripe products...\n");
  const results = [];

  try {

    // ── 1. COACH PLATFORM SUBSCRIPTIONS ──────────────────────
    console.log("1/5 Coach platform subscriptions...");

    results.push(await createProduct(
      "Coach Platform — Level 1 Development",
      "Monthly platform fee for Level 1 Development Coaches",
      [
        { nickname: "L1 Monthly",            amount: 4900, recurring: true },
        { nickname: "L1 Foundation Monthly", amount: 3900, recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Coach Platform — Level 2 Representative",
      "Monthly platform fee for Level 2 Representative Coaches",
      [
        { nickname: "L2 Monthly",            amount: 9900, recurring: true },
        { nickname: "L2 Foundation Monthly", amount: 7900, recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Coach Platform — Level 3 State",
      "Monthly platform fee for Level 3 State Coaches",
      [
        { nickname: "L3 Monthly",            amount: 19900, recurring: true },
        { nickname: "L3 Foundation Monthly", amount: 15900, recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Coach Platform — Level 4 Elite",
      "Monthly platform fee for Level 4 Elite Coaches",
      [
        { nickname: "L4 Monthly", amount: 39900, recurring: true }
      ]
    ));

    // ── 2. SPOTLIGHT PLACEMENT ────────────────────────────────
    console.log("2/5 Spotlight placement...");

    results.push(await createProduct(
      "Spotlight — Development Coach",
      "Priority top placement on Find a Coach for Level 1 coaches",
      [{ nickname: "Spotlight L1 Monthly", amount: 2900, recurring: true }]
    ));

    results.push(await createProduct(
      "Spotlight — Representative Coach",
      "Priority top placement on Find a Coach for Level 2 coaches",
      [{ nickname: "Spotlight L2 Monthly", amount: 4900, recurring: true }]
    ));

    results.push(await createProduct(
      "Spotlight — State Coach",
      "Priority top placement on Find a Coach for Level 3 coaches",
      [{ nickname: "Spotlight L3 Monthly", amount: 7900, recurring: true }]
    ));

    // ── 3. ATHLETE BUNDLE SUBSCRIPTIONS (monthly, priced by coach tier) ──
    // These 12 SKUs (3 bundles × 4 tiers) are the ACTIVE athlete product.
    // Every coach offers the same 3 standard bundles; the price is set by the
    // coach's tier hourly rate (L1 $48 / L2 $72 / L3 $108 / L4 $144).
    //
    // PRICE DERIVATION (so future re-pricing is trivial — edit the inputs, not
    // 12 magic numbers):
    //   Starter  = rate × (50/60)                              [50 min coach time]
    //   Standard = rate × 2          + $49 AI overlay          [2 hr + AI]
    //   Pro      = rate × (200/60)   + $49 AI + $40 fast-track [3h20m + AI + 4×$10]
    // Verified: every cell below equals the agreed pricing matrix exactly.
    console.log("3/5 Athlete bundle subscriptions...");

    const RATE = { L1: 48, L2: 72, L3: 108, L4: 144 };
    const AI_OVERLAY = 4900;          // $49 flat (cents)
    const FAST_TRACK = 4 * 1000;      // 4 × $10 (cents)
    const c = (dollars) => Math.round(dollars * 100);
    const starter  = (r) => c(r * (50 / 60));               // 40 / 60 / 90 / 120
    const standard = (r) => c(r * 2) + AI_OVERLAY;          // 145 / 193 / 265 / 337
    const pro      = (r) => c(r * (200 / 60)) + AI_OVERLAY + FAST_TRACK; // 249 / 329 / 449 / 569

    results.push(await createProduct(
      "Athlete Bundle — Starter (Monthly)",
      "2× Skill Review (15 min), 1× Session Summary Notes (10 min), direct messaging. 50 min coach time/mo. Priced by coach tier.",
      [
        { nickname: "Bundle Starter L1", amount: starter(RATE.L1), recurring: true },
        { nickname: "Bundle Starter L2", amount: starter(RATE.L2), recurring: true },
        { nickname: "Bundle Starter L3", amount: starter(RATE.L3), recurring: true },
        { nickname: "Bundle Starter L4", amount: starter(RATE.L4), recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Athlete Bundle — Standard (Monthly)",
      "4× Skill Review, 1× 30-min Game Review, 2× Session Summary Notes, direct messaging, biomechanics/AI overlay. 2 hr coach time/mo + AI. Priced by coach tier.",
      [
        { nickname: "Bundle Standard L1", amount: standard(RATE.L1), recurring: true },
        { nickname: "Bundle Standard L2", amount: standard(RATE.L2), recurring: true },
        { nickname: "Bundle Standard L3", amount: standard(RATE.L3), recurring: true },
        { nickname: "Bundle Standard L4", amount: standard(RATE.L4), recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Athlete Bundle — Pro (Monthly)",
      "4× Skill Review, 1× 60-min Game Review, 1× 30-min Zoom, 4× Session Summary Notes, direct messaging, AI overlay, 4× Premium Fast Track (24h). 3h20m coach time/mo + AI + fast-track. Priced by coach tier.",
      [
        { nickname: "Bundle Pro L1", amount: pro(RATE.L1), recurring: true },
        { nickname: "Bundle Pro L2", amount: pro(RATE.L2), recurring: true },
        { nickname: "Bundle Pro L3", amount: pro(RATE.L3), recurring: true },
        { nickname: "Bundle Pro L4", amount: pro(RATE.L4), recurring: true }
      ]
    ));

    // ── 3b. LEGACY ATHLETE ONE-OFF PACKAGES — PRESERVED FOR REFERENCE ──
    // Replaced by the 3 monthly bundles above. Kept (commented out) so the old
    // Starter/Standard/Pro/Elite/Premium $15–$199 one-off SKUs and their
    // STRIPE_PKG_* env mappings remain on record. Do NOT re-enable without
    // a deliberate decision — the bundles are the active product.
    /*
    results.push(await createProduct(
      "Coaching Package — Starter",
      "Single skill clip review with written feedback. Coach earns $12.",
      [{ nickname: "Starter $15", amount: 1500, recurring: false }]
    ));
    results.push(await createProduct(
      "Coaching Package — Standard",
      "Up to 15 min session footage reviewed. Coach earns $28.",
      [{ nickname: "Standard $35", amount: 3500, recurring: false }]
    ));
    results.push(await createProduct(
      "Coaching Package — Pro",
      "Up to 30 min game or session reviewed. Coach earns $60.",
      [{ nickname: "Pro $75", amount: 7500, recurring: false }]
    ));
    results.push(await createProduct(
      "Coaching Package — Elite",
      "Full game reviewed with action plan. Coach earns $96.",
      [{ nickname: "Elite $120", amount: 12000, recurring: false }]
    ));
    results.push(await createProduct(
      "Coaching Package — Premium",
      "Full game review + Zoom session + training plan. Coach earns $159.",
      [{ nickname: "Premium $199", amount: 19900, recurring: false }]
    ));
    */

    // ── 4. COACH MENTOR PROGRAM ───────────────────────────────
    console.log("4/5 Coach mentor subscriptions...");

    results.push(await createProduct(
      "Coach Mentor — Monthly Mentorship",
      "1-on-1 session review plus weekly group Zoom access with an elite mentor coach",
      [
        { nickname: "Mentor Monthly $99",  amount:  9900, recurring: true },
        { nickname: "Mentor Monthly $129", amount: 12900, recurring: true },
        { nickname: "Mentor Monthly $149", amount: 14900, recurring: true },
        { nickname: "Mentor Monthly $199", amount: 19900, recurring: true }
      ]
    ));

    results.push(await createProduct(
      "Coach Mentor — Single Session Review",
      "One coaching session reviewed by a mentor coach with full annotations and written feedback",
      [{ nickname: "Mentor Single Session", amount: 7500, recurring: false }]
    ));

    // ── 5. THE LOCKER ROOM ────────────────────────────────────
    console.log("5/5 The Locker Room sessions...");

    results.push(await createProduct(
      "The Locker Room — All Access Pass",
      "Unlimited access to all live sessions and recordings. Coach and Athlete streams.",
      [{ nickname: "All Access Monthly $49", amount: 4900, recurring: true }]
    ));

    results.push(await createProduct(
      "The Locker Room — Session Ticket Entry",
      "Single ticket to one Locker Room live session",
      [{ nickname: "Session Ticket $29", amount: 2900, recurring: false }]
    ));

    results.push(await createProduct(
      "The Locker Room — Session Ticket Standard",
      "Single ticket to a standard Locker Room live session",
      [{ nickname: "Session Ticket $49", amount: 4900, recurring: false }]
    ));

    results.push(await createProduct(
      "The Locker Room — Session Ticket Premium",
      "Single ticket to a premium Locker Room live session",
      [{ nickname: "Session Ticket $79", amount: 7900, recurring: false }]
    ));

    // ── PRINT RESULTS ─────────────────────────────────────────
    console.log("\n\n✅ ALL PRODUCTS CREATED\n");
    console.log("═══════════════════════════════════════════════════════════════════");

    for (const product of results) {
      console.log(`\n📦  ${product.name}`);
      for (const price of product.prices) {
        console.log(`     ${price.nickname.padEnd(38)} ${price.amount.padEnd(8)} ${price.type.padEnd(12)} → ${price.priceId}`);
      }
    }

    // ── KEY ENV VARS ──────────────────────────────────────────
    console.log("\n\n═══════════════════════════════════════════════════════════════════");
    console.log("NETLIFY ENVIRONMENT VARIABLES — add these to Netlify now:");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    for (const product of results) {
      for (const price of product.prices) {
        const map = {
          "Spotlight L1 Monthly":        "STRIPE_SPOTLIGHT_L1_PRICE_ID",
          "Spotlight L2 Monthly":        "STRIPE_SPOTLIGHT_L2_PRICE_ID",
          "Spotlight L3 Monthly":        "STRIPE_SPOTLIGHT_L3_PRICE_ID",
          "All Access Monthly $49":      "STRIPE_LOCKER_ROOM_PASS_PRICE_ID",
          "Session Ticket $29":          "STRIPE_LOCKER_ROOM_TICKET_ENTRY_PRICE_ID",
          "Session Ticket $49":          "STRIPE_LOCKER_ROOM_TICKET_STANDARD_PRICE_ID",
          "Session Ticket $79":          "STRIPE_LOCKER_ROOM_TICKET_PREMIUM_PRICE_ID",
          "L1 Monthly":                  "STRIPE_COACH_L1_PRICE_ID",
          "L2 Monthly":                  "STRIPE_COACH_L2_PRICE_ID",
          "L3 Monthly":                  "STRIPE_COACH_L3_PRICE_ID",
          "L4 Monthly":                  "STRIPE_COACH_L4_PRICE_ID",
          "L1 Foundation Monthly":       "STRIPE_COACH_L1_FOUNDATION_PRICE_ID",
          "L2 Foundation Monthly":       "STRIPE_COACH_L2_FOUNDATION_PRICE_ID",
          "L3 Foundation Monthly":       "STRIPE_COACH_L3_FOUNDATION_PRICE_ID",
          // ACTIVE athlete product — the 12 bundle SKUs (3 bundles × 4 tiers):
          "Bundle Starter L1":           "STRIPE_BUNDLE_STARTER_L1",
          "Bundle Starter L2":           "STRIPE_BUNDLE_STARTER_L2",
          "Bundle Starter L3":           "STRIPE_BUNDLE_STARTER_L3",
          "Bundle Starter L4":           "STRIPE_BUNDLE_STARTER_L4",
          "Bundle Standard L1":          "STRIPE_BUNDLE_STANDARD_L1",
          "Bundle Standard L2":          "STRIPE_BUNDLE_STANDARD_L2",
          "Bundle Standard L3":          "STRIPE_BUNDLE_STANDARD_L3",
          "Bundle Standard L4":          "STRIPE_BUNDLE_STANDARD_L4",
          "Bundle Pro L1":               "STRIPE_BUNDLE_PRO_L1",
          "Bundle Pro L2":               "STRIPE_BUNDLE_PRO_L2",
          "Bundle Pro L3":               "STRIPE_BUNDLE_PRO_L3",
          "Bundle Pro L4":               "STRIPE_BUNDLE_PRO_L4",
          // LEGACY athlete one-off SKUs — preserved for reference, NOT created
          // anymore (the products above are commented out). Kept so the env
          // names are on record:
          //   "Starter $15":  "STRIPE_PKG_STARTER_PRICE_ID",
          //   "Standard $35": "STRIPE_PKG_STANDARD_PRICE_ID",
          //   "Pro $75":      "STRIPE_PKG_PRO_PRICE_ID",
          //   "Elite $120":   "STRIPE_PKG_ELITE_PRICE_ID",
          //   "Premium $199": "STRIPE_PKG_PREMIUM_PRICE_ID",
          "Mentor Single Session":       "STRIPE_MENTOR_SESSION_PRICE_ID",
          "Mentor Monthly $99":          "STRIPE_MENTOR_99_PRICE_ID",
          "Mentor Monthly $129":         "STRIPE_MENTOR_129_PRICE_ID",
          "Mentor Monthly $149":         "STRIPE_MENTOR_149_PRICE_ID",
          "Mentor Monthly $199":         "STRIPE_MENTOR_199_PRICE_ID",
        };
        if (map[price.nickname]) {
          console.log(`${map[price.nickname]}=${price.priceId}`);
        }
      }
    }

    console.log("\n✅ Done! Check your Stripe dashboard to confirm all products.");
    console.log("Next: Set up the Stripe webhook → Step 4\n");

  } catch (err) {
    console.error("\n❌ Error creating products:", err.message);
    if (err.message.includes("No such")) {
      console.error("Check your Stripe secret key is correct.");
    }
  }
}

run();
