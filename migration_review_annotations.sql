-- ─────────────────────────────────────────────────────────────
-- migration_review_annotations.sql
--
-- Video launch — Task B (annotation persistence via snapshots).
--   1. feedback.annotations jsonb — array of captured marked-up frames:
--        [{ "url": "...", "video_time": 12.34, "note": "" }, ...]
--   2. A public `review-annotations` storage bucket the coach writes
--      snapshot JPEGs into at {coach_id}/{submission_id}/{uuid}.jpg.
--
-- Mirrors the avatars-bucket policy pattern: coach (auth.uid()) may
-- INSERT into their own folder; everyone may read (public bucket so the
-- athlete can view the marked-up frames in their feedback view).
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- 1. feedback column
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS annotations jsonb;

-- 2. storage bucket (public, JPEG/PNG, 5 MB per snapshot is plenty)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-annotations', 'review-annotations', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. policies — coach writes own folder, public read
DROP POLICY IF EXISTS "Coach uploads own annotation"  ON storage.objects;
DROP POLICY IF EXISTS "Public read annotations"        ON storage.objects;

CREATE POLICY "Coach uploads own annotation" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-annotations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read annotations" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'review-annotations');

NOTIFY pgrst, 'reload schema';
