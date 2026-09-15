-- Run once in the Supabase SQL editor.
-- partner_companies already existed as plain `text` from the old schema, so migration 005's
-- `ADD COLUMN IF NOT EXISTS partner_companies text[]` was a no-op — the column stayed `text`.
-- No real data has been entered under the new architecture yet, so it's safe to drop and
-- recreate as the correct array type.

ALTER TABLE programmes DROP COLUMN IF EXISTS partner_companies;
ALTER TABLE programmes ADD COLUMN partner_companies text[];
