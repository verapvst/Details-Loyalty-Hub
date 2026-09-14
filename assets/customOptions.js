// Lets the team extend picklists (industry, programme type, benefits, etc.) from the
// Settings page without touching code. Custom values are stored in Supabase and merged
// on top of the built-in OPTIONS lists at runtime.
import { supabase } from './supabase.js';
import { OPTIONS } from './options.js';

const cache = {};

export const LIST_LABELS = {
  country: 'Country',
  geography_market: 'Geography / Market',
  industry: 'Industry',
  programme_type: 'Programme Type (mechanism)',
  membership_model: 'Membership Model',
  free_vs_paid: 'Free vs Paid',
  fee_range: 'Fee Range',
  main_target_customer: 'Main Target Customer',
  programme_positioning: 'Programme Positioning',
  benefit: 'Benefit',
  discount_type: 'Discount Type',
  tier_qualification_basis: 'Tier Qualification Basis',
  single_brand_vs_ecosystem: 'Single-Brand vs Ecosystem',
  relevance_to_details: 'Relevance to Details',
  meeting_type: 'Meeting Type',
  task_status: 'Task Status',
  task_type: 'Task Type'
};

export async function loadCustomOptions() {
  const { data } = await supabase.from('custom_options').select('*').order('value');
  Object.keys(cache).forEach(k => delete cache[k]);
  (data || []).forEach(row => {
    if (!cache[row.list_key]) cache[row.list_key] = [];
    cache[row.list_key].push(row);
  });
}

// Returns the merged list of plain string values for a picklist (built-in + custom),
// inserting custom values before a trailing 'Other' / 'None' sentinel when present.
export function getOptionList(key) {
  const base = OPTIONS[key] || [];
  const custom = (cache[key] || []).map(r => r.value);
  if (!custom.length) return base;

  const sentinels = ['Other', 'None'];
  const trailingIdx = base.findIndex(v => sentinels.includes(v));
  if (trailingIdx === -1) return [...base, ...custom];
  return [...base.slice(0, trailingIdx), ...custom, ...base.slice(trailingIdx)];
}

export function getCustomRows(key) {
  return cache[key] || [];
}

export function listKeys() {
  return Object.keys(LIST_LABELS);
}
