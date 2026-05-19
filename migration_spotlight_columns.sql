-- ─────────────────────────────────────────────────────────────
-- migration_spotlight_columns.sql
--
-- Adds the six Spotlight-subscription columns that
-- netlify/functions/stripe-webhook.js writes to. Without these,
-- every webhook event silently fails with a PostgREST "column not
-- found" error and Spotlight never activates / deactivates.
--
-- Plus an index on the Stripe subscription ID since the webhook
-- looks coaches up by that field on every renewal / cancellation /
-- payment-failure event.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_active                 boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_pending                boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_stripe_customer_id     text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_activated_at           timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_expires_at             timestamptz;

-- The webhook queries by subscription ID twice (renewal + cancellation).
-- Partial index — only rows that actually have a subscription tracked.
CREATE INDEX IF NOT EXISTS profiles_spotlight_subscription_idx
  ON public.profiles (spotlight_stripe_subscription_id)
  WHERE spotlight_stripe_subscription_id IS NOT NULL;

-- Refresh PostgREST schema cache so the new columns are visible to
-- both the webhook (service-role client) and any future client UI
-- without a 60s wait.
NOTIFY pgrst, 'reload schema';
