// My Laboratory — Pricing workspace (formerly "Tiers"). Kept as its own workspace
// deliberately: tier/fee structure is a first-class research question here, and
// programme_tiers is a genuinely different (nested, ordered, currency-bearing) data
// shape than the flat dimension registry Explore/Relate work with — forcing it into an
// X/Y grid would need a fake "dimension" and would complicate Relate to save one
// section. Three views (Structure / Fees / Jumps) instead of permanently-stacked cards.
// Internal identifiers (lab: 'tiers', state.view: 'structure') deliberately keep their
// original names so existing Saved Analyses still reopen correctly — only the tab
// label and framing changed, not the config shape.
import { escapeHtml } from './fields.js';
import {
  DIMENSIONS, tierOverview, tieringByDimension, tierJumps, tierJumpsByPosition, programmesMatching,
  feeOverview, entryFeeDistribution, avgEntryFeeByDimension, feeOverviewEUR, avgEntryFeeByDimensionEUR,
  tierArchitectureOverview, classifyTierRow
} from './analysisData.js';
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
    <div class="workspace-prompt" style="margin-top: 28px;">
      <div class="workspace-prompt-label">Tier Architecture — Earned vs. Paid vs. Free vs. Invitation</div>
    </div>
    <div id="tier-arch-card"></div>
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
      note: `${fmtNum(ov.total - ov.withStructureCount)} programme(s) have no tier structure recorded.`,
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

  const arch = tierArchitectureOverview(programmes);
  const archCard = container.querySelector('#tier-arch-card');
  if (!arch.programmeBreakdown.length) {
    showEmptyChartState(archCard, 'No programmes match the current filters.');
  } else {
    const archSubtitle = `${ctx.filtersSummaryText()} · a tier counts as Paid (fee > 0), Earned (behavioural qualification — spend/nights/points/etc.), Free (automatic, no fee) or Invitation-only; "Mixed" is a programme with more than one of these — e.g. a free entry tier plus earned status tiers above it`;
    const archByLabel = new Map(arch.programmeBreakdown.map(d => [d.label, d]));
    mountChartCard(archCard, {
      title: 'Programme Architecture', subtitle: archSubtitle,
      buildChart: (el) => renderHBarChart(el, {
        title: 'Programme Architecture', subtitle: archSubtitle,
        rows: arch.programmeBreakdown.map(d => ({ label: d.label, value: d.count })),
        onSelect: (label) => {
          const d = archByLabel.get(label);
          if (!d) return;
          const subset = programmes.filter(p => {
            if (!Array.isArray(p.programme_tiers) || !p.programme_tiers.length) return label === 'No tier data';
            const types = new Set(p.programme_tiers.map(classifyTierRow));
            const computedLabel = types.size === 1 ? [...types][0] + 's only' : 'Mixed (' + [...types].sort().join(' + ') + ')';
            return computedLabel === label;
          });
          openProgrammeListModal({ title: label, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
        }
      }),
      getTableData: () => ({ headers: ['Architecture', 'Programmes', '% of Total'], rows: arch.programmeBreakdown.map(d => [d.label, d.count, Number(d.pct.toFixed(1))]) }),
      filename: 'tier-architecture',
      saveTitle: 'Programme Architecture',
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
  const subtitle2 = `${ctx.filtersSummaryText()} · % of each category's own programmes with a recorded tier structure`;
  mountChartCard(byCard, {
    title, subtitle: subtitle2,
    buildChart: (el) => renderHBarChart(el, {
      title, subtitle: subtitle2,
      rows: rows.map(r => ({ label: r.value, value: r.pct })),
      maxOverride: 100,
      valueLabel: (r) => fmtPct(r.value),
      onSelect: (categoryValue) => {
        const subset = programmesMatching(programmes, [{ dimKey: state.byDim, value: categoryValue }])
          .filter(p => Array.isArray(p.programme_tiers) && p.programme_tiers.length > 0);
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

// Re-derives one programme's entry fee for a given currency straight from its own
// tier rows (public data), rather than exporting analysisData's internal helper — the
// same "recompute bucket membership locally" approach the Structure view already uses
// for tier-count buckets above.
function localEntryFee(p, currency) {
  if (!Array.isArray(p.programme_tiers) || !p.programme_tiers.length) return null;
  const rows = [...p.programme_tiers].sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0)).filter(r => r.tier_price != null && (r.currency || 'EUR') === currency);
  return rows.length ? rows[0].tier_price : null;
}

function renderFees(container, ctx, state, programmes) {
  const overview = feeOverview(programmes);
  if (!overview.currencies.length) {
    showEmptyChartState(container, 'No programmes with a recorded tier fee match the current filters.');
    return;
  }
  if (!state.feeCurrency || !overview.currencies.some(c => c.currency === state.feeCurrency)) {
    state.feeCurrency = overview.currencies[0].currency;
  }
  const cur = overview.currencies.find(c => c.currency === state.feeCurrency);
  const eur = overview.currencies.length > 1 ? feeOverviewEUR(programmes) : null;

  container.innerHTML = `
    <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); margin-bottom: 20px;">
      <div class="kpi-item"><div class="kpi-label">With Fee Data</div><div class="kpi-value">${fmtNum(overview.withFeeCount)} / ${fmtNum(overview.total)}</div></div>
      <div class="kpi-item"><div class="kpi-label">Avg Entry Fee</div><div class="kpi-value">${cur.currency} ${fmtNum(Math.round(cur.avgEntryFee))}</div></div>
      <div class="kpi-item"><div class="kpi-label">Median Entry Fee</div><div class="kpi-value">${cur.currency} ${fmtNum(Math.round(cur.medianEntryFee))}</div></div>
      <div class="kpi-item"><div class="kpi-label">Avg Top-Tier Fee</div><div class="kpi-value">${cur.currency} ${fmtNum(Math.round(cur.avgTopFee))}</div></div>
    </div>
    ${eur && eur.withFeeCount ? `
    <div class="chart-card-note" style="margin-bottom: 20px;">
      All currencies pooled (approximate EUR, static rates) — avg entry fee €${fmtNum(Math.round(eur.avgEntryFeeEUR))} · median €${fmtNum(Math.round(eur.medianEntryFeeEUR))} · avg top-tier fee €${fmtNum(Math.round(eur.avgTopFeeEUR))}, based on ${fmtNum(eur.withFeeCount)} programme(s)${eur.unconvertedCount ? ` (${fmtNum(eur.unconvertedCount)} in an unmapped currency excluded)` : ''} — directional only at this sample size, not a benchmark.
    </div>` : ''}
    <div class="workspace-secondary-controls">
      ${overview.currencies.length > 1 ? `
      <div class="control-group"><label>Currency</label>
        <select class="control-select" id="fee-currency">${overview.currencies.map(c => `<option value="${c.currency}" ${c.currency === state.feeCurrency ? 'selected' : ''}>${c.currency} (${fmtNum(c.count)})</option>`).join('')}</select>
      </div>` : ''}
    </div>
    <div id="fee-dist-card"></div>
    <div class="workspace-secondary-controls" style="margin-top: 28px;">
      <div class="control-group"><label>Avg entry fee by</label>
        <select class="control-select" id="fee-by-dim">${TIERING_BY_KEYS.map(k => `<option value="${k}" ${k === state.feeByDim ? 'selected' : ''}>${escapeHtml(DIMENSIONS[k].label)}</option>`).join('')}</select>
      </div>
    </div>
    <div id="fee-by-card"></div>
    <div id="fee-by-eur-card"></div>
  `;

  const currencySel = container.querySelector('#fee-currency');
  if (currencySel) currencySel.addEventListener('change', () => { state.feeCurrency = currencySel.value; ctx.persist(state); renderFees(container, ctx, state, programmes); });

  const distRows = entryFeeDistribution(programmes, state.feeCurrency);
  const distCard = container.querySelector('#fee-dist-card');
  const distSubtitle = `${ctx.filtersSummaryText()} · entry fee, ${cur.currency} only (${fmtNum(cur.count)} programme(s))`;
  const bucketByLabel = new Map(distRows.map(d => [`${cur.currency} ${d.bucket}`, d]));
  mountChartCard(distCard, {
    title: 'Entry Fee Distribution', subtitle: distSubtitle,
    buildChart: (el) => renderHBarChart(el, {
      title: 'Entry Fee Distribution', subtitle: distSubtitle,
      rows: distRows.map(d => ({ label: `${cur.currency} ${d.bucket}`, value: d.count })),
      onSelect: (label) => {
        const bucket = bucketByLabel.get(label);
        if (!bucket) return;
        const [start, end] = bucket.bucket.split('–').map(Number);
        const subset = programmes.filter(p => {
          const fee = localEntryFee(p, state.feeCurrency);
          return fee != null && fee >= start && fee < end;
        });
        openProgrammeListModal({ title: label, subtitle: `Entry fee · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
      }
    }),
    getTableData: () => ({ headers: [`Entry Fee (${cur.currency})`, 'Programmes'], rows: distRows.map(d => [d.bucket, d.count]) }),
    filename: `entry-fee-distribution-${state.feeCurrency}`,
    saveTitle: 'Entry Fee Distribution',
    onSave: async (name, takeaway) => {
      const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'fees', feeCurrency: state.feeCurrency, globalFilters: ctx.getGlobalFilters() } });
      if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
    }
  });

  const byDimSel = container.querySelector('#fee-by-dim');
  byDimSel.addEventListener('change', () => { state.feeByDim = byDimSel.value; ctx.persist(state); renderFees(container, ctx, state, programmes); });

  const byRows = avgEntryFeeByDimension(programmes, state.feeByDim, state.feeCurrency);
  const byCard = container.querySelector('#fee-by-card');
  if (!byRows.length) {
    showEmptyChartState(byCard, 'No data for this dimension and currency in the current filters.');
    return;
  }
  const byTitle = `Avg Entry Fee by ${DIMENSIONS[state.feeByDim].label}`;
  const bySubtitle = `${ctx.filtersSummaryText()} · ${cur.currency} only`;
  mountChartCard(byCard, {
    title: byTitle, subtitle: bySubtitle,
    buildChart: (el) => renderHBarChart(el, {
      title: byTitle, subtitle: bySubtitle,
      rows: byRows.map(r => ({ label: r.value, value: r.avgEntryFee })),
      valueLabel: (r) => `${cur.currency} ${fmtNum(Math.round(r.value))}`,
      onSelect: (categoryValue) => {
        const subset = programmesMatching(programmes, [{ dimKey: state.feeByDim, value: categoryValue }])
          .filter(p => localEntryFee(p, state.feeCurrency) != null);
        openProgrammeListModal({ title: categoryValue, subtitle: `${DIMENSIONS[state.feeByDim].label} · ${fmtNum(subset.length)} programme(s)`, programmes: subset });
      }
    }),
    getTableData: () => ({ headers: [DIMENSIONS[state.feeByDim].label, 'Programmes', `Avg Entry Fee (${cur.currency})`], rows: byRows.map(r => [r.value, r.count, Math.round(r.avgEntryFee)]) }),
    filename: `avg-entry-fee-by-${state.feeByDim}`,
    saveTitle: byTitle,
    onSave: async (name, takeaway) => {
      const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'fees', feeCurrency: state.feeCurrency, feeByDim: state.feeByDim, globalFilters: ctx.getGlobalFilters() } });
      if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
    }
  });

  const eurByCard = container.querySelector('#fee-by-eur-card');
  if (overview.currencies.length > 1) {
    const eurByRows = avgEntryFeeByDimensionEUR(programmes, state.feeByDim);
    if (eurByRows.length) {
      const eurByTitle = `Avg Entry Fee by ${DIMENSIONS[state.feeByDim].label} — all currencies pooled (EUR)`;
      const eurBySubtitle = `${ctx.filtersSummaryText()} · approximate EUR, directional only`;
      mountChartCard(eurByCard, {
        title: eurByTitle, subtitle: eurBySubtitle,
        note: 'Static FX rates — a cross-currency comparison, not a benchmark at this sample size.',
        buildChart: (el) => renderHBarChart(el, {
          title: eurByTitle, subtitle: eurBySubtitle,
          rows: eurByRows.map(r => ({ label: `${r.value} (${fmtNum(r.count)})`, value: r.avgEntryFeeEUR })),
          valueLabel: (r) => `€${fmtNum(Math.round(r.value))}`
        }),
        getTableData: () => ({ headers: [DIMENSIONS[state.feeByDim].label, 'Programmes', 'Avg Entry Fee (EUR)', 'Median Entry Fee (EUR)'], rows: eurByRows.map(r => [r.value, r.count, Math.round(r.avgEntryFeeEUR), Math.round(r.medianEntryFeeEUR)]) }),
        filename: `avg-entry-fee-eur-by-${state.feeByDim}`,
        saveTitle: eurByTitle,
        onSave: async (name, takeaway) => {
          const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'fees', feeByDim: state.feeByDim, globalFilters: ctx.getGlobalFilters() } });
          if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
        }
      });
    }
  }
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
        <div class="control-toggle-group" id="jumps-basis-toggle">
          <button type="button" class="control-toggle ${state.jumpsMode === 'qualification' ? 'active' : ''}" data-m="qualification">Qualification (Spend / Nights / Points…)</button>
          <button type="button" class="control-toggle ${state.jumpsMode === 'fee' ? 'active' : ''}" data-m="fee">Fee</button>
        </div>
      </div>
      <div class="control-group"><label>Group by</label>
        <div class="control-toggle-group" id="jumps-groupby-toggle">
          <button type="button" class="control-toggle ${state.jumpsGroupBy !== 'position' ? 'active' : ''}" data-g="segment">Unit / Currency</button>
          <button type="button" class="control-toggle ${state.jumpsGroupBy === 'position' ? 'active' : ''}" data-g="position">Tier Position (1st jump, 2nd, …)</button>
        </div>
      </div>
    </div>
    <div id="tier-jumps-card"></div>
  `;
  container.querySelector('#jumps-basis-toggle').querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.jumpsMode = btn.dataset.m;
    ctx.persist(state);
    renderJumps(container, ctx, state, programmes);
  }));
  container.querySelector('#jumps-groupby-toggle').querySelectorAll('.control-toggle').forEach(btn => btn.addEventListener('click', () => {
    state.jumpsGroupBy = btn.dataset.g;
    ctx.persist(state);
    renderJumps(container, ctx, state, programmes);
  }));

  const cardRoot = container.querySelector('#tier-jumps-card');

  if (state.jumpsGroupBy === 'position') {
    renderJumpsByPosition(cardRoot, ctx, state, programmes);
    return;
  }

  const jumps = tierJumps(programmes);
  const map = state.jumpsMode === 'qualification' ? jumps.byUnit : jumps.byCurrency;
  const summary = summarizeJumps(map);
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

// "Is the 3rd jump proportionally bigger than the 1st?" — grouped by jump position
// instead of by unit/currency, so it pools across programmes that don't share a
// qualification unit or currency at all. % only (see tierJumpsByPosition — absolute
// amounts aren't poolable this way).
function renderJumpsByPosition(cardRoot, ctx, state, programmes) {
  const byPosition = tierJumpsByPosition(programmes, state.jumpsMode);
  if (!byPosition.length) { showEmptyChartState(cardRoot, 'No comparable consecutive-tier jumps found for the current filters.'); return; }

  const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
  const title = `Average Tier Jump — by Position (${state.jumpsMode === 'fee' ? 'Fee' : 'Qualification'})`;
  const subtitle = `${ctx.filtersSummaryText()} · average % increase for the Nth tier-to-tier jump, pooled across units/currencies`;
  const posByLabel = new Map(byPosition.map(s => [`${ordinal(s.position)} jump (${s.count})`, s]));
  mountChartCard(cardRoot, {
    title, subtitle,
    note: 'Only % increase is comparable across mixed units/currencies — see "Unit / Currency" grouping for absolute amounts.',
    buildChart: (el) => renderHBarChart(el, {
      title, subtitle,
      rows: byPosition.map(s => ({ label: `${ordinal(s.position)} jump (${s.count})`, value: s.avgPct })),
      valueLabel: (r) => fmtPct(r.value),
      onSelect: (label) => {
        const s = posByLabel.get(label);
        if (!s) return;
        const names = new Set(s.list.map(j => j.programme));
        const subset = programmes.filter(p => names.has(p.programme_name));
        openProgrammeListModal({ title: `${ordinal(s.position)} tier jump`, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
      }
    }),
    getTableData: () => ({
      headers: ['Jump Position', 'Programmes', 'Avg % Increase', 'Median % Increase'],
      rows: byPosition.map(s => [`${ordinal(s.position)} jump`, s.count, Number(s.avgPct.toFixed(1)), Number(s.medianPct.toFixed(1))])
    }),
    filename: `tier-jumps-by-position-${state.jumpsMode}`,
    saveTitle: title,
    onSave: async (name, takeaway) => {
      const row = await saveAnalysis({ name, lab: 'tiers', config: { view: 'jumps', jumpsMode: state.jumpsMode, jumpsGroupBy: 'position', globalFilters: ctx.getGlobalFilters() } });
      if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
    }
  });
}

export function mount(container, ctx) {
  const state = { view: 'structure', byDim: 'industry', jumpsMode: 'qualification', jumpsGroupBy: 'segment', feeCurrency: null, feeByDim: 'industry' };
  let lastProgrammes = [];

  container.innerHTML = `
    <div class="control-toggle-group tiers-view-toggle">
      <button type="button" class="control-toggle ${state.view === 'structure' ? 'active' : ''}" data-view="structure">Structure</button>
      <button type="button" class="control-toggle ${state.view === 'fees' ? 'active' : ''}" data-view="fees">Fees</button>
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
    else if (state.view === 'fees') renderFees(viewRoot, ctx, state, programmes);
    else renderStructure(viewRoot, ctx, state, programmes);
  }

  function applyConfig(config) {
    if (config.view) state.view = config.view;
    if (config.byDim) state.byDim = config.byDim;
    if (config.jumpsMode) state.jumpsMode = config.jumpsMode;
    if (config.jumpsGroupBy) state.jumpsGroupBy = config.jumpsGroupBy;
    if (config.feeCurrency) state.feeCurrency = config.feeCurrency;
    if (config.feeByDim) state.feeByDim = config.feeByDim;
    container.querySelectorAll('.tiers-view-toggle .control-toggle').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  return { render, applyConfig, getConfig };
}
