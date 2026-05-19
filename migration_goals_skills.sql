-- ─────────────────────────────────────────────────────────────
-- Migration: add goals + skills JSONB columns to profiles
-- Run this once in: Supabase Dashboard → SQL Editor
--
-- Shape of each item:
--   goals.[*]  = { id: string, name: string, progress: 0..100 }
--   skills.[*] = { id: string, name: string, level: 0..100 }
--
-- Idempotent — safe to run more than once.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goals  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional sanity check — should return zero rows if everything is good.
-- SELECT id, goals, skills FROM profiles WHERE jsonb_typeof(goals) <> 'array' OR jsonb_typeof(skills) <> 'array';
