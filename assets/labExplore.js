// My Laboratory — Explore workspace. "What does the landscape look like along one
// dimension?" Consolidates the old Distribution Lab and the old standalone Mechanism
// Distribution card (Mechanism is just one more dimension here, nothing special).
// Reuses the existing engine verbatim: distribution(), categoryProfile().
import { escapeHtml } from './fields.js';
import { DIMENSIONS, distribution, categoryProfile } from './analysisData.js';
import { renderHBarChart, renderDonutChart, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal, showTipOnce } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

const DIM_KEYS = ['industry', 'sub_industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms'];
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

function barRow(profileRows) {
  const max = Math.max(...profileRows.map(r => r.pct), 1);
  return profileRows.map(r => `
    <div class="drilldown-bar-row">
      <span class="dbr-label" title="${escapeHtml(r.value)}">${escapeHtml(r.value)}</span>
      <span class="dbr-track"><span class="dbr-fill" style="width:${((r.pct / max) * 100).toFixed(1)}%"></span></span>
      <span class="dbr-pct">${fmtPct(r.pct)}</span>
    </div>
  `).join('') || '<div class="drilldown-empty">No data.</div>';
}

function renderDrilldown(el, dimKey, value, programmes, ctx) {
  if (!value) {
    el.innerHTML = '<div class="drilldown-empty">Click a category in the chart to inspect it here.</div>';
    return;
  }
  const profile = categoryProfile(programmes, dimKey, value);
  // Tiering is a mechanism like any other here — but a researcher who lands on it
  // from Explore is often really asking a tier-structure question, so offer a
  // natural bridge into the Tiers workspace rather than a special case in Explore.
  const isTieringBridge = dimKey === 'mechanisms' && value === 'Tiering';
  el.innerHTML = `
    <div class="drilldown-title">${escapeHtml(value)}</div>
    <button type="button" class="drill-count-link" id="drill-count-link">${fmtNum(profile.count)} programme${profile.count === 1 ? '' : 's'} →</button>
    ${isTieringBridge ? `<button type="button" class="drill-bridge-link" id="drill-bridge-tiers">→ Explore tier structure for these ${fmtNum(profile.count)} programmes</button>` : ''}
    <div class="drilldown-block"><div class="drilldown-block-label">Positioning</div>${barRow(profile.positioning.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Membership</div>${barRow(profile.membership.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Geographic Scope</div>${barRow(profile.geography.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Top Mechanisms <span class="drilldown-block-note">(multi-select)</span></div>${barRow(profile.topMechanisms)}</div>
  `;
  el.querySelector('#drill-count-link').addEventListener('click', () => {
    openProgrammeListModal({ title: value, subtitle: `${DIMENSIONS[dimKey].label} · ${fmtNum(profile.count)} programme(s)`, programmes: profile.subset });
  });
  const bridgeBtn = el.querySelector('#drill-bridge-tiers');
  if (bridgeBtn) bridgeBtn.addEventListener('click', () => ctx.switchTab('tiers'));
}

export function mount(container, ctx) {
  const state = { dimKey: null, measure: 'count', chartType: 'bar' };
  let lastProgrammes = [];
  let selectedValue = null;

  container.innerHTML = `
    <div class="workspace-prompt">
      <div class="workspace-prompt-label">What would you like to explore?</div>
      <select class="control-select control-select-lg" id="ex-dim">
        <option value="" disabled ${!state.dimKey ? 'selected' : ''}>Select a dimension…</option>
        ${DIM_KEYS.map(k => `<option value="${k}">${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}
      </select>
    </div>
    <div id="ex-result"></div>
  `;

  const dimSel = container.querySelector('#ex-dim');
  const resultEl = container.querySelector('#ex-result');

  function onSelect(value) {
    selectedValue = value;
    renderDrilldown(container.querySelector('#ex-drilldown'), state.dimKey, selectedValue, lastProgrammes, ctx);
  }

  function render(programmes) {
    lastProgrammes = programmes;
    if (!state.dimKey) {
      resultEl.innerHTML = '';
      return;
    }
    selectedValue = null;
    const dist = distribution(programmes, state.dimKey, { measure: state.measure });
    const title = DIMENSIONS[state.dimKey].label;
    const viewOpts = viewAsOptions(state.dimKey);

    resultEl.innerHTML = `
      <div class="workspace-secondary-controls">
        <div class="control-group"><label>Measure</label>
          <select class="control-select" id="ex-measure">${MEASURE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === state.measure ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        ${viewOpts.length ? `
        <div class="control-group"><label>View as…</label>
          <select class="control-select" id="ex-viewas">${viewOpts.map(([v, l]) => `<option value="${v}" ${v === state.chartType ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>` : ''}
      </div>
      <div class="workspace-columns">
        <div id="ex-chart-card"></div>
        <div class="drilldown-panel" id="ex-drilldown"><div class="drilldown-empty">Click a category in the chart to inspect it here.</div></div>
      </div>
    `;

    const measureSel = resultEl.querySelector('#ex-measure');
    measureSel.addEventListener('change', () => { state.measure = measureSel.value; render(lastProgrammes); });
    const viewAsSel = resultEl.querySelector('#ex-viewas');
    if (viewAsSel) viewAsSel.addEventListener('change', () => { state.chartType = viewAsSel.value; render(lastProgrammes); });

    const cardRoot = resultEl.querySelector('#ex-chart-card');
    if (!dist.rows.length) {
      showEmptyChartState(cardRoot, 'No programmes with a value for this dimension match the current filters.');
      renderDrilldown(resultEl.querySelector('#ex-drilldown'), state.dimKey, null, programmes, ctx);
      return;
    }

    const subtitle = [ctx.filtersSummaryText(), dist.multiSelect ? 'multi-select — shares may not sum to 100%' : null].filter(Boolean).join(' · ');
    const note = dist.missing ? `${dist.missing} programme(s) have no value for ${title} and are excluded above.` : '';

    mountChartCard(cardRoot, {
      title: `${title} Distribution`, subtitle, note,
      buildChart: (el) => {
        if (state.chartType === 'donut' && viewOpts.length) {
          return renderDonutChart(el, { title: `${title} Distribution`, subtitle, data: dist.rows.map(r => ({ label: r.value, value: r.measureValue })), onSelect });
        }
        return renderHBarChart(el, {
          title: `${title} Distribution`, subtitle,
          rows: dist.rows.map(r => ({ label: r.value, value: r.measureValue })),
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

    showTipOnce(cardRoot, 'clickthrough', 'Tip: click any bar to see the underlying programmes.');
    renderDrilldown(resultEl.querySelector('#ex-drilldown'), state.dimKey, null, programmes, ctx);
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
