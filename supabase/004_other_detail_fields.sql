-- Run once in the Supabase SQL editor.
-- Matches the Excel's "Mechanics Data Dictionary" instruction: whenever Primary/
-- Secondary Programme Type or a Benefit field is set to "Other", describe it here.

ALTER TABLE programmes ADD COLUMN IF NOT EXISTS mechanic_detail text;
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS benefit_detail text;
