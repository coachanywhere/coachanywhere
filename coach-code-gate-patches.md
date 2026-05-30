# CoachAnywhere — Coach Code Gate Patches

This adds invite-code-only access to coach signup, matching the athlete
flow. After this is applied:

- `/pilot-coaches.html` requires a `COACH-XXXX` code before letting anyone sign up
- `/coach-signup.html` blocks direct access during `PILOT_MODE = true` unless a valid code is in the URL
- Marketing CTAs ("Become a coach" buttons) redirect to `/waitlist.html?role=coach`
- Admin panel has a "Mint coach code" button and copy-email/SMS templates for each code

Run the `coach-codes-migration.sql` in Supabase first. Then apply the patches below.

---

## ① PATCH — `pilot-coaches.html` — add code gate

The page currently has a "Get started" button that links straight to `/coach-signup.html?pilot=coach`. We add an invite-code input above it that validates against the `pilot_codes` table before forwarding to signup.

### 1a. Add the code-gate UI in the offer card

**Find** the existing CTA row at the bottom of the offer card. It looks something like:

```html
    <div class="cta-row">
      <button class="cta-btn" onclick="window.location.href='coach-signup.html?pilot=coach'">Get started →</button>
      <span class="cta-note">Takes ~10 min to complete intake</span>
    </div>
```

**Replace with:**

```html
    <!-- INVITE CODE GATE — coach must enter a valid COACH-XXXX before signup -->
    <div class="code-gate" id="codeGate" style="background:rgba(255,255,255,.04);border:1px solid rgba(245,158,11,.3);border-radius:14px;padding:20px 22px;margin-top:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#fbbf24;margin-bottom:10px;">Enter your invite code</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <input type="text" id="codeInput"
               placeholder="e.g. COACH-A7K2" autocomplete="off"
               autocapitalize="characters" spellcheck="false"
               style="flex:1;min-width:220px;padding:13px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.3);color:#f1f5f9;font-size:15px;font-family:inherit;outline:none;letter-spacing:.04em;font-weight:600;text-transform:uppercase;"/>
        <button class="cta-btn" id="codeBtn" onclick="validateCoachCode()">Continue →</button>
      </div>
      <div id="codeMsg" style="font-size:13px;margin-top:10px;display:none;"></div>
      <div style="font-size:12px;color:rgba(232,237,245,.55);margin-top:12px;line-height:1.55;">
        Codes were sent by email or SMS to invited coaches. Lost yours?
        <a href="contact.html" style="color:#fbbf24;">Message us</a> and we'll resend.
      </div>
    </div>
```

### 1b. Add the validation script

**Find** the closing `</body>` tag at the very bottom of `pilot-coaches.html`. **Immediately before** the `</body>` tag, insert:

```html
<script>
  // ── Coach code validation ─────────────────────────────────────────────
  // We do NOT claim the code here — claim happens server-side at signup
  // (matches the athlete flow). Here we just verify the code exists and
  // is unused, then route to coach-signup with the code in the URL.
  const SB_URL = "https://rtaxjewvshhpdnkpojjn.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YXhqZXd2c2hocGRua3BvampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTY5ODgsImV4cCI6MjA5NDQ5Mjk4OH0.PSyoFEAKA0J2pZfIE1QkyziF1quetXelhPzuGqpZbhk";
  const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:false } });

  async function validateCoachCode(){
    const code = document.getElementById("codeInput").value.trim().toUpperCase();
    const msg  = document.getElementById("codeMsg");
    const btn  = document.getElementById("codeBtn");

    msg.style.display = "block";
    msg.style.color   = "";

    if(!code){
      msg.style.color = "#fca5a5";
      msg.textContent = "Enter your invite code.";
      return;
    }

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = "Checking...";

    try {
      const { data, error } = await sb.from("pilot_codes")
        .select("code, used_at, code_type")
        .eq("code", code)
        .maybeSingle();

      if(error){
        msg.style.color = "#fca5a5";
        msg.textContent = "Couldn't check that code. Try again or contact support.";
        btn.disabled = false; btn.textContent = origText;
        return;
      }
      if(!data){
        msg.style.color = "#fca5a5";
        msg.textContent = "That code isn't valid. Double-check your invite.";
        btn.disabled = false; btn.textContent = origText;
        return;
      }
      if(data.code_type !== "coach"){
        msg.style.color = "#fca5a5";
        msg.textContent = "That code is for athletes, not coaches.";
        btn.disabled = false; btn.textContent = origText;
        return;
      }
      if(data.used_at){
        msg.style.color = "#fca5a5";
        msg.textContent = "That code has already been used. Contact us if this is wrong.";
        btn.disabled = false; btn.textContent = origText;
        return;
      }

      // Valid — route to coach signup carrying the code through.
      msg.style.color = "#86efac";
      msg.textContent = "✓ Code valid. Taking you to sign up...";
      setTimeout(() => {
        window.location.href = "coach-signup.html?pilot=coach&code=" + encodeURIComponent(code);
      }, 600);
    } catch(e) {
      msg.style.color = "#fca5a5";
      msg.textContent = "Network error. Try again.";
      btn.disabled = false; btn.textContent = origText;
    }
  }

  document.getElementById("codeInput").addEventListener("keydown", e => {
    if(e.key === "Enter") validateCoachCode();
  });

  // Pre-fill code from URL if present (e.g. coach scanned QR with code in URL)
  (function(){
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if(code){
      document.getElementById("codeInput").value = code.toUpperCase();
      // Auto-validate
      setTimeout(validateCoachCode, 200);
    }
  })();
</script>
```

### 1c. Make sure the Supabase JS library loads

If `pilot-coaches.html` doesn't already have the Supabase script tag in `<head>` (the current version may not — it has bundles.js but maybe not supabase-js), add it. Find:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="bundles.js"></script>
```

If only `bundles.js` is there but not the supabase-js line above it, add the supabase-js script tag.

---

## ② PATCH — `coach-signup.html` — claim coach code + block direct access

### 2a. Block direct access when in pilot mode without a valid code

Find the init block (search for where `?pilot=coach` is currently detected — should be from the earlier B2 patch, around the line `const _isPilotCoach = new URLSearchParams(window.location.search).get("pilot") === "coach";`).

**Replace that detection block with:**

```js
// ── PILOT COACH GATE ──────────────────────────────────────────────────
// During PILOT_MODE, coach signup is invite-only. Anyone hitting this page
// without ?pilot=coach&code=COACH-XXXX gets redirected to pilot-coaches.html
// where they have to enter their code. Anyone WITH a code passes through.
const _coachParams = new URLSearchParams(window.location.search);
const _isPilotCoach = _coachParams.get("pilot") === "coach";
const _coachCode = (_coachParams.get("code") || "").toUpperCase();

if (window.PILOT_MODE && !_isPilotCoach) {
  window.location.replace("pilot-coaches.html");
}

if (_isPilotCoach && !_coachCode) {
  // pilot=coach was set but no code — also redirect
  window.location.replace("pilot-coaches.html");
}

if(_isPilotCoach){
  const banner = document.getElementById("pilotBanner");
  if(banner) banner.style.display = "block";
}
```

### 2b. Claim the code at signup

In the signup-submit handler, find the existing successful `auth.signUp` block (where `data.user.id` is created). **After** the profile insert/upsert (or after `signUp` resolves successfully if no profile insert happens at signup), add:

```js
// ── CLAIM COACH CODE ──────────────────────────────────────────────────
// Only if this is a pilot-coach signup with a code. Calls the RPC which
// atomically validates the code, checks it's a 'coach' type, and marks
// it claimed. On success, persists pilot_status='coach' on the profile.
if(_isPilotCoach && _coachCode){
  try {
    const { data: claimData, error: claimErr } = await sb.rpc(
      "validate_and_claim_pilot_code",
      {
        p_code: _coachCode,
        p_user_id: data.user.id,
        p_expected_type: "coach"
      }
    );
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if(claimErr || !claim || !claim.ok){
      const reason = (claim && claim.reason) || (claimErr && claimErr.message) || "unknown";
      console.warn("[pilot] coach code claim failed:", reason);
      alert("Your invite code couldn't be validated (" + reason + "). " +
            "Your account has been created — please contact support to " +
            "activate your pilot coach access.");
    } else {
      // Stamp pilot_status='coach' so dashboards/setup pages recognise them.
      await sb.from("profiles").update({
        pilot_status:     "coach",
        pilot_started_at: new Date().toISOString()
      }).eq("id", data.user.id);
    }
  } catch(e) {
    console.warn("[pilot] coach code claim threw:", e);
  }
}
```

Make sure this block runs **inside the same async function** as the signup and **before** any redirect to `coach-profile-setup.html`.

---

## ③ PATCH — `index.html` — redirect coach CTA to waitlist during pilot

The homepage has role-entry cards including one for coaches.

**Find** the coach card / button. It probably looks like:

```html
<a href="coach-signup.html" ...>...Become a coach...</a>
```

or a `<button onclick="window.location.href='coach-signup.html'">`.

**Add a JavaScript redirect** at the bottom of `index.html`, just before `</body>`:

```html
<script>
  // ── PILOT MODE — redirect coach signup CTAs to waitlist ──────────────
  // While PILOT_MODE = true, coaches sign up by invite only (via the QR card).
  // Anyone clicking "become a coach" from the public site goes to waitlist
  // so we capture demand for post-pilot launch.
  (function(){
    if (!window.PILOT_MODE) return;
    document.querySelectorAll('a[href*="coach-signup"], button[onclick*="coach-signup"]').forEach(el => {
      if (el.tagName === 'A') {
        el.href = 'waitlist.html?role=coach';
      } else {
        // Button with onclick — replace it
        el.removeAttribute('onclick');
        el.addEventListener('click', () => window.location.href = 'waitlist.html?role=coach');
      }
    });
  })();
</script>
```

Make sure `bundles.js` is loaded before this script (it sets `window.PILOT_MODE`).

---

## ④ PATCH — `for-coaches.html` — redirect coach CTA to waitlist during pilot

Same treatment as `index.html`. Add this script just before `</body>`:

```html
<script>
  // ── PILOT MODE — redirect coach signup CTAs to waitlist ──────────────
  (function(){
    if (!window.PILOT_MODE) return;
    document.querySelectorAll('a[href*="coach-signup"], button[onclick*="coach-signup"]').forEach(el => {
      if (el.tagName === 'A') {
        el.href = 'waitlist.html?role=coach';
      } else {
        el.removeAttribute('onclick');
        el.addEventListener('click', () => window.location.href = 'waitlist.html?role=coach');
      }
    });
  })();
</script>
```

(Same script as Patch ③ — purposefully duplicated rather than abstracted, because both pages may be touched by other devs and we want each self-contained.)

---

## ⑤ PATCH — `admin.html` — mint coach codes + copy-message templates

### 5a. Add a "Mint coach code" button alongside the existing athlete one

**Find** the existing "Pilot invite codes" section. Look for the `mintCodeBtn` button or `Mint new code` text.

**Replace the button row** (the row with "Mint new code") with:

```html
<div style="display:flex;gap:10px;flex-wrap:wrap;">
  <button id="mintAthleteCodeBtn" class="refresh-btn" style="background:linear-gradient(135deg,#facc15,#d97706);color:#0a0f1a;font-weight:700;">
    + Mint athlete code
  </button>
  <button id="mintCoachCodeBtn" class="refresh-btn" style="background:linear-gradient(135deg,#fbbf24,#92400e);color:#fff;font-weight:700;">
    + Mint coach code
  </button>
</div>
```

### 5b. Update the JS to handle both types + show code type in the table

**Find** the `mintCode()` function and `loadPilotCodes()` function. **Replace both with:**

```js
async function loadPilotCodes(){
  const { data: codes } = await sb.from("pilot_codes")
    .select("code, athlete_email, used_at, notes, created_at, code_type")
    .order("created_at", { ascending: false });

  const used_a = (codes || []).filter(c => c.used_at && c.code_type !== "coach").length;
  const used_c = (codes || []).filter(c => c.used_at && c.code_type === "coach").length;
  const total_a = (codes || []).filter(c => c.code_type !== "coach").length;
  const total_c = (codes || []).filter(c => c.code_type === "coach").length;

  document.getElementById("pilotCodesUsed").textContent =
    `Athletes ${used_a}/${total_a}  ·  Coaches ${used_c}/${total_c}`;
  document.getElementById("pilotCodesSub").textContent =
    `Athletes capped at 20  ·  Coaches managed manually`;

  const rows = (codes || []).map(c => {
    const isCoach = c.code_type === "coach";
    const typePill = isCoach
      ? '<span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fbbf24;background:rgba(217,119,6,.16);padding:3px 9px;border-radius:6px;">COACH</span>'
      : '<span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#60a5fa;background:rgba(96,165,250,.16);padding:3px 9px;border-radius:6px;">ATHLETE</span>';

    const status = c.used_at
      ? '<span style="font-size:11px;color:var(--green2);font-weight:600;">✓ Used ' + new Date(c.used_at).toLocaleDateString() + '</span>'
      : '<span style="font-size:11px;color:var(--muted);">Unused</span>';

    const actions = !c.used_at
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">
           <button onclick="copyInvite('${c.code}','${c.code_type}','email')" style="padding:5px 10px;border-radius:6px;background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.3);color:var(--blue2);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">📧 Email</button>
           <button onclick="copyInvite('${c.code}','${c.code_type}','sms')" style="padding:5px 10px;border-radius:6px;background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.3);color:var(--blue2);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">💬 SMS</button>
         </div>`
      : '';

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);gap:14px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:200px;">
          ${typePill}
          <code style="background:rgba(255,255,255,.05);padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:.04em;color:${isCoach ? '#fbbf24' : '#60a5fa'};">${c.code}</code>
          ${status}
        </div>
        ${actions}
      </div>
    `;
  }).join("");

  document.getElementById("pilotCodesTable").innerHTML = rows ||
    '<div style="padding:20px;text-align:center;color:var(--muted);">No codes minted yet.</div>';
}

function randomCodeSuffix(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for(let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function mintCode(codeType){
  const prefix = codeType === "coach" ? "COACH-" : "PIONEER-";
  const code = prefix + randomCodeSuffix();
  const note = prompt(`Optional: who is this ${codeType} code for? (e.g. "Geoff")`) || "";
  const { error } = await sb.from("pilot_codes").insert({
    code,
    notes:     note || null,
    code_type: codeType
  });
  if(error){
    alert("Mint failed: " + error.message);
    return;
  }
  loadPilotCodes();
}

// ── Copy-paste invite templates ─────────────────────────────────────────
// Builds an email-friendly OR sms-friendly invite message for the given code.
// Pops a prompt so you can copy it (clipboard write often fails on admin pages).
function copyInvite(code, codeType, channel){
  const url = window.location.origin + (codeType === "coach" ? "/pilot-coaches.html" : "/pilot.html") + "?code=" + code;

  let text;
  if(codeType === "coach" && channel === "email"){
    text =
      "Subject: You're invited — CoachAnywhere Founding Coach\n\n" +
      "Hi [Name],\n\n" +
      "I'd like to invite you to join CoachAnywhere as one of our Founding Pilot Coaches.\n\n" +
      "Two coaches, hand-picked. You're one of them. During the pilot you'll review uploaded skill clips from up to 10 athletes and earn $60/month per active athlete, paid by bank transfer within 24-48h of each invoice. No platform fee during pilot.\n\n" +
      "Your invite code: " + code + "\n\n" +
      "Get started: " + url + "\n\n" +
      "Takes ~10 min to complete your intake. Reach out if you have any questions.\n\n" +
      "— Kane Oakley\n" +
      "Founder, CoachAnywhere";
  } else if(codeType === "coach" && channel === "sms"){
    text =
      "Hey [Name] — I'd like to invite you to CoachAnywhere as a Founding Pilot Coach. $60/athlete/month, 2 coaches only. Your code: " + code + ". Sign up here: " + url;
  } else if(codeType !== "coach" && channel === "email"){
    text =
      "Subject: You're invited — CoachAnywhere Founding Athlete Pilot\n\n" +
      "Hi [Name],\n\n" +
      "You've been invited to the CoachAnywhere Founding Athlete Pilot.\n\n" +
      "Twenty athletes, hand-picked. You're one of them. You'll get 4 weekly skill reviews from a vetted coach for $49/month (normally $60), locked in as a founding member.\n\n" +
      "Your invite code: " + code + "\n\n" +
      "Get started: " + url + "\n\n" +
      "Limited to 20 athletes. Cancel anytime.\n\n" +
      "— The CoachAnywhere team";
  } else {
    text =
      "You're invited to CoachAnywhere — Founding Athlete Pilot. 4 weekly skill reviews from a vetted coach, $49/mo (normally $60). Code: " + code + ". Sign up: " + url;
  }

  // Try clipboard first; fall back to a prompt
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => {
      alert(`${channel === "email" ? "Email" : "SMS"} template copied to clipboard. Paste into your ${channel} app and replace [Name] with the recipient's name.`);
    }).catch(() => {
      prompt(`Copy this ${channel} template (replace [Name] with the recipient's name):`, text);
    });
  } else {
    prompt(`Copy this ${channel} template (replace [Name] with the recipient's name):`, text);
  }
}

window.copyInvite = copyInvite;
document.getElementById("mintAthleteCodeBtn").addEventListener("click", () => mintCode("athlete"));
document.getElementById("mintCoachCodeBtn").addEventListener("click",   () => mintCode("coach"));

loadPilotCodes();
setInterval(loadPilotCodes, 60 * 1000);
```

Make sure to remove the old single `mintCodeBtn` event listener and the old `mintCode()` function — the new versions replace them.

---

## After patches applied

Test path:

1. Run the SQL migration in Supabase
2. Apply patches ① - ⑤ in Claude Code
3. Commit + push + wait for Netlify deploy green
4. In `/admin.html`, click **Mint coach code** four times — type "Geoff", "Kyle", "Backup 1", "Backup 2" as notes
5. The code table should show 4 new `COACH-XXXX` rows with a "COACH" pill
6. Click **Email** on Geoff's row — confirms the template lands in your clipboard
7. Visit `/pilot-coaches.html` in incognito — confirms the code gate is there
8. Try a fake code — should reject
9. Try a real coach code — should validate and redirect to `/coach-signup.html?pilot=coach&code=COACH-XXXX`
10. Try visiting `/coach-signup.html` directly (no params) — should redirect to `/pilot-coaches.html`

---

*End of patches.*
