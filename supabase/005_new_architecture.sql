-- Run once in the Supabase SQL editor.
-- Adds the new architecture (Mechanisms, Benefits, Target Customer, Geographic Scope,
-- Fee/Qualification split on tiers, Features table, richer Likes) WITHOUT dropping any
-- existing column. Old fields (main_target_customer, geography_market, primary/secondary
-- _programme_type, membership_model, free_vs_paid, discount_type, tier_qualification_basis,
-- single_brand_vs_ecosystem, primary/secondary/tertiary_benefit, key_differentiator,
-- relevance_to_details, main_core_offer, target_customer_notes, primary/secondary_partner
-- _industry, mechanic_detail, benefit_detail) are left in place, just unused by the app
-- going forward. They can be dropped in a later cleanup pass once the new architecture
-- is confirmed working end to end.

-- ---------- Programmes: new architecture columns ----------
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS launch_year integer;
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS target_customer text[];       -- multi-select
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS geographic_scope text[];      -- multi-select
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS membership_type text;        -- Free/Paid/Subscription/Hybrid/Other
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS access_registration text;    -- Open/Application/.../Referral required
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS mechanisms text[];           -- multi-select
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS benefits text[];            -- multi-select
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS points_expires boolean;
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS points_expiration_period text;
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS points_notes text;
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS discount_types text[];       -- multi-select, mechanism-specific
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS partner_companies text[];    -- mechanism-specific
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS source_url text;            -- merged Programme URL + Main Source

-- ---------- Programme Tiers: Fee vs Qualification split ----------
ALTER TABLE programme_tiers ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE programme_tiers ADD COLUMN IF NOT EXISTS qualification_amount numeric;
ALTER TABLE programme_tiers ADD COLUMN IF NOT EXISTS qualification_unit text;
ALTER TABLE programme_tiers ADD COLUMN IF NOT EXISTS note text;
-- tier_price (existing column) now explicitly means Fee.

-- ---------- Programme Features (new table) ----------
CREATE TABLE IF NOT EXISTS programme_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE programme_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON programme_features;
CREATE POLICY "allow all" ON programme_features FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON programme_features TO anon;

-- ---------- Likes: richer target model (schema only — UI comes later) ----------
ALTER TABLE likes ADD COLUMN IF NOT EXISTS target_type text;   -- 'feature' | 'mechanism' | 'membership_type' | 'tier' | 'benefit' | 'other'
ALTER TABLE likes ADD COLUMN IF NOT EXISTS target_label text;
ALTER TABLE likes ADD COLUMN IF NOT EXISTS target_id uuid;      -- FK to a feature or tier row, when applicable
ALTER TABLE likes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE likes ADD COLUMN IF NOT EXISTS psychological_effect text[];
ALTER TABLE likes ADD COLUMN IF NOT EXISTS psychological_effect_notes text;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
