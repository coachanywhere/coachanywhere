-- ─────────────────────────────────────────────────────────────
-- migration_contact_submissions.sql
--
-- Backing store for the public Contact Us form (contact.html →
-- netlify/functions/contact-submit.js). The function writes here with
-- the service role and also emails the owner via Resend.
--
-- Admin-only data: RLS is ON with NO policies, so anon/authenticated
-- clients can neither read nor write. Only the service role (which
-- bypasses RLS) can insert rows or read them back.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  email       text NOT NULL,
  role        text,
  topic       text,
  message     text NOT NULL,
  ip_address  text,
  user_agent  text
);

-- Helps the rate-limit lookup (recent submissions per email).
CREATE INDEX IF NOT EXISTS contact_submissions_email_created_idx
  ON public.contact_submissions (email, created_at DESC);

-- Lock it down: enable RLS and define no policies → only the service
-- role can touch it. (force = applies even to the table owner.)
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
