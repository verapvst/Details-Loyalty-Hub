import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml, copyToClipboard } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openSourceModal } from './sourceModal.js';
import { definitionFor } from './insightModal.js';
import { fieldPlainText } from './richText.js';

await initNav('sources');
await loadCustomOptions();

const root = document.getElementById('record-root');
const params = new URLSearchParams(window.location.search);
const sourceId = params.get('id');

let source = null;
let insights = [];

if (!sourceId) {
  root.innerHTML = `<div class="error-state">No source selected. <a href="sources.html">Back to Sources</a></div>`;
  throw new Error('Missing source id');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

function copyBtnHTML(action, label) {
  return `<button type="button" class="btn-outline btn-sm" data-copy="${action}">${label}</button>`;
}

function fieldHTML(label, value) {
  return `
    <div class="record-field">
      <label>${label}</label>
      <span class="value ${value ? '' : 'empty'}">${value ? escapeHtml(value) : '—'}</span>
    </div>
  `;
}

function insightRowHTML(f) {
  const title = f.title || fieldPlainText(f.insight_text) || 'Untitled insight';
  return `
    <a href="insight.html?id=${f.id}" class="list-row" style="display: block; text-decoration: none; color: inherit;">
      <div class="list-row-top">
        <div class="badge badge-green has-tooltip" data-tooltip="${escapeHtml(definitionFor(f.insight_type))}">${escapeHtml(f.insight_type || 'Other')}</div>
      </div>
      <div class="list-row-title" style="margin-top: 8px; font-size: 14px;">${escapeHtml(title)}</div>
    </a>
  `;
}

function render() {
  const isUrl = /^https?:\/\//i.test(source.link_or_path || '');
  const scopeChips = (source.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');

  const actions = [
    source.short_citation ? copyBtnHTML('short-citation', 'Copy Short Citation') : '',
    source.full_citation ? copyBtnHTML('full-citation', 'Copy Full Citation') : '',
    isUrl ? `<a href="${escapeHtml(source.link_or_path)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Source ↗</a>` : ''
  ].filter(Boolean).join('');

  root.innerHTML = `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="sources.html" class="record-back">&larr; Back to Sources</a>
        ${source.source_type ? `<div class="badge badge-green" style="margin-bottom: 10px;">${escapeHtml(source.source_type)}</div>` : ''}
        <div class="record-title" style="font-size: 28px;">${escapeHtml(displayName(source))}</div>
        ${scopeChips ? `<div class="chip-row" style="margin: 14px 0 0;">${scopeChips}</div>` : ''}
        <div class="record-actions" style="margin-top: 18px; flex-wrap: wrap;">${actions}</div>
      </div>
    </div>
    <div class="record-body">
      <div class="record-block">
        <h3>Source Details</h3>
        <div class="record-grid">
          ${fieldHTML('Author / Organisation', source.author_org)}
          ${fieldHTML('Year', source.year)}
          ${fieldHTML('Short Citation', source.short_citation)}
          ${fieldHTML('URL / DOI', source.link_or_path)}
          <div class="record-field full">
            <label>Full Citation</label>
            <span class="value ${source.full_citation ? '' : 'empty'}">${source.full_citation ? escapeHtml(source.full_citation) : '—'}</span>
          </div>
        </div>
      </div>

      <div class="record-block">
        <h3>Insights extracted from this source</h3>
        ${insights.length
          ? `<div class="list-rows">${insights.map(insightRowHTML).join('')}</div>`
          : `<div class="settings-hint" style="margin: 0;">No insights linked to this source yet.</div>`}
      </div>

      <div class="record-block">
        <h3 style="color: var(--muted); font-size: 13px;">Details</h3>
        <div class="settings-hint" style="margin-bottom: 16px;">
          ${source.created_by ? `Added by ${escapeHtml(source.created_by)}${source.created_at ? ` · ${formatDate(source.created_at)}` : ''}` : ''}
          ${source.updated_by ? `<br />Last updated by ${escapeHtml(source.updated_by)}${source.updated_at ? ` · ${formatDate(source.updated_at)}` : ''}` : ''}
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
      const texts = { 'short-citation': source.short_citation, 'full-citation': source.full_citation };
      const ok = await copyToClipboard(texts[btn.dataset.copy]);
      showToast(ok ? 'Copied.' : 'Could not copy. Select the text manually.', !ok);
    });
  });

  document.getElementById('btn-edit').addEventListener('click', () => {
    openSourceModal({ source, onChange: load });
  });
  document.getElementById('btn-delete').addEventListener('click', async () => {
    const { count } = await supabase.from('figures').select('id', { count: 'exact', head: true }).eq('source_id', source.id);
    if (count > 0) {
      showToast(`Can't delete: ${count} insight${count === 1 ? '' : 's'} still cite${count === 1 ? 's' : ''} this source. Remove or reassign them first.`, true);
      return;
    }
    if (!confirm('Delete this source?')) return;
    await supabase.from('sources').delete().eq('id', source.id);
    showToast('Source deleted.');
    window.location.href = 'sources.html';
  });
}

async function load() {
  const [{ data, error }, { data: relatedInsights }] = await Promise.all([
    supabase.from('sources').select('*').eq('id', sourceId).single(),
    supabase.from('figures').select('id, title, insight_text, insight_type').eq('source_id', sourceId).order('created_at', { ascending: false })
  ]);

  if (error || !data) {
    root.innerHTML = `<div class="error-state">Couldn't load this source. <a href="sources.html">Back to Sources</a></div>`;
    return;
  }

  source = data;
  insights = relatedInsights || [];
  render();
}

load();
