// My Laboratory — Saved workspace: a research library, not another dashboard. No
// standing note-authoring form — a takeaway is captured once, at Save time, from
// whichever workspace produced the analysis (see chartToolbar.js's Save modal).
import { escapeHtml } from './fields.js';
import { DIMENSIONS } from './analysisData.js';
import { analysisTablesReady, loadSavedAnalyses, getSavedAnalyses, deleteSavedAnalysis, loadNotes, getNotes, onSavedDataChange } from './analysisSaved.js';
import { showToast } from './app.js';

const WORKSPACE_LABELS = { explore: 'Explore', relate: 'Relate', trends: 'Trends', tiers: 'Pricing', mechanisms: 'Mechanisms' };

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; }
}

function normaliseLabel(n) { return n === 'row' ? 'Row %' : n === 'col' ? 'Column %' : 'Count'; }
function measureLabel(m) { return m === 'pct' ? '% of Programmes' : m === 'companies' ? 'Number of Companies' : 'Number of Programmes'; }

// A short, human config descriptor — reuses the same DIMENSIONS labels the
// workspaces themselves use, so this never drifts out of sync with what they show.
function describeConfig(row) {
  const c = row.config || {};
  const dim = (k) => (DIMENSIONS[k] ? DIMENSIONS[k].label : k);
  if (row.lab === 'explore') return [dim(c.dimKey), measureLabel(c.measure)].filter(Boolean).join(' · ');
  if (row.lab === 'relate') {
    const isTime = c.xKey === 'launch_year' || c.yKey === 'launch_year';
    const core = isTime ? `${dim(c.xKey === 'launch_year' ? c.yKey : c.xKey)} over time` : `${dim(c.yKey)} × ${dim(c.xKey)}`;
    return [core, c.chartType === 'heatmap' ? normaliseLabel(c.normalise) : null].filter(Boolean).join(' · ');
  }
  if (row.lab === 'tiers') {
    if (c.view === 'jumps') return `Tier Jumps · ${c.jumpsMode === 'fee' ? 'Fee' : 'Qualification'}`;
    if (c.view === 'fees') return c.feeByDim ? `Fees · Avg Entry by ${dim(c.feeByDim)}` : 'Fees · Entry Fee Distribution';
    return c.byDim ? `Tier Structure · ${dim(c.byDim)}` : 'Tier Structure';
  }
  if (row.lab === 'trends') return `${dim(c.yKey)} over Time`;
  if (row.lab === 'mechanisms') {
    if (c.view === 'pairs') return 'Strongest Pairings';
    if (c.view === 'cooccurrence') return 'Mechanism × Mechanism';
    if (c.view === 'stacking') return 'Mechanisms per Programme';
    return c.selectedMechanism ? `${c.selectedMechanism} — Trend` : 'Mechanisms';
  }
  return WORKSPACE_LABELS[row.lab] || row.lab;
}

function savedItemHTML(row, note) {
  return `
    <div class="saved-item" data-id="${row.id}">
      <div class="saved-item-main">
        <div class="saved-item-title">${escapeHtml(row.name)}</div>
        <div class="saved-item-config">${escapeHtml(describeConfig(row))}</div>
        ${note && note.note_text ? `<div class="saved-item-takeaway">"${escapeHtml(note.note_text)}"</div>` : ''}
        <div class="saved-item-meta">${WORKSPACE_LABELS[row.lab] || row.lab} · ${row.created_by ? `${escapeHtml(row.created_by)} · ` : ''}${fmtDate(row.created_at)}</div>
      </div>
      <div class="saved-item-actions">
        <button type="button" class="btn-text" data-action="open" data-id="${row.id}">Open</button>
        <button type="button" class="btn-danger-text" data-action="delete" data-id="${row.id}">Delete</button>
      </div>
    </div>
  `;
}

export function mount(ctx) {
  const root = document.getElementById('saved-root');

  async function render() {
    if (!analysisTablesReady()) {
      root.innerHTML = `<div class="setup-note">Saved analyses aren't set up yet. Run <code>supabase/024_analysis_lab.sql</code> once in the Supabase SQL editor to enable this.</div>`;
      return;
    }
    const rows = getSavedAnalyses();
    if (!rows.length) {
      root.innerHTML = `<div class="drilldown-empty">Nothing saved yet — use Save on any analysis in Explore, Relate, Trends, Pricing or Mechanisms to keep it here.</div>`;
      return;
    }
    const notes = getNotes();
    root.innerHTML = `<div class="saved-list">${rows.map(r => savedItemHTML(r, notes.find(n => n.linked_analysis_id === r.id))).join('')}</div>`;

    root.querySelectorAll('[data-action="open"]').forEach(btn => btn.addEventListener('click', () => {
      const row = getSavedAnalyses().find(a => a.id === btn.dataset.id);
      if (row) ctx.reopenAnalysis(row);
    }));
    root.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this saved analysis?')) return;
      try { await deleteSavedAnalysis(btn.dataset.id); render(); showToast('Deleted.'); }
      catch (e) { showToast(e.message, true); }
    }));
  }

  async function load() {
    await Promise.all([loadSavedAnalyses(), loadNotes()]);
    render();
  }

  load();
  onSavedDataChange(load);

  // Not driven by the filtered programme dataset or workspace-config restore — it
  // manages its own Supabase-backed state.
  return { render: () => {}, applyConfig: () => {}, getConfig: () => ({}) };
}
