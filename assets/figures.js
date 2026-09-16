import { supabase } from './supabase.js';
import { initNav } from './app.js';
import { escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openInsightModal, definitionFor, typeLegendHTML } from './insightModal.js';

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

// Compact, scannable row: Type, the insight itself, Scope tags, and a clickable
// Source reference — nothing else. Full text, citations, and Edit/Delete all live
// on the Insight Detail page (insight.html) — this list is for browsing, not reading.
function renderRow(f) {
  const sourceName = f.sources ? displaySourceName(f.sources) : null;
  const shortCitation = f.sources ? (f.sources.short_citation || f.sources.citation_tag) : null;
  const scopeChips = (f.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');

  // The Source badge needs to be its own click target (jump straight to the source)
  // nested inside the row's own click target (open the insight) — an <a> can't
  // validly contain another <a> (the browser silently closes the outer one early,
  // splitting the card in two), so the inner one is a <span> wired up in JS instead.
  return `
    <a href="insight.html?id=${f.id}" class="list-row" style="display: block; text-decoration: none; color: inherit;">
      <div class="list-row-top">
        <div class="badge badge-green has-tooltip" data-tooltip="${escapeHtml(definitionFor(f.insight_type))}">${escapeHtml(f.insight_type || 'Other')}</div>
        ${shortCitation ? `<span data-source-link="${f.source_id}" class="badge badge-muted" title="${escapeHtml(sourceName || '')}">${escapeHtml(shortCitation)}</span>` : ''}
      </div>
      <div class="list-row-title" style="margin-top: 10px;">${escapeHtml(f.insight_text)}</div>
      ${scopeChips ? `<div class="chip-row" style="margin: 10px 0 0;">${scopeChips}</div>` : ''}
    </a>
  `;
}

function wireRowLinks() {
  listEl.querySelectorAll('[data-source-link]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `source.html?id=${el.dataset.sourceLink}`;
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
  wireRowLinks();
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

addBtn.addEventListener('click', () => openInsightModal({ insight: null, sources, onChange: loadInsights }));

loadSources().then(loadInsights);
