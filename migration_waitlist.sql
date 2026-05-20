-- ─────────────────────────────────────────────────────────────
-- migration_waitlist.sql
--
-- Pre-launch waitlist capture for the public /waitlist.html page.
-- Anonymous visitors can INSERT (join the list); nobody can SELECT
-- through the public anon key (the owner reads via the Supabase
-- table editor / service role).
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  first_name  text,
  email       text NOT NULL,
  role        text,   -- coach | athlete | both | parent | other
  sport       text,
  country     text,   -- AU | USA | Other
  level       text,   -- coaching/competing level (branches by role)
  notes       text,
  source      text    -- ?src= URL param (e.g. instagram, facebook, direct)
);

-- One signup per email. A repeat submit surfaces "you're already on the
-- list" in the UI rather than creating a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique
  ON public.waitlist (lower(email));

CREATE INDEX IF NOT EXISTS waitlist_created_at_idx
  ON public.waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_source_idx
  ON public.waitlist (source);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Public can INSERT only. No SELECT/UPDATE/DELETE policy is created, so
-- the anon + authenticated roles cannot read or modify the list — the
-- table is write-only from the client. Owner reads via service role.
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join the waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
