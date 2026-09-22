// Lets the team extend picklists (industry, programme type, benefits, etc.) from the
// Settings page without touching code. Custom values are stored in Supabase and merged
// on top of the built-in OPTIONS lists at runtime — plus the full Add/Deactivate/safe
// Delete lifecycle: a built-in value is hidden from new-entry pickers via a row in
// deactivated_options (it isn't a row anywhere else, so that's the only way to hide
// one); a custom (team-added) value is hidden via its own `active` flag. Either way,
// any record that already used the value keeps it — deactivation only affects what's
// offered when creating/editing going forward (see selectOptionsHTML/checkboxGroupHTML
// in fields.js, which always keep an already-selected value visible even if inactive).
import { supabase } from './supabase.js';
import { OPTIONS, SCOPE_GROUPS, SCOPE_OTHER } from './options.js';

const cache = {};
let deactivatedBuiltins = {}; // list_key -> Set of deactivated built-in values

export const LIST_LABELS = {
  country: 'Country',
  industry: 'Industry',
  programme_positioning: 'Programme Positioning',
  target_customer: 'Target Customer',
  geographic_scope: 'Geographic Scope',
  membership_type: 'Membership Type',
  access_registration: 'Access / Registration',
  mechanisms: 'Mechanisms',
  discount_type: 'Discount Type',
  qualification_unit: 'Tier Qualification Unit',
  meeting_type: 'Meeting Type',
  task_type: 'Task Type',
  insight_type: 'Insight Type',
  source_type: 'Source Type'
  // task_status is deliberately not editable here: tasks.status has a pre-existing
  // database CHECK constraint (todo / in_progress / done only), so a custom addition
  // would just fail to save.
  // scope (Sources / Data & Insights) is handled separately too (see
  // mergedScopeGroups) — it's organised into 3 fixed visual groups, not a flat list.
};

// Which table(s)/column(s) actually store a given list's values — used to check
// whether a value is safe to hard-delete (zero dependencies) versus needing
// Deactivate instead. Also exactly the map a future Phase 2 "rename" cascade would
// reuse to run its UPDATE ... WHERE = 'old value' statements.
const LIST_USAGE = {
  industry: [{ table: 'programmes', column: 'industry' }],
  programme_positioning: [{ table: 'programmes', column: 'programme_positioning' }],
  target_customer: [{ table: 'programmes', column: 'target_customer', array: true }],
  geographic_scope: [{ table: 'programmes', column: 'geographic_scope', array: true }],
  membership_type: [{ table: 'programmes', column: 'membership_type' }],
  access_registration: [{ table: 'programmes', column: 'access_registration' }],
  mechanisms: [
    { table: 'programmes', column: 'mechanisms', array: true },
    { table: 'likes', column: 'target_label', extraEq: { target_type: 'mechanism' } }
  ],
  discount_type: [{ table: 'programmes', column: 'discount_types', array: true }],
  qualification_unit: [{ table: 'programme_tiers', column: 'qualification_unit' }],
  source_type: [{ table: 'sources', column: 'source_type' }],
  insight_type: [{ table: 'figures', column: 'insight_type' }],
  meeting_type: [{ table: 'meetings', column: 'meeting_type' }],
  task_type: [{ table: 'tasks', column: 'task_type' }],
  psychological_effect: [{ table: 'likes', column: 'psychological_effect', array: true }],
  scope: [
    { table: 'sources', column: 'scope', array: true },
    { table: 'figures', column: 'scope', array: true }
  ]
};

export async function loadCustomOptions() {
  const [{ data: customData }, { data: deactivatedData }] = await Promise.all([
    supabase.from('custom_options').select('*').order('value'),
    supabase.from('deactivated_options').select('*')
  ]);

  Object.keys(cache).forEach(k => delete cache[k]);
  (customData || []).forEach(row => {
    if (!cache[row.list_key]) cache[row.list_key] = [];
    cache[row.list_key].push(row);
  });

  deactivatedBuiltins = {};
  (deactivatedData || []).forEach(row => {
    if (!deactivatedBuiltins[row.list_key]) deactivatedBuiltins[row.list_key] = new Set();
    deactivatedBuiltins[row.list_key].add(row.value);
  });
}

// Returns the merged list of plain string values for a picklist (built-in + custom),
// for NEW entries: built-ins hidden via deactivated_options are excluded, custom rows
// with active=false are excluded. inputHTML/selectOptionsHTML separately make sure an
// already-selected-but-now-inactive value stays visible when editing an existing record.
export function getOptionList(key) {
  const deactivated = deactivatedBuiltins[key];
  const base = (OPTIONS[key] || []).filter(v => !deactivated || !deactivated.has(typeof v === 'object' ? v.value : v));
  const custom = (cache[key] || []).filter(r => r.active !== false).map(r => r.value);
  if (!custom.length) return base;

  const sentinels = ['Other', 'None'];
  const trailingIdx = base.findIndex(v => typeof v === 'string' && sentinels.includes(v));
  if (trailingIdx === -1) return [...base, ...custom];
  return [...base.slice(0, trailingIdx), ...custom, ...base.slice(trailingIdx)];
}

// All custom rows for a list, active AND inactive — Settings shows both (inactive
// ones dimmed) so the team can see and reactivate what's been turned off.
export function getCustomRows(key) {
  return cache[key] || [];
}

export function getDeactivatedBuiltins(key) {
  return [...(deactivatedBuiltins[key] || [])];
}

export function listKeys() {
  return Object.keys(LIST_LABELS);
}

// ---------------- Scope (shared by Sources + Data & Insights, 3 fixed groups) ----------------

// Merges custom Scope values into the 3 fixed groups, respecting deactivation, and
// always keeping an already-selected-but-now-inactive value visible so an existing
// record never silently loses a tag it was saved with.
export function mergedScopeGroups(selected = []) {
  const deactivated = deactivatedBuiltins['scope'] || new Set();
  const customRows = cache['scope'] || [];
  const groups = {};

  Object.entries(SCOPE_GROUPS).forEach(([group, values]) => {
    groups[group] = values.filter(v => !deactivated.has(v) || selected.includes(v));
  });
  groups['Other'] = groups['Other'] || [];
  if (!Object.values(groups).flat().includes(SCOPE_OTHER)) groups['Other'] = [SCOPE_OTHER];

  customRows.forEach(row => {
    const group = row.group_name && groups[row.group_name] !== undefined ? row.group_name : 'Other';
    if (row.active !== false || selected.includes(row.value)) {
      if (!groups[group].includes(row.value)) groups[group] = [...groups[group], row.value];
    }
  });

  return groups;
}

export async function addScopeValue(groupName, value) {
  const { error } = await supabase.from('custom_options').insert({ list_key: 'scope', value, group_name: groupName });
  return { error };
}

// ---------------- Usage / safe-delete ----------------

// Counts how many existing records still reference a value — 0 means Delete is safe;
// otherwise only Deactivate is offered (Delete would silently orphan real data).
export async function countOptionUsage(listKey, value) {
  const checks = LIST_USAGE[listKey] || [];
  let total = 0;
  for (const check of checks) {
    let q = supabase.from(check.table).select('id', { count: 'exact', head: true });
    q = check.array ? q.contains(check.column, [value]) : q.eq(check.column, value);
    if (check.extraEq) Object.entries(check.extraEq).forEach(([k, v]) => { q = q.eq(k, v); });
    const { count } = await q;
    total += count || 0;
  }
  return total;
}

export function hasUsageCheck(listKey) {
  return !!LIST_USAGE[listKey];
}

// ---------------- Add / Deactivate / Delete (generic, used by Settings) ----------------

export async function addOption(key, value, extra = {}) {
  const { error } = await supabase.from('custom_options').insert({ list_key: key, value, ...extra });
  return { error };
}

export async function setOptionActive(rowId, active) {
  return supabase.from('custom_options').update({ active }).eq('id', rowId);
}

export async function deleteOption(rowId) {
  return supabase.from('custom_options').delete().eq('id', rowId);
}

export async function deactivateBuiltin(listKey, value) {
  return supabase.from('deactivated_options').insert({ list_key: listKey, value });
}

export async function reactivateBuiltin(listKey, value) {
  return supabase.from('deactivated_options').delete().eq('list_key', listKey).eq('value', value);
}
