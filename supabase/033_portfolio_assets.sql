-- Run once in the Supabase SQL editor.
-- New Map section (2026-09-27): plots Details' own physical asset portfolio in
-- Portugal (hotels, resorts, golf courses, F&B, sports & leisure, residential) —
-- a different thing from the `programmes` table, which is the 226-programme
-- loyalty-programme benchmark database. This is Details' own real estate/leisure
-- footprint, sourced from details.net/pt/portefolio/ and the individual asset
-- sites' own embedded links (see migration/add_portfolio_assets_2026.py for the
-- full per-asset source trail).

CREATE TABLE IF NOT EXISTS portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  asset_name text NOT NULL,
  -- Multi-select: an asset like Palmares is both a Resort and a Golf course —
  -- modelled as one row with two categories, never duplicated into two rows.
  categories text[] NOT NULL DEFAULT '{}',
  location text,               -- human-readable town/region, e.g. "Vilamoura, Algarve"
  latitude double precision,
  longitude double precision,
  -- 'exact' (matched the specific venue/address), 'street' (matched the street,
  -- not the exact building), 'approximate' (town/village centroid only — flagged
  -- rather than guessed at building level). Never null once geocoded.
  coordinate_confidence text CHECK (coordinate_confidence IN ('exact', 'street', 'approximate')),
  website_url text,
  notes text,
  source_url text
);

ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON portfolio_assets;
CREATE POLICY "allow all" ON portfolio_assets FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_assets TO anon;
