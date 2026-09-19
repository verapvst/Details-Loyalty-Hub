import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openSourceModal } from './sourceModal.js';
import { loadSourceUsage, sortSourcesByRecency } from './insightModal.js';
import { loadTeamMembers } from './teamMembers.js';

await initNav('sources');
await loadCustomOptions();
await loadTeamMembers();

const listEl = document.getElementById('source-list');
const sectionCount = document.getElementById('section-count');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const filterType = document.getElementById('filter-type');
const filterAddedBy = document.getElementById('filter-added-by');
const scopeFilterBtn = document.getElementById('scope-filter-btn');
const scopeFilterPanel = document.getElementById('scope-filter-panel');

let allSources = [];
let usage = new Map(); // source_id -> most recent figures.created_at, from insightModal.js
let scopeFilterSelected = [];

// Legacy rows added before this restructure may not have source_name/short_citation
// yet (only the migration's one-time backfill from the old citation_tag) — fall back
// to whatever is present so nothing old looks blank.
function displayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

// Compact, scannable row: Short Citation, Source Name, and a Type · Scope meta line —
// nothing else. Full citation, URL, author/year detail and Edit/Delete all live on
// the Source Detail page (source.html) — this list is for browsing, not reading.
function renderRow(s) {
  const shortCitation = s.short_citation || s.citation_tag;
  const metaParts = [s.source_type, ...(s.scope || [])].filter(Boolean);

  return `
    <a href="source.html?id=${s.id}" class="list-row" style="display: block; text-decoration: none; color: inherit;">
      ${shortCitation ? `<div class="badge badge-muted" style="margin-bottom: 6px;">${escapeHtml(shortCitation)}</div>` : ''}
      <div class="list-row-title">${escapeHtml(displayName(s))}</div>
      ${metaParts.length ? `<div class="list-row-meta" style="margin-top: 6px;">${metaParts.map(escapeHtml).join(' · ')}</div>` : ''}
    </a>
  `;
}

function distinctSorted(list, key) {
  return [...new Set(list.map(s => s[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateFilterOptions() {
  const current = filterType.value;
  filterType.innerHTML = '<option value="">All</option>' +
    distinctSorted(allSources, 'source_type').map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  filterType.value = current;

  const currentAddedBy = filterAddedBy.value;
  filterAddedBy.innerHTML = '<option value="">All</option>' +
    distinctSorted(allSources, 'created_by').map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  filterAddedBy.value = currentAddedBy;
}

function updateScopeFilterButtonLabel() {
  scopeFilterBtn.textContent = scopeFilterSelected.length
    ? (scopeFilterSelected.length <= 2 ? scopeFilterSelected.join(', ') : `${scopeFilterSelected.length} selected`)
    : 'All';
}

// "Recently Used" (default) surfaces sources actually being cited right now, not just
// ones entered recently — a source added months ago but reused for several Insights
// stays near the top. "Recently Added" and "A–Z" cover the other two natural asks.
function sortForDisplay(list) {
  const sort = sortSelect.value;
  if (sort === 'az') return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  if (sort === 'za') return [...list].sort((a, b) => displayName(b).localeCompare(displayName(a)));
  if (sort === 'recent-add') return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return sortSourcesByRecency(list, usage);
}

function applyFiltersAndRender() {
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allSources.filter(s => {
    if (filterType.value && s.source_type !== filterType.value) return false;
    if (filterAddedBy.value && s.created_by !== filterAddedBy.value) return false;
    if (scopeFilterSelected.length && !(s.scope || []).some(v => scopeFilterSelected.includes(v))) return false;
    if (q) {
      const hay = `${displayName(s)} ${s.author_org || ''} ${s.source_type || ''} ${s.short_citation || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sectionCount.textContent = `${filtered.length} of ${allSources.length}`;

  if (!filtered.length) {
    listEl.innerHTML = allSources.length
      ? `<div class="empty-state"><div class="em-title">No sources match</div><p>Try adjusting or clearing the filters.</p></div>`
      : `<div class="empty-state"><div class="em-title">No sources yet</div><p>Add the first one to start citing stats and findings.</p></div>`;
    return;
  }

  listEl.innerHTML = sortForDisplay(filtered).map(renderRow).join('');
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

[sortSelect, filterType, filterAddedBy].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  sortSelect.value = 'recent-use';
  filterType.value = '';
  filterAddedBy.value = '';
  searchInput.value = '';
  scopeFilterSelected = [];
  scopeFilterPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  updateScopeFilterButtonLabel();
  applyFiltersAndRender();
});

async function loadSources() {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load sources: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allSources = data || [];
  usage = await loadSourceUsage();
  populateFilterOptions();
  applyFiltersAndRender();
}

document.getElementById('btn-add-source').addEventListener('click', () => openSourceModal({ source: null, onChange: loadSources }));

loadSources();
