-- ─────────────────────────────────────────────────────────────
-- migration_waitlist_locker_interest.sql
--
-- Adds the "interested in The Locker Room" opt-in checkbox value
-- to the waitlist table. Boolean, defaults false.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS interested_in_locker_room boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
