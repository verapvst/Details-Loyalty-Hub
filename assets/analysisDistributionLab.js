// Analysis tab — Programme Landscape / Distribution Lab + Category Profile drill-down
// (sections 11-12). Click any bar/donut slice (or a row in View Data) to inspect that
// one category: its positioning, membership, geography and top-mechanism composition.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, distribution, categoryProfile } from './analysisData.js';
import { renderHBarChart, renderDonutChart, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis } from './analysisSaved.js';

// Mechanisms included here too (not just in the dedicated Mechanics Lab) so any
// dimension can be inspected from one place — but see chartTypesFor() below: a
// donut/pie visually implies parts of a whole (100%), which is only true for a
// single-select dimension. Mechanisms/Geographic Scope/Target Customer are
// multi-select (a programme can have several), so Donut is not offered for them —
// Horizontal Bar is, since it doesn't carry that "sums to 100%" implication.
const DIST_KEYS = ['industry', 'sub_industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms'];
const MEASURE_OPTIONS = [['count', 'Number of Programmes'], ['pct', '% of Programmes'], ['companies', 'Number of Companies']];

function chartTypesFor(dimKey) {
  return DIMENSIONS[dimKey].kind === 'multi' ? [['bar', 'Horizontal Bar']] : [['bar', 'Horizontal Bar'], ['donut', 'Donut']];
}

function measureLabel(measure) {
  return measure === 'pct' ? '% of Programmes' : measure === 'companies' ? 'Number of Companies' : 'Number of Programmes';
}

function barRow(profileRows, valueSuffix) {
  const max = Math.max(...profileRows.map(r => r.pct), 1);
  return profileRows.map(r => `
    <div class="drilldown-bar-row">
      <span class="dbr-label" title="${escapeHtml(r.value)}">${escapeHtml(r.value)}</span>
      <span class="dbr-track"><span class="dbr-fill" style="width:${((r.pct / max) * 100).toFixed(1)}%"></span></span>
      <span class="dbr-pct">${fmtPct(r.pct)}</span>
    </div>
  `).join('') || '<div class="drilldown-empty">No data.</div>';
}

function renderDrilldown(el, dimKey, value, programmes) {
  if (!value) {
    el.innerHTML = '<div class="drilldown-empty">Click a category in the chart, or a row in View Data, to inspect it here.</div>';
    return;
  }
  const profile = categoryProfile(programmes, dimKey, value);
  el.innerHTML = `
    <div class="drilldown-head-row">
      <div>
        <div class="drilldown-title">${escapeHtml(value)}</div>
        <div class="drilldown-count">${fmtNum(profile.count)} programme(s) — ${DIMENSIONS[dimKey].label}</div>
      </div>
      <button type="button" class="btn-text" id="drilldown-view-list">View programmes</button>
    </div>
    <div class="drilldown-block"><div class="drilldown-block-label">Positioning</div>${barRow(profile.positioning.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Membership</div>${barRow(profile.membership.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Geographic Scope</div>${barRow(profile.geography.rows)}</div>
    <div class="drilldown-block"><div class="drilldown-block-label">Top Mechanisms <span style="font-weight:400; text-transform:none; letter-spacing:0;">(multi-select)</span></div>${barRow(profile.topMechanisms)}</div>
  `;
  el.querySelector('#drilldown-view-list').addEventListener('click', () => {
    openProgrammeListModal({ title: value, subtitle: `${DIMENSIONS[dimKey].label} · ${fmtNum(profile.count)} programme(s)`, programmes: profile.subset });
  });
}

export function mount(container, ctx) {
  const state = { dimKey: 'industry', chartType: 'bar', measure: 'count' };
  let lastProgrammes = [];
  let selectedValue = null;

  container.innerHTML = `
    <h3>Programme Landscape</h3>
    <div class="control-row">
      <div class="control-group"><label>Dimension</label>
        <select class="control-select" id="dist-dim">${DIST_KEYS.map(k => `<option value="${k}" ${k === state.dimKey ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}</select>
      </div>
      <div class="control-group"><label>Chart Type</label>
        <select class="control-select" id="dist-charttype"></select>
      </div>
      <div class="control-group"><label>Measure</label>
        <select class="control-select" id="dist-measure">${MEASURE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === state.measure ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="lab-grid-2">
      <div id="dist-chart-card"></div>
      <div class="drilldown-panel" id="dist-drilldown"><div class="drilldown-empty">Click a category in the chart, or a row in View Data, to inspect it here.</div></div>
    </div>
  `;

  const dimSel = container.querySelector('#dist-dim');
  const typeSel = container.querySelector('#dist-charttype');
  const measureSel = container.querySelector('#dist-measure');
  const drillEl = container.querySelector('#dist-drilldown');

  function syncChartTypeOptions() {
    const opts = chartTypesFor(state.dimKey);
    const keep = opts.some(([v]) => v === state.chartType) ? state.chartType : opts[0][0];
    typeSel.innerHTML = opts.map(([v, l]) => `<option value="${v}" ${v === keep ? 'selected' : ''}>${l}</option>`).join('');
    state.chartType = keep;
  }
  syncChartTypeOptions();

  function subtitleText(dist) {
    const parts = [ctx.filtersSummaryText()];
    if (dist.multiSelect) parts.push('multi-select — shares may not sum to 100%');
    return parts.join(' · ');
  }

  function onSelect(value) {
    selectedValue = value;
    renderDrilldown(drillEl, state.dimKey, selectedValue, lastProgrammes);
  }

  function render(programmes) {
    lastProgrammes = programmes;
    selectedValue = null;
    const dist = distribution(programmes, state.dimKey, { measure: state.measure });
    const cardRoot = container.querySelector('#dist-chart-card');
    if (!dist.rows.length) {
      showEmptyChartState(cardRoot, 'No programmes with a value for this dimension match the current filters.');
      renderDrilldown(drillEl, state.dimKey, null, programmes);
      return;
    }

    const title = `${DIMENSIONS[state.dimKey].label} Distribution`;
    const note = dist.missing ? `${dist.missing} programme(s) have no value for ${DIMENSIONS[state.dimKey].label} and are excluded above.` : '';

    mountChartCard(cardRoot, {
      title, subtitle: subtitleText(dist), note,
      buildChart: (el) => {
        if (state.chartType === 'donut') {
          return renderDonutChart(el, {
            title, subtitle: subtitleText(dist),
            data: dist.rows.map(r => ({ label: r.value, value: r.measureValue })),
            onSelect
          });
        }
        return renderHBarChart(el, {
          title, subtitle: subtitleText(dist),
          rows: dist.rows.map(r => ({ label: r.value, value: r.measureValue })),
          valueLabel: (r) => state.measure === 'pct' ? fmtPct(r.value) : fmtNum(r.value),
          onSelect
        });
      },
      getTableData: () => ({
        headers: [DIMENSIONS[state.dimKey].label, measureLabel(state.measure), '% of Programmes', 'Companies'],
        rows: dist.rows.map(r => [r.value, state.measure === 'pct' ? Number(r.measureValue.toFixed(1)) : Math.round(r.measureValue), Number(r.pct.toFixed(1)), r.companies])
      }),
      filename: `${state.dimKey}-distribution`,
      onSave: (name) => saveAnalysis({ name, lab: 'distribution', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });

    renderDrilldown(drillEl, state.dimKey, null, programmes);
  }

  dimSel.addEventListener('change', () => {
    state.dimKey = dimSel.value;
    syncChartTypeOptions();
    render(lastProgrammes);
  });
  [typeSel, measureSel].forEach(sel => sel.addEventListener('change', () => {
    state.chartType = typeSel.value; state.measure = measureSel.value;
    render(lastProgrammes);
  }));

  function applyConfig(config) {
    if (config.dimKey) state.dimKey = config.dimKey;
    if (config.measure) state.measure = config.measure;
    dimSel.value = state.dimKey; measureSel.value = state.measure;
    syncChartTypeOptions();
    if (config.chartType && typeSel.querySelector(`option[value="${config.chartType}"]`)) {
      state.chartType = config.chartType;
      typeSel.value = state.chartType;
    }
    render(lastProgrammes);
  }

  return { render, applyConfig };
}
