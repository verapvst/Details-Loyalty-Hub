// My Laboratory — Tiers workspace. Kept as its own workspace deliberately: tier
// structure is a first-class research question here, and programme_tiers is a
// genuinely different (nested, ordered) data shape than the flat dimension registry
// Explore/Relate work with — forcing it into an X/Y grid would need a fake
// "dimension" and would complicate Relate to save one section. One workspace, two
// views (Structure / Jumps) instead of three permanently-stacked cards.
import { escapeHtml } from './fields.js';
import { DIMENSIONS, tierOverview, tieringByDimension, tierJumps, programmesMatching } from './analysisData.js';
import { renderHBarChart, fmtNum, fmtPct } from './charts.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

const TIERING_BY_KEYS = ['industry', 'programme_positioning', 'membership_type', 'geographic_scope'];

function renderStructure(container, ctx, state, programmes) {
  const ov = tierOverview(programmes);
  container.innerHTML = `
    <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); margin-bottom: 20px;">
      <div class="kpi-item"><div class="kpi-label">Tiered</div><div class="kpi-value">${fmtPct(ov.tieredPct)}</div></div>
      <div class="kpi-item"><div class="kpi-label">Programmes</div><div class="kpi-value">${fmtNum(ov.tieredCount)} / ${fmtNum(ov.total)}</div></div>
      <div class="kpi-item"><div class="kpi-label">Avg Tiers</div><div class="kpi-value">${ov.avgTiers == null ? '—' : ov.avgTiers.toFixed(1)}</div></div>
      <div class="kpi-item"><div class="kpi-label">Median Tiers</div><div class="kpi-value">${ov.medianTiers == null ? '—' : ov.medianTiers}</div></div>
    </div>
    <div id="tier-dist-card"></div>
    <div class="workspace-secondary-controls" style="margin-top: 28px;">
      <div class="control-group"><label>Tiering by</label>
        <select class="control-select" id="tier-by-dim">${TIERING_BY_KEYS.map(k => `<option value="${k}" ${k === state.byDim ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}</select>
      </div>
    </div>
    <div id="tier-by-card"></div>
  `;

  const distRows = ov.distribution.filter(d => d.count > 0);
  const distCard = container.querySelector('#tier-dist-card');
  if (!distRows.length) {
    showEmptyChartState(distCard, 'No programmes with tier structure recorded match the current filters.');
  } else {
    const subtitle = `${ctx.filtersSummaryText()} · based on the ${fmtNum(ov.withStructureCount)} programme(s) with tier structure recorded`;
    const bucketByLabel = new Map(distRows.map(d => [`${d.bucket} tier${d.bucket === '1' ? '' : 's'}`, d.bucket]));
    mountChartCard(distCard, {
      title: 'Tier Count Distribution', subtitle,
      note: `${fmtNum(ov.total - ov.withStructureCount)} programme(s) have no tier structure recorded (they may still use the Tiering mechanism without a documented structure).`,
      buildChart: (el) => renderHBarChart(el, {
        title: 'Tier Count Distribution', subtitle,
        rows: distRows.map(d => ({ label: `${d.bucket} tier${d.bucket === '1' ? '' : 's'}`, value: d.count })),
        onSelect: (label) => {
          const bucket = bucketByLabel.get(label);
          const subset = programmes.filter(p => Array.isArray(p.programme_tiers) &&
            (bucket === '5+' ? p.programme_tiers.length >= 5 : p.programme_tiers.length === Number(bucket)));
          openProgrammeListModal({ title: label, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
        }
      }),
      getTableData: () => ({ headers: ['Number of Tiers', 'Programmes'], rows: distRows.map(d => [d.bucket, d.count]) }),
      filename: 'tier-count-distribution',
      saveTitle: 'Tier Count Distribution',
      onSave: async (name, takeaway) => {
        const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'structure', globalFilters: ctx.getGlobalFilters() } });
        if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
      }
    });
  }

  const byDimSel = container.querySelector('#tier-by-dim');
  byDimSel.addEventListener('change', () => { state.byDim = byDimSel.value; ctx.persist(state); renderStructure(container, ctx, state, programmes); });

  const byCard = container.querySelector('#tier-by-card');
  const rows = tieringByDimension(programmes, state.byDim);
  if (!rows.length) {
    showEmptyChartState(byCard, 'No data for this dimension in the current filters.');
    return;
  }
  const title = `Tiering by ${DIMENSIONS[state.byDim].label}`;
  const subtitle2 = `${ctx.filtersSummaryText()} · % of each category's own programmes that use the Tiering mechanism`;
  mountChartCard(byCard, {
    title, subtitle: subtitle2,
    buildChart: (el) => renderHBarChart(el, {
      title, subtitle: subtitle2,
      rows: rows.map(r => ({ label: r.value, value: r.pct })),
      maxOverride: 100,
      valueLabel: (r) => fmtPct(r.value),
      onSelect: (categoryValue) => {
        const subset = programmesMatching(programmes, [{ dimKey: state.byDim, value: categoryValue }, { dimKey: 'mechanisms', value: 'Tiering' }]);
        openProgrammeListModal({ title: `${categoryValue} — Tiered`, subtitle: `${DIMENSIONS[state.byDim].label} · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
      }
    }),
    getTableData: () => ({ headers: [DIMENSIONS[state.byDim].label, 'Tiered', 'Total', '% Tiered'], rows: rows.map(r => [r.value, r.tiered, r.total, Number(r.pct.toFixed(1))]) }),
    filename: `tiering-by-${state.byDim}`,
    saveTitle: title,
    onSave: async (name, takeaway) => {
      const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'structure', byDim: state.byDim, globalFilters: ctx.getGlobalFilters() } });
      if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
    }
  });
}

function summarizeJumps(map) {
  return [...map.entries()].map(([segment, list]) => {
    const pcts = list.map(j => j.pct).filter(p => p != null);
    const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    return { segment, count: list.length, avgPct, list };
  }).filter(s => s.avgPct != null).sort((a, b) => b.avgPct - a.avgPct);
}

function renderJumps(container, ctx, state, programmes) {
  container.innerHTML = `
    <div class="workspace-secondary-controls">
      <div class="control-group"><label>Basis</label>
        <div class="control-toggle-group">
          <button type="button" class="control-toggle ${state.jumpsMode === 'qualification' ? 'active' : ''}" data-m="qualification">Qualification (Spend / Nights / Points…)</button>
          <button type="button" class="control-toggle ${state.jumpsMode === 'fee' ? 'active' : ''}" data-m="fee">Fee</button>
        </div>
      </div>
    </div>
    <div id="tier-jumps-card"></div>
  `;
  container.querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.jumpsMode = btn.dataset.m;
    ctx.persist(state);
    renderJumps(container, ctx, state, programmes);
  }));

  const jumps = tierJumps(programmes);
  const map = state.jumpsMode === 'qualification' ? jumps.byUnit : jumps.byCurrency;
  const summary = summarizeJumps(map);
  const cardRoot = container.querySelector('#tier-jumps-card');
  if (!summary.length) { showEmptyChartState(cardRoot, 'No comparable consecutive-tier jumps found for the current filters.'); return; }

  const title = state.jumpsMode === 'qualification' ? 'Average Tier Jump — by Qualification Unit' : 'Average Tier Jump — by Fee Currency';
  const subtitle = `${ctx.filtersSummaryText()} · average % increase from one tier to the next, within each ${state.jumpsMode === 'qualification' ? 'qualification unit' : 'currency'}`;
  const segmentByLabel = new Map(summary.map(s => [`${s.segment} (${s.count} jump${s.count === 1 ? '' : 's'})`, s]));
  mountChartCard(cardRoot, {
    title, subtitle,
    buildChart: (el) => renderHBarChart(el, {
      title, subtitle,
      rows: summary.map(s => ({ label: `${s.segment} (${s.count} jump${s.count === 1 ? '' : 's'})`, value: s.avgPct })),
      valueLabel: (r) => fmtPct(r.value),
      onSelect: (label) => {
        const s = segmentByLabel.get(label);
        if (!s) return;
        const names = new Set(s.list.map(j => j.programme));
        const subset = programmes.filter(p => names.has(p.programme_name));
        openProgrammeListModal({ title: s.segment, subtitle: `Programmes with a tier jump in this segment · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
      }
    }),
    getTableData: () => {
      const headers = state.jumpsMode === 'qualification'
        ? ['Programme', 'From Tier', 'To Tier', 'Unit', 'From Amount', 'To Amount', 'Absolute Jump', '% Jump']
        : ['Programme', 'From Tier', 'To Tier', 'Currency', 'From Fee', 'To Fee', 'Absolute Jump', '% Jump'];
      const rows = [];
      map.forEach((list, segment) => list.forEach(j => {
        rows.push(state.jumpsMode === 'qualification'
          ? [j.programme, j.from, j.to, segment, j.fromAmount, j.toAmount, j.absolute, j.pct == null ? '' : Number(j.pct.toFixed(1))]
          : [j.programme, j.from, j.to, segment, j.fromFee, j.toFee, j.absolute, j.pct == null ? '' : Number(j.pct.toFixed(1))]);
      }));
      return { headers, rows };
    },
    filename: `tier-jumps-${state.jumpsMode}`,
    saveTitle: title,
    onSave: async (name, takeaway) => {
      const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'jumps', jumpsMode: state.jumpsMode, globalFilters: ctx.getGlobalFilters() } });
      if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
    }
  });
}

export function mount(container, ctx) {
  const state = { view: 'structure', byDim: 'industry', jumpsMode: 'qualification' };
  let lastProgrammes = [];

  container.innerHTML = `
    <div class="control-toggle-group tiers-view-toggle">
      <button type="button" class="control-toggle ${state.view === 'structure' ? 'active' : ''}" data-view="structure">Structure</button>
      <button type="button" class="control-toggle ${state.view === 'jumps' ? 'active' : ''}" data-view="jumps">Jumps</button>
    </div>
    <div id="tiers-view-root"></div>
  `;

  const viewRoot = container.querySelector('#tiers-view-root');
  container.querySelectorAll('.tiers-view-toggle .control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    container.querySelectorAll('.tiers-view-toggle .control-toggle').forEach(b => b.classList.toggle('active', b === btn));
    ctx.persist(state);
    render(lastProgrammes);
  }));

  function render(programmes) {
    lastProgrammes = programmes;
    if (state.view === 'jumps') renderJumps(viewRoot, ctx, state, programmes);
    else renderStructure(viewRoot, ctx, state, programmes);
  }

  function applyConfig(config) {
    if (config.view) state.view = config.view;
    if (config.byDim) state.byDim = config.byDim;
    if (config.jumpsMode) state.jumpsMode = config.jumpsMode;
    container.querySelectorAll('.tiers-view-toggle .control-toggle').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  return { render, applyConfig, getConfig };
}
