-- ─────────────────────────────────────────────────────────────
-- Cleanup: remove submissions whose video_url points to a .MOV file
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- WHY
--   Desktop browsers (Chrome, Firefox, Edge) can't play .MOV (QuickTime)
--   files in a <video> element. The coach review screen now detects this
--   and shows a friendly message instead of a broken player, but the rows
--   stay in the Review Queue as unplayable. This script deletes them so
--   the queue is back to a clean state. Re-running the athlete upload flow
--   (with iPhone Camera → Most Compatible) will produce MP4 rows that play.
--
--   The DELETE cascades into:
--     - feedback rows for those submissions (FK ON DELETE CASCADE)
--     - any Storage files? NO — Storage objects are NOT deleted by this.
--       You can clean those up separately from Storage → videos → bulk select.
--
-- SAFETY
--   1) Step 1 is a SELECT — run it first to PREVIEW what will be deleted.
--   2) Step 2 is the actual DELETE — only run it after you've confirmed the
--      preview list looks right.
-- ─────────────────────────────────────────────────────────────

-- ── Step 1: preview ─────────────────────────────────────────
-- Run this on its own first. Inspect the rows that would be deleted.
SELECT id, athlete_id, coach_id, status, video_url, created_at
FROM   public.submissions
WHERE  video_url ILIKE '%.mov'
ORDER  BY created_at DESC;

-- ── Step 2: delete ──────────────────────────────────────────
-- Uncomment and run AFTER you've previewed and are happy.
-- DELETE FROM public.submissions WHERE video_url ILIKE '%.mov';

-- ── Step 3 (optional): orphaned Storage files ──────────────
-- Storage objects in the 'videos' bucket are NOT removed by the DELETE above.
-- To clean them up: Dashboard → Storage → videos → search for .MOV → bulk delete.
-- Or in SQL (only works if you have access to the storage schema):
-- DELETE FROM storage.objects WHERE bucket_id = 'videos' AND name ILIKE '%.mov';
