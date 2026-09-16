-- Run once in the Supabase SQL editor.
-- Adds a short, searchable Insight Title, separate from the existing insight_text
-- ("Main Insight") and supporting_detail ("Source Detail", relabeled in the UI only —
-- the column name is unchanged). Both of those become rich-text-capable (plain HTML
-- stored in the same text columns, no type change) and optional.
--
-- Non-destructive: one new nullable column, nothing rewritten. Existing rows have no
-- title yet — the UI falls back to a plain-text rendering of insight_text wherever a
-- title would otherwise be blank (same pattern as source_name || citation_tag).
ALTER TABLE figures ADD COLUMN IF NOT EXISTS title text;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
