-- ─────────────────────────────────────────────────────────────
-- Migration: submissions + feedback tables, plus RLS policies
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- WHO USES WHAT
--   submissions  — athlete uploads write a row (status='pending').
--                  video-review.html flips status: pending → in_review on open,
--                  → completed on Send Review.
--   feedback     — video-review.html inserts one row on Send Review with
--                  written_feedback, key_takeaways, drill_recommendations,
--                  voice_clips (jsonb), referencing the submission + athlete + coach.
--
-- Depends on athlete_coaches existing (created by migration_subscriptions_policies.sql).
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── submissions ─────────────────────────────────────────────
-- coach_id is written by the athlete-dashboard upload code at submission time
-- (sourced from the athlete's active subscription). It's the simple, fast key
-- for the coach's Review Queue.
CREATE TABLE IF NOT EXISTS public.submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  video_url       text,
  notes           text,
  skill_category  text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_athlete_idx ON public.submissions(athlete_id);
CREATE INDEX IF NOT EXISTS submissions_coach_idx   ON public.submissions(coach_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx  ON public.submissions(status);
CREATE INDEX IF NOT EXISTS submissions_created_idx ON public.submissions(created_at DESC);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athlete inserts own submission"   ON public.submissions;
DROP POLICY IF EXISTS "Athlete reads own submissions"    ON public.submissions;
DROP POLICY IF EXISTS "Athlete updates own submissions"  ON public.submissions;
DROP POLICY IF EXISTS "Athlete deletes own submissions"  ON public.submissions;
DROP POLICY IF EXISTS "Coach reads linked submissions"   ON public.submissions;
DROP POLICY IF EXISTS "Coach updates linked submissions" ON public.submissions;
DROP POLICY IF EXISTS "Coach reads own submissions"      ON public.submissions;
DROP POLICY IF EXISTS "Coach updates own submissions"    ON public.submissions;

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

-- Coach reads/updates rows where they're the named coach — direct, no join.
CREATE POLICY "Coach reads own submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coach updates own submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING       (coach_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid());

-- ── feedback ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  coach_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  athlete_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  written_feedback      text,
  key_takeaways         text,
  drill_recommendations text,
  voice_clips           jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_athlete_idx    ON public.feedback(athlete_id);
CREATE INDEX IF NOT EXISTS feedback_coach_idx      ON public.feedback(coach_id);
CREATE INDEX IF NOT EXISTS feedback_submission_idx ON public.feedback(submission_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coach inserts feedback for linked athlete" ON public.feedback;
DROP POLICY IF EXISTS "Coach reads own feedback"   ON public.feedback;
DROP POLICY IF EXISTS "Athlete reads own feedback" ON public.feedback;

-- Coach inserts feedback only when they're the coach of the linked athlete.
CREATE POLICY "Coach inserts feedback for linked athlete" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.athlete_coaches ac
      WHERE ac.athlete_id = feedback.athlete_id
        AND ac.coach_id   = auth.uid()
    )
  );

CREATE POLICY "Coach reads own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Athlete reads own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

-- ── Optional sanity check (uncomment after running) ─────────
-- SELECT tablename, policyname, cmd
-- FROM   pg_policies
-- WHERE  schemaname = 'public'
--   AND  tablename IN ('submissions','feedback')
-- ORDER  BY tablename, policyname;
