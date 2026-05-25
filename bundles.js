/* bundles.js
 * Single source of truth for the 3 standard athlete bundles + tier pricing.
 * Shared by coach-dashboard.html (My Packages), select-coach.html (athlete
 * subscribe), and the for-athletes / for-coaches marketing pages.
 *
 * PRICING (monthly, AUD) = coach tier hourly rate × bundle coach-time + flat fees:
 *   Starter  = rate × (50/60)
 *   Standard = rate × 2          + $49 AI overlay
 *   Pro      = rate × (200/60)   + $49 AI + $40 (4× Premium Fast Track @ $10)
 * Tier hourly rates: L1 $48 / L2 $72 / L3 $108 / L4 $144.
 * Final pricing TBC — see pricing review spreadsheet.
 */
(function (g) {
  "use strict";

  var BUNDLES = {
    starter: {
      key: "starter", name: "Starter",
      summary: "50 min coach time / month",
      contents: [
        "2× Skill Review (15 min each)",
        "1× Session Summary Notes (10 min)",
        "Direct messaging"
      ],
      price: function (r) { return Math.round(r * (50 / 60)); }
    },
    standard: {
      key: "standard", name: "Standard",
      summary: "2 hr coach time / month + AI overlay",
      contents: [
        "4× Skill Review (15 min each)",
        "1× 30-min Game Review",
        "2× Session Summary Notes",
        "Direct messaging",
        "Biomechanics / AI overlay included"
      ],
      price: function (r) { return Math.round(r * 2) + 49; }
    },
    pro: {
      key: "pro", name: "Pro",
      summary: "3 hr 20 min coach time / month + AI + fast track",
      contents: [
        "4× Skill Review",
        "1× 60-min Game Review",
        "1× 30-min Zoom session",
        "4× Session Summary Notes",
        "Direct messaging",
        "Biomechanics / AI overlay included",
        "4× Premium Fast Track Review (24h turnaround)"
      ],
      price: function (r) { return Math.round(r * (200 / 60)) + 49 + 40; }
    }
  };
  var BUNDLE_ORDER = ["starter", "standard", "pro"];

  // Derive the hourly rate from either tier_hourly_rate or the selected_tier
  // string ("Level 3 …"). Returns null if unknown.
  function tierHourlyRate(profile) {
    if (profile && profile.tier_hourly_rate) return Number(profile.tier_hourly_rate);
    var t = (profile && profile.selected_tier) || "";
    if (/4/.test(t)) return 144;
    if (/3/.test(t)) return 108;
    if (/2/.test(t)) return 72;
    if (/1/.test(t)) return 48;
    return null;
  }
  // Canonical short tier label for display.
  function tierShort(selected_tier) {
    var t = selected_tier || "";
    if (/4/.test(t)) return "L4 Elite";
    if (/3/.test(t)) return "L3 State";
    if (/2/.test(t)) return "L2 Representative";
    if (/1/.test(t)) return "L1 Development";
    return "Coach";
  }
  function tierLevel(selected_tier) {
    var m = String(selected_tier || "").match(/[1-4]/);
    return m ? Number(m[0]) : null;
  }
  function bundlePrice(key, rate) {
    return (BUNDLES[key] && rate) ? BUNDLES[key].price(rate) : null;
  }

  g.BUNDLES = BUNDLES;
  g.BUNDLE_ORDER = BUNDLE_ORDER;
  g.bundlePrice = bundlePrice;
  g.tierHourlyRate = tierHourlyRate;
  g.tierShort = tierShort;
  g.tierLevel = tierLevel;
})(window);
