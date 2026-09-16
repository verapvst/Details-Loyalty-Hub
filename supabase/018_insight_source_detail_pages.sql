-- Run once in the Supabase SQL editor.
-- Supports the new Insight Detail / Source Detail pages: adds "who/when last updated"
-- (mirrors programmes.updated_at from migration 013) so the detail view's quiet
-- metadata footer can show "Last updated by X · date" alongside "Added by X · date".
-- Non-destructive — no existing column touched, no existing row changed.

ALTER TABLE figures ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE figures ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE sources ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS updated_by text;

-- NOT included here: a "source excerpt / quoted evidence" field. It doesn't exist
-- anywhere in the current schema (figures only has insight_text/insight_type/
-- supporting_detail/source_id/scope) and wasn't added without explicit confirmation.
-- The smallest addition if wanted later: `ALTER TABLE figures ADD COLUMN IF NOT
-- EXISTS source_excerpt text;` — a single nullable column, same pattern as above.

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
