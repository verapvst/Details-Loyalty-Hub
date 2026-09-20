-- Run once in the Supabase SQL editor.
-- Backs the new Analysis tab's "Save Analysis" and "Research Notes" features (see
-- assets/analysisSaved.js). `config` stores the exact chart configuration (lab, chart
-- type, x/y/measure/group-by/normalisation, global + local filters, date range) as JSON
-- so a saved analysis can be reopened exactly as it was. Follows the same "allow all"
-- RLS + anon-grant convention as every other table in this project (see e.g.
-- programme_features in 005_new_architecture.sql).

CREATE TABLE IF NOT EXISTS analysis_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lab text NOT NULL,
  config jsonb NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE analysis_saved ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON analysis_saved;
CREATE POLICY "allow all" ON analysis_saved FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON analysis_saved TO anon;

CREATE TABLE IF NOT EXISTS analysis_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  note_text text,
  linked_analysis_id uuid REFERENCES analysis_saved(id) ON DELETE SET NULL,
  tags text[],
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE analysis_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON analysis_notes;
CREATE POLICY "allow all" ON analysis_notes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON analysis_notes TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
