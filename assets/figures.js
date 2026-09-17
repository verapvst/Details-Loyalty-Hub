import { supabase } from './supabase.js';
import { initNav } from './app.js';
import { escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openInsightModal, definitionFor, typeLegendHTML } from './insightModal.js';
import { fieldPlainText } from './richText.js';

await initNav('figures');
await loadCustomOptions();

const listEl = document.getElementById('insight-list');
const noSourcesNote = document.getElementById('no-sources-note');
const addBtn = document.getElementById('btn-add-insight');
const sectionCount = document.getElementById('section-count');
const filterType = document.getElementById('filter-type');
const filterVisual = document.getElementById('filter-visual');
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
  fill(filterVisual, distinctSorted(allInsights, 'visual_type'));
  fill(filterSource, distinctSorted(allInsights.map(f => ({ source_name: f.sources ? displaySourceName(f.sources) : null })), 'source_name'));
}

function displaySourceName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

// The Title is what the list shows; a legacy insight saved before Title existed
// falls back to a plain-text rendering of its Main Insight (same "graceful fallback
// for old rows" pattern used for Source Name elsewhere in this app).
function displayTitle(f) {
  return f.title || fieldPlainText(f.insight_text) || 'Untitled insight';
}

// A compact research-library card, not a full content card: Title + where it came
// from (the source's short citation already encodes Author · Year), Type/Visual as
// small badges. Scope, Main Insight, Source Detail, citations and Edit/Delete all
// live on the Insight Detail page (insight.html) — this grid is for browsing/scanning.
function renderCard(f) {
  const sourceLabel = f.sources ? (f.sources.short_citation || displaySourceName(f.sources)) : null;

  return `
    <a href="insight.html?id=${f.id}" class="compact-card">
      <div class="compact-card-head">
        <div class="compact-card-body">
          <div class="compact-card-title">${escapeHtml(displayTitle(f))}</div>
          ${sourceLabel ? `<div class="compact-card-sub">${escapeHtml(sourceLabel)}</div>` : ''}
        </div>
      </div>
      <div class="compact-card-meta">
        <span class="badge badge-green has-tooltip" data-tooltip="${escapeHtml(definitionFor(f.insight_type))}">${escapeHtml(f.insight_type || 'Other')}</span>
        ${f.visual_type ? `<span class="badge badge-muted">${escapeHtml(f.visual_type)}</span>` : ''}
      </div>
    </a>
  `;
}

function applyFiltersAndRender() {
  const type = filterType.value;
  const visual = filterVisual.value;
  const sourceName = filterSource.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allInsights.filter(f => {
    if (type && f.insight_type !== type) return false;
    if (visual && f.visual_type !== visual) return false;
    if (sourceName && (!f.sources || displaySourceName(f.sources) !== sourceName)) return false;
    // Scope filter uses OR logic: match if the insight has ANY of the selected tags.
    if (scopeFilterSelected.length && !(f.scope || []).some(v => scopeFilterSelected.includes(v))) return false;
    if (q) {
      const hay = `${f.title || ''} ${fieldPlainText(f.insight_text)} ${fieldPlainText(f.supporting_detail)} ${f.sources ? displaySourceName(f.sources) : ''}`.toLowerCase();
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

  listEl.innerHTML = filtered.map(renderCard).join('');
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

[filterType, filterVisual, filterSource].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterType.value = '';
  filterVisual.value = '';
  filterSource.value = '';
  searchInput.value = '';
  scopeFilterSelected = [];
  scopeFilterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  updateScopeFilterButtonLabel();
  applyFiltersAndRender();
});

async function loadSources() {
  const { data } = await supabase.from('sources').select('id, source_name, citation_tag, short_citation, author_org, year, scope').order('source_name');
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
