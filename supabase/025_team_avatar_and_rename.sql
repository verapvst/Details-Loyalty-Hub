-- Run once in the Supabase SQL editor.
-- Two Settings > Members upgrades:
--   1. Profile photos — a small Storage bucket (same public-read / anon-write pattern
--      as insight-images, see 021) plus one new column on app_team_members.
--   2. Safe renaming — a member's name is copied as plain text into every table that
--      records who created/liked/attended something (no foreign key, by original
--      design — see teamMembers.js). Renaming was deliberately left unbuilt until this
--      cascade could update every one of those places atomically, so historical
--      activity keeps showing the person's current name instead of splitting across
--      an old and a new one.

ALTER TABLE app_team_members ADD COLUMN IF NOT EXISTS avatar_path text; -- object path within the bucket, not a full URL — same reasoning as figures.image_path (021)

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "team avatars: public read" ON storage.objects;
CREATE POLICY "team avatars: public read" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'team-avatars');

DROP POLICY IF EXISTS "team avatars: anon upload" ON storage.objects;
CREATE POLICY "team avatars: anon upload" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'team-avatars');

DROP POLICY IF EXISTS "team avatars: anon delete" ON storage.objects;
CREATE POLICY "team avatars: anon delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'team-avatars');

-- Every table + column that stores a team member's name as plain text, found by
-- grepping every created_by / updated_by / liked_by / asked_by / person / participants /
-- assignees write site in assets/*.js against the schema. Runs as one transaction (a
-- Postgres function body always does), so a rename either fully lands everywhere or
-- not at all — never half-applied. p_id identifies the member being renamed; the old
-- name is read from their own row rather than passed in, so the caller can't drift out
-- of sync with what's actually on record.
CREATE OR REPLACE FUNCTION rename_team_member(p_id uuid, p_new_name text)
RETURNS void AS $$
DECLARE
  v_old_name text;
BEGIN
  SELECT name INTO v_old_name FROM app_team_members WHERE id = p_id;
  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;
  IF v_old_name = p_new_name THEN
    RETURN;
  END IF;

  UPDATE app_team_members SET name = p_new_name WHERE id = p_id;

  UPDATE programmes SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE programme_features SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE sources SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE sources SET updated_by = p_new_name WHERE updated_by = v_old_name;
  UPDATE figures SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE figures SET updated_by = p_new_name WHERE updated_by = v_old_name;
  UPDATE likes SET liked_by = p_new_name WHERE liked_by = v_old_name;
  UPDATE meetings SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE meetings SET participants = array_replace(participants, v_old_name, p_new_name) WHERE v_old_name = ANY(participants);
  UPDATE meeting_polls SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE poll_responses SET person = p_new_name WHERE person = v_old_name;
  UPDATE custom_options SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE milestones SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE questions SET asked_by = p_new_name WHERE asked_by = v_old_name;
  UPDATE weekly_reports SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE next_steps SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE analysis_saved SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE analysis_notes SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE tasks SET created_by = p_new_name WHERE created_by = v_old_name;
  UPDATE tasks SET assignees = array_replace(assignees, v_old_name, p_new_name) WHERE v_old_name = ANY(assignees);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION rename_team_member(uuid, text) TO anon;
