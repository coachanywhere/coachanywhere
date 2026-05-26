# CoachAnywhere — Bundle Pricing Patches

A single new file (`bundles.js`) plus targeted patches to 6 existing files.

The `bundles.js` is the canonical source of truth — once shipped, every page reads tier rates, bundle contents, and prices from it.

---

## ① NEW FILE — `bundles.js`

Save the accompanying `bundles.js` to your repo root. Two pages already load it (`<script src="bundles.js"></script>`):

- `select-coach.html` (line 10)
- `coach-dashboard.html` (line 15)

You'll also need to add it to four more pages (see patches below).

**Verified output** — matches your matrix exactly:

| Bundle    | L1   | L2   | L3   | L4   |
|-----------|------|------|------|------|
| Starter   | $40  | $60  | $90  | $120 |
| Standard  | $145 | $193 | $265 | $337 |
| Pro       | $249 | $329 | $449 | $569 |

---

## ② PATCH — `coach-profile-setup.html`

**Goal:** replace the 5 hard-coded add-on packages (Skill Clip Review / Session Review / Half Game / Full Game / Elite Package) with the 3 bundles. The coach picks which bundles they offer (1–3 of them) and submits to `profiles.bundles_active` instead of `profiles.service_packages`.

### 2a. Add the script tag

**Find** (line 11):
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

### 2b. Delete the old PACKAGES array

**Find** (lines 474–480):
```js
  const PACKAGES=[
    {id:"starter",name:"Skill Clip Review",tagline:"One focused skill reviewed per submission",price:15,earn:12,minTier:0,inclusions:["1 skill clip per submission","Written feedback & corrections","Drill recommendation to reinforce improvement","Response within 48 hours"]},
    {id:"standard",name:"Session Review",tagline:"Up to 15 min of footage reviewed",price:35,earn:28,minTier:0,inclusions:["Up to 15 min training footage","Multi-skill written feedback report","Key technique corrections","Next session tips","Response within 48 hours"]},
    {id:"pro",name:"Half Game / Long Session Review",tagline:"30 min footage — technique, decisions, positioning",price:75,earn:60,minTier:1,inclusions:["Up to 30 min game or session footage","Multi-phase technique analysis","Decision-making & positioning feedback","Key moments highlighted","Written breakdown + drill plan","Response within 48 hours"]},
    {id:"elite",name:"Full Game Review",tagline:"Complete game breakdown with action plan",price:120,earn:96,minTier:1,inclusions:["Full game footage reviewed","Comprehensive written report","Technique, tactics & positioning","Performance trends identified","Personalised improvement action plan","Response within 72 hours"]},
    {id:"premium",name:"Elite Package",tagline:"Full review + Zoom session + training plan",price:199,earn:159,minTier:2,inclusions:["Full game or session footage reviewed","Live Zoom debrief session (30 min)","Personalised monthly training plan","Priority response within 48 hours","Ongoing progress tracking"]}
  ];
```

**Replace with:** (uses `window.BUNDLES` from `bundles.js`)
```js
  // Bundles live in bundles.js — single source of truth for contents + prices.
  // We map them here to the shape the existing renderer expects so the
  // setup UI stays consistent.
```

### 2c. Replace the package-state variable

**Find** (line 463):
```js
  let selectedPackages=[];
```

**Replace with:**
```js
  // Bundles the coach has chosen to offer (subset of BUNDLE_ORDER). Persisted
  // to profiles.bundles_active as a Postgres text[] array.
  let selectedBundles = ["starter","standard","pro"];  // default: offer all 3
```

### 2d. Replace `renderPackages` with `renderBundles`

**Find** (lines 798–824):
```js
  // ── PACKAGES ──
  function renderPackages(){
    const tierIdx=TIERS.findIndex(t=>t.id===selectedTier.id);
    const container=document.getElementById("pkgToggleList");
    container.innerHTML=PACKAGES.map(pkg=>{
      const locked=tierIdx<pkg.minTier;
      const isActive=!locked&&selectedPackages.includes(pkg.id);
      return`<div class="pkg-toggle-item ${isActive?"active":""} ${locked?"locked":""}" id="pkg-${pkg.id}" ${!locked?`onclick="togglePackage('${pkg.id}')"`:""}> 
        <div class="pkg-toggle-header">
          <div class="pkg-toggle-switch"><div class="pkg-toggle-knob"></div></div>
          <div class="pkg-toggle-info">
            <div class="pkg-toggle-name">${pkg.name}</div>
            <div class="pkg-toggle-tagline">${pkg.tagline}</div>
            ${locked?`<div class="pkg-lock-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Requires ${TIERS[pkg.minTier].label}</div>`:""}
          </div>
          <div class="pkg-toggle-pricing">
            <div class="pkg-toggle-price">$${pkg.price}</div>
            <div class="pkg-toggle-earn">You earn $${pkg.earn}</div>
          </div>
        </div>
        <div class="pkg-toggle-body">
          <div class="pkg-toggle-body-inner">
            ${pkg.inclusions.map(inc=>`<div class="pkg-inclusion"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${inc}</div>`).join("")}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  function togglePackage(id){
    const el=document.getElementById("pkg-"+id);
    if(selectedPackages.includes(id)){
      selectedPackages=selectedPackages.filter(p=>p!==id);
      el.classList.remove("active");
    } else {
      selectedPackages.push(id);
      el.classList.add("active");
    }
    updateSummary();
  }
```

**Replace with:**
```js
  // ── BUNDLES ── (renders the 3 bundles with the coach's tier-priced amount)
  function renderPackages(){
    const lvl = window.tierLevel(selectedTier.id);
    const rate = window.TIER_RATES[lvl];
    const container = document.getElementById("pkgToggleList");
    container.innerHTML = window.BUNDLE_ORDER.map(key => {
      const b = window.BUNDLES[key];
      const price = b.price(rate);
      const earn  = window.coachEarn(key, lvl);
      const isActive = selectedBundles.includes(key);
      return `<div class="pkg-toggle-item ${isActive?"active":""}" id="pkg-${b.id}" onclick="togglePackage('${b.id}')">
        <div class="pkg-toggle-header">
          <div class="pkg-toggle-switch"><div class="pkg-toggle-knob"></div></div>
          <div class="pkg-toggle-info">
            <div class="pkg-toggle-name">${b.name}</div>
            <div class="pkg-toggle-tagline">${b.summary}</div>
          </div>
          <div class="pkg-toggle-pricing">
            <div class="pkg-toggle-price">$${price}<small style="font-size:11px;font-weight:600;color:var(--muted);">/mo</small></div>
            <div class="pkg-toggle-earn">You earn $${earn}/mo</div>
          </div>
        </div>
        <div class="pkg-toggle-body">
          <div class="pkg-toggle-body-inner">
            ${b.contents.map(inc=>`<div class="pkg-inclusion"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${inc}</div>`).join("")}
          </div>
        </div>
      </div>`;
    }).join("");
  }

  function togglePackage(id){
    const el = document.getElementById("pkg-"+id);
    if (selectedBundles.includes(id)) {
      if (selectedBundles.length <= 1) {
        alert("You must offer at least one bundle.");
        return;
      }
      selectedBundles = selectedBundles.filter(p => p !== id);
      el.classList.remove("active");
    } else {
      selectedBundles.push(id);
      // Keep canonical order so the dashboard always shows Starter→Standard→Pro.
      selectedBundles = window.BUNDLE_ORDER.filter(k => selectedBundles.includes(k));
      el.classList.add("active");
    }
    updateSummary();
  }
```

### 2e. Update the summary block to use bundle prices

**Find** (lines 838–859):
```js
  // ── SUMMARY ──
  function updateSummary(){
    if(!selectedTier)return;
    const t=selectedTier;
    const fee=selectedBilling==="fortnightly"?t.foundationFN:t.foundation;
    const period=selectedBilling==="fortnightly"?"fortnight":"month";
    const activePkgs=PACKAGES.filter(p=>selectedPackages.includes(p.id));
    const avgEarn=activePkgs.length>0?activePkgs.reduce((s,p)=>s+p.earn,0)/activePkgs.length:0;
    const monthlyEst=Math.round(avgEarn*10);

    document.getElementById("summaryList").innerHTML=`
      <div class="summary-row"><span class="summary-label">Platform tier</span><span class="summary-value">${t.label}</span></div>
      <div class="summary-row"><span class="summary-label">Monthly platform fee</span><span class="summary-value">$${fee}/${period} (Foundation)</span></div>
      <div class="summary-row"><span class="summary-label">Packages offered</span><span class="summary-value">${activePkgs.length} package${activePkgs.length!==1?"s":""}</span></div>
      <div class="summary-row"><span class="summary-label">Platform commission</span><span class="summary-value">20% per sale</span></div>
    `;

    document.getElementById("earningsHighlight").innerHTML=`
      <div class="earnings-highlight-label">Example monthly earnings</div>
      <div class="earnings-highlight-text">If you coach <strong>10 athletes/month</strong> across your selected packages, you could earn approximately <strong>$${monthlyEst}/month</strong> after platform commission — before your subscription fee of $${fee}/${period}.</div>
    `;
  }
```

**Replace with:**
```js
  // ── SUMMARY ──
  function updateSummary(){
    if(!selectedTier) return;
    const t      = selectedTier;
    const lvl    = window.tierLevel(t.id);
    const fee    = selectedBilling === "fortnightly" ? t.foundationFN : t.foundation;
    const period = selectedBilling === "fortnightly" ? "fortnight" : "month";

    // Avg coach earning across the bundles this coach has activated. 10
    // athletes is an illustrative average for the earnings estimator below.
    const active = window.BUNDLE_ORDER.filter(k => selectedBundles.includes(k));
    const avgEarn = active.length
      ? active.reduce((s, k) => s + window.coachEarn(k, lvl), 0) / active.length
      : 0;
    const monthlyEst = Math.round(avgEarn * 10);

    document.getElementById("summaryList").innerHTML = `
      <div class="summary-row"><span class="summary-label">Platform tier</span><span class="summary-value">${t.label}</span></div>
      <div class="summary-row"><span class="summary-label">Hourly rate (your tier)</span><span class="summary-value">$${window.TIER_RATES[lvl]}/hr</span></div>
      <div class="summary-row"><span class="summary-label">Monthly platform fee</span><span class="summary-value">$${fee}/${period} (Foundation)</span></div>
      <div class="summary-row"><span class="summary-label">Bundles offered</span><span class="summary-value">${active.length} of 3</span></div>
      <div class="summary-row"><span class="summary-label">Platform commission</span><span class="summary-value">20% per athlete subscription</span></div>
    `;

    document.getElementById("earningsHighlight").innerHTML = `
      <div class="earnings-highlight-label">Example monthly earnings</div>
      <div class="earnings-highlight-text">If <strong>10 athletes</strong> subscribe across your active bundles, you'd earn approximately <strong>$${monthlyEst}/month</strong> after the 20% platform commission — before your tier subscription fee of $${fee}/${period}.</div>
    `;
  }
```

### 2f. Update the profile-save payload

**Find** (lines 898–910):
```js
    const updateData={
      first_name:firstName,last_name:lastName,sport,location,
      bio,qualifications:qual,
      coaching_style:selectedStyles.join(", "),
      focus_areas:selectedFocus,
      custom_focus_areas:customFocus,
      selected_tier:selectedTier.id,
      billing_cycle:selectedBilling,
      service_packages:selectedPackages.join(", "),
      ai_recommended_tier:aiRecommendedTier?.id,
      coach_agreed_with_ai:agreedWithAI,
      role:"coach"
    };
```

**Replace with:**
```js
    const updateData = {
      first_name: firstName, last_name: lastName, sport, location,
      bio, qualifications: qual,
      coaching_style:       selectedStyles.join(", "),
      focus_areas:          selectedFocus,
      custom_focus_areas:   customFocus,
      selected_tier:        selectedTier.id,
      // Snapshot the hourly rate so a future tier-rate change doesn't
      // retroactively reprice athletes mid-month. The Stripe price IDs are
      // tier-pinned anyway, but this gives us an audit trail.
      tier_hourly_rate:     window.TIER_RATES[window.tierLevel(selectedTier.id)],
      billing_cycle:        selectedBilling,
      bundles_active:       selectedBundles,
      ai_recommended_tier:  aiRecommendedTier?.id,
      coach_agreed_with_ai: agreedWithAI,
      role: "coach"
    };
```

### 2g. Re-render bundles when the tier changes

The current code calls `renderPackages()` only inside `showBillingAndPackages()`. When a coach picks a different tier (via `selectTier` or `agreeWithAI`), bundles need to re-render so prices reflect the new tier's rate.

**Find** (lines 716–724):
```js
  function agreeWithAI(){
    selectedTier=aiRecommendedTier;
    agreedWithAI=true;
    document.getElementById("btnAgree").classList.add("active");
    document.getElementById("btnChoose").classList.remove("active");
    document.getElementById("aiOverrideWarn").style.display="none";
    document.getElementById("tierCards").innerHTML="";
    showBillingAndPackages();
  }
```

No change needed — `showBillingAndPackages` already calls `renderPackages`. Just confirm the tier-card selector also calls it:

**Find** (lines 752–759):
```js
  function selectTier(tierId,el){
    selectedTier=TIERS.find(t=>t.id===tierId);
    document.querySelectorAll(".tier-card").forEach(c=>c.classList.remove("selected"));
    el.classList.add("selected");
    const isOverride=aiRecommendedTier&&tierId!==aiRecommendedTier.id&&TIERS.findIndex(t=>t.id===tierId)>TIERS.findIndex(t=>t.id===aiRecommendedTier.id);
    document.getElementById("aiOverrideWarn").style.display=isOverride?"block":"none";
    showBillingAndPackages();
  }
```

Already good.

### 2h. Pre-fill bundles on load (so editing a profile keeps the choice)

**Find** (lines 528–534):
```js
      // Pre-select existing coaching styles
      if(profile.coaching_style){
        selectedStyles=profile.coaching_style.split(",").map(s=>s.trim()).filter(Boolean).slice(0,5);
      }
      // Pre-select existing focus areas (text[] columns come back as JS arrays)
      if(Array.isArray(profile.focus_areas)) selectedFocus=profile.focus_areas.slice(0,CAP_FOCUS);
      if(Array.isArray(profile.custom_focus_areas)) customFocus=profile.custom_focus_areas.slice(0,CAP_CUSTOM);
```

**Replace with:**
```js
      // Pre-select existing coaching styles
      if(profile.coaching_style){
        selectedStyles=profile.coaching_style.split(",").map(s=>s.trim()).filter(Boolean).slice(0,5);
      }
      // Pre-select existing focus areas (text[] columns come back as JS arrays)
      if(Array.isArray(profile.focus_areas)) selectedFocus=profile.focus_areas.slice(0,CAP_FOCUS);
      if(Array.isArray(profile.custom_focus_areas)) customFocus=profile.custom_focus_areas.slice(0,CAP_CUSTOM);
      // Pre-select existing bundles_active (array of bundle ids). Defaults to
      // all three when the coach is new, set above at declaration time.
      if(Array.isArray(profile.bundles_active) && profile.bundles_active.length){
        selectedBundles = window.BUNDLE_ORDER.filter(k => profile.bundles_active.includes(k));
        if(!selectedBundles.length) selectedBundles = ["starter","standard","pro"];
      }
```

---

## ③ PATCH — `athlete-dashboard.html`

The `PACKAGES` constant is described in comments as a mirror of coach-profile-setup — that's no longer accurate. Replace it with the bundle definitions and rename consumers.

### 3a. Add the script tag

**Find** (line 11):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Replace with:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="bundles.js"></script>
```

### 3b. Delete the obsolete PACKAGES array

**Find** (lines 1040–1053):
```js
  // ── Coach service packages ─────────────────────────────────────
  // Mirror of the canonical list in coach-profile-setup.html:403–409.
  // Used here to resolve subscription.package_name → inclusions list and to
  // render the "More packages" section from coach.service_packages.
  // Keep the names + ids in sync if you ever edit coach-profile-setup.
  const PACKAGES = [
    { id:"starter",  name:"Skill Clip Review",            price:15,  inclusions:["1 skill clip per submission","Written feedback & corrections","Drill recommendation to reinforce improvement","Response within 48 hours"] },
    { id:"standard", name:"Session Review",               price:35,  inclusions:["Up to 15 min training footage","Multi-skill written feedback report","Key technique corrections","Next session tips","Response within 48 hours"] },
    { id:"pro",      name:"Half Game / Long Session Review", price:75,  inclusions:["Up to 30 min game or session footage","Multi-phase technique analysis","Decision-making & positioning feedback","Key moments highlighted","Written breakdown + drill plan","Response within 48 hours"] },
    { id:"elite",    name:"Full Game Review",             price:120, inclusions:["Full game footage reviewed","Comprehensive written report","Technique, tactics & positioning","Performance trends identified","Personalised improvement action plan","Response within 72 hours"] },
    { id:"premium",  name:"Elite Package",                price:199, inclusions:["Full game or session footage reviewed","Live Zoom debrief session (30 min)","Personalised monthly training plan","Priority response within 48 hours","Ongoing progress tracking"] }
  ];
  function packageById(id){ return PACKAGES.find(p => p.id === id) || null; }
  function packageByName(name){ return PACKAGES.find(p => p.name === name) || null; }
```

**Replace with:**
```js
  // ── Bundles (read from bundles.js) ─────────────────────────────
  // The athlete's subscription row stores the bundle id (starter/standard/pro).
  // Resolving by name is kept for backwards compatibility with legacy rows
  // that stored package_name = the human-readable bundle name.
  function packageById(id){
    return window.BUNDLES && window.BUNDLES[id] ? window.BUNDLES[id] : null;
  }
  function packageByName(name){
    if(!window.BUNDLES || !name) return null;
    return window.BUNDLE_ORDER
      .map(k => window.BUNDLES[k])
      .find(b => b.name === name) || null;
  }
  // Returns the contents/inclusions list for whatever record shape we got.
  function packageContents(pkg){
    if(!pkg) return [];
    return pkg.contents || pkg.inclusions || [];
  }
```

### 3c. Find anywhere `pkg.inclusions` is read and switch to `packageContents(pkg)`

Search the file for `.inclusions` (currently used to render the "My Coach package" panel) and update each reference. Likely lines around 1246 — the comment "render the More packages section from coach.service_packages" hints at this:

**Find** any line like:
```js
pkg.inclusions.map(...)
```

**Replace with:**
```js
packageContents(pkg).map(...)
```

(There's typically just one or two such call sites; if your build has more, the same swap applies to each.)

### 3d. Read the coach's active bundles from `bundles_active` instead of `service_packages`

**Find** (around line 1246):
```js
    const raw = (coach.service_packages||"").trim();
```

**Replace with:**
```js
    // Prefer the new column (text[] of bundle ids). Fall back to the legacy
    // comma-separated service_packages string so existing rows keep working
    // until they're migrated. Anything not in BUNDLE_ORDER is filtered out.
    const activeIds = Array.isArray(coach.bundles_active) && coach.bundles_active.length
      ? coach.bundles_active.filter(k => window.BUNDLE_ORDER.includes(k))
      : (coach.service_packages || "")
          .split(",").map(s => s.trim()).filter(Boolean)
          .map(s => {
            // Legacy: name → id; or already-an-id → keep
            const byId   = window.BUNDLES[s] ? s : null;
            const byName = packageByName(s);
            return byId || (byName ? byName.id : null);
          }).filter(Boolean);
    const raw = activeIds.join(",");  // keep downstream parsing if any
```

### 3e. Where prices are read, use the bundle price formula

If your render shows `$${pkg.price}` anywhere in the "More packages" panel, those need to be tier-aware now. Search the file for `pkg.price` (or `b.price`) and route through:

```js
const lvl = window.tierLevel(coach.selected_tier);
const rate = coach.tier_hourly_rate || window.TIER_RATES[lvl];
const price = pkg.price(rate);   // calling the function defined in bundles.js
```

---

## ④ PATCH — `checkout.html`

The current checkout receives `tier` + `tierPrice` + `addons` from URL params. The new bundle flow uses `coach` + `bundle` (id) and looks the price up from the matrix.

Two changes: (a) accept either old or new params for graceful migration, (b) compute the total from the matrix rather than trusting URL-supplied prices.

### 4a. Add the script tag

**Find** (line 8):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Replace with:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="bundles.js"></script>
```

### 4b. Replace the ADDONS lookup and recompute

**Find** (lines 121–162):
```js
  // Standard add-on packages (must match select-coach.html)
  const ADDONS={
    skill_clip:{name:"Skill Clip Review",price:15},
    session:{name:"Session Review",price:35},
    half_game:{name:"Half Game / Long Session Review",price:75},
    full_game:{name:"Full Game Review",price:120},
    elite_pkg:{name:"Elite Package",price:199}
  };

  const params=new URLSearchParams(window.location.search);
  const coachId=params.get("coach")||"";
  const coachName=params.get("coachName")||"Your Coach";
  const tierName=params.get("tier")||"Coaching Plan";
  const tierPrice=parseInt(params.get("tierPrice"))||0;
  const addonIds=(params.get("addons")||"").split(",").filter(Boolean);

  let discount=0; // dollars off
  let currentUser=null;

  function recomputeTotal(){
    let addonTotal=0;
    addonIds.forEach(id=>{if(ADDONS[id])addonTotal+=ADDONS[id].price;});
    let grand=tierPrice+addonTotal-discount;
    if(grand<0)grand=0;
    document.getElementById("grandTotal").textContent="$"+grand;
    return grand;
  }

  function renderLines(){
    let html=`
      <div class="line">
        <div>
          <div class="line-name">${tierName}</div>
          <div class="line-tag">Monthly subscription</div>
        </div>
        <div class="line-amt">$${tierPrice}/mo</div>
      </div>`;
    addonIds.forEach(id=>{
      const a=ADDONS[id];
      if(!a)return;
      html+=`
      <div class="line">
        <div>
          <div class="line-name">${a.name}</div>
          <div class="line-tag">One-off add-on</div>
        </div>
        <div class="line-amt">+$${a.price}</div>
      </div>`;
    });
    document.getElementById("lineItems").innerHTML=html;
  }
```

**Replace with:**
```js
  // Params accepted (new bundle flow):
  //   coach     — coach UUID
  //   coachName — display name
  //   bundle    — bundle id (starter/standard/pro)
  //   tierLevel — 1..4 (snapshot of the coach's level at checkout time)
  // The price is looked up from the matrix in bundles.js — never trust the
  // URL for the dollar amount.
  //
  // Legacy params (tier/tierPrice/addons) are still accepted so any in-flight
  // links from the old flow don't 404 — they just show a deprecated banner.
  const params      = new URLSearchParams(window.location.search);
  const coachId     = params.get("coach")    || "";
  const coachName   = params.get("coachName")|| "Your Coach";
  const bundleId    = params.get("bundle")   || "";
  const tierLevel   = parseInt(params.get("tierLevel")) || null;

  // Legacy fallbacks (only used if bundle param is missing)
  const legacyTier  = params.get("tier")  || "";
  const legacyPrice = parseInt(params.get("tierPrice")) || 0;
  const legacyAddons= (params.get("addons") || "").split(",").filter(Boolean);
  const isLegacy    = !bundleId && (legacyTier || legacyAddons.length);

  let discount = 0;   // dollars off
  let currentUser = null;

  function bundleSubtotal(){
    if (!bundleId || !window.BUNDLES || !window.BUNDLES[bundleId]) return 0;
    const lvl = tierLevel || 1;
    return window.bundlePrice(bundleId, lvl);
  }
  function legacySubtotal(){
    // Old ADDONS pricing — kept for in-flight links only.
    const OLD = { skill_clip:15, session:35, half_game:75, full_game:120, elite_pkg:199 };
    return legacyPrice + legacyAddons.reduce((s,id)=>s+(OLD[id]||0), 0);
  }

  function recomputeTotal(){
    const subtotal = isLegacy ? legacySubtotal() : bundleSubtotal();
    let grand = subtotal - discount;
    if (grand < 0) grand = 0;
    document.getElementById("grandTotal").textContent = "$" + grand;
    return grand;
  }

  function renderLines(){
    let html = "";
    if (!isLegacy && bundleId && window.BUNDLES[bundleId]) {
      const b = window.BUNDLES[bundleId];
      const lvl = tierLevel || 1;
      const price = window.bundlePrice(bundleId, lvl);
      const rateLabel = window.TIER_RATES[lvl] ? " · L" + lvl + " rate $" + window.TIER_RATES[lvl] + "/hr" : "";
      html += `
        <div class="line">
          <div>
            <div class="line-name">${b.name} bundle</div>
            <div class="line-tag">Monthly subscription${rateLabel}</div>
            <div class="line-desc">${b.summary}</div>
          </div>
          <div class="line-amt">$${price}/mo</div>
        </div>`;
      // List bundle contents inline so the athlete sees what they're paying for.
      html += '<div style="padding:8px 0 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:700;">Includes</div>';
      b.contents.forEach(c => {
        html += `<div style="font-size:12px;color:rgba(232,237,245,.78);padding:3px 0 3px 14px;position:relative;">
          <span style="position:absolute;left:0;top:3px;color:var(--green);">✓</span>${c}
        </div>`;
      });
    } else if (isLegacy) {
      // Render the old line-items shape exactly as before.
      const OLD = {
        skill_clip:{name:"Skill Clip Review",price:15},
        session:{name:"Session Review",price:35},
        half_game:{name:"Half Game / Long Session Review",price:75},
        full_game:{name:"Full Game Review",price:120},
        elite_pkg:{name:"Elite Package",price:199}
      };
      html = `
        <div class="line">
          <div>
            <div class="line-name">${legacyTier || "Coaching Plan"}</div>
            <div class="line-tag">Monthly subscription</div>
          </div>
          <div class="line-amt">$${legacyPrice}/mo</div>
        </div>`;
      legacyAddons.forEach(id => {
        const a = OLD[id]; if(!a) return;
        html += `
          <div class="line">
            <div>
              <div class="line-name">${a.name}</div>
              <div class="line-tag">One-off add-on</div>
            </div>
            <div class="line-amt">+$${a.price}</div>
          </div>`;
      });
    } else {
      html = `<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px;">No bundle selected. Please <a href="select-coach.html">choose a coach</a>.</div>`;
    }
    document.getElementById("lineItems").innerHTML = html;
  }
```

### 4c. Update the subscription insert

**Find** (around line 137):
```js
    const {error: subErr} = await sb.from("subscriptions").insert({
      athlete_id:   currentUser.id,
      coach_id:     coachId,
      status:       "active",
      package_name: tierName,
      billing_cycle:"Monthly"
    });
```

**Replace with:**
```js
    // Resolve the bundle name & price snapshot at insert time so a future
    // matrix change doesn't appear to retroactively reprice the athlete.
    const bundleObj = bundleId && window.BUNDLES[bundleId] ? window.BUNDLES[bundleId] : null;
    const priceSnapshot = bundleObj ? window.bundlePrice(bundleId, tierLevel || 1)
                                    : (isLegacy ? legacySubtotal() : 0);
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

> **Schema note:** the `subscriptions` table needs three new optional columns (`bundle_id text`, `tier_level int`, `monthly_price int`). They're nullable, so adding them is non-breaking for existing rows.

---

## ⑤ PATCH — `for-athletes.html`

Replace the "What it costs" block with copy that matches the matrix.

**Find** (lines 311–335):
```html
<!-- WHAT IT COSTS — 3 monthly bundles, priced by your coach's tier. -->
<section class="block">
  <div class="container">
    <div class="block-label">What it costs</div>
    <p class="lead" style="margin-bottom:6px;">Three monthly packages, offered by every coach. From <strong>$40 to $569/mo</strong> depending on your coach's tier — higher-tier coaches cost more per month.</p>
    <div class="price-grid">
      <div class="price-card">
        <div class="pname">Starter</div>
        <div class="pamt">$40–$120<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">2× skill reviews, session summary notes, and direct messaging each month.</div>
      </div>
      <div class="price-card">
        <div class="pname">Standard</div>
        <div class="pamt">$145–$337<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">4× skill reviews, a 30-min game review, session notes, messaging + AI movement overlay.</div>
      </div>
      <div class="price-card">
        <div class="pname">Pro</div>
        <div class="pamt">$249–$569<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">Everything in Standard plus a 60-min game review, a 30-min Zoom, and 4× 24-hour fast-track reviews.</div>
      </div>
    </div>
    <div class="price-note">Final pricing may vary. See current rates with each coach.</div>
  </div>
</section>
```

**Replace with:** (numbers now correct against the matrix; copy reflects what's actually in each bundle)
```html
<!-- WHAT IT COSTS — 3 monthly bundles, priced by your coach's tier. -->
<!-- Numbers verified against bundles.js — the canonical pricing matrix.   -->
<!-- L1 Development $48/hr → L4 Elite $144/hr drives the range per bundle. -->
<section class="block">
  <div class="container">
    <div class="block-label">What it costs</div>
    <p class="lead" style="margin-bottom:6px;">Three monthly bundles, offered by every coach. From <strong>$40 to $569/mo</strong> depending on your coach's tier — higher-tier coaches command higher hourly rates.</p>
    <div class="price-grid">
      <div class="price-card">
        <div class="pname">Starter</div>
        <div class="pamt">$40–$120<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">50 min coach time — 2× skill reviews, session summary notes, direct messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Standard</div>
        <div class="pamt">$145–$337<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">2 hr coach time + AI overlay — 4× skill reviews, a 30-min game review, session notes, messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Pro</div>
        <div class="pamt">$249–$569<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">3h 20m coach time + AI + Premium Fast Track — game review, 30-min Zoom, 4× 24h fast-track reviews.</div>
      </div>
    </div>
    <div class="price-note">Pricing scales with your coach's tier. See exact bundle prices on each coach's profile.</div>
  </div>
</section>
```

---

## ⑥ PATCH — `for-coaches.html`

Two blocks need fixing: the tier subscription panel (Level 4 currently shows $399 but foundation is $319) and the package grid.

### 6a. Reconcile L4 tier price

**Find** (lines 284–288):
```html
      <div class="price-card">
        <div class="pname">L4 Elite</div>
        <div class="pamt">$399<small>/mo</small></div>
        <div class="pdesc">Professional &amp; Olympic-pathway specialists. Top placement + mentoring.</div>
      </div>
```

**Replace with:**
```html
      <div class="price-card">
        <div class="pname">L4 Elite</div>
        <div class="pamt">$319<small>/mo</small></div>
        <div class="pdesc">Professional &amp; Olympic-pathway specialists. Top placement + mentoring.</div>
      </div>
```

> Founding cohort rates are $39 / $79 / $159 / $319 — the page already shows the lower three. L4 was the outlier.

### 6b. Update package grid copy to match bundles.js exactly

**Find** (lines 295–319):
```html
<!-- THE PACKAGES YOU OFFER — 3 standard bundles, priced by your tier. -->
<section class="block">
  <div class="container">
    <div class="block-label">The packages you offer</div>
    <h2>Offer up to 3 packages — pricing scales with your tier.</h2>
    <p class="lead" style="margin-bottom:8px;">Every coach offers the same three standard monthly packages. You don't set the price — it's calculated from your tier's hourly rate, so a higher tier earns more for the same package. Choose which to offer from your dashboard; you keep 80% of each.</p>
    <!-- Pricing values are placeholder/Foundation rates. Final pricing TBC — see pricing review spreadsheet. -->
    <div class="price-grid">
      <div class="price-card">
        <div class="pname">Starter</div>
        <div class="pamt">$40–$120<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">~50 min coach time / month — 2× skill reviews, session notes, messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Standard</div>
        <div class="pamt">$145–$337<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">~2 hr coach time / month + AI overlay — 4× skill reviews, a game review, notes, messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Pro</div>
        <div class="pamt">$249–$569<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">~3h20m coach time / month + AI + fast-track — game review, 30-min Zoom, 24h fast-track reviews.</div>
      </div>
    </div>
    <div class="price-note">Ranges span L1–L4 tiers. Final pricing may vary — see current rates with each coach.</div>
  </div>
</section>
```

**Replace with:** (same matrix; comment removed; copy tightened)
```html
<!-- THE PACKAGES YOU OFFER — 3 standard bundles, priced by your tier. -->
<!-- Prices verified against bundles.js (the canonical matrix). At L1 $48/hr, -->
<!-- Standard = 2hr × $48 + $49 AI = $145. At L4 $144/hr = $337. Same shape  -->
<!-- across Starter and Pro.                                                 -->
<section class="block">
  <div class="container">
    <div class="block-label">The packages you offer</div>
    <h2>Three bundles — pricing scales with your tier.</h2>
    <p class="lead" style="margin-bottom:8px;">Every coach offers the same three monthly bundles. You don't set the price — it's calculated from your tier's hourly rate. A higher tier earns more for the same bundle. Choose which to offer from your dashboard; you keep <strong>80%</strong> of each subscription.</p>
    <div class="price-grid">
      <div class="price-card">
        <div class="pname">Starter</div>
        <div class="pamt">$40–$120<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">50 min coach time / month — 2× skill reviews, session summary notes, direct messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Standard</div>
        <div class="pamt">$145–$337<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">2 hr coach time + AI overlay — 4× skill reviews, 30-min game review, 2× session notes, messaging.</div>
      </div>
      <div class="price-card">
        <div class="pname">Pro</div>
        <div class="pamt">$249–$569<small style="font-size:12px;font-weight:600;color:var(--muted);">/mo</small></div>
        <div class="pdesc">3h 20m coach time + AI + 4× Premium Fast Track — game review, 30-min Zoom, 24h turnaround reviews.</div>
      </div>
    </div>
    <div class="price-note">Ranges span L1 ($48/hr) to L4 ($144/hr). Each coach's exact prices show on their profile.</div>
  </div>
</section>
```

---

## ⑦ PATCH — `faq.html`

The athlete pricing answer currently describes the old per-item add-on model.

**Find** (line 168):
```html
<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)"><span>How much does coaching cost?</span><svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="faq-a"><p>Packages start from $15 for a single skill clip review. Each coach offers Starter ($15), Standard ($35), Pro ($75), Elite ($120) and Premium ($199) packages. You choose what suits your budget.</p></div></div>
```

**Replace with:**
```html
<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)"><span>How much does coaching cost?</span><svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="faq-a"><p>Athletes subscribe monthly to one of three bundles per coach. Starter is $40–$120/mo, Standard is $145–$337/mo, and Pro is $249–$569/mo — the range depends on the coach's tier (Level 1 Development through to Level 4 Elite). You can switch bundles or cancel anytime.</p></div></div>
```

The coach-side "How much can I earn?" answer (line 182) is also worth a refresh:

**Find:**
```html
<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)"><span>How much can I earn?</span><svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="faq-a"><p>You keep 80% of every package sold. A coach with 10 athletes across standard packages can earn $280–$1,590/month. Your earnings grow as your athlete base grows.</p></div></div>
```

**Replace with:**
```html
<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)"><span>How much can I earn?</span><svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="faq-a"><p>You keep <strong>80%</strong> of every athlete subscription. A Level 2 Representative coach with 10 athletes on the Standard bundle earns ~$1,544/month after commission. At Level 4 Elite, the same setup earns ~$2,696/month. Your earnings scale with both your athlete base and your tier.</p></div></div>
```

> Math check: L2 Standard = $193 × 0.8 × 10 = $1,544. L4 Standard = $337 × 0.8 × 10 = $2,696. ✓

---

## ⑧ Server-side TODOs (not in this patch but flagging them)

Five things have to land server-side before this can transact real money:

1. **`/netlify/functions/create-bundle-subscription`** needs the 12 Stripe Price IDs mapped by `{bundle, tier}`. Same shape as the existing function — just verify the mapping matches your Stripe dashboard.

2. **`subscriptions` table** needs three new optional columns:
   ```sql
   alter table subscriptions add column bundle_id text;
   alter table subscriptions add column tier_level int;
   alter table subscriptions add column monthly_price int;
   ```

3. **`profiles.tier_hourly_rate`** column should be backfilled for existing coaches:
   ```sql
   update profiles
   set tier_hourly_rate = case
     when selected_tier ilike 'Level 1%' then 48
     when selected_tier ilike 'Level 2%' then 72
     when selected_tier ilike 'Level 3%' then 108
     when selected_tier ilike 'Level 4%' then 144
   end
   where role='coach' and tier_hourly_rate is null;
   ```

4. **`profiles.bundles_active`** column should default to all three bundles for existing coaches:
   ```sql
   update profiles
   set bundles_active = array['starter','standard','pro']
   where role='coach' and bundles_active is null;
   ```

5. **Founding cohort waiver** — the existing code charges the tier subscription via Stripe at signup. The first 15 coaches need that waived until cumulative earnings hit $500. Cleanest implementation: a `founding_member` flag on `profiles` + an admin flip after the $500 threshold. The Stripe Connect Application Fee (20% commission) keeps applying through both stages — only the tier subscription is waived.

---

*End of patches. Drop `bundles.js` into your repo root, then apply each patch in order. Test path: athlete picks coach → bundle subscribe → checkout shows correct matrix-derived price → subscription row carries `bundle_id` + `tier_level` + `monthly_price`. Coach side: tier setup pre-fills hourly rate, bundle toggle persists to `bundles_active`, earnings estimator uses the new matrix.*
