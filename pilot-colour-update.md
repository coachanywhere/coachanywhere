# Pilot.html — Brand colour alignment

Bringing `pilot.html` in line with the rest of the athlete-facing pages (navy + white + blue, no gold accents). The page structure and layout stay exactly as they are — only colours, the dropped tagline lines, and the removed "You're Invited" pill change.

---

## ① PATCH — `pilot.html` — colour scheme + copy trims

### 1a. Remove the "You're Invited" pill at the top

**Find** the pill block near the top of `<body>` — probably inside the container div, just above the `<h1>`. Looks something like:

```html
<div class="pilot-badge"><span class="dot"></span>YOU'RE INVITED</div>
```

(Class name might be `.invite-badge`, `.pilot-pill`, `.eyebrow`, etc. — search for "YOU'RE INVITED" to find it.)

**Delete this element entirely.**

### 1b. Update the headline colour scheme

**Find** the `<h1>` with the gold gradient on "Athlete Pilot." Looks something like:

```html
<h1>The Founding<br><span class="grad">Athlete Pilot</span></h1>
```

The `.grad` class is currently a gold gradient. Also find the related CSS rule (search for `.grad` in the `<style>` block — likely something like `background:linear-gradient(135deg,#facc15,#fbbf24);-webkit-background-clip:text;color:transparent`).

**Replace the `.grad` CSS rule with:**

```css
.grad{
  color:#60a5fa;
  /* (gradient removed - using solid bright blue to match the brand) */
}
```

Or if the class is used elsewhere on the page and you can't change it safely, keep `.grad` as-is and update the HTML instead:

```html
<h1>The Founding<br><span style="color:#60a5fa;">Athlete Pilot</span></h1>
```

Whichever fits cleaner with the existing file. The "The Founding" half stays white (no change needed).

### 1c. Trim the subhead copy

**Find** the subhead paragraph below the h1. Currently:

```html
<p class="hero-sub">We've hand-picked a small group of athletes to test what elite remote coaching looks like. Weekly skill reviews from vetted coaches — locked in at a founding-member price you won't see again.</p>
```

**Replace with:**

```html
<p class="hero-sub">We've hand-picked a small group of athletes to test what elite remote coaching looks like. Weekly skill reviews from vetted coaches.</p>
```

(Removes "— locked in at a founding-member price you won't see again." The em dash and everything after it.)

### 1d. Change the spots-remaining counter colour

**Find** the spots-remaining indicator — probably looks like:

```html
<div class="spots-line"><strong id="spotsRemaining">20</strong> of 20 spots remaining</div>
```

The `#spotsRemaining` or the surrounding `<strong>` is currently gold (likely `color:#facc15` or `#fbbf24`).

In the CSS, find that rule and **change the gold colour to blue**: `color:#60a5fa`.

If the colour is inline-styled rather than in CSS, update the inline style. Search for `#facc15` and `#fbbf24` near the spots-remaining markup and change to `#60a5fa`.

### 1e. Recolour the offer card — border, accents, prices

This is the biggest change. The offer card currently has gold border, gold glow, gold price text. All need to go blue.

**Find** the offer card styles. The card class is probably `.offer` or `.offer-card`. The current border/accent colours are gold tones — `#facc15`, `#fbbf24`, `#d97706`, `rgba(250,204,21,...)`, `rgba(245,158,11,...)`.

**Replace gold colours throughout the offer card's CSS rules with blue equivalents:**

| Currently | Replace with |
|---|---|
| `#facc15` (gold) | `#60a5fa` (blue) |
| `#fbbf24` (gold-deeper) | `#3b82f6` (blue-deeper) |
| `#d97706` (deep amber) | `#2563eb` (deep blue) |
| `rgba(250,204,21,X)` | `rgba(96,165,250,X)` — preserve the alpha value |
| `rgba(245,158,11,X)` | `rgba(59,130,246,X)` — preserve the alpha value |
| `rgba(217,119,6,X)` | `rgba(37,99,235,X)` — preserve the alpha value |

Apply this find-and-replace ONLY within rules that target `.offer`, `.offer-card`, `.offer-name`, `.offer-sub`, `.offer-price`, `.offer-price-now`, `.offer-price-sub`, `.offer-list`, `.offer-item`, and any styles that target the price element specifically.

**Do NOT change colours inside the green `✓` check icon SVGs or the icon stroke colour.** The checks stay green (semantic — confirms inclusion). If the offer-item ✓ icon uses `color:#22c55e` or `#10b981` or similar green — leave it.

### 1f. Remove "Cancel anytime" from the offer sub-line

**Find** the offer-sub line. Currently:

```html
<div class="offer-sub">Invite-only · monthly subscription · cancel anytime</div>
```

**Replace with:**

```html
<div class="offer-sub">Invite-only · monthly subscription</div>
```

### 1g. Remove "Cancel anytime" from the check-list

**Find** the offer-list (the bulleted list with green checks). Look for the list item that says "Cancel anytime."

**Delete that entire `<div class="offer-item">...</div>` block.** The list should now have 4 items:
- 4x Skill Review per month (1 per week)
- Personalised written feedback
- Direct messaging with your coach
- Locked-in pilot pricing

### 1h. Recolour the code-gate "Continue →" button

**Find** the Continue button inside the code-gate panel. CSS might look like:

```css
.cta-btn, #codeBtn {
  background: linear-gradient(135deg, #facc15, #d97706);
  color: #0a0f1a;
  ...
}
```

**Replace the gradient with:**

```css
background: linear-gradient(135deg, #60a5fa, #2563eb);
color: #fff;
```

(Note: text colour changes from dark navy to white because the new blue gradient is darker than the old gold gradient and needs higher contrast.)

### 1i. Recolour the code-gate panel border

**Find** the code-gate container styles. The border probably uses a gold tone — change to blue.

| Currently | Replace with |
|---|---|
| `border:1px solid rgba(245,158,11,.3)` | `border:1px solid rgba(96,165,250,.3)` |
| `border-color:rgba(245,158,11,...)` | `border-color:rgba(96,165,250,...)` |
| Label/header colour like `color:#fbbf24` inside the gate | `color:#60a5fa` |

### 1j. Recolour the "ENTER YOUR INVITE CODE" label

**Find** the label above the code input. Probably:

```html
<div class="code-gate-label" style="...color:#fbbf24...">ENTER YOUR INVITE CODE</div>
```

Or in CSS rule. Change `#fbbf24` (or whichever gold colour) to `#60a5fa`.

### 1k. Recolour the "message us" link

**Find** the helper text below the code input:

```html
<div>Codes were emailed to invited athletes. If you've lost yours, <a href="contact.html" style="color:#fbbf24;">message us</a> and we'll resend.</div>
```

Change the link colour from gold (`#fbbf24` or `#facc15`) to blue (`#60a5fa`).

---

## After applying

Report back with a one-line summary per sub-patch (1a through 1k). Flag if any of the "Find" blocks didn't match what's currently in the file — the existing version may already have some of these colours in unexpected places.

No changes needed to `pilot-coaches.html` — that one stays amber/gold to differentiate it from the athlete pilot page.

---

*End of patch.*
