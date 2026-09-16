-- Run once in the Supabase SQL editor.
-- Adds the configuration layer for Settings: safe Add/Deactivate/Delete for every
-- picklist, team members as real data instead of a hardcoded array, and a small
-- generic key-value store for global app settings (nav labels, pinned countries).
-- Everything here is additive/non-destructive — no existing table loses a column,
-- no existing record changes.

-- ---------- custom_options: add the fields needed for the full lifecycle ----------
-- active: lets a team-added value be deactivated (hidden from new-entry pickers)
--         without deleting it, so historical records that already used it stay valid.
-- group_name: only used by Scope (Market / Industry | Loyalty | Company / Internal) —
--         every other list leaves this null.
-- note: an optional short definition, used today only for custom Information Types
--         (shown as a hover tooltip, same as the 8 built-in definitions).
ALTER TABLE custom_options ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE custom_options ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE custom_options ADD COLUMN IF NOT EXISTS note text;

-- ---------- deactivated_options: hide a BUILT-IN (code-shipped) value from new-entry
-- pickers without touching code or any existing record that already uses it. Built-in
-- values aren't rows anywhere else, so this is the only place that can happen.
CREATE TABLE IF NOT EXISTS deactivated_options (
  list_key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (list_key, value)
);
ALTER TABLE deactivated_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON deactivated_options;
CREATE POLICY "allow all" ON deactivated_options FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON deactivated_options TO anon;

-- ---------- team_members: replaces the hardcoded TEAM_MEMBERS array in options.js.
-- Deliberately no rename support yet (see the Settings proposal) — Add + Deactivate
-- only. A deactivated member disappears from new-assignment pickers but every task,
-- meeting, like, source etc. they already touched keeps their name unchanged.
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON team_members;
CREATE POLICY "allow all" ON team_members FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO anon;

INSERT INTO team_members (name) VALUES ('André'), ('Alice'), ('Cá'), ('Chica'), ('Maria'), ('Vera')
ON CONFLICT (name) DO NOTHING;

-- ---------- app_settings: a small generic key/value store for the few genuinely
-- global settings that aren't picklists — nav tab display-label overrides
-- (key = 'nav_label:<technical key>') and Pinned Countries (key = 'pinned_countries').
-- One shared table rather than a dedicated one per concern.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON app_settings;
CREATE POLICY "allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
