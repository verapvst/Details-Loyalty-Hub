-- Run once in the Supabase SQL editor.
-- Prevents the same person from double-liking the same element on the same programme,
-- while different teammates can each like it independently.

-- Clear out any stray rows from before target_type existed (the Favorites UI was never
-- built, so this should be a no-op in practice).
DELETE FROM likes WHERE target_type IS NULL OR target_label IS NULL;

DO $$ BEGIN
  ALTER TABLE likes ADD CONSTRAINT likes_unique_per_person
    UNIQUE (programme_id, target_type, target_label, liked_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
