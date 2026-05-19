-- ─────────────────────────────────────────────────────────────
-- Migration: Storage policies for the `avatars` bucket
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- WHO USES THIS BUCKET
--   • coach-profile-setup.html:484  — coaches upload to {coach_id}/avatar_*.{ext}
--   • athlete-dashboard.html (Profile popup) — athletes upload to {athlete_id}/avatar.{ext}
--
-- Both follow the {user_id}/... pattern, so a single set of three policies
-- (INSERT / UPDATE / SELECT) covers everyone.
--
-- Why UPDATE matters: the athlete photo upload uses `upsert: true` which calls
-- INSERT-or-UPDATE on the same path. INSERT alone isn't enough.
--
-- IDEMPOTENT: each policy is dropped first so re-running won't error with
-- "policy ... already exists". The DROP doesn't fail if the policy is missing.
-- ─────────────────────────────────────────────────────────────

-- Make sure the bucket itself exists and is public. ON CONFLICT keeps this safe
-- to run even if you already created the bucket via the dashboard.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,           -- 5 MB cap matches client-side check
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Policies ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users upload own avatar"  ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar"  ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars"      ON storage.objects;

CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- ── Sanity check (optional — uncomment to verify after running) ──
-- SELECT policyname, cmd, roles
-- FROM   pg_policies
-- WHERE  schemaname = 'storage'
--   AND  tablename  = 'objects'
--   AND  policyname IN ('Users upload own avatar','Users update own avatar','Public read avatars');
