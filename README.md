# CoachAnywhere

Static HTML + Supabase + Netlify Functions + Stripe.

## Athlete bundle subscriptions (active athlete product)

Every coach offers the same 3 standard monthly bundles, priced by the coach's
tier hourly rate (L1 $48 / L2 $72 / L3 $108 / L4 $144 per hour).

Price derivation (see `create-stripe-products.js` for the code):
- **Starter** = rate × (50/60) → **$40 / $60 / $90 / $120**
- **Standard** = rate × 2 + $49 AI overlay → **$145 / $193 / $265 / $337**
- **Pro** = rate × (200/60) + $49 AI + $40 fast-track → **$249 / $329 / $449 / $569**

### Stripe price-ID env vars to set in Netlify (12 new — all monthly recurring)

Run `node create-stripe-products.js` (with `STRIPE_SECRET_KEY` set) to create the
products; it prints these with the generated price IDs. Then set them in Netlify:

```
STRIPE_BUNDLE_STARTER_L1     # $40/mo
STRIPE_BUNDLE_STARTER_L2     # $60/mo
STRIPE_BUNDLE_STARTER_L3     # $90/mo
STRIPE_BUNDLE_STARTER_L4     # $120/mo
STRIPE_BUNDLE_STANDARD_L1    # $145/mo
STRIPE_BUNDLE_STANDARD_L2    # $193/mo
STRIPE_BUNDLE_STANDARD_L3    # $265/mo
STRIPE_BUNDLE_STANDARD_L4    # $337/mo
STRIPE_BUNDLE_PRO_L1         # $249/mo
STRIPE_BUNDLE_PRO_L2         # $329/mo
STRIPE_BUNDLE_PRO_L3         # $449/mo
STRIPE_BUNDLE_PRO_L4         # $569/mo
```

Legacy one-off package SKUs (`STRIPE_PKG_*`) are preserved-for-reference only
(commented out in `create-stripe-products.js`) and are no longer created.

### ⚠️ Stripe Connect dependency (launch-critical, NOT yet built)

The bundle system is **non-functional for real money until coaches have a
connected Stripe Connect account.** Athlete subscriptions use
`application_fee_percent: 20` (80% to the coach's Connect account, 20% platform).
Until Connect onboarding exists:
- a coach **without** a Connect account → subscription is **blocked** with a clear
  message and the athlete is **not charged**;
- a coach **with** a Connect account → subscription proceeds with the 20/80 split.

Build the structure now; activation happens when Connect onboarding is live.

## Coach tier naming

Canonical tier names (display): **L1 Development · L2 Representative · L3 State ·
L4 Elite**. Note: the internal identifier strings stored in
`profiles.selected_tier` (e.g. `"Level 2 — Performance Coach"`) are kept
unchanged as stable billing-map keys — only user-visible labels were renamed.
