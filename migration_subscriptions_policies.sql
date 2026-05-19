-- ─────────────────────────────────────────────────────────────
-- Migration: subscriptions + athlete_coaches tables, plus their RLS policies
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- WHAT THESE TABLES ARE FOR
--   subscriptions    — athlete↔coach paid/active relationship (athlete dashboard reads this)
--   athlete_coaches  — link table (coach dashboard reads this to list their athletes)
--
-- Both are written from checkout.html on successful "payment". The constraint
-- names for foreign keys are the Postgres defaults (e.g. athlete_coaches_athlete_id_fkey)
-- because coach-dashboard.html and video-review.html embed via PostgREST using
-- exactly those default names — keep them as-is.
--
-- IDEMPOTENT — every CREATE / ALTER uses IF NOT EXISTS, every CREATE POLICY is
-- preceded by DROP POLICY IF EXISTS. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── subscriptions table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'active',
  package_name     text,
  billing_cycle    text DEFAULT 'Monthly',
  next_upload_due  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_athlete_idx ON public.subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS subscriptions_coach_idx   ON public.subscriptions(coach_id);

-- ── athlete_coaches table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_coaches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_coaches_unique_pair UNIQUE (athlete_id, coach_id)
);

CREATE INDEX IF NOT EXISTS athlete_coaches_coach_idx ON public.athlete_coaches(coach_id);

-- ── Enable RLS (Supabase default for new tables, but explicit is safer) ──
ALTER TABLE public.subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_coaches ENABLE ROW LEVEL SECURITY;

-- ── subscriptions policies ──────────────────────────────────
DROP POLICY IF EXISTS "Athlete inserts own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Athlete reads own subscription"   ON public.subscriptions;
DROP POLICY IF EXISTS "Coach reads own subscriptions"    ON public.subscriptions;

CREATE POLICY "Athlete inserts own subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athlete reads own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Coach reads own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

-- ── athlete_coaches policies ────────────────────────────────
DROP POLICY IF EXISTS "Athlete inserts own link" ON public.athlete_coaches;
DROP POLICY IF EXISTS "Athlete reads own link"   ON public.athlete_coaches;
DROP POLICY IF EXISTS "Coach reads own links"    ON public.athlete_coaches;

CREATE POLICY "Athlete inserts own link" ON public.athlete_coaches
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athlete reads own link" ON public.athlete_coaches
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Coach reads own links" ON public.athlete_coaches
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

-- ── Optional sanity check (uncomment after running) ─────────
-- SELECT tablename, policyname, cmd
-- FROM   pg_policies
-- WHERE  schemaname = 'public'
--   AND  tablename IN ('subscriptions','athlete_coaches')
-- ORDER  BY tablename, policyname;
