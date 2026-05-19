-- ─────────────────────────────────────────────────────────────
-- Migration: mentor_relationships + mentor_sessions tables + RLS,
-- plus mentor_focus_area column on profiles.
-- Idempotent — safe to re-run.
--
-- WHO USES WHAT
--   mentor_relationships  — coach↔mentor (L3/L4 coach) pairing.
--                           Mentee inserts on "Request Mentor" with status='pending'.
--                           Mentor flips to 'active' when they accept.
--   mentor_sessions       — scheduled / completed mentorship sessions.
--                           Either party can insert/read/update their own rows.
--   profiles.mentor_focus_area — mentee-set text the coach is currently
--                                focusing on. Survives mentor changes.
-- ─────────────────────────────────────────────────────────────

-- 1. focus area on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentor_focus_area text;

-- 2. mentor_relationships ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_relationships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending',  -- pending | active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_relationships_unique UNIQUE (mentee_id, mentor_id)
);

CREATE INDEX IF NOT EXISTS mentor_relationships_mentee_idx ON public.mentor_relationships(mentee_id);
CREATE INDEX IF NOT EXISTS mentor_relationships_mentor_idx ON public.mentor_relationships(mentor_id);

ALTER TABLE public.mentor_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentee inserts own relationship"  ON public.mentor_relationships;
DROP POLICY IF EXISTS "Mentee reads own relationships"   ON public.mentor_relationships;
DROP POLICY IF EXISTS "Mentor reads own relationships"   ON public.mentor_relationships;
DROP POLICY IF EXISTS "Mentee updates own relationships" ON public.mentor_relationships;
DROP POLICY IF EXISTS "Mentor updates own relationships" ON public.mentor_relationships;

CREATE POLICY "Mentee inserts own relationship" ON public.mentor_relationships
  FOR INSERT TO authenticated
  WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "Mentee reads own relationships" ON public.mentor_relationships
  FOR SELECT TO authenticated
  USING (mentee_id = auth.uid());

CREATE POLICY "Mentor reads own relationships" ON public.mentor_relationships
  FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());

CREATE POLICY "Mentee updates own relationships" ON public.mentor_relationships
  FOR UPDATE TO authenticated
  USING       (mentee_id = auth.uid())
  WITH CHECK  (mentee_id = auth.uid());

CREATE POLICY "Mentor updates own relationships" ON public.mentor_relationships
  FOR UPDATE TO authenticated
  USING       (mentor_id = auth.uid())
  WITH CHECK  (mentor_id = auth.uid());

-- 3. mentor_sessions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  topic            text,
  status           text NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled
  recording_url    text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentor_sessions_mentee_idx    ON public.mentor_sessions(mentee_id);
CREATE INDEX IF NOT EXISTS mentor_sessions_mentor_idx    ON public.mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS mentor_sessions_scheduled_idx ON public.mentor_sessions(scheduled_at);

ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentee inserts session"      ON public.mentor_sessions;
DROP POLICY IF EXISTS "Mentor inserts session"      ON public.mentor_sessions;
DROP POLICY IF EXISTS "Mentee reads own sessions"   ON public.mentor_sessions;
DROP POLICY IF EXISTS "Mentor reads own sessions"   ON public.mentor_sessions;
DROP POLICY IF EXISTS "Mentee updates own sessions" ON public.mentor_sessions;
DROP POLICY IF EXISTS "Mentor updates own sessions" ON public.mentor_sessions;

CREATE POLICY "Mentee inserts session" ON public.mentor_sessions
  FOR INSERT TO authenticated
  WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "Mentor inserts session" ON public.mentor_sessions
  FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "Mentee reads own sessions" ON public.mentor_sessions
  FOR SELECT TO authenticated
  USING (mentee_id = auth.uid());

CREATE POLICY "Mentor reads own sessions" ON public.mentor_sessions
  FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());

CREATE POLICY "Mentee updates own sessions" ON public.mentor_sessions
  FOR UPDATE TO authenticated
  USING       (mentee_id = auth.uid())
  WITH CHECK  (mentee_id = auth.uid());

CREATE POLICY "Mentor updates own sessions" ON public.mentor_sessions
  FOR UPDATE TO authenticated
  USING       (mentor_id = auth.uid())
  WITH CHECK  (mentor_id = auth.uid());

-- Refresh PostgREST schema cache so new tables/columns are visible immediately
NOTIFY pgrst, 'reload schema';
