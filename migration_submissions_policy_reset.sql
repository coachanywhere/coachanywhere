-- ─────────────────────────────────────────────────────────────
-- Migration: submissions RLS policy reset + final NULL coach_id backfill
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- WHY
--   Earlier migrations left 8 policies on the submissions table where 6 were
--   expected — likely the old join-based "Coach reads/updates linked submissions"
--   weren't cleanly dropped before the new direct-coach_id ones were created.
--   This file blows away every known submissions policy and recreates exactly
--   the 6 we want, all using direct identity checks (no joins).
--
--   It also backfills any remaining rows where coach_id IS NULL to Coach Daniel
--   (72d3977e-b95c-4227-a6d8-2fce41269409) so all existing test submissions show
--   up in his queue.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1) Drop every known policy by name. IF EXISTS makes each line a no-op when
--    the named policy isn't there. If there are policies on this table you
--    didn't create through these migrations, run the diagnostic at the bottom
--    of this file to spot them — they may also need dropping.
DROP POLICY IF EXISTS "Athlete inserts own submission"   ON public.submissions;
DROP POLICY IF EXISTS "Athlete reads own submissions"    ON public.submissions;
DROP POLICY IF EXISTS "Athlete updates own submissions"  ON public.submissions;
DROP POLICY IF EXISTS "Athlete deletes own submissions"  ON public.submissions;
DROP POLICY IF EXISTS "Coach reads linked submissions"   ON public.submissions;
DROP POLICY IF EXISTS "Coach updates linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Coach reads own submissions"      ON public.submissions;
DROP POLICY IF EXISTS "Coach updates own submissions"    ON public.submissions;

-- 2) Make sure RLS is on (Supabase default, but explicit is safer).
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 3) Recreate the canonical 6 policies — every one direct, no joins.
CREATE POLICY "Athlete inserts own submission" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athlete reads own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Athlete updates own submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING       (athlete_id = auth.uid())
  WITH CHECK  (athlete_id = auth.uid());

CREATE POLICY "Athlete deletes own submissions" ON public.submissions
  FOR DELETE TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Coach reads own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coach updates own submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());

-- 4) Backfill: any remaining NULL coach_id rows → Coach Daniel.
UPDATE public.submissions
   SET coach_id = '72d3977e-b95c-4227-a6d8-2fce41269409'
 WHERE coach_id IS NULL;

-- ── Diagnostics (uncomment to inspect after running) ──────────
-- 1) Confirm exactly 6 policies now exist on submissions:
-- SELECT policyname, cmd, roles
-- FROM   pg_policies
-- WHERE  schemaname = 'public' AND tablename = 'submissions'
-- ORDER  BY cmd, policyname;
--
-- 2) Confirm every submission now has a coach_id:
-- SELECT id, athlete_id, coach_id, status, created_at
-- FROM   public.submissions
-- ORDER  BY created_at DESC;
--
-- 3) Sanity check that Coach Daniel's profile row exists with the expected id:
-- SELECT id, role, first_name, last_name FROM public.profiles
-- WHERE id = '72d3977e-b95c-4227-a6d8-2fce41269409';
