-- Run once in the Supabase SQL editor.
-- Adds: programme cover images, meetings, deliverable flag on tasks, and
-- a lightweight "which slot works for everyone" meeting-poll feature.

-- ---------- Programme cover image ----------
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS cover_image_url text;

-- ---------- Meetings (Client / Group / Professor), shown on the Schedules & Tasks agenda ----------
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meeting_type text NOT NULL, -- 'Client' | 'Group' | 'Professor'
  meeting_date date NOT NULL,
  meeting_time time,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON meetings;
CREATE POLICY "allow all" ON meetings FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON meetings TO anon;

-- ---------- Deliverable flag on the existing tasks table ----------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'Task'; -- 'Task' | 'Deliverable'

-- ---------- Meeting polls ("Lettuce Meet"-lite: candidate slots, everyone ticks what works) ----------
CREATE TABLE IF NOT EXISTS meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  chosen_slot_id uuid,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meeting_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON meeting_polls;
CREATE POLICY "allow all" ON meeting_polls FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON meeting_polls TO anon;

CREATE TABLE IF NOT EXISTS poll_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES meeting_polls(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  slot_time time,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE poll_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON poll_slots;
CREATE POLICY "allow all" ON poll_slots FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_slots TO anon;

DO $$ BEGIN
  ALTER TABLE meeting_polls ADD CONSTRAINT fk_meeting_polls_chosen_slot
    FOREIGN KEY (chosen_slot_id) REFERENCES poll_slots(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES poll_slots(id) ON DELETE CASCADE,
  person text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (slot_id, person)
);
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON poll_responses;
CREATE POLICY "allow all" ON poll_responses FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_responses TO anon;

-- ---------- Custom picklist values added from the Settings page ----------
CREATE TABLE IF NOT EXISTS custom_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key text NOT NULL,
  value text NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (list_key, value)
);
ALTER TABLE custom_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON custom_options;
CREATE POLICY "allow all" ON custom_options FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_options TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
