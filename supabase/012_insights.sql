-- Run once in the Supabase SQL editor.
-- Restructures "Figures & Data" into "Data & Insights": reusable pieces of information
-- extracted from Sources (a finding, a stat, a relationship, a framework...), rather than
-- the old market-stat-only shape (data_type/topic/subtopic/market/statistic/value).
--
-- Non-destructive: the old columns stay (unused going forward) — this is the same
-- pattern used for the Programme architecture rewrite (005_new_architecture.sql).

ALTER TABLE figures ADD COLUMN IF NOT EXISTS insight_text text;         -- the one-sentence takeaway
ALTER TABLE figures ADD COLUMN IF NOT EXISTS insight_type text;         -- Key Finding | Statistic | Relationship | Framework | Strategic Implication | Other
ALTER TABLE figures ADD COLUMN IF NOT EXISTS supporting_detail text;    -- optional short context
