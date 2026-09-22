-- Run once in the Supabase SQL editor.
-- The reviewed Brainstorming architecture: an idea gets a Type (altitude — Strategic
-- Choice / Mechanism / Design Parameter / Positioning / Enabling Technology / Concept)
-- alongside its existing Category (content area — now the 8 loyalty-system buckets,
-- see options.js), plus an optional Customer Objective tag. Vertical/Audience come back
-- as optional per-idea tags (separate from, but sharing the same vocabulary as, the
-- Scorecard's column headers). Ideas can now also link to each other via a lightweight
-- relationships graph (combines_with / alternative_to / depends_on / built_from) — this
-- is how a Concept is built from several ingredient ideas without ever copying or
-- losing the originals.

ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS vertical text[];
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS audience text[];
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS objective text[];

CREATE TABLE IF NOT EXISTS idea_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  to_idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('combines_with', 'alternative_to', 'depends_on', 'built_from')),
  created_at timestamptz DEFAULT now(),
  CHECK (from_idea_id <> to_idea_id),
  UNIQUE (from_idea_id, to_idea_id, relation_type)
);
ALTER TABLE idea_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON idea_relationships;
CREATE POLICY "allow all" ON idea_relationships FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_relationships TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
