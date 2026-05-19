-- migration_profile_columns.sql
--
-- Adds every column the athlete and coach flows write to `public.profiles`.
-- Safe to run multiple times — every statement is idempotent
-- (`ADD COLUMN IF NOT EXISTS`).
--
-- Run this in Supabase SQL editor once. After it succeeds, the runtime
-- schema-introspection filter in athlete-dashboard.html / athlete-signup.html
-- becomes a no-op for these fields (it'll happily pass them through), and
-- the "Could not find the X column in profiles in the schema cache" errors
-- will stop.

-- ---------- Athlete-side fields ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age              integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile           text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sport            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skill_level      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_goal        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goals            jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url       text;

-- Guardian fields (only populated when athlete is under 18 at signup)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_last_name  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_mobile     text;

-- ---------- Coach-side fields ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio                   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS qualifications        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coaching_style        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills                jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selected_tier         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_cycle         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service_packages      jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_status        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepting_athletes    boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_recommended_tier   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_agreed_with_ai  boolean;

-- After adding columns, ask PostgREST to reload its schema cache so the
-- new columns are visible to the JS client immediately (otherwise it can
-- take up to 60s).
NOTIFY pgrst, 'reload schema';
