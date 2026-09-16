// Lets the team extend picklists (industry, programme type, benefits, etc.) from the
// Settings page without touching code. Custom values are stored in Supabase and merged
// on top of the built-in OPTIONS lists at runtime.
import { supabase } from './supabase.js';
import { OPTIONS } from './options.js';

const cache = {};

export const LIST_LABELS = {
  country: 'Country',
  industry: 'Industry',
  programme_positioning: 'Programme Positioning',
  target_customer: 'Target Customer',
  geographic_scope: 'Geographic Scope',
  membership_type: 'Membership Type',
  access_registration: 'Access / Registration',
  mechanisms: 'Mechanisms',
  benefits: 'Benefits',
  discount_type: 'Discount Type',
  qualification_unit: 'Tier Qualification Unit',
  meeting_type: 'Meeting Type',
  task_type: 'Task Type',
  insight_type: 'Insight Type',
  source_type: 'Source Type'
  // task_status is deliberately not editable here: tasks.status has a pre-existing
  // database CHECK constraint (todo / in_progress / done only), so a custom addition
  // would just fail to save.
  // sub_industry is dependent on Industry and isn't Settings-extensible for now.
  // scope (Sources / Data & Insights) is deliberately not here either — it's organised
  // into 3 fixed visual groups (see SCOPE_GROUPS in options.js) that a flat appended
  // custom value would break; add to a group directly in code if the taxonomy grows.
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
  const trailingIdx = base.findIndex(v => typeof v === 'string' && sentinels.includes(v));
  if (trailingIdx === -1) return [...base, ...custom];
  return [...base.slice(0, trailingIdx), ...custom, ...base.slice(trailingIdx)];
}

export function getCustomRows(key) {
  return cache[key] || [];
}

export function listKeys() {
  return Object.keys(LIST_LABELS);
}
