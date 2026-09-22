-- Run once in the Supabase SQL editor.
-- Replaces the simple Vertical/Audience multi-select tags with a proper effectiveness
-- scorecard: for each idea, score every dimension (Market Fit, Feasibility, ...) against
-- every vertical/audience column, 1-5. The Vertical/Audience taxonomies themselves aren't
-- going away -- they're reused as the scorecard's column headers (still managed in
-- Settings), just no longer a plain tag field on the idea itself.
-- Also adds a Mechanisms multi-pick on the idea, shown only when Category = "Mechanism",
-- reusing the same Mechanisms taxonomy as Loyalty Programmes.

ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS vertical;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS audience;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS mechanisms text[];

CREATE TABLE IF NOT EXISTS idea_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  column_key text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (idea_id, dimension, column_key)
);
ALTER TABLE idea_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON idea_scores;
CREATE POLICY "allow all" ON idea_scores FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_scores TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
