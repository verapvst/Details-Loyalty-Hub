// Analysis tab — Cross-Analysis Lab (sections 13-17, 26): relationships between any
// two dimensions. Heatmap (Count / Row% / Column%) by default for categorical ×
// categorical; grouped/stacked/100% bar as alternatives; line/area/stacked-area when
// Launch Year is one of the axes (delegates to the same time-series logic as Launch
// Trends, since a "time" dimension needs per-year bucketing, not a static cross-tab).
import { escapeHtml } from './fields.js';
import { DIMENSIONS, crossTab, normaliseCell, timeSeries, programmesMatching } from './analysisData.js';
import { renderHeatmap, renderBarChart, renderLineChart, compatibleChartTypes, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis } from './analysisSaved.js';

const AXIS_KEYS = ['industry', 'sub_industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms', 'feature', 'launch_year'];
const CHART_TYPE_LABELS = { heatmap: 'Heatmap', groupedBar: 'Grouped Bar', stackedBar: 'Stacked Bar', stacked100Bar: '100% Stacked Bar', line: 'Line', area: 'Area', stackedArea: 'Stacked Area', bar: 'Bar' };

function isTime(key) { return DIMENSIONS[key].kind === 'time'; }

export function mount(container, ctx) {
  const state = { xKey: 'programme_positioning', yKey: 'industry', measure: 'count', chartType: 'heatmap', normalise: 'count' };
  let lastProgrammes = [];

  container.innerHTML = `
    <h3>Cross-Analysis</h3>
    <div class="control-row">
      <div class="control-group"><label>X-axis</label><select class="control-select" id="cx-x">${axisOptions(state.xKey)}</select></div>
      <div class="control-group"><label>Y-axis</label><select class="control-select" id="cx-y">${axisOptions(state.yKey)}</select></div>
      <div class="control-group"><label>Measure</label>
        <select class="control-select" id="cx-measure"><option value="count">Number of Programmes</option><option value="companies">Number of Companies</option></select>
      </div>
      <div class="control-group"><label>Chart Type</label><select class="control-select" id="cx-charttype"></select></div>
      <div class="control-group" id="cx-normalise-group"><label>Normalisation</label>
        <div class="control-toggle-group">
          <button type="button" class="control-toggle active" data-n="count">Count</button>
          <button type="button" class="control-toggle" data-n="row">Row %</button>
          <button type="button" class="control-toggle" data-n="col">Column %</button>
        </div>
      </div>
    </div>
    <div id="cx-chart-card"></div>
  `;

  function axisOptions(selected) {
    return AXIS_KEYS.map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('');
  }

  const xSel = container.querySelector('#cx-x');
  const ySel = container.querySelector('#cx-y');
  const measureSel = container.querySelector('#cx-measure');
  const typeSel = container.querySelector('#cx-charttype');
  const normaliseGroup = container.querySelector('#cx-normalise-group');

  function syncChartTypes() {
    const xKind = DIMENSIONS[state.xKey].kind === 'time' ? 'time' : 'categorical';
    const yKind = DIMENSIONS[state.yKey].kind === 'time' ? 'time' : 'categorical';
    const opts = compatibleChartTypes(xKind, yKind);
    const keep = opts.includes(state.chartType) ? state.chartType : opts[0];
    typeSel.innerHTML = opts.map(v => `<option value="${v}" ${v === keep ? 'selected' : ''}>${CHART_TYPE_LABELS[v]}</option>`).join('');
    state.chartType = keep;
    normaliseGroup.hidden = state.chartType !== 'heatmap';
  }
  syncChartTypes();

  function crossTitle() { return `${DIMENSIONS[state.yKey].label} × ${DIMENSIONS[state.xKey].label}`; }
  function measureLabel() { return state.measure === 'companies' ? 'Number of Companies' : 'Number of Programmes'; }
  function subtitleText(multiNote) {
    const parts = [ctx.filtersSummaryText(), measureLabel()];
    if (state.chartType === 'heatmap') parts.push(state.normalise === 'row' ? 'Row %' : state.normalise === 'col' ? 'Column %' : 'Count');
    if (multiNote) parts.push(multiNote);
    return parts.join(' · ');
  }

  // Every chart variant gets the same click-through: a mark always resolves to the
  // exact programmes it was drawn from, so it's never ambiguous what a number means.
  function openCellProgrammes(yValue, xValue, programmes) {
    const criteria = [{ dimKey: state.yKey, value: isTime(state.yKey) ? Number(yValue) : yValue }, { dimKey: state.xKey, value: isTime(state.xKey) ? Number(xValue) : xValue }];
    const subset = programmesMatching(programmes, criteria);
    openProgrammeListModal({ title: `${yValue} · ${xValue}`, subtitle: `${DIMENSIONS[state.yKey].label} × ${DIMENSIONS[state.xKey].label} · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
  }

  function buildChartInto(el, programmes) {
    if (isTime(state.xKey) || isTime(state.yKey)) {
      const groupKey = isTime(state.xKey) ? state.yKey : state.xKey;
      const ts = timeSeries(programmes, { groupByKey: groupKey, measure: state.measure === 'companies' ? 'companies' : 'count' });
      if (!ts.years.length) { showEmptyChartState(el, 'No programmes with a recorded launch year match the current filters.'); return null; }
      const spec = {
        title: crossTitle(), subtitle: subtitleText(ts.multiSelect ? 'multi-select — may exceed totals' : ''), categories: ts.years, series: ts.series,
        onSelect: (year, seriesName) => openCellProgrammes(isTime(state.yKey) ? year : seriesName, isTime(state.xKey) ? year : seriesName, programmes)
      };
      if (['line', 'area', 'stackedArea'].includes(state.chartType)) return renderLineChart(el, { ...spec, mode: state.chartType });
      const mode = state.chartType === 'stackedBar' ? 'stacked' : state.chartType === 'stacked100Bar' ? 'percent' : 'grouped';
      return renderBarChart(el, { ...spec, mode });
    }

    const table = crossTab(programmes, state.xKey, state.yKey, { measure: state.measure });
    if (!table.xValues.length || !table.yValues.length) { showEmptyChartState(el, 'Not enough data for this comparison — try different dimensions or clear a filter.'); return null; }
    const multiNote = (table.xMultiSelect || table.yMultiSelect) ? 'a multi-select axis is involved — its own row/column % stays independently correct' : '';

    if (state.chartType === 'heatmap') {
      return renderHeatmap(el, {
        title: crossTitle(), subtitle: subtitleText(multiNote),
        rows: table.yValues, cols: table.xValues,
        matrix: table.matrix.map((row, ri) => row.map((v, ci) => normaliseCell(v, ri, ci, table, state.normalise))),
        cellText: (v) => state.normalise === 'count' ? fmtNum(v) : fmtPct(v),
        colorMax: state.normalise === 'count' ? undefined : 100,
        onSelect: (yValue, xValue) => openCellProgrammes(yValue, xValue, programmes)
      });
    }
    const series = table.xValues.map((xv, ci) => ({ name: xv, values: table.yValues.map((yv, ri) => table.matrix[ri][ci]) }));
    const mode = state.chartType === 'stackedBar' ? 'stacked' : state.chartType === 'stacked100Bar' ? 'percent' : 'grouped';
    return renderBarChart(el, {
      title: crossTitle(), subtitle: subtitleText(multiNote), categories: table.yValues, series, mode,
      onSelect: (yValue, xValue) => openCellProgrammes(yValue, xValue, programmes)
    });
  }

  function getTableData(programmes) {
    if (isTime(state.xKey) || isTime(state.yKey)) {
      const groupKey = isTime(state.xKey) ? state.yKey : state.xKey;
      const ts = timeSeries(programmes, { groupByKey: groupKey, measure: state.measure === 'companies' ? 'companies' : 'count' });
      return { headers: ['Launch Year', ...ts.series.map(s => s.name)], rows: ts.years.map((y, i) => [y, ...ts.series.map(s => Math.round(s.values[i]))]) };
    }
    const table = crossTab(programmes, state.xKey, state.yKey, { measure: state.measure });
    const headers = [DIMENSIONS[state.yKey].label, ...table.xValues];
    const rows = table.yValues.map((y, ri) => [y, ...table.xValues.map((x, ci) => {
      const v = normaliseCell(table.matrix[ri][ci], ri, ci, table, state.chartType === 'heatmap' ? state.normalise : 'count');
      return state.chartType === 'heatmap' && state.normalise !== 'count' ? Number(v.toFixed(1)) : Math.round(v);
    })]);
    return { headers, rows };
  }

  function render(programmes) {
    lastProgrammes = programmes;
    mountChartCard(container.querySelector('#cx-chart-card'), {
      title: crossTitle(), subtitle: subtitleText(),
      buildChart: (el) => buildChartInto(el, programmes),
      getTableData: () => getTableData(programmes),
      filename: `${state.yKey}-x-${state.xKey}`,
      onSave: (name) => saveAnalysis({ name, lab: 'cross_analysis', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }

  [xSel, ySel, measureSel].forEach(sel => sel.addEventListener('change', () => {
    state.xKey = xSel.value; state.yKey = ySel.value; state.measure = measureSel.value;
    syncChartTypes();
    render(lastProgrammes);
  }));
  typeSel.addEventListener('change', () => { state.chartType = typeSel.value; normaliseGroup.hidden = state.chartType !== 'heatmap'; render(lastProgrammes); });
  normaliseGroup.querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.normalise = btn.dataset.n;
    normaliseGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b === btn));
    render(lastProgrammes);
  }));

  function applyConfig(config) {
    if (config.xKey) state.xKey = config.xKey;
    if (config.yKey) state.yKey = config.yKey;
    if (config.measure) state.measure = config.measure;
    xSel.value = state.xKey; ySel.value = state.yKey; measureSel.value = state.measure;
    syncChartTypes();
    if (config.chartType && typeSel.querySelector(`option[value="${config.chartType}"]`)) {
      state.chartType = config.chartType;
      typeSel.value = state.chartType;
      normaliseGroup.hidden = state.chartType !== 'heatmap';
    }
    if (config.normalise) {
      state.normalise = config.normalise;
      normaliseGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b.dataset.n === state.normalise));
    }
    render(lastProgrammes);
  }

  return { render, applyConfig };
}
