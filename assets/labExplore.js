// My Laboratory — Explore workspace. "What does the landscape look like along one
// dimension?" Consolidates the old Distribution Lab and the old standalone Mechanism
// Distribution card (Mechanism is just one more dimension here, nothing special).
// Reuses the existing engine verbatim: distribution(), categoryProfile().
//
// Layout (2026-09 redesign): one horizontal control row (dimension/measure/view-as,
// no more stacked full-width prompts), a big feature chart, and — once a category is
// clicked — a full-width "selected category" workspace below it: breakdowns on the
// left, the actual underlying programmes on the right, each linking straight to its
// own programme page. The click path is meant to read as
// chart category -> underlying characteristics -> actual programmes -> programme page,
// not category -> a small info panel.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, distribution, categoryProfile, snapshotKpis } from './analysisData.js';
import { renderHBarChart, renderDonutChart, fmtNum, fmtPct } from './charts.js';
import { mechanismSpectrumColor } from './options.js';
import { mountChartCard, showEmptyChartState, showTipOnce } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

const DIM_KEYS = ['industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms'];
const MEASURE_OPTIONS = [['count', 'Number of Programmes'], ['pct', '% of Programmes'], ['companies', 'Number of Companies']];

function measureLabel(measure) {
  return measure === 'pct' ? '% of Programmes' : measure === 'companies' ? 'Number of Companies' : 'Number of Programmes';
}

// A donut only makes sense when the parts genuinely sum to a whole — never true for a
// multi-select dimension, so it's simply not offered there (no "why is this greyed
// out" explaining needed, because the option doesn't exist).
function viewAsOptions(dimKey) {
  return DIMENSIONS[dimKey].kind === 'multi' ? [] : [['bar', 'Bar'], ['donut', 'Donut']];
}

// A muted, brand-family palette for the small stacked-proportion bars below — never
// the main chart's own gold, so these clearly read as secondary/subordinate to it.
const STACK_COLORS = ['#B18F46', '#6E6E73', '#D8C6A0', '#93753A', '#AEAEB2', '#C9A667', '#4C4A42', '#E4DAC4'];

// One thin horizontal bar, segmented proportionally — a shape you can read at a
// glance before the exact-numbers list underneath it spells them out.
function stackedBarHTML(profileRows) {
  const total = profileRows.reduce((s, r) => s + r.pct, 0) || 1;
  return `
    <div class="mini-stack-bar">
      ${profileRows.map((r, i) => `<span class="mini-stack-seg" style="width:${(r.pct / total * 100).toFixed(1)}%; background:${STACK_COLORS[i % STACK_COLORS.length]}" title="${escapeHtml(r.value)} — ${fmtPct(r.pct)}"></span>`).join('')}
    </div>
  `;
}

// The exact numbers, as a plain list — the stacked bar above already carries the
// "see it visually" job, so this stays text-only rather than repeating the same
// proportion a second time as a row of individual mini-bars.
function valueListHTML(profileRows) {
  return profileRows.map(r => `
    <div class="drilldown-bar-row">
      <span class="dbr-label" title="${escapeHtml(r.value)}">${escapeHtml(r.value)}</span>
      <span class="dbr-pct">${fmtPct(r.pct)}</span>
    </div>
  `).join('') || '<div class="drilldown-empty">No data.</div>';
}

function programmeRowHTML(p) {
  return `
    <a class="prog-list-row" href="programme.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">
      <span class="prog-list-name">${escapeHtml(p.programme_name || 'Untitled programme')}</span>
      <span class="prog-list-company">${escapeHtml(p.company || '')}</span>
    </a>
  `;
}

// The category workspace: breakdowns (left) + the actual underlying programmes
// (right, each a real link into the existing programme page) — replaces the old
// "click count to open a modal" indirection with the list always in view once a
// category is selected.
function categorySectionHTML(dimKey, value, programmes) {
  const profile = categoryProfile(programmes, dimKey, value);
  const isMechanismBridge = dimKey === 'mechanisms';
  const rows = [...profile.subset].sort((a, b) => (a.programme_name || '').localeCompare(b.programme_name || ''));

  return `
    <div class="category-section-head">
      <div class="category-section-title">${escapeHtml(value)}<span class="category-section-count">${fmtNum(profile.count)} programme${profile.count === 1 ? '' : 's'}</span></div>
      ${isMechanismBridge ? `<button type="button" class="btn-text" id="ex-drill-bridge-mechanisms">→ Analyze ${escapeHtml(value)} in Mechanisms</button>` : ''}
    </div>
    <div class="category-drilldown-grid">
      <div class="category-breakdown-grid">
        <div class="breakdown-block"><div class="drilldown-block-label">Positioning</div>${stackedBarHTML(profile.positioning.rows)}${valueListHTML(profile.positioning.rows)}</div>
        <div class="breakdown-block"><div class="drilldown-block-label">Membership</div>${stackedBarHTML(profile.membership.rows)}${valueListHTML(profile.membership.rows)}</div>
        <div class="breakdown-block"><div class="drilldown-block-label">Geographic Scope</div>${stackedBarHTML(profile.geography.rows)}${valueListHTML(profile.geography.rows)}</div>
        <div class="breakdown-block"><div class="drilldown-block-label">Top Mechanisms <span class="drilldown-block-note">(multi-select)</span></div>${valueListHTML(profile.topMechanisms)}</div>
      </div>
      <div>
        <div class="prog-list-count">${fmtNum(profile.count)} programme${profile.count === 1 ? '' : 's'} — click one to open it</div>
        <div class="category-programme-list-wrap">
          <div class="category-programme-list prog-list">${rows.length ? rows.map(programmeRowHTML).join('') : '<div class="drilldown-empty">No programmes match.</div>'}</div>
        </div>
      </div>
    </div>
  `;
}

function kpiRowHTML(programmes) {
  const k = snapshotKpis(programmes);
  const cards = [
    ['Programmes', fmtNum(k.total)],
    ['Companies', fmtNum(k.companies)],
    ['Industries', fmtNum(k.industries)],
    ['Geographic Markets', fmtNum(k.geoMarkets)],
    ['Paid', fmtPct(k.paidPct)],
    ['Tiered', fmtPct(k.tieredPct)]
  ];
  return `
    <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); margin-bottom: 24px;">
      ${cards.map(([label, value]) => `<div class="kpi-item"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`).join('')}
    </div>
  `;
}

export function mount(container, ctx) {
  // Industry/Donut is the default first-open view (a fresh session with no saved
  // config) — the single most useful "what does the landscape look like" cut.
  const state = { dimKey: 'industry', measure: 'count', chartType: 'donut' };
  let lastProgrammes = [];
  let selectedValue = null;

  container.innerHTML = `
    <div id="ex-kpis"></div>
    <div class="workspace-secondary-controls">
      <div class="control-group">
        <label>Explore by</label>
        <select class="control-select" id="ex-dim">
          <option value="" disabled ${!state.dimKey ? 'selected' : ''}>Select a dimension…</option>
          ${DIM_KEYS.map(k => `<option value="${k}" ${k === state.dimKey ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}
        </select>
      </div>
      <div class="control-group" id="ex-measure-group" hidden>
        <label>Measure</label>
        <select class="control-select" id="ex-measure">${MEASURE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === state.measure ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="control-group" id="ex-viewas-group" hidden>
        <label>View as…</label>
        <select class="control-select" id="ex-viewas"></select>
      </div>
    </div>
    <div id="ex-result"></div>
  `;

  const kpisEl = container.querySelector('#ex-kpis');
  const dimSel = container.querySelector('#ex-dim');
  const measureGroup = container.querySelector('#ex-measure-group');
  const measureSel = container.querySelector('#ex-measure');
  const viewAsGroup = container.querySelector('#ex-viewas-group');
  const viewAsSel = container.querySelector('#ex-viewas');
  const resultEl = container.querySelector('#ex-result');

  measureSel.addEventListener('change', () => { state.measure = measureSel.value; ctx.persist(state); render(lastProgrammes); });
  viewAsSel.addEventListener('change', () => { state.chartType = viewAsSel.value; ctx.persist(state); render(lastProgrammes); });

  function renderCategorySection() {
    const el = resultEl.querySelector('#ex-category-section');
    if (!el) return;
    if (!selectedValue) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = categorySectionHTML(state.dimKey, selectedValue, lastProgrammes);
    el.querySelector('#ex-drill-bridge-mechanisms')?.addEventListener('click', () => ctx.switchToMechanism(selectedValue));
  }

  function onSelect(value) {
    selectedValue = value;
    renderCategorySection();
    resultEl.querySelector('#ex-category-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function render(programmes) {
    lastProgrammes = programmes;
    kpisEl.innerHTML = kpiRowHTML(programmes);
    if (!state.dimKey) {
      measureGroup.hidden = true;
      viewAsGroup.hidden = true;
      resultEl.innerHTML = '';
      return;
    }
    selectedValue = null;
    const dist = distribution(programmes, state.dimKey, { measure: state.measure });
    const title = DIMENSIONS[state.dimKey].label;
    const viewOpts = viewAsOptions(state.dimKey);

    measureGroup.hidden = false;
    viewAsGroup.hidden = viewOpts.length === 0;
    if (viewOpts.length) {
      viewAsSel.innerHTML = viewOpts.map(([v, l]) => `<option value="${v}" ${v === state.chartType ? 'selected' : ''}>${l}</option>`).join('');
    }

    resultEl.innerHTML = `
      <div class="explore-chart-wrap" id="ex-chart-card"></div>
      <div class="category-section" id="ex-category-section" hidden></div>
    `;

    const cardRoot = resultEl.querySelector('#ex-chart-card');
    if (!dist.rows.length) {
      showEmptyChartState(cardRoot, 'No programmes with a value for this dimension match the current filters.');
      return;
    }

    const subtitle = [ctx.filtersSummaryText(), dist.multiSelect ? 'multi-select — shares may not sum to 100%' : null].filter(Boolean).join(' · ');
    const note = dist.missing ? `${dist.missing} programme(s) have no value for ${title} and are excluded above.` : '';

    cardRoot.classList.add('chart-card-feature');
    mountChartCard(cardRoot, {
      title: `${title} Distribution`, subtitle, note,
      buildChart: (el) => {
        if (state.chartType === 'donut' && viewOpts.length) {
          return renderDonutChart(el, { title: `${title} Distribution`, subtitle, data: dist.rows.map(r => ({ label: r.value, value: r.measureValue })), onSelect });
        }
        return renderHBarChart(el, {
          title: `${title} Distribution`, subtitle,
          rows: dist.rows.map(r => ({ label: r.value, value: r.measureValue, color: state.dimKey === 'mechanisms' ? mechanismSpectrumColor(r.value) : null })),
          valueLabel: (r) => state.measure === 'pct' ? fmtPct(r.value) : fmtNum(r.value),
          onSelect
        });
      },
      getTableData: () => ({
        headers: [title, measureLabel(state.measure), '% of Programmes', 'Companies'],
        rows: dist.rows.map(r => [r.value, state.measure === 'pct' ? Number(r.measureValue.toFixed(1)) : Math.round(r.measureValue), Number(r.pct.toFixed(1)), r.companies])
      }),
      filename: `${state.dimKey}-distribution`,
      saveTitle: title,
      onSave: async (name, takeaway) => {
        const row = await saveAnalysis({ name, lab: 'explore', config: { ...state, globalFilters: ctx.getGlobalFilters() } });
        if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
      }
    });

    showTipOnce(cardRoot, 'clickthrough', 'Tip: click any bar to see the full breakdown and its programmes below.');
    renderCategorySection();
  }

  dimSel.addEventListener('change', () => {
    state.dimKey = dimSel.value || null;
    ctx.persist(state);
    render(lastProgrammes);
  });

  function applyConfig(config) {
    if (config.dimKey) { state.dimKey = config.dimKey; dimSel.value = state.dimKey; }
    if (config.measure) state.measure = config.measure;
    if (config.chartType) state.chartType = config.chartType;
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  return { render, applyConfig, getConfig };
}
