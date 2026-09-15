-- Run once in the Supabase SQL editor.
-- Adds two small tables for the Weekly Reports feature:
--   questions        — "Questions & Support Needed", managed manually on Schedules &
--                       Tasks; a report pulls in whichever are still unanswered.
--   weekly_reports    — saved/generated report versions (one per reviewed period).

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  asked_by text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'answered'
  answer text,
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON questions;
CREATE POLICY "allow all" ON questions FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON questions TO anon;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  content jsonb NOT NULL, -- { research, analysis, meetings, deliverables, questions, next_steps }
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (period_start, period_end)
);
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON weekly_reports;
CREATE POLICY "allow all" ON weekly_reports FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_reports TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
