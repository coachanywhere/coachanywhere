# CoachAnywhere — Pilot B2 (Manual Payouts) Migration

This converts the pilot from Connect splits (B1, never deployed) to manual bank
transfers (B2). The athlete-side flow is unchanged. Connect can be wired up
properly later and the pilot migrated then.

## What's in this drop

Five files:

1. **`bundles.js`** — overwrites your existing one. Adds `PILOT_PAYOUT_MODE = "manual"` config; everything else unchanged.
2. **`pilot-manual-payouts-migration.sql`** — Supabase migration. Run after the original `pilot-migration.sql`.
3. **`create-bundle-subscription.js`** — new Netlify function. Athletes use this to start their Stripe Checkout.
4. **`pilot-payout-handler.js`** — new Netlify function. Stripe webhook records what's owed to each coach.
5. **`pilot-migration-patches-b2.md`** — this file. Apply patches ① through ⑤ below in Claude Code.

## Order of operations

1. Save all five files to your repo (Netlify functions go in `/.netlify/functions/`).
2. Run the SQL in Supabase.
3. Apply patches ①–⑤ below via Claude Code.
4. Set Netlify env vars (see Phase 3 of the runbook).
5. Create Stripe product + webhook (see Phase 2 + 4).
6. Deploy.
7. Smoke test.

---

## ① PATCH — `coach-signup.html` — add bank details to signup

Coaches need to give you BSB + account number for payouts. Easiest place to capture is at signup.

### 1a. Add bank details fields to the coach signup form

Find the existing form fields (after "mobile" and before the password fields, around the section showing the contact details). Add this block:

```html
<!-- Bank details for manual coach payouts (pilot mode).
     Required so we can pay you for athlete subscriptions. -->
<div style="margin-top:18px;padding:16px 18px;border-radius:12px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);">
  <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#fbbf24;text-transform:uppercase;margin-bottom:8px;">Bank details for payouts</div>
  <div style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.55;margin-bottom:14px;">During the pilot, we pay you $60/month per active athlete via bank transfer. These details go to our admin only — never shared with athletes.</div>

  <label style="display:block;margin-bottom:10px;">
    <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">Account name</div>
    <input type="text" id="payoutAccountName" required placeholder="Full name as it appears on bank account"
           style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;"/>
  </label>

  <div style="display:flex;gap:10px;">
    <label style="flex:0 0 130px;">
      <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">BSB</div>
      <input type="text" id="payoutBsb" required pattern="[0-9]{3}-?[0-9]{3}" maxlength="7" placeholder="000-000"
             style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;font-family:ui-monospace,monospace;"/>
    </label>
    <label style="flex:1;">
      <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">Account number</div>
      <input type="text" id="payoutAccountNumber" required pattern="[0-9]{6,10}" maxlength="10" placeholder="123456789"
             style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;font-family:ui-monospace,monospace;"/>
    </label>
  </div>
</div>
```

### 1b. Persist the values at signup

Find the form-submit handler. **After** the existing `auth.signUp` success — wherever you currently insert/update the profiles row — add the payout fields. Look for the existing `sb.from("profiles").insert(...)` or `.update(...)` call and add these fields:

```js
// In the profiles insert/update payload, add:
payout_account_name:   document.getElementById("payoutAccountName").value.trim(),
payout_bsb:            document.getElementById("payoutBsb").value.replace(/-/g, ""),
payout_account_number: document.getElementById("payoutAccountNumber").value.trim(),
payout_method:         "bank-transfer"
```

If the profiles row is created in `coach-profile-setup.html` rather than `coach-signup.html`, move this whole block (including the form fields above) to that page instead — wherever the coach's profile is first created.

### 1c. Validate before submit

Find the existing form-submit handler. **Add a validation block** at the top:

```js
// Pilot mode validation: bank details required
const _isPilotCoach = new URLSearchParams(window.location.search).get("pilot") === "coach";
if (_isPilotCoach) {
  const bsb = document.getElementById("payoutBsb").value.replace(/-/g, "");
  const acc = document.getElementById("payoutAccountNumber").value.trim();
  const name = document.getElementById("payoutAccountName").value.trim();
  if (!/^\d{6}$/.test(bsb)) {
    alert("Please enter a valid 6-digit BSB."); return;
  }
  if (!/^\d{6,10}$/.test(acc)) {
    alert("Please enter a valid bank account number (6-10 digits)."); return;
  }
  if (!name || name.length < 2) {
    alert("Please enter the account name."); return;
  }
}
```

---

## ② PATCH — `coach-dashboard.html` — show "you'll be paid $X this month"

The earnings panel for pilot coaches needs a refresh: total + itemised breakdown of pending payouts.

### 2a. Update `renderPilotEarnings()` to query `pilot_coach_earnings` view

You already have a `renderPilotEarnings()` function from the prior B1 patch. Replace its body with this manual-payouts version:

**Find** (the existing `renderPilotEarnings` function):
```js
async function renderPilotEarnings() {
  // ... existing B1 code ...
}
```

**Replace with:**
```js
async function renderPilotEarnings() {
  if (!window._isPilotCoach) return;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const target = document.getElementById("earningsPanel")
              || document.getElementById("earningsBody");
  if (!target) return;

  // Read the rolled-up earnings view for active athletes
  const { data: earningsRow } = await sb
    .from("pilot_coach_earnings")
    .select("active_athletes, amount_dollars")
    .eq("coach_id", currentUser.id)
    .maybeSingle();

  const activeAthletes = (earningsRow && earningsRow.active_athletes) || 0;
  const monthlyDollars = (earningsRow && earningsRow.amount_dollars)   || 0;

  // Pull the itemised pending + paid history (this month)
  const { data: payoutRows } = await sb
    .from("pilot_payouts")
    .select("id, athlete_id, amount_cents, status, paid_at, month, created_at")
    .eq("coach_id", currentUser.id)
    .eq("month", currentMonth)
    .order("created_at", { ascending: false });

  // Pull athlete names so we can show "Sarah J. — $60 — Pending"
  const athleteIds = [...new Set((payoutRows || []).map(r => r.athlete_id))];
  let athleteNames = {};
  if (athleteIds.length) {
    const { data: ppl } = await sb
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", athleteIds);
    (ppl || []).forEach(p => {
      athleteNames[p.id] = (p.first_name || "") + " " + (p.last_name || "").charAt(0) + ".";
    });
  }

  const pending = (payoutRows || []).filter(r => r.status === "pending");
  const paid    = (payoutRows || []).filter(r => r.status === "paid");
  const pendingTotal = pending.reduce((s, r) => s + r.amount_cents, 0) / 100;
  const paidTotal    = paid.reduce((s, r) => s + r.amount_cents, 0) / 100;

  const rowHtml = (r) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <div>
        <div style="font-size:13px;color:#f1f5f9;font-weight:600;">${athleteNames[r.athlete_id] || "Athlete"}</div>
        <div style="font-size:11px;color:var(--muted);">${new Date(r.created_at).toLocaleDateString()}${r.paid_at ? " · Paid " + new Date(r.paid_at).toLocaleDateString() : ""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:700;color:${r.status === 'paid' ? '#86efac' : '#fbbf24'};">$${(r.amount_cents/100).toFixed(2)}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${r.status === 'paid' ? '#86efac' : 'var(--muted)'};font-weight:700;">${r.status}</div>
      </div>
    </div>`;

  target.innerHTML = `
    <div style="padding:20px 22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:14px;flex-wrap:wrap;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:.18em;color:var(--amber3);text-transform:uppercase;margin-bottom:6px;">Pilot Earnings · ${currentMonth}</div>
          <div style="font-size:32px;font-weight:800;color:#f9fafb;line-height:1;">$${monthlyDollars}<span style="font-size:14px;font-weight:600;color:var(--muted);">/mo</span></div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">${activeAthletes} active athlete${activeAthletes === 1 ? "" : "s"} × $60/month</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Pending</div>
          <div style="font-size:22px;font-weight:700;color:#fbbf24;">$${pendingTotal.toFixed(2)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px;">Paid this month</div>
          <div style="font-size:14px;font-weight:600;color:#86efac;">$${paidTotal.toFixed(2)}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.55;">
        Athletes pay $49/mo via Stripe. CoachAnywhere pays you <strong style="color:#f1f5f9;">$60 per active athlete</strong> by bank transfer, typically within 24-48 hours of each successful invoice.
      </div>
      ${pending.length ? `
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px;">Pending payouts</div>
        ${pending.map(rowHtml).join("")}
      ` : ""}
      ${paid.length ? `
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px;">Paid this month</div>
        ${paid.map(rowHtml).join("")}
      ` : ""}
      ${(!pending.length && !paid.length) ? `
        <div style="padding:24px;text-align:center;font-size:13px;color:var(--muted);">No payouts yet this month. They appear here within 24h of each athlete's invoice.</div>
      ` : ""}
    </div>`;
}
```

### 2b. Add a "bank details on file" badge

Below the earnings card, add a small confirmation that lets the coach see what bank account we have on file (so they can update if it changed).

Find the part of the dashboard that shows the coach's profile info (probably in a Settings section or sidebar). Add this block somewhere it makes sense — could be next to the earnings panel:

```js
// In an init function where you load the coach profile, after p is fetched:
if (window._isPilotCoach && p) {
  const bankEl = document.getElementById("bankDetailsBadge");
  if (bankEl) {
    if (p.payout_bsb && p.payout_account_number) {
      const masked = p.payout_account_number.slice(0, 2) + "****" + p.payout_account_number.slice(-2);
      bankEl.innerHTML = `
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Payouts go to</div>
        <div style="font-size:13px;color:#f1f5f9;font-weight:600;">${p.payout_account_name || "—"}</div>
        <div style="font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;margin-top:2px;">BSB ${p.payout_bsb.slice(0,3)}-${p.payout_bsb.slice(3)} · Acct ${masked}</div>
        <div style="font-size:11px;color:var(--blue2);margin-top:8px;"><a href="settings.html" style="color:inherit;">Update →</a></div>`;
    } else {
      bankEl.innerHTML = `
        <div style="padding:14px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);">
          <div style="font-size:12px;font-weight:700;color:#fca5a5;margin-bottom:4px;">⚠ Bank details missing</div>
          <div style="font-size:11px;color:rgba(232,237,245,.7);line-height:1.5;">We can't pay you without your BSB + account number. <a href="settings.html" style="color:#60a5fa;">Add them now →</a></div>
        </div>`;
    }
  }
}
```

And in the HTML, add an empty `<div id="bankDetailsBadge"></div>` somewhere sensible (e.g. next to the earnings panel).

---

## ③ PATCH — `admin.html` — pilot payouts dashboard section

Add a "Pilot Payouts" section so you can see what's owed and mark each one as paid.

### 3a. Add the HTML section

Find the existing "Pilot invite codes" section you added previously. **Immediately after** that section, add:

```html
<!-- ══ PILOT PAYOUTS DUE ══ -->
<section class="row">
  <div class="row-label">Pilot payouts due</div>
  <div class="kpi-card" style="grid-column: 1 / -1;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:14px;flex-wrap:wrap;">
      <div>
        <div class="kpi-label">Pending payouts</div>
        <div class="kpi-value" id="pilotPayoutsPendingTotal">…</div>
        <div class="kpi-sub" id="pilotPayoutsPendingCount">— transfers needed</div>
      </div>
      <div>
        <div class="kpi-label">Paid this month</div>
        <div class="kpi-value" id="pilotPayoutsPaidTotal" style="color:#86efac;">…</div>
        <div class="kpi-sub" id="pilotPayoutsPaidCount">—</div>
      </div>
      <button id="refreshPayoutsBtn" class="refresh-btn">Refresh</button>
    </div>
    <div id="pilotPayoutsTable" style="margin-top:14px;font-size:13px;"></div>
  </div>
</section>
```

### 3b. Add the JS to load + render the payouts table

In the admin's init flow (after the gate, alongside `loadPilotCodes()`):

```js
// ── PILOT PAYOUTS PANEL ────────────────────────────────────────────────
async function loadPilotPayouts() {
  // Pull pending + recent paid payouts with coach details
  const { data: summary, error } = await sb
    .from("pilot_payouts_admin_summary")
    .select("*")
    .order("month", { ascending: false });

  if (error) {
    console.error("[admin] payouts query failed:", error);
    document.getElementById("pilotPayoutsTable").innerHTML =
      '<div style="padding:14px;color:#fca5a5;">Failed to load payouts.</div>';
    return;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = (summary || []).filter(r => r.month === currentMonth);

  const pendingTotal = thisMonth.reduce((s, r) => s + (r.pending_cents || 0), 0) / 100;
  const paidTotal    = thisMonth.reduce((s, r) => s + (r.paid_cents || 0), 0) / 100;
  const pendingCount = thisMonth.reduce((s, r) => s + (r.pending_count || 0), 0);
  const paidCount    = thisMonth.reduce((s, r) => s + (r.paid_count || 0), 0);

  document.getElementById("pilotPayoutsPendingTotal").textContent = "$" + pendingTotal.toFixed(2);
  document.getElementById("pilotPayoutsPendingCount").textContent =
    pendingCount + " transfer" + (pendingCount === 1 ? "" : "s") + " needed";
  document.getElementById("pilotPayoutsPaidTotal").textContent = "$" + paidTotal.toFixed(2);
  document.getElementById("pilotPayoutsPaidCount").textContent =
    paidCount + " transfer" + (paidCount === 1 ? "" : "s") + " sent";

  // Pull individual line items for the current month
  const { data: lines } = await sb
    .from("pilot_payouts")
    .select("id, coach_id, athlete_id, amount_cents, status, created_at, paid_at, payment_reference, stripe_invoice_id")
    .eq("month", currentMonth)
    .order("created_at", { ascending: false });

  // Join coach + athlete names from summary + a profiles fetch
  const profileIds = [...new Set([
    ...(lines || []).map(l => l.coach_id),
    ...(lines || []).map(l => l.athlete_id)
  ])];
  let names = {}, banks = {};
  if (profileIds.length) {
    const { data: pp } = await sb
      .from("profiles")
      .select("id, first_name, last_name, payout_bsb, payout_account_number, payout_account_name")
      .in("id", profileIds);
    (pp || []).forEach(p => {
      names[p.id] = (p.first_name || "") + " " + (p.last_name || "");
      banks[p.id] = {
        name: p.payout_account_name,
        bsb:  p.payout_bsb,
        acct: p.payout_account_number
      };
    });
  }

  const rowsHtml = (lines || []).map(l => {
    const bank = banks[l.coach_id] || {};
    const bankStr = bank.bsb
      ? bank.bsb.slice(0,3) + "-" + bank.bsb.slice(3) + " / " + (bank.acct || "—")
      : '<span style="color:#fca5a5;">⚠ no bank details</span>';
    const statusBadge = l.status === "paid"
      ? '<span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#86efac;background:rgba(34,197,94,.12);padding:3px 8px;border-radius:6px;">Paid</span>'
      : '<span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fbbf24;background:rgba(250,204,21,.12);padding:3px 8px;border-radius:6px;">Pending</span>';
    const action = l.status === "pending"
      ? `<button onclick="markPaid('${l.id}')" style="padding:5px 12px;border-radius:6px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Mark paid</button>`
      : (l.payment_reference ? `<span style="font-size:11px;color:var(--muted);">Ref: ${l.payment_reference}</span>` : "");

    return `
      <div style="display:grid;grid-template-columns: 1.4fr 1.4fr 1fr 1fr 1.4fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <div>
          <div style="font-weight:600;color:#f1f5f9;">${names[l.coach_id] || "Coach"}</div>
          <div style="font-size:11px;color:var(--muted);">${bank.name || ""}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);font-family:ui-monospace,monospace;">${bankStr}</div>
        <div style="font-size:12px;color:var(--muted);">for ${names[l.athlete_id] || "Athlete"}</div>
        <div style="font-weight:700;color:#fbbf24;">$${(l.amount_cents/100).toFixed(2)}</div>
        <div>${statusBadge}<div style="font-size:10px;color:var(--muted);margin-top:3px;">${new Date(l.created_at).toLocaleDateString()}</div></div>
        <div>${action}</div>
      </div>`;
  }).join("");

  document.getElementById("pilotPayoutsTable").innerHTML =
    rowsHtml || '<div style="padding:20px;text-align:center;color:var(--muted);">No payouts this month yet.</div>';
}

async function markPaid(payoutId) {
  const ref = prompt("Bank transfer reference (optional):") || "";
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    alert("Not authenticated.");
    return;
  }
  const { error } = await sb.rpc("mark_pilot_payout_paid", {
    p_payout_id: payoutId,
    p_admin_id:  user.id,
    p_reference: ref || null,
    p_notes:     null
  });
  if (error) {
    alert("Failed to mark paid: " + error.message);
    return;
  }
  loadPilotPayouts();
}

window.markPaid = markPaid;
document.getElementById("refreshPayoutsBtn").addEventListener("click", loadPilotPayouts);

// Refresh on first load + every 60s
loadPilotPayouts();
setInterval(loadPilotPayouts, 60 * 1000);
```

---

## ④ PATCH — `pilot-coaches.html` — update copy

The current page says "$60/month per athlete · paid via Stripe Connect." Change to manual bank transfer messaging.

### 4a. Update the offer card

**Find** the offer-list section (the bulleted list of what coaches get):
```html
    <div class="offer-list">
      <div class="offer-item">
        <svg ...><polyline points="20 6 9 17 4 12"/></svg>
        <strong style="color:#f1f5f9;">$60 per active athlete per month</strong> — paid via Stripe Connect
      </div>
```

**Replace the first `.offer-item`** with:
```html
    <div class="offer-list">
      <div class="offer-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <strong style="color:#f1f5f9;">$60 per active athlete per month</strong> — paid by bank transfer, within 24-48h of each invoice
      </div>
```

### 4b. Update the "What happens next" section

**Find:**
```html
    <div class="next-step">
      <div class="next-num">3</div>
      <div class="next-text">Connect your Stripe account so we can pay you. Athletes pay via Stripe; we handle the platform top-up automatically.</div>
    </div>
    <div class="next-step">
      <div class="next-num">4</div>
      <div class="next-text">Athletes pick you from the pilot cohort. You review their uploads weekly. <strong>$60/month per active athlete</strong> arrives in your Stripe account.</div>
    </div>
```

**Replace with:**
```html
    <div class="next-step">
      <div class="next-num">3</div>
      <div class="next-text">Add your BSB + bank account so we can pay you. We pay manually during the pilot — full Stripe payouts kick in for the public launch.</div>
    </div>
    <div class="next-step">
      <div class="next-num">4</div>
      <div class="next-text">Athletes pick you from the pilot cohort. You review their uploads weekly. <strong>$60/month per active athlete</strong> hits your bank account within 24-48h of each invoice.</div>
    </div>
```

### 4c. Update the "How the $60 works" panel

**Find** the entire `<div class="econ">` block.

**Replace with:**
```html
  <div class="econ">
    <div class="econ-label">How the $60 works</div>
    <div class="econ-row">
      <span class="left">Athlete subscription</span>
      <span class="right">$49 / month</span>
    </div>
    <div class="econ-row">
      <span class="left">Goes to CoachAnywhere (covers platform + Stripe fees)</span>
      <span class="right">$49</span>
    </div>
    <div class="econ-row">
      <span class="left">CoachAnywhere pays you (covers the gap + premium)</span>
      <span class="right">$60</span>
    </div>
    <div class="econ-row">
      <span class="left">You receive (via bank transfer)</span>
      <span class="right" style="color:var(--amber-lt);">$60.00</span>
    </div>
  </div>
  <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.5;">CoachAnywhere absorbs the gap between athlete payments and your $60 during the pilot — part of why pilot intake is capped at 20 athletes. Stripe Connect (automated payouts) ships for the public launch.</div>
```

---

## ⑤ PATCH — `coach-profile-setup.html` — already correct, just verify

This file was previously patched to skip Stripe tier checkout for pilot coaches and go straight to `profile_status='Live'`. That logic is **unchanged** in B2 mode — no Connect onboarding step is needed because there's no Connect.

**Verification only** — no edits required. Run this manually after patching, just to confirm the existing flow still works:

1. Open `coach-profile-setup.html`
2. Find the `_isPilotCoach` check at submit (should be from the earlier patch)
3. Confirm it routes to `coach-dashboard.html` directly, no Stripe call

If it's there, you're done with this patch.

---

## Stripe & deployment checklist (for the launch runbook)

After patches applied:

1. **Stripe product** — `Founding Athlete Pilot`, $49 AUD monthly. Copy price_xxx → Netlify env `STRIPE_PILOT_PRICE_ID`.
2. **Stripe webhook** — endpoint `<site>/.netlify/functions/pilot-payout-handler`, event `invoice.payment_succeeded`. Copy whsec_xxx → Netlify env `STRIPE_WEBHOOK_SECRET_PILOT_PAYOUT`.
3. **Netlify env vars** required:
   - `STRIPE_SECRET_KEY` (sk_test or sk_live)
   - `STRIPE_PILOT_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET_PILOT_PAYOUT`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL`
4. **Run the SQL** — `pilot-manual-payouts-migration.sql`.
5. **Mint 20 codes** — via admin panel.
6. **Smoke test** — sign up test coach via `/pilot-coaches.html?pilot=coach`, complete profile WITH bank details, sign up test athlete via `/pilot.html` with a test code, subscribe with card `4242 4242 4242 4242`. Verify `pilot_payouts` row appears with status 'pending'. Admin panel shows payout. Click "Mark paid" — row flips to 'paid'.
7. **Pay coaches** — once a real athlete subscribes and webhook fires, you'll see the pending payout in admin. Make the bank transfer, paste the bank reference into the "Mark paid" prompt, done.

---

*End of B2 patches.*
