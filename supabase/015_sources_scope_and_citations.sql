-- Run once in the Supabase SQL editor.
-- Restructures Sources into a reusable, structured citation record (Source Name /
-- Author-Organisation / Year / Source Type / Scope -> generated citation), and adds
-- a Scope taxonomy that Data & Insights snapshots at creation time. Non-destructive:
-- old columns (citation_tag, full_citation, link_or_path) are kept and reused where
-- their meaning already matches (full_citation, link_or_path); citation_tag's old
-- free-text value is backfilled into the new source_name/short_citation columns so
-- existing sources stay findable immediately.

ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS author_org text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS scope text[];
ALTER TABLE sources ADD COLUMN IF NOT EXISTS short_citation text;

UPDATE sources SET source_name = citation_tag WHERE source_name IS NULL AND citation_tag IS NOT NULL;
UPDATE sources SET short_citation = citation_tag WHERE short_citation IS NULL AND citation_tag IS NOT NULL;

-- Data & Insights: Scope is copied from the Source at creation time (a snapshot,
-- not a live link) and stays independently editable/overridable per insight.
ALTER TABLE figures ADD COLUMN IF NOT EXISTS scope text[];

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
