-- Run once in the Supabase SQL editor.
-- Extends Meetings with full scheduling detail + a cancel-without-delete status,
-- extends Tasks' existing status check to allow 'cancelled', and adds a lightweight
-- Milestones table for fixed deadlines / approximate windows / TBD project dates.

-- ---------- Meetings: richer scheduling fields ----------
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS format text; -- 'Online' | 'In-person', optional
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS online_link text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants text[];
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled'; -- 'scheduled' | 'cancelled'

-- The old meeting_type value 'Group' is renamed to 'Team' (naming update only).
UPDATE meetings SET meeting_type = 'Team' WHERE meeting_type = 'Group';

-- ---------- Tasks: allow a 'cancelled' status alongside the existing todo/in_progress/done ----------
-- The exact pre-existing constraint name isn't known here, so find and drop whatever
-- CHECK constraint governs the status column, then recreate it with the extra value.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'tasks' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled'));

-- ---------- Milestones (fixed deadlines, approximate windows, or genuinely TBD dates) ----------
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  milestone_type text NOT NULL, -- 'deadline' | 'steering' | 'presentation'
  precision text NOT NULL DEFAULT 'exact', -- 'exact' | 'window' | 'tbd'
  date_from date,
  date_to date,
  date_label text, -- e.g. "Late September", "Early December" — shown instead of a fake exact date
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON milestones;
CREATE POLICY "allow all" ON milestones FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON milestones TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
