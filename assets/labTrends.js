// My Laboratory — Trends workspace. "How has X evolved over launch year?" Relate
// already answers this today (pick Launch Year as either axis), but that's one option
// buried in an 11-item axis picker — this workspace is the same engine (timeSeries())
// with the time axis pinned and the Y dimension surfaced up front with one-click
// presets, so "how has Mechanisms/Industry/etc. evolved" is the very first thing you
// see rather than something you have to know to configure.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, timeSeries, programmesMatching } from './analysisData.js';
import { renderLineChart, renderBarChart, fmtNum } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

const Y_KEYS = ['mechanisms', 'industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'target_customer', 'country', 'access_registration'];
const PRESETS = ['mechanisms', 'industry', 'programme_positioning', 'membership_type'];
const CHART_TYPE_LABELS = { line: 'Line', area: 'Area', stackedArea: 'Stacked Area', bar: 'Bar', stackedBar: 'Stacked Bar', stacked100Bar: '100% Stacked Bar' };
const CHART_TYPES = ['line', 'area', 'stackedArea', 'bar', 'stackedBar', 'stacked100Bar'];

export function mount(container, ctx) {
  const state = { yKey: 'mechanisms', measure: 'count', chartType: 'line' };
  let lastProgrammes = [];

  container.innerHTML = `
    <div class="try-chips" id="tr-presets">
      <span class="try-chips-label">See evolve over time:</span>
      ${PRESETS.map(k => `<button type="button" class="try-chip" data-y="${k}">${escapeHtml(DIMENSIONS[k].label)}</button>`).join('')}
    </div>
    <div id="tr-result"></div>
  `;

  const resultEl = container.querySelector('#tr-result');

  container.querySelector('#tr-presets').querySelectorAll('.try-chip').forEach(btn => btn.addEventListener('click', () => {
    state.yKey = btn.dataset.y;
    ctx.persist(state);
    render(lastProgrammes);
  }));

  function openYearCell(year, seriesName) {
    const criteria = [{ dimKey: 'launch_year', value: Number(year) }, { dimKey: state.yKey, value: seriesName }];
    const subset = programmesMatching(lastProgrammes, criteria);
    openProgrammeListModal({ title: `${seriesName} · ${year}`, subtitle: `${DIMENSIONS[state.yKey].label} · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
  }

  function render(programmes) {
    lastProgrammes = programmes;
    const title = `${DIMENSIONS[state.yKey].label} over Time`;

    resultEl.innerHTML = `
      <div class="workspace-secondary-controls">
        <div class="control-group"><label>Show</label>
          <select class="control-select" id="tr-y">${Y_KEYS.map(k => `<option value="${k}" ${k === state.yKey ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}</select>
        </div>
        <div class="control-group"><label>Measure</label>
          <select class="control-select" id="tr-measure">
            <option value="count" ${state.measure === 'count' ? 'selected' : ''}>Number of Programmes</option>
            <option value="companies" ${state.measure === 'companies' ? 'selected' : ''}>Number of Companies</option>
          </select>
        </div>
        <div class="control-group"><label>View as…</label>
          <select class="control-select" id="tr-viewas">${CHART_TYPES.map(v => `<option value="${v}" ${v === state.chartType ? 'selected' : ''}>${CHART_TYPE_LABELS[v]}</option>`).join('')}</select>
        </div>
      </div>
      <div class="explore-chart-wrap" id="tr-chart-card"></div>
    `;

    resultEl.querySelector('#tr-y').addEventListener('change', (e) => { state.yKey = e.target.value; ctx.persist(state); render(lastProgrammes); });
    resultEl.querySelector('#tr-measure').addEventListener('change', (e) => { state.measure = e.target.value; ctx.persist(state); render(lastProgrammes); });
    resultEl.querySelector('#tr-viewas').addEventListener('change', (e) => { state.chartType = e.target.value; ctx.persist(state); render(lastProgrammes); });

    const cardRoot = resultEl.querySelector('#tr-chart-card');
    cardRoot.classList.add('chart-card-feature');
    const ts = timeSeries(programmes, { groupByKey: state.yKey, measure: state.measure });
    if (!ts.years.length) {
      showEmptyChartState(cardRoot, 'No programmes with a recorded launch year match the current filters.');
      return;
    }
    const subtitle = [ctx.filtersSummaryText(), ts.multiSelect ? 'multi-select — a programme can count toward more than one line in the same year' : null].filter(Boolean).join(' · ');
    const note = ts.missingLaunchYearCount ? `${fmtNum(ts.missingLaunchYearCount)} programme(s) have no recorded launch year and are excluded above.` : '';

    mountChartCard(cardRoot, {
      title, subtitle, note,
      buildChart: (el) => {
        if (['line', 'area', 'stackedArea'].includes(state.chartType)) {
          return renderLineChart(el, { title, subtitle, categories: ts.years, series: ts.series, mode: state.chartType, onSelect: openYearCell });
        }
        const mode = state.chartType === 'stackedBar' ? 'stacked' : state.chartType === 'stacked100Bar' ? 'percent' : 'grouped';
        return renderBarChart(el, { title, subtitle, categories: ts.years, series: ts.series, mode, onSelect: openYearCell });
      },
      getTableData: () => ({ headers: ['Launch Year', ...ts.series.map(s => s.name)], rows: ts.years.map((y, i) => [y, ...ts.series.map(s => Math.round(s.values[i]))]) }),
      filename: `${state.yKey}-over-time`,
      saveTitle: title,
      onSave: async (name, takeaway) => {
        const row = await saveAnalysis({ name, lab: 'trends', config: { ...state, globalFilters: ctx.getGlobalFilters() } });
        if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
      }
    });
  }

  function applyConfig(config) {
    if (config.yKey) state.yKey = config.yKey;
    if (config.measure) state.measure = config.measure;
    if (config.chartType) state.chartType = config.chartType;
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  return { render, applyConfig, getConfig };
}
