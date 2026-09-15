-- Run once in the Supabase SQL editor.
-- The original `likes` table (created before this session) has feature_text as NOT NULL.
-- The new Likes layer uses target_type/target_label instead and never sets feature_text,
-- so every insert was failing. No real data depends on feature_text yet.

ALTER TABLE likes ALTER COLUMN feature_text DROP NOT NULL;
