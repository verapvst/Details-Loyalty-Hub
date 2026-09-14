-- Run once in the Supabase SQL editor.
-- Adds: figure classification (type/topic/subtopic), and recurrence grouping for
-- recurring meetings and tasks.

ALTER TABLE figures ADD COLUMN IF NOT EXISTS data_type text;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS subtopic text;

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_id uuid;
