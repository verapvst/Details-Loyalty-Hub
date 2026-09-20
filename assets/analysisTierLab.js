// Analysis tab — Tier Lab (sections 22-25). programme_tiers already stores real
// per-tier structure (fee + qualification amount/unit), so this ships as CURRENT
// analysis, not a "once we have the data" placeholder — but every average/jump is
// scoped to the programmes that actually have tier rows recorded, and qualification
// units/currencies are never diffed against each other.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, tierOverview, tieringByDimension, tierJumps } from './analysisData.js';
import { renderHBarChart, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState } from './chartToolbar.js';
import { saveAnalysis } from './analysisSaved.js';

const TIERING_BY_KEYS = ['industry', 'programme_positioning', 'membership_type', 'geographic_scope'];

function overviewCard(container, ctx) {
  let lastProgrammes = [];
  container.innerHTML = `<h3>Tiered Programmes</h3><div id="tier-ov-stats"></div><div id="tier-ov-card"></div>`;

  function render(programmes) {
    lastProgrammes = programmes;
    const ov = tierOverview(programmes);
    container.querySelector('#tier-ov-stats').innerHTML = `
      <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); margin-bottom: 18px;">
        <div class="kpi-item"><div class="kpi-label">Tiered</div><div class="kpi-value">${fmtPct(ov.tieredPct)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Programmes</div><div class="kpi-value">${fmtNum(ov.tieredCount)} / ${fmtNum(ov.total)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Avg Tiers</div><div class="kpi-value">${ov.avgTiers == null ? '—' : ov.avgTiers.toFixed(1)}</div></div>
        <div class="kpi-item"><div class="kpi-label">Median Tiers</div><div class="kpi-value">${ov.medianTiers == null ? '—' : ov.medianTiers}</div></div>
      </div>
    `;
    const cardRoot = container.querySelector('#tier-ov-card');
    const distRows = ov.distribution.filter(d => d.count > 0);
    if (!distRows.length) {
      showEmptyChartState(cardRoot, 'No programmes with tier structure recorded match the current filters.');
      return;
    }
    const subtitle = `${ctx.filtersSummaryText()} · based on the ${fmtNum(ov.withStructureCount)} programme(s) with tier structure recorded`;
    mountChartCard(cardRoot, {
      title: 'Tier Count Distribution', subtitle,
      note: `${fmtNum(ov.total - ov.withStructureCount)} programme(s) have no tier structure recorded (they may still use the Tiering mechanism without a documented structure).`,
      buildChart: (el) => renderHBarChart(el, { title: 'Tier Count Distribution', subtitle, rows: distRows.map(d => ({ label: `${d.bucket} tier${d.bucket === '1' ? '' : 's'}`, value: d.count })) }),
      getTableData: () => ({ headers: ['Number of Tiers', 'Programmes'], rows: distRows.map(d => [d.bucket, d.count]) }),
      filename: 'tier-count-distribution',
      onSave: (name) => saveAnalysis({ name, lab: 'tier_overview', config: { globalFilters: ctx.getGlobalFilters() } })
    });
  }
  function applyConfig() { render(lastProgrammes); }
  return { render, applyConfig };
}

function tieringByCard(container, ctx) {
  const state = { dimKey: 'industry' };
  container.innerHTML = `
    <h3>Tiering by Category</h3>
    <div class="control-row">
      <div class="control-group"><label>Dimension</label>
        <select class="control-select" id="tier-by-dim">${TIERING_BY_KEYS.map(k => `<option value="${k}" ${k === state.dimKey ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}</select>
      </div>
    </div>
    <div id="tier-by-card"></div>
  `;
  const sel = container.querySelector('#tier-by-dim');
  let lastProgrammes = [];

  function render(programmes) {
    lastProgrammes = programmes;
    const rows = tieringByDimension(programmes, state.dimKey);
    const cardRoot = container.querySelector('#tier-by-card');
    if (!rows.length) { showEmptyChartState(cardRoot, 'No data for this dimension in the current filters.'); return; }
    const title = `Tiering by ${DIMENSIONS[state.dimKey].label}`;
    const subtitle = `${ctx.filtersSummaryText()} · % of each category's own programmes that use the Tiering mechanism`;
    mountChartCard(cardRoot, {
      title, subtitle,
      buildChart: (el) => renderHBarChart(el, {
        title, subtitle,
        rows: rows.map(r => ({ label: r.value, value: r.pct })),
        maxOverride: 100,
        valueLabel: (r) => fmtPct(r.value)
      }),
      getTableData: () => ({ headers: [DIMENSIONS[state.dimKey].label, 'Tiered', 'Total', '% Tiered'], rows: rows.map(r => [r.value, r.tiered, r.total, Number(r.pct.toFixed(1))]) }),
      filename: `tiering-by-${state.dimKey}`,
      onSave: (name) => saveAnalysis({ name, lab: 'tier_by_dimension', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
    });
  }
  sel.addEventListener('change', () => { state.dimKey = sel.value; render(lastProgrammes); });
  function applyConfig(config) { if (config.dimKey) { state.dimKey = config.dimKey; sel.value = state.dimKey; } render(lastProgrammes); }
  return { render, applyConfig };
}

function jumpsCard(container, ctx) {
  const state = { mode: 'qualification' };
  container.innerHTML = `
    <h3>Tier Jump Analysis</h3>
    <p class="lab-section-subtitle" style="margin: -6px 0 14px;">Jumps are segmented by qualification unit (or currency, for fees) so incompatible bases are never diffed against each other.</p>
    <div class="control-row">
      <div class="control-group"><label>Basis</label>
        <div class="control-toggle-group">
          <button type="button" class="control-toggle active" data-m="qualification">Qualification (Spend / Nights / Points…)</button>
          <button type="button" class="control-toggle" data-m="fee">Fee</button>
        </div>
      </div>
    </div>
    <div id="tier-jumps-card"></div>
  `;
  const toggleGroup = container.querySelector('.control-toggle-group');
  let lastProgrammes = [];

  function summarize(map) {
    return [...map.entries()].map(([segment, list]) => {
      const pcts = list.map(j => j.pct).filter(p => p != null);
      const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
      return { segment, count: list.length, avgPct, list };
    }).filter(s => s.avgPct != null).sort((a, b) => b.avgPct - a.avgPct);
  }

  function render(programmes) {
    lastProgrammes = programmes;
    const jumps = tierJumps(programmes);
    const map = state.mode === 'qualification' ? jumps.byUnit : jumps.byCurrency;
    const summary = summarize(map);
    const cardRoot = container.querySelector('#tier-jumps-card');
    if (!summary.length) { showEmptyChartState(cardRoot, 'No comparable consecutive-tier jumps found for the current filters.'); return; }

    const title = state.mode === 'qualification' ? 'Average Tier Jump — by Qualification Unit' : 'Average Tier Jump — by Fee Currency';
    const subtitle = `${ctx.filtersSummaryText()} · average % increase from one tier to the next, within each ${state.mode === 'qualification' ? 'qualification unit' : 'currency'}`;
    mountChartCard(cardRoot, {
      title, subtitle,
      buildChart: (el) => renderHBarChart(el, {
        title, subtitle,
        rows: summary.map(s => ({ label: `${s.segment} (${s.count} jump${s.count === 1 ? '' : 's'})`, value: s.avgPct })),
        valueLabel: (r) => fmtPct(r.value)
      }),
      getTableData: () => {
        const headers = state.mode === 'qualification'
          ? ['Programme', 'From Tier', 'To Tier', 'Unit', 'From Amount', 'To Amount', 'Absolute Jump', '% Jump']
          : ['Programme', 'From Tier', 'To Tier', 'Currency', 'From Fee', 'To Fee', 'Absolute Jump', '% Jump'];
        const rows = [];
        map.forEach((list, segment) => list.forEach(j => {
          rows.push(state.mode === 'qualification'
            ? [j.programme, j.from, j.to, segment, j.fromAmount, j.toAmount, j.absolute, j.pct == null ? '' : Number(j.pct.toFixed(1))]
            : [j.programme, j.from, j.to, segment, j.fromFee, j.toFee, j.absolute, j.pct == null ? '' : Number(j.pct.toFixed(1))]);
        }));
        return { headers, rows };
      },
      filename: `tier-jumps-${state.mode}`,
      onSave: (name) => saveAnalysis({ name, lab: 'tier_jumps', config: { ...state, globalFilters: ctx.getGlobalFilters() } })
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
    <div class="lab-card" id="tier-card-1"></div>
    <div class="lab-card" id="tier-card-2"></div>
    <div class="lab-card" id="tier-card-3"></div>
  `;
  const overview = overviewCard(container.querySelector('#tier-card-1'), ctx);
  const byDim = tieringByCard(container.querySelector('#tier-card-2'), ctx);
  const jumps = jumpsCard(container.querySelector('#tier-card-3'), ctx);
  const subLabs = { tier_overview: overview, tier_by_dimension: byDim, tier_jumps: jumps };

  const render = (programmes) => { overview.render(programmes); byDim.render(programmes); jumps.render(programmes); };
  const applyConfig = (config) => { (subLabs[config.lab] || overview).applyConfig(config); };
  return { render, applyConfig };
}
