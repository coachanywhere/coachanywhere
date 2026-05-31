# Homepage + Waitlist Cleanup — Patches

Six changes across two pages plus the mentor-routing work we already specified. Apply in order.

This goes alongside `mentor-waitlist-patches.md` — these two patch documents touch the same `waitlist.html` file so apply them in the order: **mentor patches first, then this cleanup**. If you apply this one first, the mentor patches will still work but the "Find" blocks for the mentor patch may have already-modified text.

---

## ① PATCH — `index.html` — homepage hero cleanup (#1, #2, #3, #4)

### 1a. Remove the "LAUNCHING SOON · AUSTRALIA" pill

**Find** the pill element above the headline:

```html
<div class="launch-pill"><span class="dot"></span>LAUNCHING SOON · AUSTRALIA</div>
```

Class name might be different (`.pill`, `.eyebrow`, `.status-pill`, `.hero-eyebrow`). Search for the text "LAUNCHING SOON" to find it.

**Delete the entire element.** (Tag and everything inside.)

### 1b. Recolour the headline + put on one line for desktop

**Find** the hero headline:

```html
<h1>Elite coaching.<br>Anytime, <span class="grad">anywhere.</span></h1>
```

Structure may vary — could have different spans, different gradients, line breaks. The current colours are: "Elite coaching." white, "Anytime, anywhere." has a gold/yellow gradient.

**Replace with** (one line, white + blue, no inline `<br>`):

```html
<h1>Elite coaching. <span class="grad">Anytime, anywhere.</span></h1>
```

**Also update the `.grad` CSS rule** (search for `.grad` in the `<style>` block) — currently a gold/yellow gradient. Replace with solid bright blue:

```css
.grad {
  color: #60a5fa;
  /* (gradient removed for brand consistency — solid bright blue) */
}
```

If `.grad` is used elsewhere on the page and changing it breaks other pages, instead use a new class:

```html
<h1>Elite coaching. <span style="color:#60a5fa;">Anytime, anywhere.</span></h1>
```

### 1c. Add responsive line-break for mobile

**Find** the `<style>` block (likely in `<head>`). **Append this rule:**

```css
@media (max-width: 700px) {
  h1 .grad::before {
    content: "\A";
    white-space: pre;
  }
}
```

This forces "Anytime, anywhere." onto a new line only on narrow screens. Desktop keeps it one line.

### 1d. Remove "No spam. Just a heads-up when we open the doors."

**Find** the small line below the "Join the waitlist" button:

```html
<p class="hero-disclaimer">No spam. Just a heads-up when we open the doors.</p>
```

Class might be `.hero-note`, `.cta-sub`, `.disclaimer`, or similar. Search for "No spam" to find the exact element.

**Delete the entire element.**

---

## ② PATCH — `index.html` — remove "Founding cohort" section (#5)

**Find** the entire `<section>` (or `<div>`) containing the "FOUNDING COHORT" pill, "Be one of the first in." headline, and the three benefit checkmarks. Search for "FOUNDING COHORT" or "Be one of the first" to locate it.

The section is roughly between the "What's coming" card list and the "Join the waitlist" form. Looks something like:

```html
<section class="founding-cohort-section">
  <div class="founding-pill">FOUNDING COHORT</div>
  <h2>Be one of the first in.</h2>
  <p>Our founding coaches and pilot athletes shape what CoachAnywhere becomes — and lock in benefits the rest won't get.</p>
  <ul class="benefits">
    <li>✓ Reduced founding-member fees, locked in</li>
    <li>✓ Founding-member status on your profile</li>
    <li>✓ Direct input into the features we build next</li>
  </ul>
</section>
```

(Structure may differ — could be a `<div>`, classes may vary, list might be a series of `<div>`s, etc.)

**Delete the entire section.** Container element, headline, pill, copy, list — all of it.

---

## ③ PATCH — `index.html` — remove bottom badges (#6)

**Find** the three pills at the very bottom of the page, just above the "CoachAnywhere — elite coaching, anytime anywhere." footer line:

```html
<div class="footer-badges">
  <span class="badge">🏀 All sports</span>
  <span class="badge">📍 Australia-wide</span>
  <span class="badge">⚡ Remote coaching</span>
</div>
```

(Classes/emoji/structure may differ — search for "All sports" to find it.)

**Delete the entire container** (the `<div>` wrapping all three pills, not just the pills themselves).

**KEEP** the line below it: "CoachAnywhere — elite coaching, anytime anywhere." and the "Questions? Contact us" link.

---

## ④ PATCH — `waitlist.html` — remove Country field + Locker Room checkbox

### 4a. Remove the Country field

**Find** the Country dropdown:

```html
<label>COUNTRY
  <select id="country" ...>
    <option value="">Select</option>
    <option value="AU">Australia</option>
    ...
  </select>
</label>
```

Search for "COUNTRY" or "id=\"country\"" to find it. Could be wrapped in different parent elements.

**Delete the entire label/wrapper element.**

**Also remove any JavaScript** that reads from the country field. Search for `getElementById("country")` or `#country` in the JS — delete those lines, or replace any usage with a hardcoded `"AU"` if that's cleaner:

```js
// Where the form previously read country, replace with:
country: "AU"   // Australia-only during pilot/early launch
```

If country is being sent to a Netlify function or Supabase insert, hardcode it as `"AU"` in the payload so the data is still captured.

### 4b. Remove the Locker Room interest checkbox

**Find** the Locker Room checkbox:

```html
<label class="checkbox-row">
  <input type="checkbox" id="lockerRoomInterest"/>
  I'm interested in <strong>The Locker Room</strong> — live tactical sessions with elite coaches
</label>
```

Search for "Locker Room" or "lockerRoomInterest" to find it.

**Delete the entire label/wrapper element.**

**Also remove any JavaScript** referencing `lockerRoomInterest` — search the submit handler for that ID and remove the line that reads/sends it.

---

## After applying

Test sequence after commit + push + Netlify deploy:

1. **Homepage** (`/`):
   - ✅ No "LAUNCHING SOON" pill
   - ✅ Headline reads "Elite coaching. Anytime, anywhere." with "Anytime, anywhere." in blue
   - ✅ Headline is one line on desktop, two lines on mobile (resize browser or test on phone)
   - ✅ No "No spam" line below CTA
   - ✅ No "Founding cohort" section
   - ✅ No bottom badges (All sports / Australia-wide / Remote coaching)
   - ✅ Footer line and Contact us link still present

2. **Waitlist** (`/waitlist.html`):
   - ✅ No Country field
   - ✅ No Locker Room checkbox
   - ✅ Form still submits successfully (test with a dummy entry)
   - ✅ If applied AFTER mentor patches: `/waitlist.html?role=mentor` still shows the 3 mentor fields

3. **Regression checks:**
   - ✅ "Join waitlist" button on homepage still routes to `/waitlist.html`
   - ✅ Other navigation/CTAs on homepage work normally
   - ✅ Form submissions land in Supabase `waitlist` table

---

## Selector-fallback note

The "Find" blocks above are educated guesses based on common patterns. Real class names in your repo may differ. Claude Code should:

- Search by visible text (e.g. "LAUNCHING SOON", "Founding cohort", "All sports") to locate elements, not by class name
- Adapt selectors to whatever IDs/classes are actually used
- Stop and ask if any element can't be found

If anything's been moved/renamed since the screenshots were taken, ask before guessing.

---

*End of patches.*
