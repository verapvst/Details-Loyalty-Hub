-- Run once in the Supabase SQL editor.
-- Brainstorm: Ideas (divergent) -> Issue Tree nodes (convergent) -> Next Steps -> Weekly Report.
-- Evidence on a node is a reference (Insight / Programme / Idea), never copied text.

-- ---------------- Ideas ----------------
CREATE TABLE IF NOT EXISTS brainstorm_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'idea',
  theme text,
  vertical text,
  priority text NOT NULL DEFAULT 'medium',
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brainstorm_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON brainstorm_ideas;
CREATE POLICY "allow all" ON brainstorm_ideas FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON brainstorm_ideas TO anon;

CREATE TABLE IF NOT EXISTS brainstorm_idea_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (idea_id, member_name)
);
ALTER TABLE brainstorm_idea_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON brainstorm_idea_interest;
CREATE POLICY "allow all" ON brainstorm_idea_interest FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON brainstorm_idea_interest TO anon;

-- ---------------- Issue Tree ----------------
CREATE TABLE IF NOT EXISTS issue_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  hypothesis_status text NOT NULL DEFAULT 'open',
  archived boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE issue_trees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_trees;
CREATE POLICY "allow all" ON issue_trees FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_trees TO anon;

CREATE TABLE IF NOT EXISTS issue_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES issue_trees(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES issue_nodes(id) ON DELETE CASCADE,
  branch text NOT NULL,
  title text NOT NULL,
  description text,
  evidence_strength text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'draft',
  order_index int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE issue_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_nodes;
CREATE POLICY "allow all" ON issue_nodes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_nodes TO anon;

CREATE TABLE IF NOT EXISTS issue_node_insights (
  node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  figure_id uuid NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (node_id, figure_id)
);
ALTER TABLE issue_node_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_node_insights;
CREATE POLICY "allow all" ON issue_node_insights FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_node_insights TO anon;

CREATE TABLE IF NOT EXISTS issue_node_programmes (
  node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (node_id, programme_id)
);
ALTER TABLE issue_node_programmes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_node_programmes;
CREATE POLICY "allow all" ON issue_node_programmes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_node_programmes TO anon;

CREATE TABLE IF NOT EXISTS issue_node_ideas (
  node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  idea_id uuid NOT NULL REFERENCES brainstorm_ideas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (node_id, idea_id)
);
ALTER TABLE issue_node_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_node_ideas;
CREATE POLICY "allow all" ON issue_node_ideas FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_node_ideas TO anon;

-- ---------------- Link Questions / Next Steps back to a node ----------------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS related_node_id uuid REFERENCES issue_nodes(id) ON DELETE SET NULL;
ALTER TABLE next_steps ADD COLUMN IF NOT EXISTS related_node_id uuid REFERENCES issue_nodes(id) ON DELETE SET NULL;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
