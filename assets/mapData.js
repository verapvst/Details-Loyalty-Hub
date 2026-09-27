// Portfolio Map — data loading + category metadata.
// portfolio_assets is a separate table from `programmes`: this is Details' own
// physical asset portfolio (hotels, golf, F&B, sports, residential), not a
// loyalty-programme benchmark. Adding a new asset is a single INSERT — this file
// never needs a code change for that, only for a genuinely new category.
import { supabase } from './supabase.js';

// Fixed order + colour, never cycled/reassigned (dataviz skill: categorical hues
// assigned by identity, in a fixed order). Validated as a set with
// scripts/validate_palette.js (adjacent-pair mode) — all 6 checks pass. Because 6
// categorical dots on a map can appear in any spatial adjacency (an all-pairs
// case the palette can't fully clear — see the skill's palette.md), colour is
// deliberately never the ONLY way to tell categories apart here: the legend is
// always visible, every marker's category is named in its info panel, and the
// category filters let a viewer isolate one at a time.
export const CATEGORY_ORDER = [
  'Hotel', 'Resort', 'Golf', 'Food & Beverage', 'Sports & Leisure', 'Apartments / Residential'
];

export const CATEGORY_COLORS = {
  'Hotel': '#1B5A8C',
  'Sports & Leisure': '#0A8FA0',
  'Food & Beverage': '#C85A28',
  'Apartments / Residential': '#8C3F91',
  'Golf': '#2E7D4F',
  'Resort': '#B4862E'
};

export const CATEGORY_SHORT_LABEL = {
  'Apartments / Residential': 'Apartments'
};

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#6E6E73';
}

export function categoryLabel(cat) {
  return CATEGORY_SHORT_LABEL[cat] || cat;
}

// Algarve bounding box (rough, generous) — used for the "Algarve" region-jump
// button and to size/centre the initial view so the Algarve cluster reads clearly
// even though a couple of assets (Madeira, Porto-area) sit well outside it.
export const ALGARVE_BOUNDS = [[36.95, -8.95], [37.25, -7.45]];
export const PORTUGAL_BOUNDS = [[32.4, -17.3], [42.2, -6.1]];

let cached = null;

export async function loadPortfolioAssets({ force = false } = {}) {
  if (cached && !force) return cached;
  const { data, error } = await supabase
    .from('portfolio_assets')
    .select('*')
    .order('asset_name', { ascending: true });
  if (error) throw error;
  cached = data || [];
  return cached;
}
