# CoachAnywhere — Full Code & Content Review

Reviewed 27 files in user-flow order. Severity labels used throughout: **🔴 Critical** (fix before launch), **🟠 High** (fix soon after), **🟡 Medium** (polish), **🔵 Low** (nice to have).

A cross-cutting summary lives at the end — start there if you want the headlines.

---

## 1. index.html (618 lines)

The current production homepage: big COACHANYWHERE wordmark hero, three role-entry cards (Athletes/Coaches/Mentors), trust-row (commented out, kept for reference), three audience-journey blocks, auto-rotating placeholder testimonial carousel, and a footer CTA. Sticky blurred nav with a slide-out drawer; locker-room link intercepts to a "coming soon" modal.

**Strengths:** Well-organised CSS using design tokens, accessible focus-trap drawer, `prefers-reduced-motion` honoured on the journey-card glow, reduced-motion absent here but the testimonial fade isn't animation-intensive. JS-driven `fitWordmark` scales the hero wordmark to fit the card-row width — neat, and the CSS `clamp()` is a no-JS fallback.

**Findings:**

🟡 **Hardcoded placeholder testimonials** (lines 557–588). Five fake quotes with Unsplash portraits and made-up athletes ("Marcus T.", "Sarah R."). The comment correctly flags them as placeholder, but at launch these read as fake to anyone who reverse-image-searches the photos. Replace with real founding cohort quotes or pull from `coach_reviews` via the same pattern as STATS-TESTIMONIALS-READY-FOR-LAUNCH.

🟡 **Hotlinked Unsplash images.** Five `images.unsplash.com` URLs in the testimonial carousel; if Unsplash changes its hotlinking policy or rate-limits, faces blank out and only the emoji fallback shows. Self-host the chosen photos.

🔵 **Generic favicon.** Uses the logo PNG as both favicon and apple-touch-icon — fine, but a 32×32 cropped version would render sharper than a full transparent logo at favicon size.

🔵 **No SEO meta from launch-prep file applied yet.** SEO-META-READY-FOR-LAUNCH.html has canonical, OG image dimensions, structured-data scripts and twitter cards ready — none of that is merged here yet.

🔵 **Trust-row (founding coach avatars + "Founding cohort now accepting members" pill) is commented out** awaiting real photos. Fine for now; just remember it exists.

---

## 2. index-router.html (369 lines)

Alternate "router-style" homepage that was the previous live version. Preserved unlinked per the comment in `index.html`. Same shell, simpler hero (no big wordmark), two-card athlete/coach split, one proof testimonial, trust row.

**Findings:**

🟠 **Still contains the live `mailto:` link** in the footer (line 339) — `kane@coachanywhere247.com`. If Netlify ever deploys this file, search engines and email harvesters get it. If it's deployed to Netlify (which Netlify does by default for every .html in the deploy folder), the file is publicly accessible at `/index-router.html`.

🟡 **[FOUNDING COACHES — names/photos placeholder]** literal text in the trust row (line 264) — would render to users if this page is ever made canonical.

🟡 **No drawer/hamburger nav** on the mobile breakpoint — `.nav-toggle` is defined in CSS but never wired up in HTML. Mobile nav links collapse into a dropdown that has no toggle. The current `index.html` has a working drawer; this older file doesn't, so don't merge any nav code back from this one without checking.

**Recommendation:** Either delete this file or move it out of the deploy folder (e.g. `/_archive/`). Same applies to `index-legacy.html`.

---

## 3. index-legacy.html (1,448 lines)

The original long-form homepage, kept unlinked for reference. Has feature grids, "Marketplace for sport" framing, marketplace flow animation, full FAQ, portal section, and a complete privacy policy embedded inline.

**Findings:**

🟠 **Six live `kane@coachanywhere247.com` references** (lines 1125, 1152, 1214, 1289, 1309 — confirmed via grep) including a `mailto:` link in the footer and full text in the embedded privacy section. Same Netlify-public-by-default concern as index-router.

🟠 **Embeds a full Privacy Policy inline** — diverges from `privacy-policy.html`. If a user finds this URL, they get an out-of-date policy without the contact-form replacement.

🟡 **Old "AI-powered feedback" copy** in the meta description (line 7) — the current product positions AI as assistive to coaches, not as the feedback source. Could mislead expectations.

**Recommendation:** Move to `/_archive/` or remove from deploy. If you want to keep the source-controlled history, that's what Git is for — these files don't need to live in the public folder.

---

## 4. for-athletes.html (537 lines)

The athlete-side marketing landing page. Hero, "what you get", animated 3-step flow, auto-scrolling coach carousel (placeholder coaches), 3-tier pricing grid, 6-tile testimonials grid, final CTA → waitlist. Shared drawer/lockerroom modal.

**Findings:**

🔴 **Pricing copy contradicts the actual product.** Lines 315–331 claim "Three monthly packages, offered by every coach. From **$40 to $569/mo** depending on your coach's tier" with three bundles:
- Starter $40–$120/mo
- Standard $145–$337/mo
- Pro $249–$569/mo

But every internal product surface (checkout.html, select-coach.html, FAQ, coach-profile-setup.html, athlete-dashboard.html) uses **fixed per-item add-ons** at $15 / $35 / $75 / $120 / $199 layered on top of a monthly tier of $49 / $99 / $179. The marketing copy describes a pricing model that doesn't exist in the product. An athlete arriving from this page expects to pay $40–$569/mo for a "Starter/Standard/Pro" bundle and will instead see an entirely different menu in checkout. This is the single biggest content issue I found.

🟡 **Hotlinked Unsplash headshots** for placeholder coaches and athletes (10 + 6 images). Same fragility as #1.

🟡 **Founding-coach trust strip commented out** (lines 287–298) pending real photos — needs to land before launch or be replaced with the stats banner.

🟡 **FAQ section commented out** (lines 346–357) "pending refresh" — placeholder answers preserved. Either restore an athlete-specific FAQ here or remove the commented block.

🔵 **`coach-strip` CSS uses `gap:-12px`** (line 89) — invalid CSS, ignored by all browsers. The negative `margin-left` on `.coach-av` is what's actually creating the overlap. Cosmetic.

🔵 **Final CTA still routes to waitlist** rather than `athlete-signup.html` — the inline comment in for-coaches confirms this is deliberate while Stripe is being wired. Fine to ship, but flip the routes at launch.

---

## 5. for-coaches.html (487 lines)

Coach-facing landing. Mirrors for-athletes structure — amber treatment. Hero, what-you-get, animated 3-step flow, athletes carousel, coach tier pricing (L1-L4), package grid, 6 athlete testimonials, final CTA → waitlist.

**Findings:**

🔴 **Same pricing-copy contradiction** as for-athletes (the "athletes pay $40–$569/mo packages, you keep 80%" framing in lines 296–319). The 80% retention figure is repeated in headline ("You keep 80% of every package") but the actual product offers add-ons whose per-item earn is shown in coach-profile-setup as $12/$28/$60/$96/$159 — which works out to 80% of $15/$35/$75/$120/$199, so the 80% number checks out _for the add-ons_, but the **package ranges shown to coaches don't match reality**.

🟠 **Coach tier prices match coach-profile-setup almost** — but coach-profile-setup advertises **foundation** pricing ($39/$79/$159/$319) as the locked-in number, while for-coaches shows what looks like foundation pricing ($39/$79/$159/$399) yet labels Level 4 at $399 instead of foundation $319. So a coach arriving from this page expects $399 for L4 but actually pays $319 foundation. Reconcile by either showing foundation everywhere or showing standard everywhere.

🟠 **"Founding cohort rates locked in for your first year"** (line 266) is a binding promise. Make sure ToS or a founding-member agreement actually says this and that the Stripe price IDs are configured to honour it on renewal.

🟡 **"CTA temporarily points to waitlist while athlete payment loop is being built. Switch to /coach-signup.html once Stripe Connect is live."** — inline comment line 336. Confirm before launch.

🟡 **Hotlinked Unsplash photos** in the athletes carousel — same fragility.

🔵 **"Final pricing TBC — see pricing review spreadsheet"** comments (lines 267, 300) — make sure the spreadsheet and this page agree at launch.

---

## 6. for-mentors.html (375 lines)

Mentor recruitment page. Different colour treatment (violet). Hero, what-you-get bullets, 3-step flow, eligibility card (L3+L4 only), earnings card, testimonial, FAQ, final CTA.

**Findings:**

🔴 **Hero is unfilled placeholder.** Lines 180–181:
```
<h1>[HEADLINE: outcome-led, answers "How do I share what I know and earn from it?" — e.g. "Pass on what you know — and <span class="grad">get paid</span> for it."]</h1>
<p class="hero-sub">[SUBHEADING: one sentence — mentor developing coaches through guided sessions and earn alongside your athlete coaching.]</p>
```
The example text inside the brackets is actually pretty good — just delete the brackets. But as-shipped right now, anyone hitting `/for-mentors.html` sees raw placeholder square brackets.

🔴 **Earnings card has `[$ TBC]` literal placeholder** (line 252) and a `[MENTOR EARNINGS PLACEHOLDER — final mentorship pricing and revenue split to be confirmed...]` block (line 255). Cannot ship as-is.

🔴 **Testimonial card has `[MENTOR TESTIMONIAL PLACEHOLDER]`** (line 265). Same problem.

🔴 **FAQ answers all begin `[PLACEHOLDER ANSWER]`** (lines 275–279). Five questions. Five placeholders.

🟠 **Mentor waitlist routes to `?role=coach`** (lines 151, 289) because the waitlist form has no "mentor" role option. Acceptable workaround, but the mentor lead isn't distinguishable in the data without scanning the `notes` field. Consider adding "mentor" to the waitlist role dropdown.

🟡 **Locker Room badge in nav** (the `.nav-links a.mentor` style is present but the desktop nav links are not visible here — only the drawer has them — so the styling is unused).

**Recommendation:** This page is the most launch-blocking of the marketing pages. Six placeholders, all visible to users.

---

## 7. find-mentor.html (625 lines)

App-shell page for coaches to browse mentor-eligible peers (L3/L4) and request mentorship. Real Supabase data (`profiles.role=coach` + `selected_tier ILIKE 'Level 3%' OR 'Level 4%'`), with sport/level/sort filters, request-with-notes modal, "view profile" modal, request-sent confirmation modal. Inserts into `mentor_relationships` and `messages` tables.

**Findings:**

🟠 **Hard-coded "★ 4.9" rating on every mentor card** (line 464). No `rating` column is read or computed. Either wire it to real `coach_reviews` data once that exists, or remove until then — a constant 4.9 across every mentor looks fake.

🟠 **Two writes happen sequentially** in `submitRequest` (`mentor_relationships.upsert` then `messages.insert`). If the second fails, the relationship is still created but the introductory message never arrives. Either wrap in a transaction (Supabase doesn't expose them client-side — needs a Postgres function or RPC) or surface the second-failure case to the user.

🟡 **`i.pravatar.cc` fallback for missing avatars** (line 440). Third-party service, no SLA, served over HTTP-keepalive — fine for development, but if pravatar ever changes or rate-limits, every coach without an upload shows a broken image. Consider self-hosted SVG initials avatars as a fallback to the fallback.

🟡 **No "edit my request" or "withdraw" flow.** Once a coach sends a request, the only state shown is "✓ Request sent". They can't change the notes or rescind it.

🟡 **No tier filter for "L4 only"** even though the page distinguishes L3/L4 in the dropdown. Filter dropdown shows "All levels / Level 3 / Level 4" which works because of the `startsWith` filter — verify.

🟡 **No empty state when nobody has signed up yet** (other than the post-filter empty state). On first launch, when no L3/L4 coaches exist, the page will render an empty grid + "0 mentors" and look broken.

🔵 **`Cache-Control: no-store` on the HTML** — fine for an authenticated app page, just confirm intent.

🔵 **`fallbackAvatar` is also defined inline in mentor-dashboard.html** — duplicated logic.

---

## 8. faq.html (300 lines)

Three-column FAQ (Athletes / Coaches / Locker Room) on a public marketing page. Clean implementation, accordion-style toggle, share drawer nav. All emails replaced with `<a href="contact.html">`.

**Findings:**

🔴 **Pricing in the Athletes column** (line 168):
> "Packages start from $15 for a single skill clip review. Each coach offers Starter ($15), Standard ($35), Pro ($75), Elite ($120) and Premium ($199) packages."

This is the per-add-on pricing — **consistent with the actual product** but **contradicts for-athletes.html and for-coaches.html** which say packages range $40–$569/mo. The FAQ is right; the marketing pages are wrong. The product calls them "Starter / Standard / Pro / Elite / Premium" with prices $15/$35/$75/$120/$199, while for-athletes uses the same names "Starter / Standard / Pro" with prices $40–$120 / $145–$337 / $249–$569. Same labels, completely different price models. Pick one model and rewrite the other surfaces to match.

🟠 **"How much can I earn?" answer** (line 182): "A coach with 10 athletes across standard packages can earn $280–$1,590/month." 10 × Session Review @ $28 earn = $280. 10 × Elite Package @ $159 earn = $1,590. Math checks out _if_ the standard pricing model is correct — same model conflict as above.

🟠 **Spotlight pricing answer** (line 186): "L1 $29/mo · L2 $49/mo · L3 $79/mo · L4 free" matches `SPOTLIGHT_COST` in coach-dashboard.html exactly. Good.

🟡 **Hero subhead "We're an email away"** (line 151) — but the email route has been replaced with a contact form. Reword to "we're a message away" or similar.

🔵 **Smart and clean** — this is the most consistent content document in the build.

---

## 9. contact.html (385 lines)

Contact form with name / email / role / topic / message + honeypot + char counter + client-side validation. Posts to `/.netlify/functions/contact-submit` and shows a success state. Standard nav + drawer.

**Findings:**

🟠 **Social links are `href="#"`** (lines 231–233 — Instagram / TikTok / LinkedIn). Either remove until the accounts exist or fill them in.

🟡 **Honeypot field uses `display:none`-equivalent** (`position:absolute; left:-9999px`) — modern bots increasingly fill these. Combine with a time-to-submit floor (e.g. reject any form submitted in <2s) for stronger defence.

🟡 **No rate limiting** at the client. If `contact-submit` server function doesn't rate-limit, a script can flood your inbox. Confirm server-side throttle.

🟡 **No optimistic char counter on subject/topic** — only on message.

🔵 **The form-error block uses `formError.textContent = data.error` for server errors** — make sure `contact-submit` doesn't leak stack traces or internal errors back. Use generic messages server-side.

🔵 **Email validation regex** (`/^[^@\s]+@[^@\s]+\.[^@\s]+$/`) accepts many invalid addresses but rejects clearly broken ones — standard tradeoff, acceptable.

---

## 10. waitlist.html (642 lines)

Waitlist sign-up page. Hero, "what's coming" feature list, founding callout, multi-field form (first name, email, role, sport, country, conditional level question, optional notes, locker-room interest checkbox). Posts to Supabase `waitlist` table, then fires `/.netlify/functions/waitlist-welcome` for the welcome email. Success state with native share / WhatsApp / copy-link.

**Findings:**

🟠 **Treats `23505` duplicate-email error as success.** Friendly UX (line 583), but if someone else's email gets duplicated (they share a family account), the second person gets the success screen without being added. Acceptable for low-traffic waitlist — note the assumption.

🟠 **No CAPTCHA, no honeypot, no rate limit.** Contact form has a honeypot; this one doesn't. Combined with a real Supabase insert and a triggered email, this is spammable.

🟡 **`auth.persistSession: false`** on this client (line 458) — correct, since waitlist visitors aren't users yet. Good.

🟡 **Locker-room modal "Join the waitlist" button** scrolls to the form (line 445) — but the form is on this same page. Confusing for users who didn't expect to already be on the form page. Maybe change the modal copy to "Sign up below ↓".

🔵 **Source tracking** via `?src=...` query param (line 461) — well-designed.

🔵 **First name only** is required for personalisation, not last name — reduces friction. Good.

🔵 **The supabase-js script tag is loaded at line 454** _after_ the closing `</div>` of `.wrap` but before `</body>` — order's fine, but visually it looks like a chunk of HTML is below an inline script. Cosmetic.

---

## 11. login.html (482 lines)

Combined login + signup + forgot-password card. Role toggle (Athlete/Coach) drives copy and gradient. Tabs swap between Login / Create Account. Auto-redirects on existing session (coach-profile-setup if no `selected_tier`, else coach-dashboard / athlete-dashboard).

**Findings:**

🔴 **DEBUG alert left in production code** (lines 374–378):
```
alert("DEBUG — Login succeeded but NO session persisted.\n\nUser ID: " + (data.user?.id||"?") + "\nlocalStorage keys: " + (keys.join(", ")||"(none)") + "\n\nScreenshot this.");
```
This will fire for real users if the post-login session retry loop times out (which it occasionally will on slow networks). Replace with a softer in-page error or remove entirely.

🔴 **Signup tab creates a profile row with no email-confirmation handling.** Line 423 inserts directly into `profiles` using `data.user.id`, then switches to login tab. If email confirmation is enabled in Supabase Auth (which `coach-signup.html` and `athlete-signup.html` _both_ handle explicitly), then no session exists at this point, and the `profiles` insert hits RLS and silently fails (no error surface). The user gets "account created!" then can't log in because the confirmation hasn't happened, and when they finally do confirm, their `profiles` row is missing — coach-dashboard.html then redirects them to `coach-profile-setup.html` which re-creates the row from `user_metadata`... but `user_metadata` isn't being set here (no `options.data` in the `signUp` call), so first/last name are lost.

🟠 **Three different signup paths exist:** login.html (minimal), athlete-signup.html (full athlete profile), coach-signup.html (full coach profile with confirmation handling). The login.html version doesn't capture mobile, age, sport, location, guardian details, etc. — so an athlete signing up here ends up on the dashboard with a half-empty profile.

🟠 **Forgot-password redirect URL** uses `new URL("reset-password.html", window.location.href)` (line 456). Works locally and on Netlify, but make sure your Supabase Auth → URL Configuration whitelists the production reset-password URL or the email link won't validate.

🟡 **"Wait until session is actually persisted to storage" loop** (lines 365–371) iterates 20 times with 100ms gaps — reasonable. Same pattern repeated across many files (coach-dashboard, athlete-dashboard, find-mentor, video-review) — would be cleaner as a shared util.

🟡 **Role toggle defaults to Athlete** — but a coach landing here from for-coaches has no way to know they should click Coach. Consider reading `?role=coach` from the URL like the waitlist does.

🔵 **`:has()` CSS selector** used for the role-driven theming (`.login-card:has(#btnCoach.active) ...`). Modern but well-supported now. Safari 15.4+, Chrome 105+, FF 121+.

---

## 12. reset-password.html (242 lines)

Password reset target for Supabase's `PASSWORD_RECOVERY` flow. Listens for the auth event, gates the form behind it, has a 5s timeout-to-invalid state. Strength meter, match indicator, show/hide toggles.

**Findings:**

🟡 **Calls `supabase.auth.updateUser` then immediately redirects to `login.html`** (line 218) — meaning the user never sees the success state. The success state DIV exists but the redirect at line 218 fires before the user has time to read "Password updated!". Either delay the redirect (line 213–217 set up the success state, line 218 immediately redirects) or just stay on the page and let them click "Go to login →" themselves.

🟡 **`flowType: 'implicit'`** on the Supabase client — was the default and still works, but PKCE is preferred for new code. Low priority.

🔵 **5-second timeout to "invalid link" state** is reasonable; could be more forgiving for slow connections (10s).

🔵 **Console.log statements** at lines 184 and 198 — fine for debugging, would be cleaner to remove before launch.

---

## 13. athlete-signup.html (634 lines)

Full athlete onboarding form: name, age (with conditional guardian section under 18), sport, improvement focus (curated by sport via `focus-areas.js`), email, mobile, location, skill level, main goal, password (with strength meter), T&C. Inserts auth user + profiles row. Handles email-confirmation flow with a "Check your email" state.

**Findings:**

🔴 **External `focus-areas.js` is referenced (line 11) but not in the upload set.** Four files (`athlete-signup`, `coach-dashboard`, `coach-profile-setup`, `select-coach`) depend on it. The defensive code (`window.focusAreasForSport ?`) means missing-file degrades gracefully, but the user would see the improvement-focus question disappear and submit without picking any. Confirm the file exists in your deploy and ideally include it in any repo dump going forward.

🟠 **Profile insert failure is silently warned to console** (line 608: `if (profileError) console.warn("Profile insert warning:", profileError.message);`). User then proceeds to dashboard with no profile row, which gets created later via a stub in `athlete-dashboard.init()` — but the data the user just typed (age, mobile, location, skill_level, main_goal, improvement_focus, guardian fields) is lost.

🟠 **Schema introspection on every signup** (lines 591–606) hits `/rest/v1/` for the OpenAPI doc to dynamically drop unknown columns. Clever defensive code, but: (a) it adds a network round-trip to a critical path, and (b) the response is unauthenticated and uncached. Cache it in `sessionStorage` after first call.

🟡 **Age validation accepts 8–80** (line 300 `min=8 max=80`) — but per the privacy policy (and terms), athletes must be 13+ unless special parental consent. Update the `min` to 13 (or 8 with a guardian-required gate that already exists for under-18 — but then explicitly age 8–12 needs the gate triggered, which it is).

🟡 **No email/mobile uniqueness check** at the client. Supabase Auth will reject a duplicate email with a generic error. Show a friendlier "this email is already registered — log in?" hint.

🟡 **Password show/hide button** is only one piece — but most modern forms have a password "criteria checklist" (length, uppercase, number, symbol). The strength bar shows colour but doesn't tell the user _what_ they need to do.

🟡 **"Other" sport** option exists but typing a custom sport is not supported. If picked, what's stored? `null` or "Other"? Currently stores literal "Other".

🔵 **Submit handler captures email/password before `signOut()`** (line 559) — good ordering.

🔵 **Two-finger close affordance** on the modal (clicking outside, ESC) — present in find-mentor but not here. The page doesn't have modals to close, so OK.

---

## 14. coach-signup.html (147 lines)

Coach onboarding. Much shorter than athlete-signup because it defers detail to `coach-profile-setup.html`. Captures: first name, last name, email, mobile, password, T&C. Sets `user_metadata.role = "coach"`, `emailRedirectTo` to `coach-profile-setup.html`. Shows "Check your email" if email confirmation is on.

**Findings:**

🟡 **Mobile field is required** (line 73) but has no format validation — accepts anything. Australian mobile pattern would be useful (`pattern="[0-9 +\(\)-]{8,15}"`) or better, an `inputmode="tel"` keyboard hint plus loose validation.

🟡 **No T&C / Privacy click-through tracking.** Acceptable but a checkbox with a timestamp stored alongside the profile would be defensible if challenged.

🟡 **Strength meter** identical to athlete-signup — extract into a shared module to reduce drift.

🔵 **Cleanly handles two cases** (email confirmation on vs off) with a sensible UX. Good.

🔵 **Sign-out before signup** (line 86 `try { await sb.auth.signOut(); } catch (e) {}`) is the right call — prevents accidental account collision.

🔵 **Replaces page body** on success (line 116 `document.body.innerHTML = ...`) — works but wipes nav, footer, drawer state. A modal or in-page swap would be cleaner.

---

## 15. coach-profile-setup.html (1,000 lines)

Coach onboarding step 2: photo, bio, qualifications, sport, location, coaching styles (multi-select up to 5), focus areas (curated + custom), self-tier picker → AI tier recommendation → agree-or-override → billing cycle → packages → summary. On submit: updates profile row, hands off to Stripe Checkout via `/.netlify/functions/create-coach-tier-checkout`. Supports `?mode=change` for tier changes from the dashboard.

**Findings:**

🔴 **Tier id/label divergence in the TIERS array** (lines 467–472):
```js
{id:"Level 2 — Performance Coach", label:"Level 2 — Representative Coach", ...}
{id:"Level 3 — Elite Coach",       label:"Level 3 — State Coach", ...}
{id:"Level 4 — Verified Elite Coach", label:"Level 4 — Elite Coach", ...}
```
The DB stores `selected_tier = id`, but the user always sees `label`. So:
- coach-dashboard sidebar renders `tierDisplay(p.selected_tier)` which presumably maps id → label, but `find-mentor.html` filters by `selected_tier.ilike.Level 3%` which works only because of the prefix match. Any code that does an exact-equals lookup against `"Level 3 — State Coach"` (what the user thinks they picked) would fail because the DB has `"Level 3 — Elite Coach"`. The `SPOTLIGHT_COST` lookup in coach-dashboard.html does exactly that — but uses the **id** strings, so it works. So this is currently consistent only by accident.

🔴 **"AI tier recommendation" is keyword counting** (lines 660–714). Marketed as AI, implemented as `if text includes "nbl" score +=3` etc. The reasoning text is templated. If a coach is sophisticated enough to look at the source, "AI recommendation" reads as oversold. Two options: (a) reword UI to "Smart suggestion" / "Tier guide" and stop calling it AI, or (b) actually call an AI API (cheap with structured outputs).

🟠 **AI loading is a 2.2s `setTimeout`** (line 657) — fake "thinking" animation. Same overselling concern.

🟠 **`Level 4 fortnightly: null`** (line 471) — billing renderer (line 786) checks `t.fortnightly ?` so it's safe, but the no-fortnightly state for Level 4 should be explicit copy ("Monthly only at Level 4") rather than just hiding the radio.

🟡 **Confirms tier downgrade with a `confirm()` dialog** (lines 880–887) but doesn't actually do anything to active athletes on packages above the new tier — just warns the coach. The Stripe webhook (referenced in comments) is presumably supposed to handle athlete migration but that's not in this file.

🟡 **"Save & complete later"** (line 958) saves a partial profile then signs the user out. Sensible, but a user who saves-and-leaves has no way back into setup without logging in again. Consider a "resume later" link in the email.

🟡 **`uploadPhotoIfAny`** (line 630) uses `upsert:true` but the path includes `Date.now()` so it's effectively a new file each time — old avatars stay in storage. Add cleanup or use a fixed filename per user.

🔵 **`profile_status` notes in submit handler comments** (lines 894–897) document the Stripe-webhook → "Live" status flip clearly. Good.

🔵 **`focus-areas.js` dependency** — same as athlete-signup.

---

## 16. select-coach.html (807 lines)

Athlete-facing coach browser. Filters (sport, rating, exp level, sort) + skill chips. Pulls real coaches from `profiles` (role=coach, profile_status=Live), blends in 5 hard-coded dummy basketball coaches pre-launch. Coach detail modal with monthly tier subscription + add-on selection → routes to checkout.html with all params.

**Findings:**

🟠 **`SUPPRESS_DUMMY_COACHES = false`** (line 386). Must flip to `true` at launch or your athletes see 5 fake basketball coaches mixed in with real signups. The comment correctly flags this.

🟠 **Internal TIERS object diverges from coach-profile-setup TIERS** (lines 627–645):
- Here: Development $49, Performance $99, **Elite $179**
- coach-profile-setup: L1 $49, L2 $99, **L3 $199 / L4 $399**

So the athlete-facing tier pricing is $179 for the top tier ATHLETE pays, but the coach-side shows $199/$399. These are conceptually different things (athlete monthly access vs coach platform subscription), but using the same word "Elite" makes them look like the same thing — and only one is visible per persona, so it's hard to spot without the cross-reference.

Also: there's no L4 here at all. So if a real Level 4 coach signs up, the athlete-tier resolver (`tierFor`, line 647) maps "elite" → Elite which is the $179 plan, regardless of whether the coach is L3 or L4. No difference shown to the athlete.

🟠 **Hard-coded ★4.9 / dummy review counts** for every coach card via the `assignDummyStats` (referenced as `dummy.rating`, `dummy.reviews`). Real coaches get dummy ratings overlaid on their real data. Same problem as find-mentor — needs to come from `coach_reviews`.

🟠 **Sport-specific skill chips dictionary** (lines 410–418) only has 8 sports. Many supported sports (Netball, Rugby, Cricket, AFL, Athletics, Gymnastics, Swimming, etc.) are not in `SPORT_SKILLS` so an athlete in those sports falls back to "Other" generic skills. The dropdown shows them as options but the experience is impoverished.

🟠 **Dummy coaches are all basketball** — pre-launch the page will look basketball-heavy regardless of the athlete's sport.

🟡 **`tierLevel(c)` fallback** when there's no `selected_tier` returns 1 (line 393) — fine, but combined with the dummy coaches whose `tier` is "PRO"/"ELITE"/"TOP" rather than "Level X", the sort interleaves them unpredictably.

🟡 **`bundles.js` dependency** — same external file caveat. `window.BUNDLES` and `window.BUNDLE_ORDER` are read but not declared anywhere in the uploaded files.

🟡 **Best-match score weights are tunable inline** (`MATCH_WEIGHTS`) — good design. Document the rationale in a comment block.

🔵 **The carousel filter UX is clean** but the empty state (no coaches match) currently just shows "0 Coaches found" and a blank carousel. Consider an "adjust your filters" CTA.

🔵 **Match score multipliers**: 10 × focus, 5 × spotlight, 1 × tier. Spotlight (paid promotion) ranks _above_ tier — meaning a paid L1 outranks an unpaid L4. Confirm this is intentional from a marketplace integrity perspective.

---

## 17. checkout.html (236 lines)

Confirmation/payment step. Reads `coach`, `coachName`, `tier`, `tierPrice`, `addons` from URL params. Renders line items, accepts a promo code (placeholder logic accepts `FREE` or `LAUNCH100` for 100% off), inserts subscription + athlete_coaches rows. Shows success state with "Go to Dashboard" CTA.

**Findings:**

🟠 **Stripe is a placeholder.** Comment is honest (lines 109–113): "Real Stripe goes here. Two options once you have credentials: A) Payment Link... B) Checkout session..." This is a launch-blocker but the comment correctly flags it.

🟠 **Promo codes are hard-coded** ("FREE" and "LAUNCH100") and grant 100% off (lines 84–96). Anyone reading the source code can use either to bypass payment entirely. This needs to become a server-side validated promotion code through Stripe before the page is reachable in production.

🟠 **Subscription is created BEFORE payment.** Even with the placeholder logic, the flow is: confirm → write `subscriptions` row with status="active" → success screen. The athlete is "active" without paying. Acceptable while Stripe is being built — but make sure the migration to real Stripe inverts this (webhook flips to "active" on payment, not the client).

🟡 **`athlete_coaches` insert is "best effort"** (line 160) — the comment notes the athlete-side panel works without it, but the coach-side athlete list won't. If a coach checks their dashboard and sees no new athletes despite getting subscription confirmations, this is why.

🟡 **No CSRF or replay protection.** A malicious user could re-submit the form by replaying the POST. With the promo codes above, free subscriptions could be spammed.

🟡 **Promo-applied total can show $0** but the row is still inserted with status="active" and no Stripe ID. Document that "free" subscriptions are operationally distinct.

🔵 **Stripe placeholder UI is honest** about being a placeholder (`.placeholder-banner` line 188). Good UX hygiene during build.

🔵 **Back link goes to `select-coach.html`** — good.

---

## 18. athlete-dashboard.html (2,238 lines)

The big one. Sidebar nav (Dashboard / My Videos / Reviews / Upload / My Coach / Drills / Messages / Progress / Goals / Resources / Profile). Topbar with greeting + messages icon. Main grid: video upload zone, activity stats, recent reviews list, mini progress chart, My Coach side panel, payments section, profile modal, cancellation modal. Reads `profiles`, `submissions`, `feedback`, `messages`, `subscriptions`, `videos`, `avatars`. Idle auto-logout at 60min.

**Findings:**

🔴 **Hard-coded placeholder reviews in the Recent Reviews list** (lines 592–611). Four review items with "Coach Sam", "Jump Shot Analysis", "Ball Handling Session", etc., all written into the HTML. These persist visually until `renderRecentReviews(submissions.slice(0,3))` overwrites them — but only if the athlete has submissions. A new athlete with 0 submissions sees these fake reviews on first load. Replace the static HTML with an empty state.

🔴 **Hard-coded "Pro Athlete" current plan** in the sidebar (line 493). Doesn't reflect the athlete's actual subscription tier. Pull from `subscriptions.package_name`.

🟠 **Mid-month progress stats hard-coded ranges** — the activity bar values (`actUploads`, `actPending`, etc.) start at "0" then get filled — good — but the "Time Trained" field is shown as `—` and never populated. Either compute or remove.

🟠 **Profile-completion percentage** (`calcPct`, line 1110) only counts 6 fields. Adding mobile, age, improvement_focus etc would give athletes a more meaningful "fill these in" progress.

🟠 **`subscriptions` lookup logic** to populate My Coach (`loadCoach`) is sensitive to the subscriptions table schema — see checkout.html comment about `package_name` and `billing_cycle`. If those columns don't exist in the deployed DB, this breaks silently.

🟡 **Two video tables used: `videos` and `submissions`.** Code reads from both; only `submissions` is actually being inserted into (from upload flow line 1648). The `videos` table appears unused — remove or document.

🟡 **`MAX_UPLOAD_MB = 100`** with a `MAX_DURATION_SEC = 90` — but no client-side duration check. A user can upload a 5min clip under 100MB and not get rejected until the coach sees it.

🟡 **`xhr.send` upload** (line 1633) skips the Supabase client's retry/refresh logic. If the access token expires mid-upload (1hr default), the upload fails with no recovery. For 100MB videos on slow connections, this could happen. Consider chunked uploads or refresh token before starting.

🟡 **Mobile bottom nav** (lines 988–994) has only 4 items + center FAB. The FAB does `showSection('home')` — odd choice for a "+ button" in the visual centre, which users expect to be "add/upload".

🟡 **The Topbar Messages icon** doesn't have a notification dot indicating unread messages (unlike the sidebar's `msgBadge`).

🟡 **`#navMessages` badge ID** vs `#msgBadge` — two different IDs, both for unread count. Hard to keep in sync.

🔵 **Schema introspection caching** (`_profileColsCache`) is good — done once per session.

🔵 **Idle auto-logout** is a nice touch — but only on this page, not on coach-dashboard. Apply consistently.

🔵 **Inline cancellation modal** with reasons + free-text — good UX for retention insight.

---

## 19. coach-dashboard.html (2,513 lines)

The biggest file. Sidebar with tabs (Dashboard / Athletes / Reviews / Schedule / Analyze / Drills / Messages / Analytics / Earnings / Availability / Mentor Requests / Spotlight / Settings / Cancel Subscription). Many features: review queue, earnings overview, mentor requests with accept/decline-with-message modals, mentor sessions list, spotlight activation + cancel, athlete invite link, settings page, package toggle, focus area editor, tier-aware cancellation flow.

**Findings:**

🔴 **DEBUG alert with localStorage contents** (line 1197):
```
alert("DEBUG — No session found after retries.\n\nlocalStorage keys present:\n"+(keys.join("\n")||"(none)")+"\n\nThis tells us if the session was saved at all. Screenshot this and send to support.");
```
Same problem as login.html — leaks internal info, scary UX. Remove.

🟠 **Hard-coded review queue HTML demo** (around lines 530–610, large block) showing made-up athlete videos before `renderQueue()` runs. Same problem as athlete-dashboard recent reviews — a coach with no submissions sees fake athletes. Replace with empty state.

🟠 **Spotlight L4 "auto-activation isn't wired yet"** (line 1752): `err.textContent = "Level 4 Spotlight is free but auto-activation isn't wired yet. Email support to enable."` — but everywhere else (FAQ, dashboard pricing) advertises L4 spotlight as free and active. Currently a level 4 coach who clicks Activate sees this error and has to email — manual process.

🟠 **TIERS-mismatched `SPOTLIGHT_COST` lookup uses ids** ("Level 1 — Development Coach" etc.) — consistent with the DB. But if the coach-profile-setup TIERS array's `label` ever differs further from `id`, this dictionary won't auto-update.

🟠 **`acceptingAthletes` toggle writes to profiles.accepting_athletes** but I don't see this column being read on `select-coach.html`. Filter that excludes non-accepting coaches is missing.

🟡 **`window._coachProfile`** is set globally for cross-section access — works but a coach editing their bio in the Settings tab won't see it reflected in other panels without re-fetching or manually updating the global.

🟡 **Messages section** uses the same dual-table-of-state pattern as athlete-dashboard (`navMsgBadge`, `loadMessages` rebuilds the thread list every time, including after sending a single message — could be more efficient).

🟡 **`inviteAthlete()` link** (line 2183) builds `select-coach.html?coach=` — but I don't see `select-coach.html` reading a `coach=` query param to pre-select that coach. Either the deep-link is silently ignored, or this happens deeper in `select-coach.html` than I read. Verify.

🟡 **No idle auto-logout** on this page (unlike athlete-dashboard). A coach can leave a tab open all day.

🟡 **`alert("Invite link copied to clipboard...")`** with the full URL embedded in the message (line 2185) — works, but the URL is also the only content. A toast/snackbar would be cleaner.

🟡 **`focus-areas.js` and `bundles.js` dependencies** — same as before.

🔵 **Mentor request UX is comprehensive** — full bio modal, notes preview, separate accept/decline reply modals with personalised messages.

🔵 **`#statusText` / `#statusDot`** cycles through Available/Busy/Offline — but isn't persisted to DB. Reload resets.

🔵 **Earnings overview** is rendered but I didn't dig into whether figures are computed from real `subscriptions` data or are placeholder. Worth verifying.

---

## 20. mentor-dashboard.html (1,172 lines)

Mentee-side mentorship dashboard. Auth gate requires: signed in, role=coach, active mentor_relationship row. Otherwise redirects (find-mentor or athlete-dashboard or login). Shows mentor profile, upcoming + recent sessions (from `mentor_sessions`), goals, focus areas, 3 placeholder resources. Schedule + message buttons.

**Findings:**

🟠 **Resources are static placeholders** (lines 688–692): "How elite coaches structure their week", "From technical drills to game-day reads", "Building athlete buy-in across cultures". All marked "Coming soon". Either wire these to real content or remove the section until ready.

🟠 **LEVEL_NAMES dict has the same id/label divergence** as coach-profile-setup (line 680–685). At least it's consistent.

🟡 **Auth gate redirects** to find-mentor if no active mentor relationship — fine for the happy path, but if the user lost their mentor (relationship status changed to inactive), they hit a redirect loop possibility if find-mentor's role gate also rejects them. Unlikely in practice but worth tracing.

🟡 **`document.body.style.visibility = "visible"`** (line 738) implies the body is `visibility:hidden` by default (anti-flash). Good.

🟡 **`fallbackAvatar` uses pravatar** — same fragility note as find-mentor.

🟡 **"Schedule Session" and "Send Message" buttons** exist (lines 828–829) but I didn't dig into whether they're functional. Worth a manual test.

🔵 **Auth gate is the strictest of any dashboard** — three separate redirect paths. Clean defensive code.

🔵 **`mentor_sessions` data model** with `status` (scheduled/completed/cancelled), `topic`, `duration_minutes`, `recording_url` — well-designed.

---

## 21. locker-room.html (518 lines)

Marketing page for "The Locker Room" — live coaching sessions. Static demo data (4 sessions per stream + 4 recordings per stream). Two streams (Coach / Athlete) tab toggle. Featured card with live countdown. Register modal → `locker_room_interest` table.

**Findings:**

🟠 **`supabase.from(...)` insert silently swallows errors** (line 497):
```js
const {error}=await supabase.from("locker_room_interest").insert({...});
document.getElementById("modalRegisterContent").style.display="none";
document.getElementById("modalSuccess").style.display="block";
```
The `error` is destructured but never checked. If RLS rejects the insert (or the table doesn't exist), the user still sees success. The data is lost. Either show an error or log it.

🟠 **All session data is hard-coded** (lines 305–333) including specific dates (June 2026), prices, speaker names ("Aiden Brooks", "Daniel Walsh", "Jordan Parke" — real people or made up?). If made up, this could be misleading.

🟠 **Featured countdown ticks down** to a date set in 2026 — once you ship past those dates, the countdown shows negative or zero forever. Move to a date-aware schedule.

🟠 **The whole page is intercepted by the "Coming Soon" modal** in the rest of the site — so users never actually reach this page. That means **all the demo content here is dead weight** until launch. But once enabled, it ships with the fake data above.

🟡 **`#modalSubmitBtn` text changes between flows** but the actual button still calls `submitInterest()` regardless. A user clicking "Get All Access — $49/mo →" goes through the same Express-Interest flow as session registration. UX-wise, "Register interest" is what actually happens — but the button copy implies payment.

🟡 **No actual purchase / Stripe wiring.** Page captures interest only.

🔵 **Page is currently nav-intercepted** so this is all pre-launch placeholder.

---

## 22. video-review.html (1,672 lines)

The big coach tool — full-page video player with annotation/voice/timer/frame modes. Reads submission by `?sub=` or `?id=`. Multi-mode toolbar (draw / shapes / text / voice / capture). Sends written feedback + annotations + voice notes back to `feedback` table, updates `submissions.status='completed'`.

**Findings:**

🟡 **Lots of `console.log` diagnostic output** (lines 670–684) for every load — useful during debugging, noisy in prod. Either gate behind a `DEBUG` flag or remove.

🟡 **MOV file detection is `/\.mov(\?|$)/i`** (line 717) — works for direct file URLs but not for signed URLs where the extension is in a query parameter. Most Supabase Storage URLs do have `.mov` in the path, so OK.

🟡 **Double-encoded URL detection** (line 728: `/%25[0-9A-Fa-f]{2}/`) — rare edge case but documented well.

🟡 **`status:"in_review"` update fires before the coach has actually opened the editor** (line 759). If a coach clicks into a review by accident and closes, the status is permanently "in_review" with no way back to "pending". Minor UX gap.

🟡 **No save-draft / autosave** for the written feedback. A coach who writes 15 minutes of review notes then has their session expire loses everything. Save draft to localStorage at minimum.

🟡 **Sends to coach-dashboard via redirect** (line 1419) — but if the coach wants to do multiple reviews in a row, they have to navigate back, then click into the next one. A "next in queue" button would speed this up.

🔵 **The error surfaces** for missing video / wrong format are well-written and user-friendly.

🔵 **Capture composite** (video frame + annotations) — solid feature.

🔵 **Voice recording with WebM upload** — well-implemented.

---

## 23. admin.html (823 lines)

Internal admin console. Hard-coded UUID gate (`ADMIN_UUID = "405840be-8ce2-4c8c-acfa-cb27d7e15291"`). KPI cards, signups overlay chart, coaches-by-tier chart, mentor-sessions chart, top coaches list, recent activity, AI insights, cancellations panel, platform health. Fetches from `/.netlify/functions/admin-stats` and `/.netlify/functions/admin-insights`.

**Findings:**

🔴 **Client-side admin gate is bypassable** (line 352): `if (!session || session.user.id !== ADMIN_UUID) window.location.replace("index.html");`. Anyone with DevTools can disable the check. The *real* defence has to be server-side in the Netlify functions — they receive `Authorization: Bearer <session token>` and must validate that token belongs to `ADMIN_UUID` before returning data. **Critical to verify** in `admin-stats.js` and `admin-insights.js` (not in the upload set).

🟠 **`<meta name="robots" content="noindex, nofollow" />`** is good practice but is not a security boundary. Anyone who guesses or finds the URL can read the JS source including `ADMIN_UUID`. Move sensitive identifiers to Netlify env vars and check server-side.

🟠 **Single admin model** — hardcoded UUID. As the team grows, you'll want an `is_admin` flag in `profiles` and a list-based check.

🟡 **`localStorage.storageKey: "ca-auth"` shared across admin and user pages** — fine, but if an admin uses the same browser to test as athlete/coach, they need to log out fully between roles or they may load wrong dashboard.

🟡 **`Bearer ${session.access_token}`** is sent on each fetch — the access token is sensitive. Make sure the function's CORS allows only your origin.

🟡 **No CSP header on the page** — admins typing into search/filter boxes could in theory be XSS-vulnerable if untrusted content is rendered. Audit `renderTopCoaches` and the insights panel for `innerHTML` of unescaped data.

🔵 **Refresh cadence**: 60s for stats, 5min for AI insights. Sensible.

🔵 **`fmtMoney`, `fmtPct`, `timeAgo` helpers** — clean formatters.

🔵 **`inflight` flag** prevents overlapping fetches. Good.

---

## 24. terms-of-service.html (191 lines)

Static legal document. Australian privacy law framing, 14 sections covering eligibility, accounts, athlete terms, coach terms, payments, video content, acceptable use, IP, liability, termination, governing law (Victoria).

**Findings:**

🟠 **"(ABN to be inserted)"** literal placeholders in 2 places (lines 60 and 92). Must replace with the actual ABN before launch.

🟠 **"Refunds are handled on a case-by-case basis"** (section 6) — Australian Consumer Law actually mandates specific refund rights. Have a lawyer review.

🟡 **"Last updated: May 2025"** — should reflect when these were last actually reviewed. If they haven't been touched since May 2025, that's a year old; legal docs benefit from periodic review even with no changes.

🟡 **Section 13 jurisdiction is Victoria** — but if CoachAnywhere is registered elsewhere (the privacy policy doesn't specify), this should match.

🔵 **Section 14 contact link** correctly points to contact.html — good.

🔵 **Disclaimer at the end** noting "this document is a general guide and does not constitute legal advice" — appropriate.

---

## 25. privacy-policy.html (197 lines)

Companion to ToS. Australian Privacy Act / APP framing. 11 sections covering collection, use, video/AI analysis, children's privacy, sharing, security, rights, cookies, changes, contact, complaints.

**Findings:**

🟠 **Same "(ABN to be inserted)"** placeholder issues (lines 60, etc.).

🟠 **OAIC link is wrong** — line 165 has `<a href="https://www.oaic.gov.au" target="_blank">oaic.gov.au</a>` — correct URL. Confirmed.

🟠 **Section 5 "Children's Privacy"** says "available to athletes aged 13 and over" — matches the platform's 13+ minimum. But the athlete-signup form accepts age 8 (`min="8"`). Inconsistency: either tighten signup to min 13 or update the policy to reflect the 8-12 with guardian path.

🟡 **Cookies section** is generic — if you add analytics, ads pixel, or Hotjar etc., the cookies list needs updating.

🟡 **Section 2 lists "Video content"** as collected — confirm this is true. Are AI overlays / movement data stored separately?

🔵 **Section 4 explicitly addresses AI analysis** — good for trust.

🔵 **Contact form replaces email throughout** — consistent.

---

## 26. SEO-META-READY-FOR-LAUNCH.html (snippet file, ~190 lines)

Not a deployable page — a reference file containing head sections, JSON-LD structured data, sitemap.xml template, GA/Meta pixel snippets for launch. Currently un-applied to actual pages.

**Findings:**

🟠 **JSON-LD `aggregateRating`** has `ratingValue: 4.9, reviewCount: 1` (line 78). Google's structured-data guidelines require at least one verifiable review (and serving a single review for a 4.9 rating looks like manipulation). Don't ship the aggregateRating until you have multiple real reviews to back it.

🟠 **Canonical URLs use `https://coachanywhere247.com`** in places and `https://app.example.com` in others. Decide your URL strategy (root vs app subdomain) before deploying.

🟡 **OG image is the transparent logo** — wide-aspect renders poorly on social platforms. Make a proper 1200×630 OG image with the wordmark on a coloured background.

🟡 **Pixel snippets are placeholder IDs** — must be replaced before activation.

🔵 **Comments are clear and well-organised.** Easy to merge into pages section by section.

🔵 **Sitemap.xml template** is solid — just keep dates current.

---

## 27. STATS-TESTIMONIALS-READY-FOR-LAUNCH.html (snippet file, ~220 lines)

Reference snippets for two components — a stats banner (hidden until thresholds met) and a testimonials carousel (hidden until 5+ reviews). Currently un-applied.

**Findings:**

🔴 **Embeds a placeholder Airtable PAT** (line 89): `"Authorization": "Bearer AIRTABLE_PAT_PLACEHOLDER_REPLACE_VIA_SERVER_PROXY"`. The comment correctly flags that this is client-side and exposes the PAT to every visitor. **Must move to a Netlify function before deploying.** The comment even names the function: `/netlify/functions/airtable-coach-count.js`.

🟠 **Thresholds (coaches ≥10, athletes ≥50, reviews ≥20)** — sensible but a single Supabase outage at launch could keep the banner hidden indefinitely. Add a manual override flag.

🟠 **`aggregateRating: 4.9` hard-coded** (line 90) in the static `.stat-num` block — same fake-rating concern as the SEO snippets.

🟡 **No filter for stale reviews** in the testimonials carousel — if a 2-year-old 1-star review later becomes a 5-star edit, it's surfaced because the query uses `rating >= 4` and `created_at DESC`. Sensible — but document.

🔵 **Carousel uses CSS marquee with `:hover` pause** — good performance, no JS animation loop.

🔵 **The threshold-gating pattern** is a great way to avoid a launch-day empty state.

---

## Cross-cutting Findings (apply to multiple files)

### 🔴 Critical (blocks launch)

1. **Pricing model contradiction.** for-athletes.html and for-coaches.html describe a monthly-bundle model ($40–$569/mo) that doesn't exist in the product. The product offers monthly tier subscriptions ($49/$99/$179) plus per-item add-ons ($15/$35/$75/$120/$199). FAQ is correct; the two marketing pages are not. Pick one canonical model and rewrite the others — or split the marketing copy into "Monthly access plans" (tiers) and "Review packages" (add-ons) clearly.

2. **DEBUG alerts in production.** login.html and coach-dashboard.html both pop up a `alert("DEBUG — ...")` with localStorage contents to users on session-retry timeouts. Remove or replace with friendlier error UI.

3. **for-mentors.html has six unfilled `[PLACEHOLDER]` blocks** that ship to users.

4. **Stripe is a placeholder in checkout.** Two hard-coded promo codes grant 100% off; subscriptions are created before payment.

5. **Hard-coded fake content visible on first load:** Recent Reviews on athlete-dashboard, Review Queue on coach-dashboard, hero testimonials on index, mock coaches on select-coach (when `SUPPRESS_DUMMY_COACHES=false`).

6. **Airtable PAT placeholder in STATS-TESTIMONIALS** — flagged correctly in the file but easy to deploy by accident.

7. **External JS files (`focus-areas.js`, `bundles.js`)** are referenced by 4+ pages and not in your upload set. Confirm they exist in the deploy folder.

### 🟠 High (fix soon after launch)

8. **Tier id/label divergence** in coach-profile-setup TIERS — the DB stores ids like "Level 2 — Performance Coach" while users always see "Level 2 — Representative Coach" labels. Works currently only by accident; risk a future bug.

9. **Three signup paths with divergent behaviour** (athlete-signup, coach-signup, signup tab in login.html). The login.html signup loses metadata and breaks under email confirmation.

10. **i.pravatar.cc dependency** for fallback avatars in find-mentor / mentor-dashboard / select-coach — third-party, no SLA, can break the UI silently.

11. **Pricing mismatch** between coach-side tier prices ($199 Elite) and athlete-side tier prices ($179 Elite) for what's labelled the same tier.

12. **Silent profile-insert failures** in athlete-signup, coach-signup, and athlete-dashboard's stub creation — user data lost without warning.

13. **L4 Spotlight "not wired"** even though marketing says it's free and live.

14. **Admin auth is client-side only** — verify the Netlify functions check the JWT server-side and reject non-admin callers.

15. **Hardcoded fake ratings (★4.9)** on every coach card in find-mentor and select-coach. Wire to real `coach_reviews` data or remove until populated.

16. **Index-legacy.html and index-router.html ship with live `kane@coachanywhere247.com` mailto links** even though they're unlinked. Move to `/_archive/` outside the deploy folder.

### 🟡 Medium (polish)

17. **Cookies & GDPR/AU compliance** — no consent banner anywhere despite the privacy policy mentioning cookies.

18. **No idle auto-logout on coach-dashboard** (only on athlete-dashboard).

19. **Schema introspection on every signup** in athlete-signup — works but uncached.

20. **`accepting_athletes` toggle** writes to DB but no consumer reads it (select-coach doesn't filter).

21. **No CAPTCHA / honeypot on waitlist.html** even though contact.html has one.

22. **Locker-room form swallows errors silently.**

23. **Hardcoded "Pro Athlete" plan label** in athlete-dashboard sidebar.

24. **`videos` table referenced but unused** alongside `submissions` — pick one or document.

25. **OG image is the transparent logo** — won't render well on social shares.

26. **No T&C timestamp** captured at signup.

27. **No "next review in queue" button** in video-review — coaches have to manually navigate back.

28. **No save-draft / autosave** on video-review written feedback — long reviews can be lost.

29. **Welcome-email handoff in waitlist** is fire-and-forget — no retry, no admin alert if Resend is down.

30. **Hardcoded sport list** differs slightly between athlete-signup ("Gymnastics, Rowing, Lacrosse, Pickleball...") and select-coach SPORT_SKILLS (only 8 sports). Reconcile.

### 🔵 Low (nice to have)

31. **Inconsistent typography** — index uses system-ui, athlete/coach/select-coach use DM Sans (loaded from Google Fonts). Pick one font stack.

32. **Duplicated drawer + locker-modal code** in 8+ marketing pages — extract to a shared `nav.js` include.

33. **Hard-coded testimonial photos** — could be self-hosted, deterministic.

34. **No service-worker / offline support** anywhere.

35. **Many pages use `Cache-Control: no-store`** even for static pages where caching would help.

36. **`focus-areas.js` consumer code is defensive** (works if missing) but should be a hard requirement — make the dependency explicit.

37. **No telemetry / error tracking** wired up — Sentry or similar would catch the silent failures highlighted above.

38. **Privacy / ToS "ABN to be inserted"** literal placeholder.

39. **`Date.now()` filenames for avatar uploads** leave orphans in storage.

40. **`alert()` used heavily** as the error UX — toast notifications or in-card error states would feel more modern.

---

## Suggested Launch Order

1. **Fix the four 🔴 launch-blockers** above (pricing, DEBUG alerts, for-mentors placeholders, checkout/Stripe).
2. **Move index-legacy and index-router** out of the deploy folder.
3. **Wire real Stripe** (checkout + create-coach-tier-checkout + create-spotlight-checkout).
4. **Audit Netlify functions** (admin auth, contact rate-limit, Airtable proxy).
5. **Replace fake placeholder content** (testimonials, recent reviews HTML, dummy coaches with `SUPPRESS_DUMMY_COACHES=true`).
6. **Apply SEO meta** from SEO-META-READY-FOR-LAUNCH.html to each page.
7. **Verify focus-areas.js and bundles.js** are in your deploy and don't drift from the consumer pages.
8. **Insert ABN** in ToS and Privacy.
9. **Set up Sentry or similar** to catch the silent failures.
10. **Pre-launch QA pass** — at minimum, sign up as athlete (under 18 + over 18), sign up as coach, complete profile setup, browse coaches, checkout, upload a video, do a review, send a message, both directions.

---

*End of review.*
