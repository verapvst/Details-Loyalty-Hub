import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { INSIGHT_FIELDS, INSIGHT_TYPE_DEFINITIONS } from './options.js';
import { inputHTML, readFormValues, escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { loadCustomOptions, getCustomRows } from './customOptions.js';

await initNav('figures');
await loadCustomOptions();

const listEl = document.getElementById('insight-list');
const noSourcesNote = document.getElementById('no-sources-note');
const addBtn = document.getElementById('btn-add-insight');
const sectionCount = document.getElementById('section-count');
const filterType = document.getElementById('filter-type');
const filterSource = document.getElementById('filter-source');
const searchInput = document.getElementById('search-input');
const scopeFilterBtn = document.getElementById('scope-filter-btn');
const scopeFilterPanel = document.getElementById('scope-filter-panel');

let sources = [];
let allInsights = [];
let scopeFilterSelected = [];

// The 8 built-in definitions are fixed/developer-controlled; a custom Information
// Type added via Settings can carry its own short definition (stored in
// custom_options.note), shown as a tooltip the same way.
function definitionFor(type) {
  if (INSIGHT_TYPE_DEFINITIONS[type]) return INSIGHT_TYPE_DEFINITIONS[type];
  const custom = getCustomRows('insight_type').find(r => r.value === type);
  return custom?.note || '';
}

function typeLegendHTML() {
  const builtIn = Object.keys(INSIGHT_TYPE_DEFINITIONS);
  const custom = getCustomRows('insight_type').filter(r => r.active !== false).map(r => r.value);
  return [...builtIn, ...custom].map(type =>
    `<span class="type-legend-item" data-tooltip="${escapeHtml(definitionFor(type))}">${escapeHtml(type)}</span>`
  ).join('<span class="type-legend-sep"> · </span>');
}
document.getElementById('type-legend').innerHTML = typeLegendHTML();

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
  fill(filterSource, distinctSorted(allInsights.map(f => ({ source_name: f.sources ? displaySourceName(f.sources) : null })), 'source_name'));
}

function displaySourceName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

function renderRow(f) {
  const sourceName = f.sources ? displaySourceName(f.sources) : null;
  const shortCitation = f.sources ? (f.sources.short_citation || f.sources.citation_tag) : null;
  const sourceLink = f.sources ? f.sources.link_or_path : null;
  const isUrl = /^https?:\/\//i.test(sourceLink || '');
  const scopeChips = (f.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div class="badge badge-green has-tooltip" data-tooltip="${escapeHtml(definitionFor(f.insight_type))}">${escapeHtml(f.insight_type || 'Other')}</div>
        ${isUrl ? `<a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Website</a>` : ''}
      </div>
      <div class="list-row-title" style="margin-top: 10px;">${escapeHtml(f.insight_text)}</div>
      ${f.supporting_detail ? `<div class="list-row-body">${escapeHtml(f.supporting_detail)}</div>` : ''}
      ${scopeChips ? `<div class="chip-row" style="margin: 10px 0 0;">${scopeChips}</div>` : ''}
      <div class="list-row-meta">
        ${shortCitation ? `<span class="badge badge-muted" title="${escapeHtml(sourceName || '')}">${escapeHtml(shortCitation)}</span>` : ''}
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
  const sourceName = filterSource.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allInsights.filter(f => {
    if (type && f.insight_type !== type) return false;
    if (sourceName && (!f.sources || displaySourceName(f.sources) !== sourceName)) return false;
    // Scope filter uses OR logic: match if the insight has ANY of the selected tags.
    if (scopeFilterSelected.length && !(f.scope || []).some(v => scopeFilterSelected.includes(v))) return false;
    if (q) {
      const hay = `${f.insight_text || ''} ${f.supporting_detail || ''} ${f.sources ? displaySourceName(f.sources) : ''}`.toLowerCase();
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

function updateScopeFilterButtonLabel() {
  scopeFilterBtn.textContent = scopeFilterSelected.length
    ? (scopeFilterSelected.length <= 2 ? scopeFilterSelected.join(', ') : `${scopeFilterSelected.length} selected`)
    : 'All';
}

scopeFilterPanel.innerHTML = scopeCheckboxGroupsHTML([]);
scopeFilterBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  scopeFilterPanel.hidden = !scopeFilterPanel.hidden;
});
scopeFilterPanel.addEventListener('change', () => {
  scopeFilterSelected = readCheckboxGroup(scopeFilterPanel, 'scope');
  updateScopeFilterButtonLabel();
  applyFiltersAndRender();
});
document.addEventListener('click', (e) => {
  if (!scopeFilterPanel.hidden && !e.target.closest('.scope-filter')) scopeFilterPanel.hidden = true;
});

[filterType, filterSource].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterType.value = '';
  filterSource.value = '';
  searchInput.value = '';
  scopeFilterSelected = [];
  scopeFilterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  updateScopeFilterButtonLabel();
  applyFiltersAndRender();
});

async function loadSources() {
  const { data } = await supabase.from('sources').select('id, source_name, citation_tag, short_citation, scope').order('source_name');
  sources = data || [];
  addBtn.disabled = sources.length === 0;
  noSourcesNote.hidden = sources.length > 0;
}

async function loadInsights() {
  const { data, error } = await supabase
    .from('figures')
    .select('*, sources(source_name, citation_tag, short_citation, link_or_path)')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load insights: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allInsights = data || [];
  populateFilterOptions();
  applyFiltersAndRender();
}

// One modal for both Add (insight=null) and Edit (insight=existing row). Scope starts
// as a snapshot copy of the chosen Source's Scope (not a live link) and stays fully
// editable from that point on — picking a different source only re-copies its Scope
// while the field is still empty, so it never clobbers a researcher's own edits.
function openInsightModal(insight) {
  const root = document.getElementById('add-insight-root');
  const sourceOptions = sources.map(s => `<option value="${s.id}" ${insight && insight.source_id === s.id ? 'selected' : ''}>${escapeHtml(s.source_name || s.citation_tag || 'Untitled source')}</option>`).join('');
  const fieldsHTML = INSIGHT_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${f.key === 'insight_type' ? `<div class="type-legend" style="margin: 2px 0 6px;">${typeLegendHTML()}</div>` : ''}
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
              <div class="form-field full">
                <label>Source *</label>
                <select name="source_id" id="insight-source-select" required>
                  <option value=""></option>
                  ${sourceOptions}
                </select>
              </div>
              ${fieldsHTML}
            </div>
            <div class="form-section-label" style="margin-top: 16px;">Scope *</div>
            <div class="settings-hint" style="margin-bottom: 6px;">Starts from the Source's Scope — narrow it down or add to it for this specific insight.</div>
            <div id="insight-scope-groups">${scopeCheckboxGroupsHTML(insight?.scope || [])}</div>
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
  const form = document.getElementById('add-form');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('insight-source-select').addEventListener('change', (e) => {
    const scopeContainer = document.getElementById('insight-scope-groups');
    const currentlyChecked = readCheckboxGroup(form, 'scope');
    if (currentlyChecked.length) return; // don't overwrite a researcher's own edits
    const picked = sources.find(s => s.id === e.target.value);
    scopeContainer.innerHTML = scopeCheckboxGroupsHTML(picked?.scope || []);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const scope = readCheckboxGroup(form, 'scope');
    if (!scope.length) {
      errorEl.textContent = 'Select at least one Scope.';
      errorEl.hidden = false;
      return;
    }

    const data = readFormValues(e.target, INSIGHT_FIELDS);
    data.source_id = e.target.elements.source_id.value;
    data.scope = scope;

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
