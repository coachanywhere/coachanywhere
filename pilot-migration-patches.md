# CoachAnywhere — Pilot Migration Patches

Apply after dropping in the four new/updated files:
- `bundles.js` (overwrite — adds PILOT_MODE config on top of bundle infrastructure)
- `pilot-migration.sql` (run in Supabase SQL Editor)
- `pilot.html` (new — athlete-facing invite page)
- `pilot-coaches.html` (new — coach-facing invite page)

Then apply patches ① through ⑨ below, in order.

---

## ① PATCH — `athlete-signup.html`

When `?pilot=athlete&code=XXX` is present in the URL: show a founding-athlete badge in the header, validate the code via the RPC after Supabase Auth signUp succeeds, and set `profiles.pilot_status = 'athlete'`.

### 1a. Add the bundles.js script tag

**Find** (around line 11, after the supabase script):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="focus-areas.js"></script>
```

**Replace with:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="focus-areas.js"></script>
<script src="bundles.js"></script>
```

### 1b. Add a pilot banner to the top of the form

Find the opening `<form>` or first `<h1>`/hero block in the body (the page's main heading). **Immediately before** that block, insert:

```html
<!-- Founding Athlete Pilot banner — only visible when ?pilot=athlete is set. -->
<div id="pilotBanner" style="display:none;max-width:560px;margin:18px auto 0;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,rgba(250,204,21,.14),rgba(217,119,6,.06));border:1px solid rgba(250,204,21,.35);">
  <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#facc15;text-transform:uppercase;margin-bottom:4px;">Founding Athlete · Pilot Invite</div>
  <div style="font-size:13px;color:rgba(232,237,245,.85);line-height:1.55;">
    Your invite code <strong id="pilotBannerCode" style="color:#fbbf24;font-family:ui-monospace,monospace;">…</strong> will be claimed when you create your account. After signup you'll be subscribed at the pilot rate of <strong>$49/mo</strong>.
  </div>
</div>
```

### 1c. Detect the pilot params on page load

Find the existing init/DOMContentLoaded block (search for `DOMContentLoaded` or the inline IIFE that runs at the bottom of the script). **At the top of that init block**, add:

```js
// ── PILOT MODE DETECTION ──────────────────────────────────────────────
// If the user arrived from pilot.html with ?pilot=athlete&code=XXX, show the
// founding-athlete banner. The code is claimed at signup-submit time, not
// here, so we don't lock codes for users who never finish.
const _pilotParams = new URLSearchParams(window.location.search);
const _isPilotSignup = _pilotParams.get("pilot") === "athlete";
const _pilotCode = (_pilotParams.get("code") || "").toUpperCase();
if(_isPilotSignup && _pilotCode){
  const banner = document.getElementById("pilotBanner");
  const codeEl = document.getElementById("pilotBannerCode");
  if(banner){ banner.style.display = "block"; }
  if(codeEl){ codeEl.textContent = _pilotCode; }
}
```

### 1d. Validate and claim the code at signup

Find the signup submit handler (search for `auth.signUp` or the function that submits the form — likely around line 559–610 of the current file).

**After** the line that successfully creates the profile row (look for `sb.from("profiles").insert(...)` or similar — the existing `if (profileError)` block), **add this block immediately after**:

```js
// ── PILOT CODE CLAIM ──────────────────────────────────────────────────
// Only runs if the URL says ?pilot=athlete&code=XXX. We call the RPC which
// atomically validates + marks the code used + checks the 20-athlete cap.
// On success, we stamp profiles.pilot_status='athlete'. On failure, we
// surface the reason but DON'T undo the signup — the user can contact
// support to manually claim a code.
if(_isPilotSignup && _pilotCode){
  try {
    const { data: claimData, error: claimErr } = await sb.rpc(
      "validate_and_claim_pilot_code",
      { p_code: _pilotCode, p_user_id: data.user.id }
    );
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if(claimErr || !claim || !claim.ok){
      const reason = (claim && claim.reason) || (claimErr && claimErr.message) || "unknown";
      console.warn("[pilot] code claim failed:", reason);
      // Show a soft warning but let signup proceed — they can be manually
      // upgraded by support after the fact.
      alert("Your invite code couldn't be validated (" + reason + "). " +
            "Your account has been created — please contact support to " +
            "activate your pilot access.");
    } else {
      // Stamp pilot status so dashboards/select-coach/etc. know this user
      // is on the pilot offer.
      await sb.from("profiles").update({
        pilot_status:     "athlete",
        pilot_started_at: new Date().toISOString()
      }).eq("id", data.user.id);
    }
  } catch(e) {
    console.warn("[pilot] code claim threw:", e);
  }
}
```

Make sure this block runs **inside the same `async` function** that does the signup and **after** the profile insert. If your existing code redirects immediately after the profile insert, move that redirect to **after** this block.

---

## ② PATCH — `coach-signup.html`

When `?pilot=coach` is present: show a founding-coach badge, on profile creation set `pilot_status='coach'`. No code needed (coaches are pre-vetted off-platform).

### 2a. Add the bundles.js script tag

**Find** (line 11):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Replace with:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="bundles.js"></script>
```

### 2b. Add a pilot banner

**Immediately before the main `<form>` or hero heading**, insert:

```html
<!-- Founding Pilot Coach banner — only visible when ?pilot=coach is set. -->
<div id="pilotBanner" style="display:none;max-width:520px;margin:18px auto 0;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(180,83,9,.06));border:1px solid rgba(245,158,11,.35);">
  <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#fbbf24;text-transform:uppercase;margin-bottom:4px;">Founding Pilot Coach</div>
  <div style="font-size:13px;color:rgba(232,237,245,.85);line-height:1.55;">
    You've been invited as one of four pilot coaches. Free platform access during the pilot. <strong>$60/month per active athlete</strong>, paid via Stripe Connect.
  </div>
</div>
```

### 2c. Detect the pilot param and stamp the profile

Find the existing init logic. **Add at the top of init**:

```js
const _isPilotCoach = new URLSearchParams(window.location.search).get("pilot") === "coach";
if(_isPilotCoach){
  const banner = document.getElementById("pilotBanner");
  if(banner) banner.style.display = "block";
}
```

In the signup-submit handler, find where the user gets created (the `auth.signUp` call). The existing code likely sets `user_metadata.role = "coach"` and an `emailRedirectTo` — leave those alone. **Find the `signUp` options block** and add `pilot: true` to `user_metadata` when `_isPilotCoach` is true:

```js
// Existing signUp call — modify the options.data block:
const { data, error } = await sb.auth.signUp({
  email,
  password,
  options: {
    data: {
      role: "coach",
      first_name: firstName,
      last_name:  lastName,
      mobile,
      pilot_status: _isPilotCoach ? "coach" : null   // ← ADD THIS LINE
    },
    emailRedirectTo: new URL("coach-profile-setup.html", window.location.href).toString()
  }
});
```

Then, in the success path after the user is created (or after they verify their email and we have a session), the `coach-profile-setup.html` page will read this from `user_metadata` and persist it. We handle that in Patch ③.

---

## ③ PATCH — `coach-profile-setup.html`

When the coach has `pilot_status='coach'`: hide the bundle-toggle UI (replace with a pilot lock card), skip the Stripe tier-checkout step at submit, jump straight to `profile_status='Live'`.

### 3a. Read pilot_status from user_metadata on init

Find the init block that loads the existing profile (`sb.from("profiles").select`). **After** that load, **before** any bundle-toggle rendering:

```js
// ── PILOT COACH DETECTION ─────────────────────────────────────────────
// pilot_status is set either by user_metadata at signUp time (Patch ②)
// or directly on the profile row. We read both so a coach who was
// onboarded by hand also gets pilot treatment.
const _userMeta = (session.user && session.user.user_metadata) || {};
const _isPilotCoach = (profile && profile.pilot_status === "coach")
                   || (_userMeta.pilot_status === "coach");

// If this is a fresh pilot coach (metadata says pilot, but profile row
// doesn't yet), persist it now so subsequent loads are consistent.
if(_isPilotCoach && (!profile || profile.pilot_status !== "coach")){
  await sb.from("profiles").update({
    pilot_status:     "coach",
    pilot_started_at: new Date().toISOString()
  }).eq("id", session.user.id);
  if(profile) profile.pilot_status = "coach";
}
```

### 3b. Replace the bundle-toggle render with a pilot lock card

In Patch ② of the bundle migration, you already wrote a `renderPackages()` that renders the 3 bundles. **Modify it** to short-circuit for pilot coaches:

**Find** (the function `renderPackages()`):
```js
  // ── BUNDLES ── (renders the 3 bundles with the coach's tier-priced amount)
  function renderPackages(){
    const lvl = window.tierLevel(selectedTier.id);
    const rate = window.TIER_RATES[lvl];
    const container = document.getElementById("pkgToggleList");
    container.innerHTML = window.BUNDLE_ORDER.map(key => {
```

**Replace the opening of the function with:**
```js
  // ── BUNDLES ── (renders the 3 bundles with the coach's tier-priced amount)
  // PILOT: pilot coaches see a single locked card instead of the 3 toggles.
  // Athletes on the pilot offer always subscribe to the flat $49 pilot price.
  function renderPackages(){
    const container = document.getElementById("pkgToggleList");
    if(window.isPilotCoach && window.isPilotCoach(profile || {pilot_status: _isPilotCoach ? "coach" : null})){
      container.innerHTML = `
        <div style="padding:18px 20px;border-radius:12px;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(180,83,9,.04));border:1px solid rgba(245,158,11,.3);">
          <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">Founding Pilot · Locked</div>
          <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px;">Founding Athlete Pilot — $49/mo</div>
          <div style="font-size:13px;color:rgba(232,237,245,.7);line-height:1.6;margin-bottom:10px;">All your athletes are on the founding pilot offer. <strong style="color:#fbbf24;">You receive $60/month per active athlete</strong> (your 80% share + a $20.80 platform top-up from CoachAnywhere). The standard 3-bundle marketplace opens after the pilot.</div>
          <div style="font-size:12px;color:rgba(232,237,245,.65);">4 weekly skill reviews per athlete · paid via Stripe Connect monthly</div>
        </div>`;
      return;
    }
    const lvl = window.tierLevel(selectedTier.id);
    const rate = window.TIER_RATES[lvl];
    container.innerHTML = window.BUNDLE_ORDER.map(key => {
```

(Keep the rest of the function unchanged — the `.map(...).join("")` ending and the `togglePackage` function below it stay the same.)

### 3c. Skip the Stripe tier-checkout at submit for pilot coaches

Find the submit handler (search for `submitProfile` or `create-coach-tier-checkout`). The function currently fires a Stripe Checkout for the tier subscription. For pilot coaches we skip that and go straight to "Live."

**Find** the part of `submitProfile()` that calls the Stripe checkout function (likely a `fetch("/.netlify/functions/create-coach-tier-checkout"...)` call). **Wrap that whole block** with a pilot bypass:

```js
// PILOT bypass — pilot coaches don't pay a tier subscription. We mark
// the profile Live immediately and route to the dashboard.
if(_isPilotCoach){
  await sb.from("profiles").update({
    profile_status: "Live",
    pilot_status:   "coach"
  }).eq("id", session.user.id);
  window.location.href = "coach-dashboard.html";
  return;
}

// Existing Stripe tier-checkout call follows (unchanged):
const resp = await fetch("/.netlify/functions/create-coach-tier-checkout", {
  // ... existing body
});
// ... existing handling
```

### 3d. Hide the billing-cycle section for pilot coaches

The billing-cycle radio (monthly/fortnightly) is irrelevant for pilot coaches since they don't pay. Find `showBillingAndPackages()` or wherever `billingSection` is shown. **At the start** of that function:

```js
// PILOT: hide billing section for pilot coaches (no tier subscription).
if(_isPilotCoach){
  document.getElementById("billingSection").style.display = "none";
} else {
  document.getElementById("billingSection").style.display = "block";
}
```

---

## ④ PATCH — `select-coach.html`

When the current athlete has `pilot_status='athlete'`: replace the 3-bundle picker on the coach detail modal with a single pilot offer card.

### 4a. Read athlete's pilot status on init

Find the `init()` function that loads `currentUser` and their profile. **After** the profile is loaded:

```js
// ── PILOT ATHLETE DETECTION ──────────────────────────────────────────
// Determines whether the bundle picker on the coach detail modal shows
// the standard 3 bundles or the single pilot offer.
let _athleteProfile = null;
try {
  const { data: ap } = await sb.from("profiles")
    .select("pilot_status").eq("id", currentUser.id).maybeSingle();
  _athleteProfile = ap;
} catch(e) {}
const _isPilotAthlete = window.isPilotAthlete && window.isPilotAthlete(_athleteProfile);
```

### 4b. Modify the bundle picker in showDetail to render the pilot card

Find the section in `showDetail(id)` that renders the bundle picker. Currently around line 742:

**Find:**
```js
  const bundlesHtml = window.BUNDLES ? _order.filter(k=>_active.indexOf(k)!==-1).map(k=>{
    const b=window.BUNDLES[k]; const price=b.price(_rate);
    return `<div class="bundle-card">
      <div class="bundle-card-top"><div class="bundle-card-name">${b.name}</div><div class="bundle-card-price">$${price}<span>/mo</span></div></div>
      <div class="bundle-card-sum">${b.summary}</div>
      <ul class="bundle-card-list">${b.contents.map(x=>`<li>${x}</li>`).join("")}</ul>
      <button class="bundle-sub-btn" onclick="subscribeBundle('${c.id}','${k}')">Subscribe</button>
    </div>`;
  }).join("") : "";
```

**Replace with:**
```js
  // PILOT: pilot athletes see a single pilot offer card instead of the
  // standard 3 bundles. The same subscribeBundle() flow handles both.
  let bundlesHtml = "";
  if(_isPilotAthlete && window.getPilotOffer){
    const offer = window.getPilotOffer();
    const price = offer.price();
    bundlesHtml = `<div class="bundle-card" style="border-color:rgba(250,204,21,.4);background:linear-gradient(160deg,rgba(15,23,42,.95),rgba(9,14,35,.98));">
      <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#facc15;text-transform:uppercase;margin-bottom:8px;">Founding Athlete · Invite-Only</div>
      <div class="bundle-card-top">
        <div class="bundle-card-name">${offer.name}</div>
        <div class="bundle-card-price" style="color:#facc15;">$${price}<span>/mo</span></div>
      </div>
      <div class="bundle-card-sum">${offer.summary}</div>
      <ul class="bundle-card-list">${offer.contents.map(x=>`<li>${x}</li>`).join("")}</ul>
      <button class="bundle-sub-btn" onclick="subscribeBundle('${c.id}','pilot')">Subscribe — $${price}/mo</button>
    </div>`;
  } else {
    bundlesHtml = window.BUNDLES ? _order.filter(k=>_active.indexOf(k)!==-1).map(k=>{
      const b=window.BUNDLES[k]; const price=b.price(_rate);
      return `<div class="bundle-card">
        <div class="bundle-card-top"><div class="bundle-card-name">${b.name}</div><div class="bundle-card-price">$${price}<span>/mo</span></div></div>
        <div class="bundle-card-sum">${b.summary}</div>
        <ul class="bundle-card-list">${b.contents.map(x=>`<li>${x}</li>`).join("")}</ul>
        <button class="bundle-sub-btn" onclick="subscribeBundle('${c.id}','${k}')">Subscribe</button>
      </div>`;
    }).join("") : "";
  }
```

### 4c. Update the "Monthly Packages" section label

Just above the `${bundlesHtml}` line in the modal template:

**Find:**
```js
    <div class="detail-section-title">Monthly Packages</div>
    <div class="bundle-context">${_tierCtx} · pricing scales with the coach's tier</div>
```

**Replace with:**
```js
    <div class="detail-section-title">${_isPilotAthlete ? "Your Pilot Offer" : "Monthly Packages"}</div>
    <div class="bundle-context">${_isPilotAthlete ? "Locked pilot pricing · 4 weekly skill reviews · cancel anytime" : (_tierCtx + " · pricing scales with the coach's tier")}</div>
```

---

## ⑤ PATCH — `checkout.html`

Accept `?bundle=pilot` and render the pilot line item. Subscription insert flags `is_pilot=true`.

### 5a. Recognise the pilot bundle in the renderer

In Patch ④ of the bundle migration, `renderLines()` already branches on `bundleId`. **Add a pilot branch at the top**:

**Find** (the existing pilot-aware branch in renderLines, the first `if (!isLegacy && bundleId && window.BUNDLES[bundleId])` check). **Insert immediately before it**:

```js
    // PILOT branch — single line item, fixed price from PILOT_CONFIG.
    if(!isLegacy && bundleId === "pilot" && window.getPilotOffer){
      const offer = window.getPilotOffer();
      const price = offer.price();
      html += `
        <div class="line">
          <div>
            <div class="line-name">${offer.name}</div>
            <div class="line-tag">Founding pilot · monthly subscription</div>
            <div class="line-desc">${offer.summary}</div>
          </div>
          <div class="line-amt">$${price}/mo</div>
        </div>`;
      html += '<div style="padding:8px 0 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:700;">Includes</div>';
      offer.contents.forEach(c => {
        html += `<div style="font-size:12px;color:rgba(232,237,245,.78);padding:3px 0 3px 14px;position:relative;">
          <span style="position:absolute;left:0;top:3px;color:var(--green);">✓</span>${c}
        </div>`;
      });
      document.getElementById("lineItems").innerHTML = html;
      return;
    }
```

### 5b. Update bundleSubtotal to handle pilot

In Patch ④'s `bundleSubtotal()`:

**Find:**
```js
  function bundleSubtotal(){
    if (!bundleId || !window.BUNDLES || !window.BUNDLES[bundleId]) return 0;
    const lvl = tierLevel || 1;
    return window.bundlePrice(bundleId, lvl);
  }
```

**Replace with:**
```js
  function bundleSubtotal(){
    if(bundleId === "pilot" && window.PILOT_CONFIG) return window.PILOT_CONFIG.monthlyPrice;
    if (!bundleId || !window.BUNDLES || !window.BUNDLES[bundleId]) return 0;
    const lvl = tierLevel || 1;
    return window.bundlePrice(bundleId, lvl);
  }
```

### 5c. Flag the subscription as pilot at insert time

In the subscription insert from Patch ④:

**Find:**
```js
    const {error: subErr} = await sb.from("subscriptions").insert({
      athlete_id:   currentUser.id,
      coach_id:     coachId,
      status:       "active",
      package_name: bundleObj ? bundleObj.name : (legacyTier || "Coaching Plan"),
      bundle_id:    bundleId || null,
      tier_level:   tierLevel || null,
      monthly_price:priceSnapshot,
      billing_cycle:"Monthly"
    });
```

**Replace with:**
```js
    const isPilotSub = bundleId === "pilot";
    const pilotOffer = isPilotSub && window.getPilotOffer ? window.getPilotOffer() : null;
    const {error: subErr} = await sb.from("subscriptions").insert({
      athlete_id:    currentUser.id,
      coach_id:      coachId,
      status:        "active",
      package_name:  pilotOffer ? pilotOffer.name
                                : (bundleObj ? bundleObj.name : (legacyTier || "Coaching Plan")),
      bundle_id:     bundleId || null,
      tier_level:    tierLevel || null,
      monthly_price: priceSnapshot,
      billing_cycle: "Monthly",
      is_pilot:      isPilotSub
    });
```

---

## ⑥ PATCH — `athlete-dashboard.html`

Show pilot offer name in "My Coach" panel; display X-of-4 review counter; soft-warn on the 5th upload of a calendar month.

### 6a. Add a pilot review counter to the home section

Find the home section's main grid (search for the activity stats — "actUploads", "Pending", etc.). Add a new stat card to that row:

**Find** the activity bar block (one of the rows showing stat tiles). **Add** another tile inside that grid:

```html
<!-- Pilot review counter — only renders for pilot athletes. -->
<div class="stat-tile" id="pilotReviewTile" style="display:none;">
  <div class="stat-label">Pilot reviews this month</div>
  <div class="stat-value"><span id="pilotReviewCount">0</span> <span style="font-size:13px;color:var(--muted);font-weight:600;">of 4</span></div>
  <div class="stat-sub" id="pilotReviewSub">Resets on the 1st</div>
</div>
```

(Match the surrounding `.stat-tile` markup — if the page uses different class names, adjust accordingly.)

### 6b. Load pilot status and review count on init

In the dashboard's init function, **after** the profile load:

```js
// ── PILOT ATHLETE STATUS + REVIEW COUNT ──────────────────────────────
const _isPilotAthlete = window.isPilotAthlete && window.isPilotAthlete(profile);
if(_isPilotAthlete){
  const tile = document.getElementById("pilotReviewTile");
  if(tile) tile.style.display = "block";

  // Read the per-month count from the view.
  const month = new Date().toISOString().slice(0, 7);   // 'YYYY-MM'
  try {
    const { data: counts } = await sb.from("pilot_review_counts")
      .select("review_count")
      .eq("athlete_id", currentUser.id)
      .eq("month", month)
      .maybeSingle();
    const used = (counts && counts.review_count) || 0;
    const countEl = document.getElementById("pilotReviewCount");
    if(countEl) countEl.textContent = used;
    if(used >= 4){
      const sub = document.getElementById("pilotReviewSub");
      if(sub) sub.textContent = "Pilot allowance reached — resets on the 1st";
    }
  } catch(e) { console.warn("[pilot] review count fetch failed:", e); }
}
```

### 6c. Soft-cap on the 5th upload of a month

Find the upload submit handler (where `submissions.insert` is called). **Immediately before** the insert:

```js
// PILOT soft cap — warn (not block) on the 5th+ upload of the month.
// Uploads aren't blocked because we want to capture demand data; the
// athlete just sees a heads-up that they've used their allowance.
if(_isPilotAthlete){
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await sb.from("pilot_review_counts")
    .select("review_count")
    .eq("athlete_id", currentUser.id)
    .eq("month", month)
    .maybeSingle();
  const used = (row && row.review_count) || 0;
  if(used >= 4){
    const ok = confirm(
      "Heads up — you've used your 4 pilot reviews this month.\n\n" +
      "Your allowance resets on the 1st. You can still upload, but your " +
      "coach may not get to extra reviews until next month.\n\n" +
      "Continue anyway?"
    );
    if(!ok) return;
  }
}
```

### 6d. Show "Founding Athlete Pilot" in My Coach panel

Find the My Coach panel renderer (search for `package_name` display, around line 1270+ from the earlier athlete-dashboard scan). Wherever the package name renders:

```js
// Replace the existing package name line with this:
const _displayPlan = sub.is_pilot
  ? (window.PILOT_CONFIG ? window.PILOT_CONFIG.label : "Founding Athlete Pilot")
  : (sub.package_name || "Coaching Plan");
// Then use _displayPlan wherever sub.package_name was rendered.
```

---

## ⑦ PATCH — `coach-dashboard.html`

Earnings panel shows pilot economics. Bundle toggle hidden for pilot coaches.

### 7a. Read pilot_status from profile

In the dashboard's init, after `window._coachProfile = p || {};`, add:

```js
// PILOT coach detection
const _isPilotCoach = window.isPilotCoach && window.isPilotCoach(p);
window._isPilotCoach = _isPilotCoach;   // used by other panels below
```

### 7b. Hide the bundle toggle, show pilot card

Find `renderPackagesPanel()` (around line 1140). **Modify the opening**:

**Find:**
```js
function renderPackagesPanel(){
  const body=document.getElementById("packagesBody"); if(!body||!window.BUNDLES) return;
  const p=window._coachProfile||{};
  const rate=tierHourlyRate(p);
  const active=Array.isArray(p.bundles_active)?p.bundles_active.slice():BUNDLE_ORDER.slice();
  if(!rate){
```

**Replace with:**
```js
function renderPackagesPanel(){
  const body=document.getElementById("packagesBody"); if(!body||!window.BUNDLES) return;
  const p=window._coachProfile||{};

  // PILOT: pilot coaches have all athletes on the flat $49 offer. Hide the
  // standard bundle toggle and show a locked pilot card instead.
  if(window.isPilotCoach && window.isPilotCoach(p)){
    body.innerHTML = `
      <div style="padding:18px 20px;border-radius:12px;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(180,83,9,.04));border:1px solid rgba(245,158,11,.3);">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">Founding Pilot · Locked</div>
        <div style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:6px;">Founding Athlete Pilot — $49/mo</div>
        <div style="font-size:13px;color:rgba(232,237,245,.7);line-height:1.6;">All your athletes subscribe at the pilot rate. <strong style="color:#fbbf24;">You receive $60 per active athlete per month</strong>. The standard 3-bundle marketplace opens after the pilot.</div>
      </div>`;
    return;
  }

  const rate=tierHourlyRate(p);
  const active=Array.isArray(p.bundles_active)?p.bundles_active.slice():BUNDLE_ORDER.slice();
  if(!rate){
```

(The rest of the function continues unchanged.)

### 7c. Pilot earnings line in the Earnings overview

Find the Earnings overview panel (search for "EARNINGS OVERVIEW" or the section labelled `<!-- ══ EARNINGS SECTION ══ -->`). At the top of whatever function renders earnings, insert a pilot-mode block:

```js
// In the earnings renderer, branch on pilot status:
if(window._isPilotCoach){
  // Count this coach's active pilot subscriptions
  const { data: activeSubs } = await sb.from("subscriptions")
    .select("id")
    .eq("coach_id", currentUser.id)
    .eq("status", "active")
    .eq("is_pilot", true);
  const n = (activeSubs || []).length;
  const monthly = n * (window.PILOT_CONFIG ? window.PILOT_CONFIG.coachPayout : 60);
  // Render a pilot earnings card — adjust selector to match your earnings container:
  const target = document.getElementById("earningsPanel") || document.getElementById("earningsBody");
  if(target){
    target.innerHTML = `
      <div style="padding:18px 20px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:var(--amber3);text-transform:uppercase;margin-bottom:6px;">Pilot Earnings</div>
        <div style="font-size:28px;font-weight:800;color:#f9fafb;">$${monthly}<span style="font-size:14px;font-weight:600;color:var(--muted);">/mo</span></div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px;">${n} active athlete${n === 1 ? "" : "s"} × $60/month</div>
        <div style="font-size:12px;color:var(--muted2);margin-top:10px;line-height:1.55;">Athletes pay $49/mo via Stripe. You receive $39.20 directly + $20.80 platform top-up = $60. Paid monthly to your Connect account.</div>
      </div>`;
  }
  return;   // skip the standard earnings render
}
```

---

## ⑧ PATCH — `for-athletes.html`

Replace the "What it costs" section with pilot-aware copy that points invitees to pilot.html.

**Find** the "What it costs" section you updated in Patch ⑤ of the bundle migration (the `<section class="block">` with `<div class="block-label">What it costs</div>` and the 3 price cards).

**Replace the entire `<section>` block with:**

```html
<!-- WHAT IT COSTS — pilot-aware. Public bundles described as "coming soon". -->
<section class="block">
  <div class="container">
    <div class="block-label">What it costs</div>
    <p class="lead" style="margin-bottom:18px;">
      We're currently in an <strong>invite-only Founding Athlete Pilot</strong> — a small group testing the platform at $49/mo with 4 weekly skill reviews. Public bundles (Starter, Standard, Pro) open after the pilot.
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;" class="price-grid">
      <!-- PILOT CARD -->
      <div class="price-card" style="border-color:rgba(250,204,21,.4);background:linear-gradient(160deg,rgba(15,23,42,.6),rgba(9,14,35,.7));">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#facc15;text-transform:uppercase;margin-bottom:6px;">Now · Invite-only</div>
        <div class="pname">Founding Athlete Pilot</div>
        <div class="pamt" style="color:#facc15;">$49<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">4 weekly skill reviews, direct messaging with your coach, founding-member pricing locked in.</div>
        <a href="pilot.html" style="display:inline-block;margin-top:14px;padding:10px 18px;border-radius:8px;background:linear-gradient(135deg,#fbbf24,#d97706);color:#0a0f1a;font-weight:700;font-size:13px;">Got an invite code? →</a>
      </div>

      <!-- PUBLIC PRICING TEASER -->
      <div class="price-card" style="opacity:.7;">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">After pilot</div>
        <div class="pname">Three monthly bundles</div>
        <div class="pamt">$40–$569<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">Starter, Standard, and Pro bundles — pricing scales with your coach's tier (Level 1 Development → Level 4 Elite).</div>
        <div style="margin-top:14px;font-size:12px;color:var(--muted);font-weight:600;">
          <a href="waitlist.html" style="color:var(--amber3);">Join the waitlist →</a>
        </div>
      </div>
    </div>

    <div class="price-note">Pilot intake capped at 20 athletes. Public launch follows the pilot's first 6 months.</div>
  </div>
</section>
```

---

## ⑨ PATCH — `for-coaches.html`

Replace the "Packages you offer" section similarly. Keep the tier subscription panel (coaches still complete full intake), but the package grid points to pilot-coaches.html for invitees.

**Find** the "Packages you offer" section from Patch ⑥ of the bundle migration (the `<section>` containing the 3 bundle cards with prices $40-$120, $145-$337, $249-$569).

**Replace the entire `<section>` with:**

```html
<!-- PACKAGES — pilot-aware. Standard bundles framed as "after the pilot". -->
<section class="block">
  <div class="container">
    <div class="block-label">How you get paid</div>
    <h2>Pilot now · standard bundles after.</h2>
    <p class="lead" style="margin-bottom:18px;">
      During the founding pilot, four invited coaches review weekly skill clips for a hand-picked group of athletes. After the pilot, the marketplace opens to the public with three tier-priced bundles.
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;" class="price-grid">
      <!-- PILOT CARD -->
      <div class="price-card" style="border-color:rgba(245,158,11,.4);background:linear-gradient(160deg,rgba(15,23,42,.6),rgba(13,17,23,.7));">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">Now · Invite-only</div>
        <div class="pname">Pilot Coach</div>
        <div class="pamt" style="color:#fbbf24;">$60<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo per athlete</small></div>
        <div class="pdesc">4 reviews per athlete per month. No platform fee during pilot. Stripe Connect for payouts.</div>
        <a href="pilot-coaches.html" style="display:inline-block;margin-top:14px;padding:10px 18px;border-radius:8px;background:linear-gradient(135deg,#fbbf24,#d97706);color:#0a0f1a;font-weight:700;font-size:13px;">Got an invite? →</a>
      </div>

      <!-- PUBLIC BUNDLES TEASER -->
      <div class="price-card" style="opacity:.7;">
        <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">After pilot</div>
        <div class="pname">Three standard bundles</div>
        <div class="pamt">80%<small style="font-size:12px;font-weight:600;color:var(--muted);"> to coach</small></div>
        <div class="pdesc">Starter ($40-$120), Standard ($145-$337), Pro ($249-$569) — priced by your tier. Foundation members get locked-in lower platform fees.</div>
        <div style="margin-top:14px;font-size:12px;color:var(--muted);font-weight:600;">
          <a href="waitlist.html" style="color:var(--amber3);">Join the coach waitlist →</a>
        </div>
      </div>
    </div>

    <div class="price-note">Foundation pricing applies to coaches who complete the pilot and stay on after public launch.</div>
  </div>
</section>
```

---

## ⑩ NETLIFY FUNCTION — `create-bundle-subscription.js`

This existing function powers `subscribeBundle()` in select-coach.html. Add a `bundle === "pilot"` branch.

If your function looks roughly like this (Stripe + Supabase service-role), insert the pilot branch where the bundle/tier logic resolves the Stripe Price ID:

```js
// Inside the function body, after parsing { coachId, bundleType } from the request:

// ── PILOT BRANCH ─────────────────────────────────────────────────────────
const isPilot = bundleType === "pilot";

let priceId;
if(isPilot){
  // Single Stripe Price ID for the $49/mo Founding Athlete Pilot product.
  // Create this in Stripe dashboard: Products → New → "Founding Athlete Pilot"
  // → recurring, $49 AUD monthly. Copy the price_xxx ID into your Netlify env.
  priceId = process.env.STRIPE_PILOT_PRICE_ID;
  if(!priceId){
    return { statusCode: 500, body: JSON.stringify({ error: "Pilot price not configured" }) };
  }
} else {
  // Existing logic for standard bundles — looks up by {bundle, tier}.
  // priceId = TIER_PRICE_MATRIX[bundleType][coach.tier_level]; etc.
}

// ── CONNECT GATE ─────────────────────────────────────────────────────────
// Coach must have a connected Stripe account.
if(!coach.stripe_account_id){
  return {
    statusCode: 200,
    body: JSON.stringify({
      blocked: true,
      message: "This coach is still completing their payment setup. Try again shortly."
    })
  };
}

// ── CREATE CHECKOUT SESSION ──────────────────────────────────────────────
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  payment_method_types: ["card"],
  line_items: [{ price: priceId, quantity: 1 }],
  customer_email: athleteEmail,
  subscription_data: {
    // 20% application fee — stays with platform; 80% transfers to coach.
    application_fee_percent: 20,
    transfer_data: {
      destination: coach.stripe_account_id
    },
    metadata: {
      athlete_id:  athleteId,
      coach_id:    coach.id,
      bundle:      bundleType,
      is_pilot:    isPilot ? "true" : "false",
      tier_level:  String(coach.tier_level || "")
    }
  },
  success_url: process.env.SITE_URL + "/athlete-dashboard.html?subscribed=1",
  cancel_url:  process.env.SITE_URL + "/select-coach.html?cancelled=1"
});

return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
```

**Required env vars:** `STRIPE_PILOT_PRICE_ID`, `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.

---

## ⑪ NEW NETLIFY FUNCTION — `pilot-topup-handler.js`

Webhook handler for `invoice.payment_succeeded` events on pilot subscriptions. Triggers the $20.80 Connect transfer top-up.

Create `/.netlify/functions/pilot-topup-handler.js`:

```js
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
```

**Required env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_PILOT_TOPUP`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Stripe webhook setup:** In the Stripe dashboard → Developers → Webhooks → Add endpoint. URL: `https://<your-site>.netlify.app/.netlify/functions/pilot-topup-handler`. Event to listen for: `invoice.payment_succeeded`. Copy the signing secret into the `STRIPE_WEBHOOK_SECRET_PILOT_TOPUP` env var.

---

## ⑫ ADMIN.HTML PATCH — invite-code minting

Add a section to your existing admin panel that lists pilot codes, lets you mint new ones, and shows their usage state.

Find a sensible spot in the admin's main grid (probably near the cancellations panel). Add this section:

```html
<!-- ══ PILOT INVITE CODES ══ -->
<section class="row">
  <div class="row-label">Pilot invite codes</div>
  <div class="kpi-card" style="grid-column: 1 / -1;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div class="kpi-label">Founding Athlete codes</div>
        <div class="kpi-value" id="pilotCodesUsed">…</div>
        <div class="kpi-sub" id="pilotCodesSub">— of 20 redeemed</div>
      </div>
      <button id="mintCodeBtn" class="refresh-btn" style="background:linear-gradient(135deg,#fbbf24,#d97706);">
        Mint new code
      </button>
    </div>
    <div id="pilotCodesTable" style="margin-top:14px;font-size:13px;"></div>
  </div>
</section>
```

And in the admin's JS init (after the admin-gate passes):

```js
// ── PILOT CODES PANEL ────────────────────────────────────────────────
async function loadPilotCodes(){
  const { data: codes } = await sb.from("pilot_codes")
    .select("code, athlete_email, used_at, notes, created_at")
    .order("created_at", { ascending: false });
  const used = (codes || []).filter(c => c.used_at).length;
  const total = (codes || []).length;
  document.getElementById("pilotCodesUsed").textContent = used + " / " + total;
  document.getElementById("pilotCodesSub").textContent =
    Math.max(0, 20 - used) + " spots remaining (cap = 20)";

  const rows = (codes || []).map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);gap:14px;">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <code style="background:rgba(255,255,255,.05);padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#fbbf24;">${c.code}</code>
        ${c.used_at
          ? '<span style="font-size:11px;color:var(--green2);font-weight:600;">✓ Used ' + new Date(c.used_at).toLocaleDateString() + '</span>'
          : '<span style="font-size:11px;color:var(--muted);">Unused</span>'
        }
        ${c.athlete_email ? '<span style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + c.athlete_email + '</span>' : ''}
      </div>
      ${!c.used_at ? '<button onclick="copyInviteEmail(\'' + c.code + '\')" style="padding:5px 12px;border-radius:6px;background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.3);color:var(--blue2);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Copy invite email</button>' : ''}
    </div>
  `).join("");

  document.getElementById("pilotCodesTable").innerHTML = rows || '<div style="padding:20px;text-align:center;color:var(--muted);">No codes minted yet.</div>';
}

function randomCodeSuffix(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no I/O/0/1 to avoid confusion
  let s = "";
  for(let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function mintCode(){
  const code = "PIONEER-" + randomCodeSuffix();
  const note = prompt("Optional: who is this code for? (e.g. 'Sarah, basketball')") || "";
  const { error } = await sb.from("pilot_codes").insert({
    code, notes: note || null
  });
  if(error){
    alert("Mint failed: " + error.message);
    return;
  }
  loadPilotCodes();
}

function copyInviteEmail(code){
  const url = window.location.origin + "/pilot.html";
  const text =
    "You're invited to the CoachAnywhere Founding Athlete Pilot.\n\n" +
    "We've hand-picked a small group of athletes to test elite remote coaching. " +
    "You'll get 4 weekly skill reviews from a vetted coach for $49/mo (normally $60), " +
    "locked in as a founding member.\n\n" +
    "Your invite code: " + code + "\n\n" +
    "Get started: " + url + "\n\n" +
    "Limited to 20 athletes. Cancel anytime.\n\n" +
    "— The CoachAnywhere team";
  navigator.clipboard.writeText(text).then(() => {
    alert("Invite email copied to clipboard. Paste into your email and send.");
  }).catch(() => prompt("Copy this invite text:", text));
}

window.copyInviteEmail = copyInviteEmail;
document.getElementById("mintCodeBtn").addEventListener("click", mintCode);

// Refresh on first load + every 60s alongside the other admin refreshes:
loadPilotCodes();
setInterval(loadPilotCodes, 60 * 1000);
```

---

## Stripe & deployment checklist

After all patches are applied:

1. **Stripe product** — Create "Founding Athlete Pilot" product, $49 AUD recurring monthly. Copy the price ID into Netlify env var `STRIPE_PILOT_PRICE_ID`.
2. **Stripe webhook** — Add endpoint `<your-site>/.netlify/functions/pilot-topup-handler`, listen for `invoice.payment_succeeded`. Copy signing secret into `STRIPE_WEBHOOK_SECRET_PILOT_TOPUP`.
3. **Run the SQL migration** — paste `pilot-migration.sql` into the Supabase SQL Editor.
4. **Mint 20 invite codes** — via the admin panel (Patch ⑫). Or uncomment the seed block in the SQL and run once.
5. **Connect onboarding** — confirm all 4 pilot coaches have completed Stripe Connect onboarding and have `profiles.stripe_account_id` populated before any athlete subscribes.
6. **Smoke test** — sign up as a test athlete via pilot.html with a fresh code. Subscribe to a Connect-onboarded test coach. Confirm:
   - `subscriptions.is_pilot = true`
   - First invoice triggers webhook
   - `pilot_topups` row created with status='sent'
   - Coach sees both the $39.20 sub payout and the $20.80 top-up in their Stripe dashboard
7. **Funding** — make sure your platform Stripe balance has enough to cover top-ups before activating. At full intake (20 athletes), that's ~$416/month going out.

---

## When you're ready to end the pilot

Flip `PILOT_MODE = false` in `bundles.js`. The pilot users (`profiles.pilot_status = 'athlete'`) keep their subscriptions running at $49 until you actively migrate them. To migrate post-pilot:

- Decide their new bundle (Starter most likely)
- Email them, cancel their Stripe sub, ask them to re-subscribe at the bundle price
- Or: update their Stripe sub to a different Price ID via the API
- Stop the pilot top-up handler from firing (either by removing the webhook or adding a date cutoff in the handler)

The exact post-pilot migration is best done case-by-case once you have real cohort behaviour data.

---

*End of patches.*
