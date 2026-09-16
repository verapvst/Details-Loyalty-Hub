import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml, copyToClipboard } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openInsightModal, definitionFor } from './insightModal.js';

await initNav('figures');
await loadCustomOptions();

const root = document.getElementById('record-root');
const params = new URLSearchParams(window.location.search);
const insightId = params.get('id');

let insight = null;
let sources = [];

if (!insightId) {
  root.innerHTML = `<div class="error-state">No insight selected. <a href="figures.html">Back to Data & Insights</a></div>`;
  throw new Error('Missing insight id');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displaySourceName(s) {
  return s?.source_name || s?.citation_tag || 'Untitled source';
}

function copyBtnHTML(action, label) {
  return `<button type="button" class="btn-outline btn-sm" data-copy="${action}">${label}</button>`;
}

function sourceFieldHTML(label, value) {
  return `
    <div class="record-field">
      <label>${label}</label>
      <span class="value ${value ? '' : 'empty'}">${value ? escapeHtml(value) : '—'}</span>
    </div>
  `;
}

// Same as sourceFieldHTML but `html` is trusted, pre-built markup (e.g. a link) —
// used only for the Source Name field, which links to the Source Detail page.
function sourceFieldHTMLRaw(label, html) {
  return `
    <div class="record-field">
      <label>${label}</label>
      <span class="value ${html ? '' : 'empty'}">${html || '—'}</span>
    </div>
  `;
}

function render() {
  const s = insight.sources;
  const isUrl = /^https?:\/\//i.test(s?.link_or_path || '');
  const scopeChips = (insight.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');
  const sourceScopeChips = (s?.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');

  const actions = [
    copyBtnHTML('insight', 'Copy Insight'),
    insight.supporting_detail ? copyBtnHTML('supporting', 'Copy Supporting Detail') : '',
    s?.short_citation ? copyBtnHTML('short-citation', 'Copy Short Citation') : '',
    s?.full_citation ? copyBtnHTML('full-citation', 'Copy Full Citation') : '',
    isUrl ? `<a href="${escapeHtml(s.link_or_path)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Source ↗</a>` : ''
  ].filter(Boolean).join('');

  root.innerHTML = `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="figures.html" class="record-back">&larr; Back to Data &amp; Insights</a>
        <div class="badge badge-green has-tooltip" data-tooltip="${escapeHtml(definitionFor(insight.insight_type))}" style="margin-bottom: 10px;">${escapeHtml(insight.insight_type || 'Other')}</div>
        <div class="record-title" style="font-size: 28px;">${escapeHtml(insight.insight_text)}</div>
        ${scopeChips ? `<div class="chip-row" style="margin: 14px 0 0;">${scopeChips}</div>` : ''}
        <div class="record-actions" style="margin-top: 18px; flex-wrap: wrap;">${actions}</div>
      </div>
    </div>
    <div class="record-body">
      ${insight.supporting_detail ? `
        <div class="record-block">
          <h3>Supporting Detail</h3>
          <p style="font-size: 14px; line-height: 1.6; color: var(--dark); white-space: pre-wrap;">${escapeHtml(insight.supporting_detail)}</p>
        </div>
      ` : ''}

      <div class="record-block">
        <h3>Source</h3>
        <div class="record-grid">
          ${sourceFieldHTMLRaw('Source / Article Name', s ? `<a href="source.html?id=${s.id}" style="color: var(--accent);">${escapeHtml(displaySourceName(s))}</a>` : null)}
          ${sourceFieldHTML('Author / Organisation', s?.author_org)}
          ${sourceFieldHTML('Year', s?.year)}
          ${sourceFieldHTML('Source Type', s?.source_type)}
          <div class="record-field full">
            <label>Scope</label>
            ${sourceScopeChips ? `<div class="chip-row" style="margin-bottom: 0;">${sourceScopeChips}</div>` : '<span class="value empty">—</span>'}
          </div>
          ${sourceFieldHTML('Short Citation', s?.short_citation)}
          <div class="record-field full">
            <label>Full Citation</label>
            <span class="value ${s?.full_citation ? '' : 'empty'}">${s?.full_citation ? escapeHtml(s.full_citation) : '—'}</span>
          </div>
          ${sourceFieldHTML('URL / DOI', s?.link_or_path)}
        </div>
      </div>

      <div class="record-block">
        <h3 style="color: var(--muted); font-size: 13px;">Details</h3>
        <div class="settings-hint" style="margin-bottom: 16px;">
          ${insight.created_by ? `Added by ${escapeHtml(insight.created_by)}${insight.created_at ? ` · ${formatDate(insight.created_at)}` : ''}` : ''}
          ${insight.updated_by ? `<br />Last updated by ${escapeHtml(insight.updated_by)}${insight.updated_at ? ` · ${formatDate(insight.updated_at)}` : ''}` : ''}
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn-outline" id="btn-edit">Edit</button>
          <button type="button" class="btn-danger-text" id="btn-delete">Delete</button>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const texts = {
        insight: insight.insight_text,
        supporting: insight.supporting_detail,
        'short-citation': s?.short_citation,
        'full-citation': s?.full_citation
      };
      const ok = await copyToClipboard(texts[btn.dataset.copy]);
      showToast(ok ? 'Copied.' : 'Could not copy — select the text manually.', !ok);
    });
  });

  document.getElementById('btn-edit').addEventListener('click', () => {
    openInsightModal({ insight, sources, onChange: load });
  });
  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!confirm('Delete this insight?')) return;
    await supabase.from('figures').delete().eq('id', insight.id);
    showToast('Insight deleted.');
    window.location.href = 'figures.html';
  });
}

async function load() {
  const [{ data, error }, { data: allSources }] = await Promise.all([
    supabase.from('figures').select('*, sources(*)').eq('id', insightId).single(),
    supabase.from('sources').select('id, source_name, citation_tag, scope').order('source_name')
  ]);

  if (error || !data) {
    root.innerHTML = `<div class="error-state">Couldn't load this insight. <a href="figures.html">Back to Data &amp; Insights</a></div>`;
    return;
  }

  insight = data;
  sources = allSources || [];
  render();
}

load();
