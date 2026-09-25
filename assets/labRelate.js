// My Laboratory — Relate workspace, the centerpiece. "How do two things relate?"
// Consolidates the old Cross-Analysis Lab, Launch Trends Lab, Mechanism × Industry and
// Mechanism Combinations into ONE engine call: crossTab() for categorical × categorical
// (including the same dimension on both axes, which is mechanism co-occurrence — no
// special case needed), timeSeries() when either axis is Launch Year (a trend is just
// what a two-dimension relationship looks like when one dimension is time).
import { escapeHtml } from './fields.js';
import { DIMENSIONS, crossTab, normaliseCell, timeSeries, programmesMatching } from './analysisData.js';
import { mechanismSpectrumColor } from './options.js';
import { renderHeatmap, renderBarChart, renderLineChart, compatibleChartTypes, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal, showTipOnce } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

const AXIS_KEYS = ['industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms', 'feature', 'launch_year'];
const CHART_TYPE_LABELS = { heatmap: 'Heatmap', groupedBar: 'Grouped Bar', stackedBar: 'Stacked Bar', stacked100Bar: '100% Stacked Bar', line: 'Line', area: 'Area', stackedArea: 'Stacked Area', bar: 'Bar' };
const DEFAULT_CHART_TYPE = { categorical: 'heatmap', time: 'line' };

const TRY_EXAMPLES = [
  { label: 'Industry × Positioning', xKey: 'programme_positioning', yKey: 'industry' },
  { label: 'Mechanism × Industry', xKey: 'mechanisms', yKey: 'industry' },
  { label: 'Mechanism × Mechanism', xKey: 'mechanisms', yKey: 'mechanisms' },
  { label: 'Membership × Launch Year', xKey: 'launch_year', yKey: 'membership_type' }
];

function isTime(key) { return DIMENSIONS[key].kind === 'time'; }
function kindOf(key) { return isTime(key) ? 'time' : 'categorical'; }

export function mount(container, ctx) {
  const state = { xKey: 'programme_positioning', yKey: 'industry', measure: 'count', chartType: 'heatmap', normalise: 'count' };
  let lastProgrammes = [];
  let hasInteracted = false;

  container.innerHTML = `
    <div class="relate-xy-row">
      <div class="control-group"><label>X</label><select class="control-select control-select-lg" id="re-x">${axisOptions(state.xKey)}</select></div>
      <div class="control-group"><label>Y</label><select class="control-select control-select-lg" id="re-y">${axisOptions(state.yKey)}</select></div>
    </div>
    <div id="re-try-chips"></div>
    <div id="re-result"></div>
  `;

  function axisOptions(selected) {
    return AXIS_KEYS.map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('');
  }

  const xSel = container.querySelector('#re-x');
  const ySel = container.querySelector('#re-y');
  const tryChipsEl = container.querySelector('#re-try-chips');
  const resultEl = container.querySelector('#re-result');

  function renderTryChips() {
    if (hasInteracted) { tryChipsEl.innerHTML = ''; return; }
    tryChipsEl.innerHTML = `
      <div class="try-chips">
        <span class="try-chips-label">Try:</span>
        ${TRY_EXAMPLES.map(ex => `<button type="button" class="try-chip" data-x="${ex.xKey}" data-y="${ex.yKey}">${escapeHtml(ex.label)}</button>`).join('')}
      </div>
    `;
    tryChipsEl.querySelectorAll('.try-chip').forEach(btn => btn.addEventListener('click', () => {
      state.xKey = btn.dataset.x; state.yKey = btn.dataset.y;
      xSel.value = state.xKey; ySel.value = state.yKey;
      markInteracted();
      syncChartTypeDefault();
      render(lastProgrammes);
    }));
  }

  function markInteracted() {
    if (hasInteracted) return;
    hasInteracted = true;
    renderTryChips();
  }

  // Chart type is a smart default, not a decision the user makes up front — "View
  // as…" only offers alternatives within the same family (grid vs. trend).
  function syncChartTypeDefault() {
    const kind = kindOf(state.xKey) === 'time' || kindOf(state.yKey) === 'time' ? 'time' : 'categorical';
    const opts = compatibleChartTypes(kindOf(state.xKey), kindOf(state.yKey));
    if (!opts.includes(state.chartType)) state.chartType = DEFAULT_CHART_TYPE[kind];
  }
  syncChartTypeDefault();

  function crossTitle() {
    if (isTime(state.xKey) || isTime(state.yKey)) {
      const otherKey = isTime(state.xKey) ? state.yKey : state.xKey;
      return `${DIMENSIONS[otherKey].label} over time`;
    }
    return `${DIMENSIONS[state.yKey].label} × ${DIMENSIONS[state.xKey].label}`;
  }
  function measureLabel() { return state.measure === 'companies' ? 'Number of Companies' : 'Number of Programmes'; }
  // Whether either chosen axis is multi-select — determines the whole note below.
  // Depends only on which dimensions are picked, not on the data, so it's safe to
  // call before the chart itself is built (e.g. for the chart-card's own header,
  // which is shown on screen and must not silently drop this warning).
  function isMultiSelectPair() { return DIMENSIONS[state.xKey].kind === 'multi' || DIMENSIONS[state.yKey].kind === 'multi'; }
  function multiSelectNote() {
    if (!isMultiSelectPair()) return '';
    return state.chartType === 'heatmap' ? 'multi-select axis — row/column % may exceed 100%' : 'multi-select axis — values may exceed totals';
  }
  function subtitleText(multiNote) {
    const parts = [ctx.filtersSummaryText(), measureLabel()];
    if (state.chartType === 'heatmap') parts.push(state.normalise === 'row' ? 'Row %' : state.normalise === 'col' ? 'Column %' : 'Count');
    if (multiNote) parts.push(multiNote);
    return parts.join(' · ');
  }

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
        title: crossTitle(), subtitle: subtitleText(multiSelectNote()), categories: ts.years, series: ts.series,
        onSelect: (year, seriesName) => openCellProgrammes(isTime(state.yKey) ? year : seriesName, isTime(state.xKey) ? year : seriesName, programmes)
      };
      if (['line', 'area', 'stackedArea'].includes(state.chartType)) return renderLineChart(el, { ...spec, mode: state.chartType });
      const mode = state.chartType === 'stackedBar' ? 'stacked' : state.chartType === 'stacked100Bar' ? 'percent' : 'grouped';
      return renderBarChart(el, { ...spec, mode });
    }

    const table = crossTab(programmes, state.xKey, state.yKey, { measure: state.measure });
    if (!table.xValues.length || !table.yValues.length) { showEmptyChartState(el, 'Not enough data for this comparison — try different dimensions or clear a filter.'); return null; }

    if (state.chartType === 'heatmap') {
      return renderHeatmap(el, {
            labelColor: mechanismSpectrumColor,
        title: crossTitle(), subtitle: subtitleText(multiSelectNote()),
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
      title: crossTitle(), subtitle: subtitleText(multiSelectNote()), categories: table.yValues, series, mode,
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

  function maybeShowMechanismTip(cardRoot) {
    const xIsMech = state.xKey === 'mechanisms', yIsMech = state.yKey === 'mechanisms';
    if (xIsMech && yIsMech) showTipOnce(cardRoot, 'mechanism-both', 'Tip: Mechanism × Mechanism shows which mechanics tend to appear together.');
    else if (xIsMech || yIsMech) showTipOnce(cardRoot, 'mechanism-single', 'Tip: compare Mechanism with another dimension to see where mechanics are concentrated.');
  }

  function render(programmes) {
    lastProgrammes = programmes;
    const isTimeChart = isTime(state.xKey) || isTime(state.yKey);
    const viewOpts = compatibleChartTypes(kindOf(state.xKey), kindOf(state.yKey));

    resultEl.innerHTML = `
      <div class="workspace-secondary-controls">
        <div class="control-group"><label>Measure</label>
          <select class="control-select" id="re-measure"><option value="count" ${state.measure === 'count' ? 'selected' : ''}>Number of Programmes</option><option value="companies" ${state.measure === 'companies' ? 'selected' : ''}>Number of Companies</option></select>
        </div>
        <div class="control-group"><label>View as…</label>
          <select class="control-select" id="re-viewas">${viewOpts.map(v => `<option value="${v}" ${v === state.chartType ? 'selected' : ''}>${CHART_TYPE_LABELS[v]}</option>`).join('')}</select>
        </div>
        ${!isTimeChart ? `
        <div class="control-group" id="re-normalise-group" ${state.chartType !== 'heatmap' ? 'hidden' : ''}><label>Normalisation</label>
          <div class="control-toggle-group">
            <button type="button" class="control-toggle ${state.normalise === 'count' ? 'active' : ''}" data-n="count">Count</button>
            <button type="button" class="control-toggle ${state.normalise === 'row' ? 'active' : ''}" data-n="row">Row %</button>
            <button type="button" class="control-toggle ${state.normalise === 'col' ? 'active' : ''}" data-n="col">Column %</button>
          </div>
        </div>` : ''}
      </div>
      <div id="re-chart-card"></div>
    `;

    resultEl.querySelector('#re-measure').addEventListener('change', (e) => { state.measure = e.target.value; ctx.persist(state); render(lastProgrammes); });
    resultEl.querySelector('#re-viewas').addEventListener('change', (e) => {
      state.chartType = e.target.value;
      const grp = resultEl.querySelector('#re-normalise-group');
      if (grp) grp.hidden = state.chartType !== 'heatmap';
      ctx.persist(state);
      render(lastProgrammes);
    });
    const normaliseGroup = resultEl.querySelector('#re-normalise-group');
    if (normaliseGroup) normaliseGroup.querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
      state.normalise = btn.dataset.n;
      normaliseGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b === btn));
      ctx.persist(state);
      render(lastProgrammes);
    }));

    const cardRoot = resultEl.querySelector('#re-chart-card');
    mountChartCard(cardRoot, {
      title: crossTitle(), subtitle: subtitleText(multiSelectNote()),
      buildChart: (el) => buildChartInto(el, programmes),
      getTableData: () => getTableData(programmes),
      filename: `${state.yKey}-x-${state.xKey}`,
      saveTitle: crossTitle(),
      onSave: async (name, takeaway) => {
        const row = await saveAnalysis({ name, lab: 'relate', config: { ...state, globalFilters: ctx.getGlobalFilters() } });
        if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
      }
    });
    maybeShowMechanismTip(cardRoot);
  }

  [xSel, ySel].forEach(sel => sel.addEventListener('change', () => {
    state.xKey = xSel.value; state.yKey = ySel.value;
    markInteracted();
    syncChartTypeDefault();
    ctx.persist(state);
    render(lastProgrammes);
  }));

  function applyConfig(config) {
    if (config.xKey) state.xKey = config.xKey;
    if (config.yKey) state.yKey = config.yKey;
    if (config.measure) state.measure = config.measure;
    if (config.normalise) state.normalise = config.normalise;
    xSel.value = state.xKey; ySel.value = state.yKey;
    markInteracted();
    if (config.chartType) state.chartType = config.chartType; else syncChartTypeDefault();
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  renderTryChips();
  return { render, applyConfig, getConfig };
}
