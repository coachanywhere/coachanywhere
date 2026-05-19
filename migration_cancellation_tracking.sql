-- ─────────────────────────────────────────────────────────────
-- migration_cancellation_tracking.sql
--
-- Phase 2 §1 — capture subscription cancellation lifecycle:
--   when it happened, why, free-text detail, and which save-offer
--   outcome (if we showed one).
-- Plus the Stripe ID columns the coach_package webhook needs to
-- write so we can map athlete subscriptions to Stripe and call
-- subscriptions.update(cancel_at_period_end) from the UI.
--
-- Idempotent — every statement is ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────

-- ── subscriptions (athlete ↔ coach package subscriptions) ────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id        text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id            text,
  ADD COLUMN IF NOT EXISTS cancelled_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason           text,
  ADD COLUMN IF NOT EXISTS cancellation_detail           text,
  ADD COLUMN IF NOT EXISTS cancellation_feedback_offer   text;

-- Webhook looks subscriptions up by Stripe subscription ID on every
-- renewal / cancellation / payment-failure event.
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Useful for the cancellations panel on the owner dashboard.
CREATE INDEX IF NOT EXISTS subscriptions_cancelled_at_idx
  ON public.subscriptions (cancelled_at)
  WHERE cancelled_at IS NOT NULL;

-- ── profiles (coach tier subscription cancellation cols) ─────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_cancelled_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS tier_cancellation_reason           text,
  ADD COLUMN IF NOT EXISTS tier_cancellation_detail           text,
  ADD COLUMN IF NOT EXISTS tier_cancellation_feedback_offer   text;

-- ── profiles (spotlight subscription cancellation cols) ─────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spotlight_cancelled_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS spotlight_cancellation_reason           text,
  ADD COLUMN IF NOT EXISTS spotlight_cancellation_detail           text,
  ADD COLUMN IF NOT EXISTS spotlight_cancellation_feedback_offer   text;

-- Indexes for the cancellations panel — partial so they only carry weight
-- once cancellations actually exist.
CREATE INDEX IF NOT EXISTS profiles_tier_cancelled_at_idx
  ON public.profiles (tier_cancelled_at)
  WHERE tier_cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_spotlight_cancelled_at_idx
  ON public.profiles (spotlight_cancelled_at)
  WHERE spotlight_cancelled_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
