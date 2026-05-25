-- migration_athlete_subscriptions.sql
-- Athlete BUNDLE subscriptions (Starter / Standard / Pro), priced by coach tier.
--
-- This is the new monetisation model: every coach offers the same 3 standard
-- bundles, priced by the coach's tier hourly rate. It is SEPARATE from:
--   • coach tier subscriptions  (profiles.tier_* + the platform fee)
--   • the existing `subscriptions` table (legacy athlete<->coach package subs)
--   • spotlight / mentor / locker SKUs
-- Nothing existing is dropped or altered beyond two additive profiles columns.
--
-- Writes happen via the Stripe webhook (service role). RLS lets an athlete and
-- the coach each read their own rows; there are no client insert/update
-- policies. Idempotent — safe to re-run.

-- ── 1. Coach pricing inputs on profiles ─────────────────────────────
-- tier_hourly_rate: L1 $48 / L2 $72 / L3 $108 / L4 $144 per hour.
-- bundles_active:  which of starter|standard|pro the coach offers (default all 3).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier_hourly_rate numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bundles_active   text[] DEFAULT ARRAY['starter','standard','pro'];

-- Best-effort backfill of hourly rate from the coach's existing tier. The tier
-- remains the authoritative source — the app should re-set this on tier change.
-- (selected_tier is text like "Level 3"; we read the level number from it.)
UPDATE public.profiles
   SET tier_hourly_rate = CASE
         WHEN selected_tier ~ '4' THEN 144
         WHEN selected_tier ~ '3' THEN 108
         WHEN selected_tier ~ '2' THEN 72
         WHEN selected_tier ~ '1' THEN 48
         ELSE tier_hourly_rate END
 WHERE role = 'coach'
   AND tier_hourly_rate IS NULL
   AND selected_tier ~ '[1-4]';

-- ── 2. New athlete bundle subscriptions table ───────────────────────
-- athlete_id / coach_id use ON DELETE SET NULL (and are therefore nullable) so a
-- subscription row SURVIVES profile deletion for audit + refund tracking — the
-- financial record stays, just orphaned from the deleted profile.
CREATE TABLE IF NOT EXISTS public.athlete_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  athlete_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coach_id               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  bundle_type            text NOT NULL CHECK (bundle_type IN ('starter','standard','pro')),
  monthly_price          numeric NOT NULL,            -- snapshot at signup (AUD)
  stripe_subscription_id text,
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancelled_at           timestamptz
);

CREATE INDEX IF NOT EXISTS athlete_subscriptions_athlete_idx ON public.athlete_subscriptions (athlete_id);
CREATE INDEX IF NOT EXISTS athlete_subscriptions_coach_idx   ON public.athlete_subscriptions (coach_id);
CREATE INDEX IF NOT EXISTS athlete_subscriptions_stripe_idx  ON public.athlete_subscriptions (stripe_subscription_id);

-- ── 3. RLS — owners read; service role (webhook) writes ─────────────
ALTER TABLE public.athlete_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Athlete reads own bundle subs" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Coach reads own bundle subs"   ON public.athlete_subscriptions;
CREATE POLICY "Athlete reads own bundle subs" ON public.athlete_subscriptions
  FOR SELECT TO authenticated USING (athlete_id = auth.uid());
CREATE POLICY "Coach reads own bundle subs" ON public.athlete_subscriptions
  FOR SELECT TO authenticated USING (coach_id = auth.uid());

NOTIFY pgrst, 'reload schema';
