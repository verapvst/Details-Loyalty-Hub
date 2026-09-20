// Analysis tab — Launch Trends Lab (sections 6-9). Fully configurable time-series:
// measure, group-by (any dimension, multi-select-aware), chart type — gated so
// nonsensical combinations (e.g. "% of Programmes" + 100% Stacked, which would
// double-normalize) are never offered.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, timeSeries, programmesMatching } from './analysisData.js';
import { renderBarChart, renderLineChart, fmtNum } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis } from './analysisSaved.js';

const GROUP_BY_KEYS = ['industry', 'sub_industry', 'programme_positioning', 'membership_type', 'geographic_scope', 'country', 'target_customer', 'access_registration', 'mechanisms', 'feature'];
const MEASURE_OPTIONS = [['count', 'Number of Programmes'], ['pct', '% of Programmes'], ['companies', 'Number of Companies']];
const ALL_CHART_TYPES = [['line', 'Line'], ['area', 'Area'], ['stackedArea', 'Stacked Area'], ['bar', 'Bar'], ['stackedBar', 'Stacked Bar'], ['stacked100Bar', '100% Stacked Bar']];
const SIMPLE_CHART_TYPES = [['line', 'Line'], ['area', 'Area'], ['bar', 'Bar']];

function availableChartTypes(measure, groupBy) {
  if (groupBy === 'none' || measure === 'pct') return SIMPLE_CHART_TYPES;
  return ALL_CHART_TYPES;
}

function roundForTable(v, measure) {
  return measure === 'count' || measure === 'companies' ? Math.round(v) : Number(v.toFixed(1));
}

export function mount(container, ctx) {
  const state = { groupBy: 'programme_positioning', measure: 'count', chartType: 'line' };
  let lastProgrammes = [];

  container.innerHTML = `
    <h3>Launch Trends</h3>
    <div class="control-row">
      <div class="control-group"><label>Y-axis / Measure</label>
        <select class="control-select" id="lt-measure">${MEASURE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === state.measure ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="control-group"><label>Group By</label>
        <select class="control-select" id="lt-groupby">
          <option value="none">None</option>
          ${GROUP_BY_KEYS.map(k => `<option value="${k}" ${k === state.groupBy ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}
        </select>
      </div>
      <div class="control-group"><label>Chart Type</label><select class="control-select" id="lt-charttype"></select></div>
    </div>
    <div id="lt-chart-card"></div>
  `;

  const groupBySel = container.querySelector('#lt-groupby');
  const measureSel = container.querySelector('#lt-measure');
  const chartTypeSel = container.querySelector('#lt-charttype');

  function syncChartTypeOptions() {
    const opts = availableChartTypes(state.measure, state.groupBy);
    const keep = opts.some(([v]) => v === state.chartType) ? state.chartType : opts[0][0];
    chartTypeSel.innerHTML = opts.map(([v, l]) => `<option value="${v}" ${v === keep ? 'selected' : ''}>${l}</option>`).join('');
    state.chartType = keep;
  }
  syncChartTypeOptions();

  function subtitleText(ts) {
    const parts = [ctx.filtersSummaryText()];
    if (state.groupBy !== 'none') parts.push(`grouped by ${DIMENSIONS[state.groupBy].label}`);
    if (ts.multiSelect) parts.push('multi-select — shares may not sum to 100%');
    return parts.join(' · ');
  }

  function openYearProgrammes(year, seriesName, programmes) {
    const criteria = [{ dimKey: 'launch_year', value: Number(year) }];
    if (state.groupBy !== 'none') criteria.push({ dimKey: state.groupBy, value: seriesName });
    const subset = programmesMatching(programmes, criteria);
    openProgrammeListModal({
      title: state.groupBy !== 'none' ? `${year} · ${seriesName}` : String(year),
      subtitle: `Launched in ${year} · ${fmtNum(subset.length)} programme(s)`,
      programmes: subset
    });
  }

  function buildChartInto(el, ts, programmes) {
    const spec = {
      title: 'Launch Trends', subtitle: subtitleText(ts), categories: ts.years, series: ts.series,
      onSelect: (year, seriesName) => openYearProgrammes(year, seriesName, programmes)
    };
    if (['line', 'area', 'stackedArea'].includes(state.chartType)) {
      return renderLineChart(el, { ...spec, mode: state.chartType });
    }
    const mode = state.chartType === 'stackedBar' ? 'stacked' : state.chartType === 'stacked100Bar' ? 'percent' : 'grouped';
    return renderBarChart(el, { ...spec, mode });
  }

  function render(programmes) {
    lastProgrammes = programmes;
    const ts = timeSeries(programmes, { groupByKey: state.groupBy, measure: state.measure });
    const cardRoot = container.querySelector('#lt-chart-card');
    if (!ts.years.length) {
      showEmptyChartState(cardRoot, 'No programmes with a recorded launch year match the current filters.');
      return;
    }
    mountChartCard(cardRoot, {
      title: 'Launch Trends',
      subtitle: subtitleText(ts),
      note: ts.missingLaunchYearCount ? `${ts.missingLaunchYearCount} programme(s) have no recorded launch year and are excluded from this chart.` : '',
      buildChart: (el) => buildChartInto(el, ts, programmes),
      getTableData: () => ({
        headers: ['Launch Year', ...ts.series.map(s => s.name)],
        rows: ts.years.map((y, i) => [y, ...ts.series.map(s => roundForTable(s.values[i], state.measure))])
      }),
      filename: 'launch-trends',
      onSave: (name) => saveAnalysis({ name, lab: 'launch_trends', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }

  [groupBySel, measureSel].forEach(sel => sel.addEventListener('change', () => {
    state.groupBy = groupBySel.value;
    state.measure = measureSel.value;
    syncChartTypeOptions();
    render(lastProgrammes);
  }));
  chartTypeSel.addEventListener('change', () => { state.chartType = chartTypeSel.value; render(lastProgrammes); });

  function applyConfig(config) {
    if (config.groupBy) state.groupBy = config.groupBy;
    if (config.measure) state.measure = config.measure;
    groupBySel.value = state.groupBy;
    measureSel.value = state.measure;
    syncChartTypeOptions();
    if (config.chartType && chartTypeSel.querySelector(`option[value="${config.chartType}"]`)) {
      state.chartType = config.chartType;
      chartTypeSel.value = state.chartType;
    }
    render(lastProgrammes);
  }

  return { render, applyConfig };
}
