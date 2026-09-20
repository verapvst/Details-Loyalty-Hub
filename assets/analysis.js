// Analysis tab orchestrator: global filter bar, KPI snapshot, and every Lab. Loads the
// full programme dataset once (assets/analysisData.js) and re-derives everything else
// client-side on every filter change — no page reloads, matching the rest of the app.
import { initNav, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { loadCustomOptions, getOptionList } from './customOptions.js';
import { loadAnalysisDataset, applyGlobalFilters } from './analysisData.js';

import { mountKpiSnapshot } from './analysisKpiSnapshot.js';
import { mount as mountLaunchTrends } from './analysisLaunchTrendsLab.js';
import { mount as mountDistribution } from './analysisDistributionLab.js';
import { mount as mountCross } from './analysisCrossLab.js';
import { mount as mountMechanics } from './analysisMechanicsLab.js';
import { mount as mountTier } from './analysisTierLab.js';
import { mount as mountSavedNotes } from './analysisSavedNotes.js';

await initNav('analysis');
await loadCustomOptions();

// ---------------- Global filter bar ----------------

const MULTI_FILTERS = [
  { key: 'industry', label: 'Industry', optionKey: 'industry' },
  { key: 'geographic_scope', label: 'Geography', optionKey: 'geographic_scope' },
  { key: 'programme_positioning', label: 'Positioning', optionKey: 'programme_positioning' },
  { key: 'membership_type', label: 'Membership', optionKey: 'membership_type' },
  { key: 'target_customer', label: 'Target Customer', optionKey: 'target_customer' },
  { key: 'access_registration', label: 'Access', optionKey: 'access_registration' }
];

const globalFilters = { yearMin: null, yearMax: null };
MULTI_FILTERS.forEach(f => { globalFilters[f.key] = []; });

function filterBarHTML() {
  const multi = MULTI_FILTERS.map(f => `
    <div class="filter-group scope-filter" data-filter-key="${f.key}">
      <span class="filter-label">${escapeHtml(f.label)}</span>
      <button type="button" class="filter-select multi-filter-btn" id="gf-btn-${f.key}">All</button>
      <div class="scope-filter-panel" id="gf-panel-${f.key}" hidden>
        <div class="checkbox-row">${getOptionList(f.optionKey).map(o => `<label class="checkbox-item"><input type="checkbox" value="${escapeHtml(o)}" /> ${escapeHtml(o)}</label>`).join('')}</div>
      </div>
    </div>
  `).join('');
  return `
    ${multi}
    <div class="filter-group year-range">
      <span class="filter-label">Launch Year</span>
      <input type="number" id="gf-year-min" placeholder="Min" />
      <span>–</span>
      <input type="number" id="gf-year-max" placeholder="Max" />
    </div>
    <button class="btn-clear-filters" id="gf-clear" type="button">Clear All</button>
  `;
}

function updateFilterButtonLabel(key) {
  const btn = document.getElementById(`gf-btn-${key}`);
  const sel = globalFilters[key];
  btn.textContent = !sel.length ? 'All' : (sel.length <= 2 ? sel.join(', ') : `${sel.length} selected`);
}

function wireFilterBar() {
  MULTI_FILTERS.forEach(f => {
    const btn = document.getElementById(`gf-btn-${f.key}`);
    const panel = document.getElementById(`gf-panel-${f.key}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasHidden = panel.hidden;
      document.querySelectorAll('.scope-filter-panel').forEach(p => { p.hidden = true; });
      panel.hidden = !wasHidden;
    });
    panel.addEventListener('change', () => {
      globalFilters[f.key] = [...panel.querySelectorAll('input:checked')].map(cb => cb.value);
      updateFilterButtonLabel(f.key);
      rerenderAll();
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.scope-filter')) document.querySelectorAll('.scope-filter-panel').forEach(p => { p.hidden = true; });
  });

  const yearMin = document.getElementById('gf-year-min');
  const yearMax = document.getElementById('gf-year-max');
  [yearMin, yearMax].forEach(inp => inp.addEventListener('change', () => {
    globalFilters.yearMin = yearMin.value ? Number(yearMin.value) : null;
    globalFilters.yearMax = yearMax.value ? Number(yearMax.value) : null;
    rerenderAll();
  }));

  document.getElementById('gf-clear').addEventListener('click', () => {
    MULTI_FILTERS.forEach(f => {
      globalFilters[f.key] = [];
      document.querySelectorAll(`#gf-panel-${f.key} input`).forEach(cb => { cb.checked = false; });
      updateFilterButtonLabel(f.key);
    });
    globalFilters.yearMin = null; globalFilters.yearMax = null;
    yearMin.value = ''; yearMax.value = '';
    rerenderAll();
  });
}

function filtersSummaryText() {
  const parts = [];
  MULTI_FILTERS.forEach(f => { if (globalFilters[f.key].length) parts.push(`${f.label}: ${globalFilters[f.key].join(', ')}`); });
  if (globalFilters.yearMin != null || globalFilters.yearMax != null) {
    parts.push(`Launch Year: ${globalFilters.yearMin ?? '…'}–${globalFilters.yearMax ?? '…'}`);
  }
  return parts.length ? parts.join(' · ') : 'All programmes';
}

document.getElementById('global-filter-bar').innerHTML = filterBarHTML();
wireFilterBar();

// ---------------- Labs ----------------

const LAB_SECTION_IDS = {
  launch_trends: 'lab-launch-trends', distribution: 'lab-distribution', cross_analysis: 'lab-cross',
  mechanics_distribution: 'lab-mechanics', mechanics_industry: 'lab-mechanics', mechanics_cooccurrence: 'lab-mechanics',
  tier_overview: 'lab-tiers', tier_by_dimension: 'lab-tiers', tier_jumps: 'lab-tiers'
};

const labs = {};

function reopenAnalysis(row) {
  const config = row.config || {};
  const gf = config.globalFilters || {};
  MULTI_FILTERS.forEach(f => {
    globalFilters[f.key] = Array.isArray(gf[f.key]) ? gf[f.key] : [];
    document.querySelectorAll(`#gf-panel-${f.key} input`).forEach(cb => { cb.checked = globalFilters[f.key].includes(cb.value); });
    updateFilterButtonLabel(f.key);
  });
  globalFilters.yearMin = gf.yearMin ?? null;
  globalFilters.yearMax = gf.yearMax ?? null;
  document.getElementById('gf-year-min').value = globalFilters.yearMin ?? '';
  document.getElementById('gf-year-max').value = globalFilters.yearMax ?? '';

  rerenderAll();

  const controller = {
    launch_trends: labs.launchTrends, distribution: labs.distribution, cross_analysis: labs.cross,
    mechanics_distribution: labs.mechanics, mechanics_industry: labs.mechanics, mechanics_cooccurrence: labs.mechanics,
    tier_overview: labs.tier, tier_by_dimension: labs.tier, tier_jumps: labs.tier
  }[row.lab];
  if (controller) controller.applyConfig({ ...config, lab: row.lab });

  const sectionId = LAB_SECTION_IDS[row.lab];
  if (sectionId) document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`Reopened "${row.name}".`);
}

const ctx = { filtersSummaryText, getGlobalFilters: () => JSON.parse(JSON.stringify(globalFilters)), reopenAnalysis };

const renderKpi = mountKpiSnapshot();
labs.launchTrends = mountLaunchTrends(document.getElementById('launch-trends-root'), ctx);
labs.distribution = mountDistribution(document.getElementById('distribution-root'), ctx);
labs.cross = mountCross(document.getElementById('cross-root'), ctx);
labs.mechanics = mountMechanics(document.getElementById('mechanics-root'), ctx);
labs.tier = mountTier(document.getElementById('tier-root'), ctx);
mountSavedNotes(ctx);

let allProgrammes = [];

function rerenderAll() {
  const filtered = applyGlobalFilters(allProgrammes, globalFilters);
  renderKpi(filtered);
  labs.launchTrends.render(filtered);
  labs.distribution.render(filtered);
  labs.cross.render(filtered);
  labs.mechanics.render(filtered);
  labs.tier.render(filtered);
}

try {
  allProgrammes = await loadAnalysisDataset();
} catch (e) {
  showToast(`Could not load programmes: ${e.message}`, true);
}
rerenderAll();
