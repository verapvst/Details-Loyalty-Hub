import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { INSIGHT_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';
import { loadCustomOptions } from './customOptions.js';

initNav('figures');
await loadCustomOptions();

const listEl = document.getElementById('insight-list');
const noSourcesNote = document.getElementById('no-sources-note');
const addBtn = document.getElementById('btn-add-insight');
const sectionCount = document.getElementById('section-count');
const filterType = document.getElementById('filter-type');
const filterSource = document.getElementById('filter-source');
const searchInput = document.getElementById('search-input');

let sources = [];
let allInsights = [];

function distinctSorted(list, key) {
  return [...new Set(list.map(f => f[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateFilterOptions() {
  const fill = (selectEl, values) => {
    const current = selectEl.value;
    selectEl.innerHTML = '<option value="">All</option>' +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    selectEl.value = current;
  };
  fill(filterType, distinctSorted(allInsights, 'insight_type'));
  fill(filterSource, distinctSorted(allInsights.map(f => ({ citation_tag: f.sources?.citation_tag })), 'citation_tag'));
}

function renderRow(f) {
  const citationTag = f.sources ? f.sources.citation_tag : null;
  const sourceLink = f.sources ? f.sources.link_or_path : null;
  const isUrl = /^https?:\/\//i.test(sourceLink || '');

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div class="badge badge-green">${escapeHtml(f.insight_type || 'Other')}</div>
        ${isUrl ? `<a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Website</a>` : ''}
      </div>
      <div class="list-row-title" style="margin-top: 10px;">${escapeHtml(f.insight_text)}</div>
      ${f.supporting_detail ? `<div class="list-row-body">${escapeHtml(f.supporting_detail)}</div>` : ''}
      <div class="list-row-meta">
        ${citationTag ? `<span class="badge badge-muted">${escapeHtml(citationTag)}</span>` : ''}
        ${f.created_by ? `<span>Added by ${escapeHtml(f.created_by)}</span>` : ''}
        <button type="button" class="btn-text" data-insight-edit="${f.id}">Edit</button>
        <button type="button" class="btn-danger-text" data-insight-delete="${f.id}">Delete</button>
      </div>
    </div>
  `;
}

function wireRowActions() {
  listEl.querySelectorAll('[data-insight-edit]').forEach(btn => {
    btn.addEventListener('click', () => openInsightModal(allInsights.find(f => f.id === btn.dataset.insightEdit)));
  });
  listEl.querySelectorAll('[data-insight-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this insight?')) return;
      await supabase.from('figures').delete().eq('id', btn.dataset.insightDelete);
      showToast('Insight deleted.');
      loadInsights();
    });
  });
}

function applyFiltersAndRender() {
  const type = filterType.value;
  const source = filterSource.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allInsights.filter(f => {
    if (type && f.insight_type !== type) return false;
    if (source && f.sources?.citation_tag !== source) return false;
    if (q) {
      const hay = `${f.insight_text || ''} ${f.supporting_detail || ''} ${f.sources?.citation_tag || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sectionCount.textContent = `${filtered.length} of ${allInsights.length}`;

  if (!filtered.length) {
    listEl.innerHTML = allInsights.length
      ? `<div class="empty-state"><div class="em-title">No insights match</div><p>Try adjusting or clearing the filters.</p></div>`
      : `<div class="empty-state"><div class="em-title">No insights yet</div><p>Add the first one once you have a source to link it to.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderRow).join('');
  wireRowActions();
}

async function loadSources() {
  const { data } = await supabase.from('sources').select('id, citation_tag').order('citation_tag');
  sources = data || [];
  addBtn.disabled = sources.length === 0;
  noSourcesNote.hidden = sources.length > 0;
}

async function loadInsights() {
  const { data, error } = await supabase
    .from('figures')
    .select('*, sources(citation_tag, link_or_path)')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load insights: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allInsights = data || [];
  populateFilterOptions();
  applyFiltersAndRender();
}

[filterType, filterSource].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterType.value = '';
  filterSource.value = '';
  searchInput.value = '';
  applyFiltersAndRender();
});

// One modal for both Add (insight=null) and Edit (insight=existing row).
function openInsightModal(insight) {
  const root = document.getElementById('add-insight-root');
  const sourceOptions = sources.map(s => `<option value="${s.id}" ${insight && insight.source_id === s.id ? 'selected' : ''}>${escapeHtml(s.citation_tag)}</option>`).join('');
  const fieldsHTML = INSIGHT_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, insight ? insight[f.key] : '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head">
          <h2>${insight ? 'Edit Insight' : 'Add Insight'}</h2>
          <button type="button" class="form-modal-close" id="close-btn">&times;</button>
        </div>
        <form id="add-form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">
              ${fieldsHTML}
              <div class="form-field full">
                <label>Source *</label>
                <select name="source_id" required>
                  <option value=""></option>
                  ${sourceOptions}
                </select>
              </div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">${insight ? 'Save Changes' : 'Save Insight'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('add-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;
    const data = readFormValues(e.target, INSIGHT_FIELDS);
    data.source_id = e.target.elements.source_id.value;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    let error;
    if (insight) {
      ({ error } = await supabase.from('figures').update(data).eq('id', insight.id));
    } else {
      data.created_by = getIdentity();
      data.created_at = new Date().toISOString();
      ({ error } = await supabase.from('figures').insert(data));
    }

    if (error) {
      errorEl.textContent = `Couldn't save insight: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = insight ? 'Save Changes' : 'Save Insight';
      return;
    }

    close();
    showToast(insight ? 'Insight updated.' : 'Insight added.');
    loadInsights();
  });
}

addBtn.addEventListener('click', () => openInsightModal(null));

loadSources().then(loadInsights);
