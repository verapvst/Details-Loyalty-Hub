-- Run once in the Supabase SQL editor.
-- Rebalances Brainstorm per the "Ideas -> Issue Tree" architecture proposal:
-- Ideas go back to being a lightweight inbox (raw thought, nothing else); the
-- analytical weight (classification, evidence, hypothesis, scoring) moves onto
-- Issue Tree nodes, which is where a strategic question actually lives.

-- ---------------- Ideas: strip back to an inbox ----------------
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS type;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS category;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS mechanisms;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS vertical;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS audience;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS objective;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS priority;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS swot_strengths;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS swot_weaknesses;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS swot_opportunities;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS swot_threats;
ALTER TABLE brainstorm_ideas DROP COLUMN IF EXISTS validation_level;
ALTER TABLE brainstorm_ideas ADD COLUMN IF NOT EXISTS theme text;

-- Collapse the old 4-state kanban (idea/exploring/validated/archived) into a
-- 2-state inbox (inbox/archived) — "promoted" is shown from issue_node_ideas,
-- never stored, so it can never drift out of sync with the tree.
UPDATE brainstorm_ideas SET status = 'archived' WHERE status = 'archived';
UPDATE brainstorm_ideas SET status = 'inbox' WHERE status <> 'archived';
ALTER TABLE brainstorm_ideas ALTER COLUMN status SET DEFAULT 'inbox';

-- Idea-level enrichment tables from the previous (abandoned) architecture —
-- evidence and discussion now live on the Issue, not the Idea.
DROP TABLE IF EXISTS idea_relationships;
DROP TABLE IF EXISTS idea_scores;
DROP TABLE IF EXISTS idea_insights;
DROP TABLE IF EXISTS idea_favourites;
DROP TABLE IF EXISTS idea_comments;
DROP TABLE IF EXISTS brainstorm_idea_interest;

-- ---------------- Issue Tree: this is where the analytical weight goes ----------------
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS hypothesis text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS analysis_tool text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS analysis_notes text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS vertical_relevance text[];
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS audience_relevance text[];
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS key_insight text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS recommendation text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS is_concept boolean NOT NULL DEFAULT false;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS complexity_drivers text[];
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS risk_note text;

-- Prioritisation — a small, defensible set of dimensions (never one generic "Fit"
-- score). Business Impact carries a required-in-UI one-line P&L logic note rather
-- than a fabricated precise figure; Implementation Complexity carries tagged
-- drivers (complexity_drivers, above) instead of separate numeric sub-scores.
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS customer_value_impact smallint CHECK (customer_value_impact BETWEEN 1 AND 5);
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS business_impact smallint CHECK (business_impact BETWEEN 1 AND 5);
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS business_impact_note text;
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS strategic_differentiation smallint CHECK (strategic_differentiation BETWEEN 1 AND 5);
ALTER TABLE issue_nodes ADD COLUMN IF NOT EXISTS implementation_complexity smallint CHECK (implementation_complexity BETWEEN 1 AND 5);

ALTER TABLE issue_trees ADD COLUMN IF NOT EXISTS recommendation_text text;

-- Optional, opt-in per-node scored vertical/audience relevance — most Issues use
-- the plain vertical_relevance/audience_relevance tag arrays above; this table is
-- only instantiated for the rare Issue where the team wants graded (1-5) relevance
-- instead of a yes/no tag.
CREATE TABLE IF NOT EXISTS issue_node_relevance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('vertical', 'audience')),
  column_key text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (node_id, dimension, column_key)
);
ALTER TABLE issue_node_relevance_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON issue_node_relevance_scores;
CREATE POLICY "allow all" ON issue_node_relevance_scores FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON issue_node_relevance_scores TO anon;
