-- Run once in the Supabase SQL editor.
-- Fixes 016: this project's Supabase instance already had a table literally named
-- `team_members` (full_name column, no `active` column) — created outside this repo,
-- most likely a course/project roster, unrelated to this app. 016's own `CREATE TABLE
-- IF NOT EXISTS team_members` therefore silently did nothing (the table already
-- existed), so the app never got the `active` column it needs. Leaving the pre-existing
-- table completely untouched and using a distinctly-named table instead.
CREATE TABLE IF NOT EXISTS app_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE app_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON app_team_members;
CREATE POLICY "allow all" ON app_team_members FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON app_team_members TO anon;

INSERT INTO app_team_members (name) VALUES ('André'), ('Alice'), ('Cá'), ('Chica'), ('Maria'), ('Vera')
ON CONFLICT (name) DO NOTHING;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
