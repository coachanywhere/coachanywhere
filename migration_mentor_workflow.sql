-- ─────────────────────────────────────────────────────────────
-- migration_mentor_workflow.sql
--
-- §5 + §6 — Make mentor_relationships readable in the table editor
--             and capture the mentee's request notes.
-- §7      — Extend mentor_sessions to support accept / modify /
--             decline flow with reasons + bidirectional negotiation.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── mentor_relationships ─────────────────────────────────────
ALTER TABLE public.mentor_relationships
  ADD COLUMN IF NOT EXISTS mentee_name   text,
  ADD COLUMN IF NOT EXISTS mentor_name   text,
  ADD COLUMN IF NOT EXISTS request_notes text;

-- Trigger keeps the name columns in sync with profiles automatically.
-- Joins to profiles on each insert/update; uses BEFORE so the row hits disk
-- with names already populated (no second UPDATE needed).
CREATE OR REPLACE FUNCTION public.fill_mentor_relationship_names()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
    INTO NEW.mentee_name
    FROM public.profiles WHERE id = NEW.mentee_id;
  SELECT TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
    INTO NEW.mentor_name
    FROM public.profiles WHERE id = NEW.mentor_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mentor_relationships_fill_names ON public.mentor_relationships;
CREATE TRIGGER mentor_relationships_fill_names
  BEFORE INSERT OR UPDATE OF mentee_id, mentor_id
  ON public.mentor_relationships
  FOR EACH ROW EXECUTE FUNCTION public.fill_mentor_relationship_names();

-- Backfill any existing rows
UPDATE public.mentor_relationships mr
SET mentee_name = TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,''))
FROM public.profiles p
WHERE p.id = mr.mentee_id AND (mr.mentee_name IS NULL OR mr.mentee_name = '');

UPDATE public.mentor_relationships mr
SET mentor_name = TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,''))
FROM public.profiles p
WHERE p.id = mr.mentor_id AND (mr.mentor_name IS NULL OR mr.mentor_name = '');

-- ── mentor_sessions ──────────────────────────────────────────
-- New columns:
--   decline_reason         — text supplied when status is set to 'cancelled'
--   modify_reason          — text supplied when responder proposes a new time
--   original_scheduled_at  — when a session is modified, the prior time is
--                            stashed here so both parties see what changed
--   last_response_by       — uuid of whoever last acted (initiator vs responder).
--                            Used to know which side the request is waiting on.
--
-- Status enum is plain text — no DB constraint to alter. The new value 'pending'
-- joins the existing 'scheduled' / 'completed' / 'cancelled' set.
ALTER TABLE public.mentor_sessions
  ADD COLUMN IF NOT EXISTS decline_reason        text,
  ADD COLUMN IF NOT EXISTS modify_reason         text,
  ADD COLUMN IF NOT EXISTS original_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_response_by      uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS mentor_sessions_status_idx
  ON public.mentor_sessions (status);

NOTIFY pgrst, 'reload schema';
