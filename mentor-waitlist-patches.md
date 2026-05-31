# Mentor Interest Capture — Patches

Goal: stop the homepage Mentors card from routing to a separate mentor page during the pilot. Instead, route to the existing waitlist with `?role=mentor`, capture mentor-specific fields, and store everything in the same `waitlist` table with `role='mentor'`.

Three small patches: SQL migration, homepage CTA update, waitlist page update.

---

## ① SQL — extend the waitlist table for mentor fields

Run in Supabase SQL Editor. Safe to re-run — uses `IF NOT EXISTS` throughout.

```sql
-- Add columns needed for mentor capture. These are nullable so existing
-- athlete/coach waitlist entries are unaffected.
alter table waitlist
  add column if not exists role               text,
  add column if not exists phone              text,
  add column if not exists sport              text,
  add column if not exists coaching_experience text;

-- Index on role for easy filtering by interest type
create index if not exists waitlist_role_idx on waitlist(role);

-- Verify
-- select column_name from information_schema.columns
-- where table_name = 'waitlist' order by ordinal_position;
```

**Note:** if your `waitlist` table is named something else (`waitlist_signups`, `waitlist_entries`, etc.), update accordingly. Check first with:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like '%waitlist%';
```

---

## ② PATCH — `index.html` — Mentors card routes to waitlist

**Find** the Mentors role card on the homepage. It probably has either an anchor:

```html
<a href="for-mentors.html" ...>Become a mentor →</a>
```

Or a button/link with similar text. Could also be:
```html
<a href="mentor-signup.html" ...>Become a mentor →</a>
```

**Replace the href** (whatever it is) **with:**

```html
href="waitlist.html?role=mentor"
```

So the final element looks like:

```html
<a href="waitlist.html?role=mentor" class="role-card-cta">Become a mentor →</a>
```

Keep all existing classes and surrounding HTML intact — only change the `href` attribute.

**If the click is bound via JavaScript** (e.g. `onclick="window.location.href='for-mentors.html'"`), update that string instead:

```html
onclick="window.location.href='waitlist.html?role=mentor'"
```

---

## ③ PATCH — `waitlist.html` — add mentor mode + extra fields

This is the bigger patch. The waitlist page needs to:

1. Detect `?role=mentor` in the URL
2. Show mentor-specific copy ("Register your interest — Mentor Programme")
3. Show 3 extra form fields (phone, sport, coaching experience)
4. Submit those extra fields to Supabase along with `role='mentor'`
5. Show "Thanks — we'll be in touch when Mentors launches" on success

### 3a. Add the extra form fields (hidden by default, shown only for mentor mode)

**Find** the existing waitlist form. Locate the existing fields (probably Name + Email at minimum). Just **after the email field** (and before the submit button), add this block:

```html
<!-- ═════ MENTOR-ONLY FIELDS (shown when ?role=mentor) ═════ -->
<div id="mentorFields" style="display:none;">
  <label style="display:block;margin-top:18px;">
    <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">Phone</div>
    <input type="tel" id="mentorPhone" placeholder="04xx xxx xxx"
           style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;outline:none;"/>
  </label>

  <label style="display:block;margin-top:14px;">
    <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">Sport(s) you'd mentor in</div>
    <input type="text" id="mentorSport" placeholder="e.g. Basketball, AFL, Netball"
           style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;outline:none;"/>
  </label>

  <label style="display:block;margin-top:14px;">
    <div style="font-size:12px;font-weight:600;color:rgba(232,237,245,.8);margin-bottom:5px;">Brief coaching experience</div>
    <textarea id="mentorExperience" rows="4"
              placeholder="A short note on your coaching background — sports, levels coached, years of experience, qualifications, etc."
              style="width:100%;padding:11px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.4);color:#f1f5f9;font-size:14px;outline:none;font-family:inherit;resize:vertical;min-height:80px;"></textarea>
  </label>
</div>
```

### 3b. Add the mentor-mode JavaScript

**Find** the existing submit handler for the waitlist form (search for `addEventListener` near a submit button, or a function tied to the form submit). 

**Just before the submit handler is wired up**, add this initialisation block:

```js
// ── MENTOR MODE DETECTION ────────────────────────────────────────────
// If URL has ?role=mentor, swap the page copy and reveal mentor-only fields.
const _waitlistParams = new URLSearchParams(window.location.search);
const _isMentor = _waitlistParams.get("role") === "mentor";
const _waitlistRole = _waitlistParams.get("role") || "athlete";

if (_isMentor) {
  // Reveal extra fields
  const mf = document.getElementById("mentorFields");
  if (mf) mf.style.display = "block";

  // Swap headline if it exists (look for hero h1)
  const heading = document.querySelector("h1, .waitlist-headline, .hero-title");
  if (heading) heading.textContent = "Register your interest — Mentor Programme";

  // Swap subhead if it exists
  const sub = document.querySelector(".waitlist-sub, .hero-sub, .subhead");
  if (sub) sub.textContent = "Share what you know and earn alongside your athlete coaching. We'll be in touch when Mentors launches.";

  // Swap submit button text
  const btn = document.querySelector("button[type='submit'], .submit-btn, #waitlistSubmit");
  if (btn) btn.textContent = "Register interest →";
}
```

### 3c. Update the submit logic to include extra fields

**Find** the existing submit handler that writes to Supabase or calls the waitlist-welcome Netlify function. It probably does something like:

```js
const { error } = await sb.from("waitlist").insert({
  name: nameInput.value,
  email: emailInput.value
});
```

Or might call a Netlify function:
```js
const res = await fetch("/.netlify/functions/waitlist-welcome", { ... });
```

**Update the insert/payload to include the role and optional mentor fields:**

```js
const payload = {
  name:  document.querySelector("#name, #waitlistName, #fullName").value.trim(),
  email: document.querySelector("#email, #waitlistEmail").value.trim().toLowerCase(),
  role:  _waitlistRole
};

// Mentor-specific fields (only set when ?role=mentor)
if (_isMentor) {
  const phoneEl = document.getElementById("mentorPhone");
  const sportEl = document.getElementById("mentorSport");
  const expEl   = document.getElementById("mentorExperience");
  if (phoneEl && phoneEl.value.trim()) payload.phone = phoneEl.value.trim();
  if (sportEl && sportEl.value.trim()) payload.sport = sportEl.value.trim();
  if (expEl   && expEl.value.trim())   payload.coaching_experience = expEl.value.trim();
}

// Then use payload in the existing insert/fetch call
const { error } = await sb.from("waitlist").insert(payload);
```

Adapt the selectors (`#name`, `#email` etc.) to match what's actually in your form.

### 3d. Update the success message for mentors

**Find** the success message that shows after a successful submit (probably a "Thanks — you're on the list" or similar).

**Update it to be mentor-aware:**

```js
// Wherever you set the success message
const successText = _isMentor
  ? "Thanks — we'll be in touch when Mentors launches."
  : "Thanks — you're on the list. We'll be in touch."; // (keep your existing text for non-mentors)

// Then display successText however your existing success UI works
```

---

## After patches applied

Test sequence:

1. SQL migration runs cleanly in Supabase
2. Patches ② and ③ apply to the right files
3. Commit + push
4. Wait for Netlify deploy green
5. **Test in incognito:**
   - Visit homepage → click "Become a mentor →"
   - Should land on `/waitlist.html?role=mentor`
   - Headline says "Register your interest — Mentor Programme"
   - 3 extra fields visible (phone, sport, experience)
   - Submit → success message says "Thanks — we'll be in touch when Mentors launches"
6. **Verify Supabase:**
   ```sql
   select name, email, role, phone, sport, coaching_experience
   from waitlist where role = 'mentor' order by created_at desc limit 5;
   ```
   Should show your test submission.
7. **Regression check:**
   - Visit `/waitlist.html` directly (no role param)
   - Should look exactly as before (no mentor fields, original copy)
   - Submit should work as before, `role` defaults to `'athlete'`

---

*End of patches.*
