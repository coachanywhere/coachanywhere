-- ─────────────────────────────────────────────────────────────
-- migration_coach_tier_subscription.sql
--
-- §2 — Coaches now pay a Stripe subscription for their platform tier.
-- We need columns on profiles to store the Stripe customer + subscription
-- IDs so the webhook can flip profile_status on cancellation / payment
-- failure events.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS tier_stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS tier_activated_at           timestamptz,
  ADD COLUMN IF NOT EXISTS tier_status                 text;
-- tier_status values: 'active' | 'past_due' | 'cancelled' | null

-- The webhook looks coaches up by their subscription ID on every renewal,
-- cancellation, and payment-failure event. Partial index so we only carry
-- weight for rows that actually have a tracked subscription.
CREATE INDEX IF NOT EXISTS profiles_tier_subscription_idx
  ON public.profiles (tier_stripe_subscription_id)
  WHERE tier_stripe_subscription_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
