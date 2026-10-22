// My Laboratory orchestrator. Loads the dataset once and drives four workspaces
// (Explore / Relate) — only one visible at a time, all mounted once so
// switching tabs never loses in-progress state. Reuses assets/analysisData.js for every
// aggregation; this file is purely page chrome (header, compact filters, tabs, persistence).
import { initNav, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { loadCustomOptions, getOptionList } from './customOptions.js';
import { loadAnalysisDataset, applyGlobalFilters } from './analysisData.js';
import { fmtNum } from './charts.js';

import { mount as mountExplore } from './labExplore.js';
import { mount as mountRelate } from './labRelate.js';

await initNav('analysis');
await loadCustomOptions();

// ---------------- Lightweight persistence (session always; localStorage best-effort) ----------------

const STORAGE_PREFIX = 'lab_state_';
// Saved views from older versions of this page (removed tabs, renamed dimensions/industries) used to
// leave Analysis empty. Drop everything saved by a previous version once.
const STATE_VERSION = '3';
try {
  if (localStorage.getItem(STORAGE_PREFIX + 'version') !== STATE_VERSION) {
    Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(STORAGE_PREFIX + 'version', STATE_VERSION);
  }
} catch { /* private mode etc. */ }
function loadPersisted(key) {
  try { const raw = localStorage.getItem(STORAGE_PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function savePersisted(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

// ---------------- Global filters (compact chip row, not a wall of dropdowns) ----------------

const FILTER_FIELDS = [
  { key: 'industry', label: 'Industry', optionKey: 'industry' },
  { key: 'geographic_scope', label: 'Geography', optionKey: 'geographic_scope' },
  { key: 'programme_positioning', label: 'Positioning', optionKey: 'programme_positioning' },
  { key: 'membership_type', label: 'Membership', optionKey: 'membership_type' },
  { key: 'target_customer', label: 'Target Customer', optionKey: 'target_customer' },
  { key: 'access_registration', label: 'Access', optionKey: 'access_registration' }
];

const defaultFilters = { yearMin: null, yearMax: null };
FILTER_FIELDS.forEach(f => { defaultFilters[f.key] = []; });
const persistedFilters = loadPersisted('filters');
const globalFilters = persistedFilters ? { ...defaultFilters, ...persistedFilters } : { ...defaultFilters };
// Keep only filter values that still exist (an industry renamed since the view was saved must not hide everything).
FILTER_FIELDS.forEach(f => {
  const valid = getOptionList(f.optionKey);
  globalFilters[f.key] = (Array.isArray(globalFilters[f.key]) ? globalFilters[f.key] : []).filter(v => valid.includes(v));
});

function filtersSummaryText() {
  const parts = [];
  FILTER_FIELDS.forEach(f => { if (globalFilters[f.key].length) parts.push(`${f.label}: ${globalFilters[f.key].join(', ')}`); });
  if (globalFilters.yearMin != null || globalFilters.yearMax != null) {
    parts.push(`Launch Year: ${globalFilters.yearMin ?? '…'}–${globalFilters.yearMax ?? '…'}`);
  }
  return parts.length ? parts.join(' · ') : 'All programmes';
}

function filterAddPanelHTML() {
  const multi = FILTER_FIELDS.map(f => `
    <div class="filter-add-field">
      <div class="filter-add-field-label">${escapeHtml(f.label)}</div>
      <div class="checkbox-row" data-field="${f.key}">${getOptionList(f.optionKey).map(o => `<label class="checkbox-item"><input type="checkbox" value="${escapeHtml(o)}" ${globalFilters[f.key].includes(o) ? 'checked' : ''} /> ${escapeHtml(o)}</label>`).join('')}</div>
    </div>
  `).join('');
  return `
    ${multi}
    <div class="filter-add-field">
      <div class="filter-add-field-label">Launch Year</div>
      <div class="year-range">
        <input type="number" id="gf-year-min" placeholder="Min" value="${globalFilters.yearMin ?? ''}" />
        <span>–</span>
        <input type="number" id="gf-year-max" placeholder="Max" value="${globalFilters.yearMax ?? ''}" />
      </div>
    </div>
  `;
}

function chipLabel(values) {
  return values.length <= 2 ? values.join(', ') : `${values[0]}, +${values.length - 1}`;
}

function renderFilterChips() {
  const chipsEl = document.getElementById('filter-chips');
  const chips = [];
  FILTER_FIELDS.forEach(f => {
    if (globalFilters[f.key].length) chips.push({ key: f.key, label: `${f.label}: ${chipLabel(globalFilters[f.key])}` });
  });
  if (globalFilters.yearMin != null || globalFilters.yearMax != null) {
    chips.push({ key: 'launchYear', label: `Launch Year: ${globalFilters.yearMin ?? '…'}–${globalFilters.yearMax ?? '…'}` });
  }
  chipsEl.innerHTML = chips.map(c => `<span class="filter-chip" data-chip="${c.key}">${escapeHtml(c.label)} <button type="button" aria-label="Remove filter">&times;</button></span>`).join('');
  chipsEl.querySelectorAll('.filter-chip button').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.closest('.filter-chip').dataset.chip;
    if (key === 'launchYear') { globalFilters.yearMin = null; globalFilters.yearMax = null; }
    else globalFilters[key] = [];
    document.querySelectorAll(`.checkbox-row[data-field="${key}"] input`).forEach(cb => { cb.checked = false; });
    const yMin = document.getElementById('gf-year-min'), yMax = document.getElementById('gf-year-max');
    if (yMin) yMin.value = ''; if (yMax) yMax.value = '';
    onFiltersChanged();
  }));
}

function wireFilterAddPanel() {
  const btn = document.getElementById('filter-add-btn');
  const panel = document.getElementById('filter-add-panel');
  panel.innerHTML = filterAddPanelHTML();
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  document.addEventListener('click', (e) => { if (!panel.hidden && !e.target.closest('.filter-add-wrap')) panel.hidden = true; });
  panel.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      const field = e.target.closest('.checkbox-row').dataset.field;
      globalFilters[field] = [...panel.querySelectorAll(`.checkbox-row[data-field="${field}"] input:checked`)].map(cb => cb.value);
      onFiltersChanged();
    }
  });
  const commitYear = () => {
    const yMin = document.getElementById('gf-year-min'), yMax = document.getElementById('gf-year-max');
    globalFilters.yearMin = yMin.value ? Number(yMin.value) : null;
    globalFilters.yearMax = yMax.value ? Number(yMax.value) : null;
    onFiltersChanged();
  };
  panel.querySelector('#gf-year-min').addEventListener('change', commitYear);
  panel.querySelector('#gf-year-max').addEventListener('change', commitYear);
}

function onFiltersChanged() {
  renderFilterChips();
  savePersisted('filters', globalFilters);
  rerenderAll();
}

function restoreFilterUI() {
  renderFilterChips();
  const panel = document.getElementById('filter-add-panel');
  if (panel) panel.innerHTML = filterAddPanelHTML();
}

// ---------------- Workspace tabs ----------------

const WORKSPACES = ['explore', 'relate'];
const workspaces = {};
let activeTab = loadPersisted('activeTab') || 'explore';
if (!WORKSPACES.includes(activeTab)) activeTab = 'explore';

function showTab(tab) {
  activeTab = tab;
  savePersisted('activeTab', tab);
  document.querySelectorAll('.lab-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  WORKSPACES.forEach(w => { document.getElementById(`workspace-${w}`).hidden = w !== tab; });
}

function wireTabs() {
  document.querySelectorAll('.lab-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
}

function reopenAnalysis(row) {
  const config = row.config || {};
  const gf = config.globalFilters || {};
  FILTER_FIELDS.forEach(f => { globalFilters[f.key] = Array.isArray(gf[f.key]) ? gf[f.key] : []; });
  globalFilters.yearMin = gf.yearMin ?? null;
  globalFilters.yearMax = gf.yearMax ?? null;
  restoreFilterUI();
  savePersisted('filters', globalFilters);
  rerenderAll();

  const ws = workspaces[row.lab];
  if (ws) { ws.applyConfig(config); savePersisted(row.lab, ws.getConfig()); }
  if (WORKSPACES.includes(row.lab)) showTab(row.lab);
  showToast(`Reopened "${row.name}".`);
}

// ---------------- Boot ----------------

function makeCtx(workspaceKey) {
  return {
    filtersSummaryText,
    getGlobalFilters: () => JSON.parse(JSON.stringify(globalFilters)),
    reopenAnalysis,
    persist: (state) => savePersisted(workspaceKey, state),
    // Used by Explore's Mechanism drill-down to bridge into the Mechanisms workspace
    // with that exact mechanism already selected, instead of landing on it empty.
    switchToMechanism: () => showTab('relate')
  };
}

wireFilterAddPanel();
restoreFilterUI();
wireTabs();
showTab(activeTab);

workspaces.explore = mountExplore(document.getElementById('workspace-explore'), makeCtx('explore'));
workspaces.relate = mountRelate(document.getElementById('workspace-relate'), makeCtx('relate'));

const DATA_DRIVEN_WORKSPACES = ['explore', 'relate'];
DATA_DRIVEN_WORKSPACES.forEach(key => {
  const persisted = loadPersisted(key);
  if (persisted) { try { workspaces[key].applyConfig(persisted); } catch { savePersisted(key, null); } }
});

let allProgrammes = [];

function rerenderAll() {
  const filtered = applyGlobalFilters(allProgrammes, globalFilters);
  // Each workspace renders independently — one throwing (e.g. a stale cached copy of
  // this file calling something that no longer exists) must not leave every other
  // workspace stuck showing stale/empty data.
  DATA_DRIVEN_WORKSPACES.forEach(key => {
    try { workspaces[key].render(filtered); }
    catch (e) {
      console.error(`${key} workspace failed to render:`, e);
      document.getElementById(`workspace-${key}`).innerHTML = `<div class="error-state" style="margin:30px 0;text-align:center;">This view could not be drawn (${escapeHtml(e.message || 'error')}). <button type="button" class="btn-primary" id="reset-view-${key}">Reset view</button></div>`;
      document.getElementById(`reset-view-${key}`).addEventListener('click', () => { try { Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {} location.reload(); });
    }
  });
}

const loadingEl = document.createElement('div');
loadingEl.className = 'loading-state';
loadingEl.style.cssText = 'padding:24px 0;text-align:center;';
loadingEl.textContent = 'Loading programmes…';
document.querySelector('.lab-main').prepend(loadingEl);
try {
  allProgrammes = await loadAnalysisDataset();
  loadingEl.remove();
  rerenderAll();
} catch (e) {
  // Never render an empty analysis as if it were real: say what happened and offer a retry.
  document.querySelector('.lab-main').innerHTML = `<div class="error-state" style="margin:40px 0;text-align:center;">Could not load the programmes (${escapeHtml(e.message || 'network error')}). <button type="button" class="btn-primary" onclick="location.reload()">Try again</button></div>`;
}
