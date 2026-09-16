-- Run once in the Supabase SQL editor.
-- Supports the Weekly Report restructure: Questions/Support Needed move off
-- Calendar & Tasks into the Weekly Report workspace only; Next Steps become a
-- genuinely separate, non-Task concept; Progress can distinguish "created" from
-- "updated"/"completed" using real timestamps instead of due_date guessing.

-- ---------- Questions: add a type so "Support Needed" is distinguishable from "Question" ----------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'question'; -- 'question' | 'support'

-- ---------- Next Steps: a lightweight, separate table — NOT tasks ----------
-- Deliberately has no assignee / due date / task type: a Next Step is a strategic
-- direction, not an operational task. Tasks and Next Steps never convert into each other.
CREATE TABLE IF NOT EXISTS next_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'done'
  created_by text,
  created_at timestamptz DEFAULT now(),
  archived_at timestamptz
);
ALTER TABLE next_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON next_steps;
CREATE POLICY "allow all" ON next_steps FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON next_steps TO anon;

-- ---------- Programmes: track updates separately from creation ----------
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ---------- Tasks: track when something was actually completed, not just its due date ----------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
