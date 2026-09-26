-- Run once in the Supabase SQL editor.
-- Analysis audit (2026-09-26, "225-programme database" review): two structural gaps
-- identified that block real pricing/ecosystem analysis and can't be filled by
-- re-deriving existing columns.
--
-- 1. programme_tiers has tier_price + currency but no billing period, so a €199
--    one-off golf membership and a €199/month subscription currently look identical
--    in any price comparison. Needed before any "average programme price" claim.
-- 2. programmes has no single_brand vs. ecosystem field. Mechanisms ('Ecosystem
--    cross-use', 'External partner network') and partner_companies hint at this but
--    conflate "leverages sister brands in the same group" with "leverages independent
--    outside partners" — two different strategic architectures.
--
-- Both are added nullable with no default: existing rows stay NULL (honestly
-- "unknown") rather than being guessed at via migration.

ALTER TABLE programme_tiers ADD COLUMN IF NOT EXISTS price_period text
  CHECK (price_period IN ('One-time', 'Monthly', 'Annual', 'Lifetime', 'Other'));

ALTER TABLE programmes ADD COLUMN IF NOT EXISTS ecosystem_type text
  CHECK (ecosystem_type IN ('Single brand', 'Multi-brand (same group)', 'Partner network', 'Both'));
