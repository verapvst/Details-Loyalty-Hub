// Analysis tab — Saved Analyses + Research Notes, backed by the analysis_saved /
// analysis_notes tables (see supabase/024_analysis_lab.sql). Mirrors the load/cache
// style of assets/teamMembers.js. Until that migration has been run in Supabase, both
// tables are missing (Postgres error 42P01) — every function here degrades to an empty
// list plus `tablesReady:false` instead of throwing, so the rest of Analysis keeps working.
import { supabase } from './supabase.js';
import { getIdentity } from './app.js';

let savedAnalyses = [];
let notes = [];
let tablesReady = true;

// The Saved Analyses / Research Notes list at the bottom of the page is a separate
// module from every chart's own "Save Analysis" button — this lets it re-render
// whenever the cache changes, without every chart needing to know that list exists.
const listeners = new Set();
export function onSavedDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notifyChange() { listeners.forEach(fn => fn()); }

function isMissingTableError(error) {
  // Postgres itself raises 42P01; PostgREST (the layer Supabase's JS client actually
  // talks to) instead returns its own PGRST205 with a "Could not find the table ...
  // in the schema cache" message — seen in practice before the migration has been run.
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(error.message || ''));
}

export function analysisTablesReady() { return tablesReady; }

export async function loadSavedAnalyses() {
  const { data, error } = await supabase.from('analysis_saved').select('*').order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) tablesReady = false; savedAnalyses = []; return savedAnalyses; }
  savedAnalyses = data || [];
  return savedAnalyses;
}

export function getSavedAnalyses(lab) {
  return lab ? savedAnalyses.filter(a => a.lab === lab) : savedAnalyses;
}

export async function saveAnalysis({ name, lab, config }) {
  const { data, error } = await supabase.from('analysis_saved')
    .insert({ name, lab, config, created_by: getIdentity() || null })
    .select().single();
  if (error) throw new Error(isMissingTableError(error) ? 'Saved Analyses aren’t set up yet — run supabase/024_analysis_lab.sql first.' : error.message);
  savedAnalyses = [data, ...savedAnalyses];
  notifyChange();
  return data;
}

export async function deleteSavedAnalysis(id) {
  const { error } = await supabase.from('analysis_saved').delete().eq('id', id);
  if (error) throw new Error(error.message);
  savedAnalyses = savedAnalyses.filter(a => a.id !== id);
  notifyChange();
}

export async function loadNotes() {
  const { data, error } = await supabase.from('analysis_notes').select('*, analysis_saved(name, lab)').order('created_at', { ascending: false });
  if (error) { if (isMissingTableError(error)) tablesReady = false; notes = []; return notes; }
  notes = data || [];
  return notes;
}

export function getNotes() { return notes; }

export async function addNote({ title, note_text, linked_analysis_id, tags }) {
  const { data, error } = await supabase.from('analysis_notes')
    .insert({ title, note_text: note_text || null, linked_analysis_id: linked_analysis_id || null, tags: tags || [], created_by: getIdentity() || null })
    .select('*, analysis_saved(name, lab)').single();
  if (error) throw new Error(isMissingTableError(error) ? 'Research Notes aren’t set up yet — run supabase/024_analysis_lab.sql first.' : error.message);
  notes = [data, ...notes];
  return data;
}

export async function deleteNote(id) {
  const { error } = await supabase.from('analysis_notes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  notes = notes.filter(n => n.id !== id);
}

export const NOTE_TAGS = ['Trend', 'Industry', 'Mechanics', 'Membership', 'Positioning', 'Geography', 'Tiering', 'Potential Thesis Finding', 'Needs Validation'];
