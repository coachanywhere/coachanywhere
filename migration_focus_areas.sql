-- migration_focus_areas.sql
-- Structured focus-area metadata for coach profiles + athlete improvement goals,
-- enabling athlete<->coach matching on select-coach.html.
--
-- Reuses existing columns where possible:
--   • Coaching level = existing profiles.selected_tier (text, e.g. "Level 3").
--     No new tier column — matching derives a 1-4 level from this string.
--   • profiles is shared by athletes and coaches (role column distinguishes).
--
-- text[] (not jsonb) so we can use native array-overlap (&&) + GIN indexes
-- for matching. App layer enforces the 3 / 2 / 3 caps; the DB does not.
--
-- Idempotent — safe to re-run.

-- Coach side: curated focus picks (max 3, app-enforced) + free-text customs (max 2)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS focus_areas         text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_focus_areas  text[];

-- Athlete side: what they want to improve (1-3, app-enforced)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS improvement_focus   text[];

-- Indexes to support overlap-based matching (cheap; harmless if matching
-- stays client-side for now).
CREATE INDEX IF NOT EXISTS profiles_focus_areas_gin
  ON public.profiles USING gin (focus_areas);
CREATE INDEX IF NOT EXISTS profiles_improvement_focus_gin
  ON public.profiles USING gin (improvement_focus);

NOTIFY pgrst, 'reload schema';
