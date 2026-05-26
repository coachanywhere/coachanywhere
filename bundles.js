/* =============================================================================
   CoachAnywhere — Bundle pricing & tier helpers + Pilot config (manual payouts)
   ─────────────────────────────────────────────────────────────────────────────
   Single source of truth for:
     • Coach tier hourly rates  (L1=$48, L2=$72, L3=$108, L4=$144)
     • The 3 bundles every coach offers (contents)
     • The 12-cell price matrix (3 bundles × 4 tiers), derived by formula
     • PILOT mode: invite-only Founding Athlete Pilot ($49/mo, 4 reviews).
       Coaches receive $60/active-athlete/month, paid manually by bank
       transfer (not via Stripe Connect). This is the pilot-launch config;
       Stripe Connect will be wired up separately and the pilot migrated.

   Pricing formula (standard bundles):
     monthly_price = (bundle_hours × tier_rate)
                   + AI_component  ($49 on Standard/Pro, $0 on Starter)
                   + Fast_track    ($40 on Pro = 4×$10, $0 elsewhere)

   Pilot economics (manual-payout mode):
     Athlete pays $49/mo
       → lands 100% in CoachAnywhere Stripe account (no Connect split)
       → CoachAnywhere pays coach $60 via bank transfer within 24-48h of
         each successful invoice
       → A pilot_payouts row is created automatically by the webhook so the
         admin panel can show what's owed and let you mark each one paid.

   Stripe configuration:
     • 1 pilot Price ID — $49 AUD monthly recurring product in your Stripe
       dashboard. Set STRIPE_PILOT_PRICE_ID in Netlify env vars.
     • Webhook listens for invoice.payment_succeeded and writes pilot_payouts
       rows (not transfers).
     • No Connect dependency — when Connect ships post-pilot, we migrate.

   Loaded by:
     <script src="bundles.js"></script>
   Exposes (additive over previous version):
     window.BUNDLES, BUNDLE_ORDER, TIER_RATES, PRICE_MATRIX
     window.tierLevel, tierShort, tierHourlyRate, bundlePrice
     window.bundleRange, coachEarn, PLATFORM_COMMISSION
     window.PILOT_MODE
     window.PILOT_PAYOUT_MODE        - "manual" | "connect"
     window.PILOT_CONFIG
     window.getPilotOffer()
     window.isPilotAthlete(profile)
     window.isPilotCoach(profile)
============================================================================= */

(function (root) {
  "use strict";

  // ══════════════════════════════════════════════════════════════════════════
  // PILOT FLAGS
  // ══════════════════════════════════════════════════════════════════════════
  // PILOT_MODE = true        : invited athletes/coaches use the $49 pilot offer
  // PILOT_PAYOUT_MODE        : "manual" = bank transfers; "connect" = Stripe
  //                            Connect splits (post-pilot, once Connect ships)
  var PILOT_MODE        = true;
  var PILOT_PAYOUT_MODE = "manual";   // change to "connect" after Connect ships

  // Pilot economics - single source for every page that mentions $ amounts.
  var PILOT_CONFIG = {
    monthlyPrice:    49,        // what the athlete pays per month
    coachPayout:     60,        // what the coach receives per active athlete
    platformKeeps:   -11,       // negative = platform subsidises by $11
                                //   ($49 in - $60 to coach = -$11)
                                //   This is the cost-per-athlete to run the pilot.
    reviewsPerMonth: 4,         // hard cap per calendar month (soft-warned, not blocked)
    intakeCap:       20,        // athlete cap for the pilot phase
    refDiscountFrom: 60,        // "$60 value" reference price in marketing copy
    durationMonths:  6,         // founding member discounted period
    label:           "Founding Athlete Pilot",
    payoutCadence:   "per-invoice",  // pay within 24-48h of each invoice
    payoutMethod:    "bank-transfer" // BSB + account number from coach profile
  };

  // Pilot offer rendered as a bundle-shaped object so existing renderers
  // (select-coach.html, athlete-dashboard.html) can render it via the same
  // code path as standard bundles. id 'pilot' is what propagates through
  // checkout.html and subscriptions.bundle_id.
  function getPilotOffer() {
    return {
      id:        "pilot",
      name:      PILOT_CONFIG.label,
      summary:   "4 weekly skill reviews - invite-only founding cohort",
      hours:     1,
      aiCost:    0,
      fastTrack: 0,
      contents: [
        "4x Skill Review per month (1 per week)",
        "Personalised written feedback",
        "Direct messaging with your coach",
        "Cancel anytime",
        "Locked-in pilot pricing"
      ],
      price: function () { return PILOT_CONFIG.monthlyPrice; },
      isPilot: true
    };
  }

  function isPilotAthlete(profile) {
    if (!PILOT_MODE) return false;
    return profile && profile.pilot_status === "athlete";
  }
  function isPilotCoach(profile) {
    if (!PILOT_MODE) return false;
    return profile && profile.pilot_status === "coach";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STANDARD BUNDLES (unchanged from previous version)
  // ══════════════════════════════════════════════════════════════════════════
  var TIER_RATES = { 1: 48, 2: 72, 3: 108, 4: 144 };
  var TIER_SHORT = {
    1: "L1 Development",
    2: "L2 Representative",
    3: "L3 State",
    4: "L4 Elite"
  };

  var BUNDLES = {
    starter: {
      id: "starter", name: "Starter",
      summary: "50 minutes of coach time per month",
      hours: 50 / 60, aiCost: 0, fastTrack: 0,
      contents: [
        "2x Skill Review (15 min each)",
        "1x Session Summary Notes (10 min)",
        "Direct messaging (10 min/mo)"
      ],
      price: function (rate) { return computePrice("starter", rate); }
    },
    standard: {
      id: "standard", name: "Standard",
      summary: "2 hours of coach time + AI overlay",
      hours: 2, aiCost: 49, fastTrack: 0,
      contents: [
        "4x Skill Review (15 min each)",
        "1x 30-min Game Review",
        "2x Session Summary Notes",
        "Direct messaging",
        "Biomechanics / AI overlay"
      ],
      price: function (rate) { return computePrice("standard", rate); }
    },
    pro: {
      id: "pro", name: "Pro",
      summary: "3h 20m coach time + AI + Premium Fast Track",
      hours: 3 + 20 / 60, aiCost: 49, fastTrack: 40,
      contents: [
        "4x Skill Review",
        "1x 60-min Game Review",
        "1x 30-min Zoom session",
        "4x Session Summary Notes",
        "Direct messaging",
        "Biomechanics / AI overlay",
        "4x Premium Fast Track Review (24h turnaround)"
      ],
      price: function (rate) { return computePrice("pro", rate); }
    }
  };

  var BUNDLE_ORDER = ["starter", "standard", "pro"];

  function resolveRate(levelOrRate) {
    if (!levelOrRate) return TIER_RATES[1];
    var n = Number(levelOrRate);
    if (n >= 1 && n <= 4 && Number.isInteger(n)) return TIER_RATES[n];
    return n;
  }

  function computePrice(bundleKey, levelOrRate) {
    var b = BUNDLES[bundleKey];
    if (!b) return 0;
    var rate = resolveRate(levelOrRate);
    return Math.round(b.hours * rate + b.aiCost + b.fastTrack);
  }

  var PRICE_MATRIX = {};
  BUNDLE_ORDER.forEach(function (k) {
    PRICE_MATRIX[k] = {};
    [1, 2, 3, 4].forEach(function (lvl) {
      PRICE_MATRIX[k][lvl] = computePrice(k, lvl);
    });
  });

  function tierLevel(selectedTier) {
    if (!selectedTier) return 1;
    var m = String(selectedTier).match(/Level\s*(\d)/i);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 1 && n <= 4) return n;
    }
    return 1;
  }

  function tierShort(selectedTier) {
    return TIER_SHORT[tierLevel(selectedTier)] || "Coach";
  }

  function tierHourlyRate(profile) {
    if (!profile) return null;
    if (profile.tier_hourly_rate != null && profile.tier_hourly_rate !== "") {
      var n = Number(profile.tier_hourly_rate);
      if (!isNaN(n) && n > 0) return n;
    }
    var lvl = tierLevel(profile.selected_tier);
    return TIER_RATES[lvl] || null;
  }

  function bundlePrice(bundleKey, levelOrRate) {
    if (bundleKey === "pilot") return PILOT_CONFIG.monthlyPrice;
    return computePrice(bundleKey, levelOrRate);
  }

  var PLATFORM_COMMISSION = 0.20;
  function coachEarn(bundleKey, levelOrRate) {
    if (bundleKey === "pilot") return PILOT_CONFIG.coachPayout;
    return Math.round(computePrice(bundleKey, levelOrRate) * (1 - PLATFORM_COMMISSION));
  }

  function bundleRange(bundleKey) {
    if (bundleKey === "pilot") {
      return { lo: PILOT_CONFIG.monthlyPrice, hi: PILOT_CONFIG.monthlyPrice,
               label: "$" + PILOT_CONFIG.monthlyPrice };
    }
    var lo = PRICE_MATRIX[bundleKey][1];
    var hi = PRICE_MATRIX[bundleKey][4];
    return { lo: lo, hi: hi, label: "$" + lo + "-$" + hi };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ══════════════════════════════════════════════════════════════════════════
  root.BUNDLES         = BUNDLES;
  root.BUNDLE_ORDER    = BUNDLE_ORDER;
  root.TIER_RATES      = TIER_RATES;
  root.PRICE_MATRIX    = PRICE_MATRIX;
  root.tierLevel       = tierLevel;
  root.tierShort       = tierShort;
  root.tierHourlyRate  = tierHourlyRate;
  root.bundlePrice     = bundlePrice;
  root.bundleRange     = bundleRange;
  root.coachEarn       = coachEarn;
  root.PLATFORM_COMMISSION = PLATFORM_COMMISSION;

  // Pilot exports
  root.PILOT_MODE         = PILOT_MODE;
  root.PILOT_PAYOUT_MODE  = PILOT_PAYOUT_MODE;
  root.PILOT_CONFIG       = PILOT_CONFIG;
  root.getPilotOffer      = getPilotOffer;
  root.isPilotAthlete     = isPilotAthlete;
  root.isPilotCoach       = isPilotCoach;

})(typeof window !== "undefined" ? window : this);
