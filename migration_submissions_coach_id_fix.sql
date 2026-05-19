-- ─────────────────────────────────────────────────────────────
-- Migration: fix submissions table so coach_id is set + backfill
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- ROOT CAUSE
--   Existing submissions had coach_id = NULL because the athlete-dashboard
--   upload code wasn't writing it. We fixed the JS to include coach_id from
--   the athlete's active subscription. This migration:
--     1) Adds coach_id column if it's missing (no-op if present)
--     2) Backfills the existing NULL rows to Coach Daniel
--        (72d3977e-b95c-4227-a6d8-2fce41269409)
--     3) Replaces the old join-based coach RLS with a direct coach_id check
--        (simpler & faster)
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1) Add coach_id column if missing. If it already exists (with or without FK),
--    this is a no-op.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) Index for the coach's queue lookup
CREATE INDEX IF NOT EXISTS submissions_coach_idx ON public.submissions(coach_id);

-- 3) Backfill the two existing rows where coach_id is still NULL.
--    Per investigation: both submissions belong to athletes coached by Daniel.
UPDATE public.submissions
   SET coach_id = '72d3977e-b95c-4227-a6d8-2fce41269409'
 WHERE coach_id IS NULL;

-- 4) Swap the coach-side RLS policies for direct coach_id checks.
--    Drop both the old (join-based) and the new (direct) names so this works
--    whether you previously ran the original migration or not.
DROP POLICY IF EXISTS "Coach reads linked submissions"   ON public.submissions;
DROP POLICY IF EXISTS "Coach updates linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Coach reads own submissions"      ON public.submissions;
DROP POLICY IF EXISTS "Coach updates own submissions"    ON public.submissions;

CREATE POLICY "Coach reads own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coach updates own submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());

-- ── Sanity check (optional — uncomment to inspect after running) ──
-- SELECT id, athlete_id, coach_id, status, created_at
-- FROM   public.submissions
-- ORDER  BY created_at DESC;
