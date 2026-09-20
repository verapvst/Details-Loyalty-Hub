// Analysis tab — Saved Analyses + Research Notes (sections 27-29). The tool records
// what the data shows (a saved chart configuration); the researcher writes the
// interpretation (a note) — this module never generates one on its own.
import { escapeHtml } from './fields.js';
import {
  analysisTablesReady, loadSavedAnalyses, getSavedAnalyses, deleteSavedAnalysis,
  loadNotes, getNotes, addNote, deleteNote, NOTE_TAGS, onSavedDataChange
} from './analysisSaved.js';
import { showToast } from './app.js';

const LAB_LABELS = {
  launch_trends: 'Launch Trends', distribution: 'Distribution', cross_analysis: 'Cross-Analysis',
  mechanics_distribution: 'Mechanics — Distribution', mechanics_industry: 'Mechanics — Mechanism × Industry',
  mechanics_cooccurrence: 'Mechanics — Combinations', tier_overview: 'Tier Lab — Overview',
  tier_by_dimension: 'Tier Lab — Tiering by Category', tier_jumps: 'Tier Lab — Jump Analysis'
};

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; }
}

function savedAnalysesHTML() {
  const rows = getSavedAnalyses();
  if (!rows.length) return '<div class="drilldown-empty">No saved analyses yet — use the ☆ Save Analysis button on any chart above.</div>';
  return rows.map(a => `
    <div class="saved-analysis-card" data-id="${a.id}">
      <div>
        <div class="saved-analysis-name">${escapeHtml(a.name)}</div>
        <div class="saved-analysis-meta">${escapeHtml(LAB_LABELS[a.lab] || a.lab)} · ${a.created_by ? `${escapeHtml(a.created_by)} · ` : ''}${fmtDate(a.created_at)}</div>
      </div>
      <div class="saved-analysis-actions">
        <button type="button" class="btn-text" data-action="reopen" data-id="${a.id}">Reopen</button>
        <button type="button" class="btn-danger-text" data-action="delete-analysis" data-id="${a.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

function notesHTML(filterTag) {
  const rows = getNotes().filter(n => !filterTag || (n.tags || []).includes(filterTag));
  if (!rows.length) return '<div class="drilldown-empty">No research notes yet.</div>';
  return rows.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div style="flex:1; min-width:0;">
        <div class="note-title">${escapeHtml(n.title)}</div>
        ${n.note_text ? `<div class="note-text">${escapeHtml(n.note_text)}</div>` : ''}
        ${(n.tags || []).length ? `<div class="note-tags">${n.tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="note-meta">${n.analysis_saved ? `Linked to <b>${escapeHtml(n.analysis_saved.name)}</b> · ` : ''}${n.created_by ? `${escapeHtml(n.created_by)} · ` : ''}${fmtDate(n.created_at)}</div>
      </div>
      <button type="button" class="btn-danger-text" data-action="delete-note" data-id="${n.id}">Delete</button>
    </div>
  `).join('');
}

// Renders into the two fixed containers analysis.html already provides
// (#saved-analyses-root, #research-notes-root) rather than a single passed-in
// container, since this Lab spans two separate cards.
export function mount(ctx) {
  const savedRoot = document.getElementById('saved-analyses-root');
  const notesRoot = document.getElementById('research-notes-root');
  let notesTagFilter = '';

  async function renderSaved() {
    if (!analysisTablesReady()) {
      savedRoot.innerHTML = `<h3>Saved Analyses</h3><div class="setup-note">Saved Analyses aren’t set up yet. Run <code>supabase/024_analysis_lab.sql</code> once in the Supabase SQL editor to enable this.</div>`;
      return;
    }
    savedRoot.innerHTML = `<h3>Saved Analyses</h3><div id="saved-list">${savedAnalysesHTML()}</div>`;
    savedRoot.querySelectorAll('[data-action="reopen"]').forEach(btn => btn.addEventListener('click', () => {
      const row = getSavedAnalyses().find(a => a.id === btn.dataset.id);
      if (row) ctx.reopenAnalysis(row);
    }));
    savedRoot.querySelectorAll('[data-action="delete-analysis"]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this saved analysis?')) return;
      try { await deleteSavedAnalysis(btn.dataset.id); renderSaved(); showToast('Saved analysis deleted.'); }
      catch (e) { showToast(e.message, true); }
    }));
  }

  async function renderNotes() {
    if (!analysisTablesReady()) {
      notesRoot.innerHTML = `<h3>Research Notes</h3><div class="setup-note">Research Notes aren’t set up yet. Run <code>supabase/024_analysis_lab.sql</code> once in the Supabase SQL editor to enable this.</div>`;
      return;
    }
    const savedOptions = getSavedAnalyses().map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    notesRoot.innerHTML = `
      <h3>Research Notes</h3>
      <form class="notes-form" id="note-form">
        <input type="text" id="note-title" placeholder="Observation title, e.g. “Premium positioning rising post-2015”" required />
        <textarea id="note-text" placeholder="What did you observe? The tool won't interpret this for you — write it as a researcher would."></textarea>
        <div class="checkbox-row" id="note-tags">${NOTE_TAGS.map(t => `<label class="checkbox-item"><input type="checkbox" value="${escapeHtml(t)}" /> ${escapeHtml(t)}</label>`).join('')}</div>
        ${savedOptions ? `<select class="control-select" id="note-linked"><option value="">Not linked to a saved analysis</option>${savedOptions}</select>` : ''}
        <div style="display:flex; justify-content:flex-end;"><button type="submit" class="btn-primary btn-sm">Add Note</button></div>
      </form>
      <div class="control-row">
        <div class="control-group"><label>Filter by tag</label>
          <select class="control-select" id="note-tag-filter"><option value="">All</option>${NOTE_TAGS.map(t => `<option value="${escapeHtml(t)}" ${t === notesTagFilter ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select>
        </div>
      </div>
      <div id="notes-list">${notesHTML(notesTagFilter)}</div>
    `;

    notesRoot.querySelector('#note-tag-filter').addEventListener('change', (e) => {
      notesTagFilter = e.target.value;
      notesRoot.querySelector('#notes-list').innerHTML = notesHTML(notesTagFilter);
      wireNoteDeletes();
    });

    function wireNoteDeletes() {
      notesRoot.querySelectorAll('[data-action="delete-note"]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;
        try { await deleteNote(btn.dataset.id); notesRoot.querySelector('#notes-list').innerHTML = notesHTML(notesTagFilter); wireNoteDeletes(); showToast('Note deleted.'); }
        catch (e) { showToast(e.message, true); }
      }));
    }
    wireNoteDeletes();

    notesRoot.querySelector('#note-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = notesRoot.querySelector('#note-title').value.trim();
      if (!title) return;
      const note_text = notesRoot.querySelector('#note-text').value.trim();
      const tags = [...notesRoot.querySelectorAll('#note-tags input:checked')].map(cb => cb.value);
      const linkedSel = notesRoot.querySelector('#note-linked');
      const linked_analysis_id = linkedSel ? linkedSel.value || null : null;
      try {
        await addNote({ title, note_text, tags, linked_analysis_id });
        showToast('Note added.');
        renderNotes();
      } catch (err) { showToast(err.message, true); }
    });
  }

  async function render() {
    await Promise.all([loadSavedAnalyses(), loadNotes()]);
    renderSaved();
    renderNotes();
  }

  render();
  // Re-render just the Saved Analyses list (not the Notes form, which may have
  // in-progress input) whenever a chart elsewhere on the page saves or deletes one.
  onSavedDataChange(renderSaved);
  // This Lab isn't driven by the filtered programme dataset — it manages its own
  // Supabase-backed state — so render/applyConfig are no-ops for the orchestrator's
  // generic "reapply to every Lab" loop.
  return { render: () => {}, applyConfig: () => {} };
}
