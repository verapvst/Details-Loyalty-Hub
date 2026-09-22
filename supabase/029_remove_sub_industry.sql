-- Run once in the Supabase SQL editor.
-- Sub-Industry is removed entirely: the field, its per-industry picklists, and the
-- Settings card that managed them. Industry itself is unaffected.

DELETE FROM custom_options WHERE list_key = 'sub_industry' OR list_key LIKE 'sub_industry:%';
DELETE FROM deactivated_options WHERE list_key = 'sub_industry' OR list_key LIKE 'sub_industry:%';
ALTER TABLE programmes DROP COLUMN IF EXISTS sub_industry;
