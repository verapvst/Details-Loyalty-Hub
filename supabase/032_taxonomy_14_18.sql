-- Run once in the Supabase SQL editor, BEFORE deploying the matching app changes.
-- Adds the scorecard taxonomies (14 mechanisms, 18 benefits) next to the existing
-- v3 data. Nothing is dropped or overwritten: programmes.mechanisms (v3, 11 values) and
-- programmes.benefits (old 12 values) stay as read-only legacy while programmes are
-- recoded one by one. See assets/options.js (MECHANISMS_14, BENEFITS_18).

ALTER TABLE programmes ADD COLUMN IF NOT EXISTS mechanisms_14 text[];   -- multi-select, 14 scorecard mechanisms
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS benefits_18 text[];     -- multi-select, 18 scorecard benefits
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS recode_status text;     -- To recode / Suggested / Recoded / Verified
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS coding_notes text;      -- where on the official page each coded item was found

UPDATE programmes SET recode_status = 'To recode' WHERE recode_status IS NULL;
