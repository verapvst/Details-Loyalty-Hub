// A small generic key/value store for the few genuinely global settings that aren't
// picklists: nav tab display-label overrides ('nav_label:<technical key>') and Pinned
// Countries ('pinned_countries'). One shared table rather than a dedicated one per
// concern — see the Settings architecture proposal.
import { supabase } from './supabase.js';

const cache = {};
let loaded = false;

export async function loadAppSettings() {
  const { data } = await supabase.from('app_settings').select('*');
  Object.keys(cache).forEach(k => delete cache[k]);
  (data || []).forEach(row => { cache[row.key] = row.value; });
  loaded = true;
}

// Technical key/route never changes — only what's read back here (a display label,
// a reordered list) does. `fallback` is the code-shipped default when nothing's saved.
export function getAppSetting(key, fallback) {
  return key in cache ? cache[key] : fallback;
}

export async function setAppSetting(key, value) {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (!error) cache[key] = value;
  return { error };
}

export function appSettingsLoaded() {
  return loaded;
}
