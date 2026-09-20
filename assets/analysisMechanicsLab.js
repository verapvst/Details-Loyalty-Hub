// Analysis tab — Mechanics Lab (sections 19-21): mechanism distribution, Mechanism ×
// Industry, and mechanism co-occurrence. Mechanisms are multi-select throughout — every
// chart here is explicitly labeled as such, and percentages are allowed to exceed 100%.
import { distribution, crossTab, normaliseCell, mechanismCooccurrence } from './analysisData.js';
import { renderHBarChart, renderHeatmap, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState } from './chartToolbar.js';
import { saveAnalysis } from './analysisSaved.js';

function distributionCard(container, ctx) {
  const state = { measure: 'count' };
  container.innerHTML = `
    <h3>Mechanism Distribution</h3>
    <div class="control-row">
      <div class="control-group"><label>Measure</label>
        <select class="control-select" id="mech-measure"><option value="count">Number of Programmes</option><option value="pct">% of Programmes</option></select>
      </div>
    </div>
    <div id="mech-dist-card"></div>
  `;
  const sel = container.querySelector('#mech-measure');
  let lastProgrammes = [];

  function render(programmes) {
    lastProgrammes = programmes;
    const dist = distribution(programmes, 'mechanisms', { measure: state.measure });
    const cardRoot = container.querySelector('#mech-dist-card');
    if (!dist.rows.length) { showEmptyChartState(cardRoot, 'No mechanisms recorded for the current filters.'); return; }
    const subtitle = `${ctx.filtersSummaryText()} · multi-select, non-exclusive — shares don't need to sum to 100%`;
    mountChartCard(cardRoot, {
      title: 'Mechanism Distribution', subtitle,
      buildChart: (el) => renderHBarChart(el, {
        title: 'Mechanism Distribution', subtitle,
        rows: dist.rows.map(r => ({ label: r.value, value: r.measureValue })),
        valueLabel: (r) => state.measure === 'pct' ? fmtPct(r.value) : fmtNum(r.value)
      }),
      getTableData: () => ({
        headers: ['Mechanism', 'Number of Programmes', '% of Programmes'],
        rows: dist.rows.map(r => [r.value, r.count, Number(r.pct.toFixed(1))])
      }),
      filename: 'mechanism-distribution',
      onSave: (name) => saveAnalysis({ name, lab: 'mechanics_distribution', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }
  sel.addEventListener('change', () => { state.measure = sel.value; render(lastProgrammes); });
  function applyConfig(config) { if (config.measure) { state.measure = config.measure; sel.value = state.measure; } render(lastProgrammes); }
  return { render, applyConfig };
}

function industryCard(container, ctx) {
  const state = { normalise: 'count' };
  container.innerHTML = `
    <h3>Mechanism × Industry</h3>
    <div class="control-row">
      <div class="control-group"><label>Normalisation</label>
        <div class="control-toggle-group">
          <button type="button" class="control-toggle active" data-n="count">Count</button>
          <button type="button" class="control-toggle" data-n="row">Row %</button>
          <button type="button" class="control-toggle" data-n="col">Column %</button>
        </div>
      </div>
    </div>
    <div id="mech-ind-card"></div>
  `;
  const toggleGroup = container.querySelector('.control-toggle-group');
  let lastProgrammes = [];

  function render(programmes) {
    lastProgrammes = programmes;
    const table = crossTab(programmes, 'mechanisms', 'industry', { measure: 'count' });
    const cardRoot = container.querySelector('#mech-ind-card');
    if (!table.xValues.length || !table.yValues.length) { showEmptyChartState(cardRoot, 'Not enough data for this comparison.'); return; }
    const subtitle = `${ctx.filtersSummaryText()} · rows = Industry, columns = Mechanism (multi-select) · ${state.normalise === 'row' ? 'Row %' : state.normalise === 'col' ? 'Column %' : 'Count'}`;
    mountChartCard(cardRoot, {
      title: 'Mechanism × Industry', subtitle,
      buildChart: (el) => renderHeatmap(el, {
        title: 'Mechanism × Industry', subtitle,
        rows: table.yValues, cols: table.xValues,
        matrix: table.matrix.map((row, ri) => row.map((v, ci) => normaliseCell(v, ri, ci, table, state.normalise))),
        cellText: (v) => state.normalise === 'count' ? fmtNum(v) : fmtPct(v),
        colorMax: state.normalise === 'count' ? undefined : 100
      }),
      getTableData: () => ({
        headers: ['Industry', ...table.xValues],
        rows: table.yValues.map((y, ri) => [y, ...table.xValues.map((x, ci) => {
          const v = normaliseCell(table.matrix[ri][ci], ri, ci, table, state.normalise);
          return state.normalise === 'count' ? v : Number(v.toFixed(1));
        })])
      }),
      filename: 'mechanism-x-industry',
      onSave: (name) => saveAnalysis({ name, lab: 'mechanics_industry', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }
  toggleGroup.querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.normalise = btn.dataset.n;
    toggleGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b === btn));
    render(lastProgrammes);
  }));
  function applyConfig(config) {
    if (config.normalise) {
      state.normalise = config.normalise;
      toggleGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b.dataset.n === state.normalise));
    }
    render(lastProgrammes);
  }
  return { render, applyConfig };
}

function cooccurrenceCard(container, ctx) {
  const state = { mode: 'count' };
  container.innerHTML = `
    <h3>Mechanism Combinations</h3>
    <p class="lab-section-subtitle" style="margin: -6px 0 14px;">For every pair of mechanisms, how many programmes use both — the row mechanism's own total sits on the diagonal.</p>
    <div class="control-row">
      <div class="control-group"><label>Display</label>
        <div class="control-toggle-group">
          <button type="button" class="control-toggle active" data-m="count">Count</button>
          <button type="button" class="control-toggle" data-m="rowpct">% of row mechanism</button>
        </div>
      </div>
    </div>
    <div id="mech-cooc-card"></div>
  `;
  const toggleGroup = container.querySelector('.control-toggle-group');
  let lastProgrammes = [];

  function render(programmes) {
    lastProgrammes = programmes;
    const co = mechanismCooccurrence(programmes);
    const cardRoot = container.querySelector('#mech-cooc-card');
    if (!co.mechanisms.length) { showEmptyChartState(cardRoot, 'No mechanisms recorded for the current filters.'); return; }
    const subtitle = `${ctx.filtersSummaryText()} · ${state.mode === 'count' ? 'Number of programmes with both mechanisms' : '% of the row mechanism’s programmes that also have the column mechanism'}`;
    const displayMatrix = co.matrix.map((row, ri) => row.map((v) => {
      if (state.mode === 'count') return v;
      const rowTotal = co.singleCounts.get(co.mechanisms[ri]) || 0;
      return rowTotal ? (v / rowTotal) * 100 : 0;
    }));
    mountChartCard(cardRoot, {
      title: 'Mechanism Combinations', subtitle,
      buildChart: (el) => renderHeatmap(el, {
        title: 'Mechanism Combinations', subtitle,
        rows: co.mechanisms, cols: co.mechanisms, matrix: displayMatrix,
        cellText: (v) => state.mode === 'count' ? fmtNum(v) : fmtPct(v),
        colorMax: state.mode === 'count' ? undefined : 100
      }),
      getTableData: () => ({
        headers: ['Mechanism', ...co.mechanisms],
        rows: co.mechanisms.map((m, ri) => [m, ...displayMatrix[ri].map(v => state.mode === 'count' ? v : Number(v.toFixed(1)))])
      }),
      filename: 'mechanism-combinations',
      onSave: (name) => saveAnalysis({ name, lab: 'mechanics_cooccurrence', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }
  toggleGroup.querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.mode = btn.dataset.m;
    toggleGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b === btn));
    render(lastProgrammes);
  }));
  function applyConfig(config) {
    if (config.mode) {
      state.mode = config.mode;
      toggleGroup.querySelectorAll('.control-toggle').forEach(b => b.classList.toggle('active', b.dataset.m === state.mode));
    }
    render(lastProgrammes);
  }
  return { render, applyConfig };
}

export function mount(container, ctx) {
  container.innerHTML = `
    <div class="lab-card" id="mech-card-1"></div>
    <div class="lab-card" id="mech-card-2"></div>
    <div class="lab-card" id="mech-card-3"></div>
  `;
  const dist = distributionCard(container.querySelector('#mech-card-1'), ctx);
  const industry = industryCard(container.querySelector('#mech-card-2'), ctx);
  const cooc = cooccurrenceCard(container.querySelector('#mech-card-3'), ctx);
  const subLabs = { mechanics_distribution: dist, mechanics_industry: industry, mechanics_cooccurrence: cooc };

  const render = (programmes) => { dist.render(programmes); industry.render(programmes); cooc.render(programmes); };
  const applyConfig = (config) => { (subLabs[config.lab] || dist).applyConfig(config); };
  return { render, applyConfig };
}
