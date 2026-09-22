-- Run once in the Supabase SQL editor.
-- Ideas grow from a kanban card into their own detail page: multi-select Vertical and
-- Audience (B2B/B2C), a smaller curated Category list replacing the old Theme, a SWOT
-- framework, a Validation Level, evidence links to Insights and Favourites, and a
-- categorized comment thread (Team / Details / Professor).

ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS theme;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS vertical;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS vertical text[];
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS audience text[];
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS validation_level text NOT NULL DEFAULT 'none';
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS swot_strengths text;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS swot_weaknesses text;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS swot_opportunities text;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS swot_threats text;

CREATE TABLE IF NOT EXISTS idea_insights (
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  figure_id uuid NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (idea_id, figure_id)
);
ALTER TABLE idea_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON idea_insights;
CREATE POLICY "allow all" ON idea_insights FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_insights TO anon;

CREATE TABLE IF NOT EXISTS idea_favourites (
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  like_id uuid NOT NULL REFERENCES likes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (idea_id, like_id)
);
ALTER TABLE idea_favourites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON idea_favourites;
CREATE POLICY "allow all" ON idea_favourites FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_favourites TO anon;

CREATE TABLE IF NOT EXISTS idea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'team',
  author text,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE idea_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON idea_comments;
CREATE POLICY "allow all" ON idea_comments FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON idea_comments TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
