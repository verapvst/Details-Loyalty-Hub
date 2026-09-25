// My Laboratory — Mechanisms workspace. Explore/Relate treat Mechanism as just one of
// nine dimensions behind a generic picker; this workspace is mechanism-native instead —
// every mechanism visible at once as a card, with its own KPIs, co-occurring mechanics,
// and launch-year trend, one click away. Reuses the existing engine throughout
// (distribution, categoryProfile, timeSeries via mechanismProfile) — the only new
// aggregations are the ones nothing else already computes: stacking distribution,
// mechanism KPIs and ranked co-occurrence pairs (all in analysisData.js).
import { escapeHtml } from './fields.js';
import { distribution, mechanismKpis, mechanismStackingDistribution, mechanismTopPairs, mechanismProfile, mechanismCooccurrence, programmesMatching } from './analysisData.js';
import { renderHBarChart, renderHeatmap, renderLineChart, fmtNum, fmtPct } from './charts.js';
import { mechanismSpectrumColor, MECHANISM_SPECTRUM_GRADIENT } from './options.js';
import { mountChartCard, showEmptyChartState, openProgrammeListModal } from './chartToolbar.js';
import { saveAnalysis, addNote } from './analysisSaved.js';

function kpiRowHTML(k) {
  const cards = [
    ['Distinct Mechanisms', fmtNum(k.distinctMechanisms)],
    ['Avg per Programme', k.avgPerProgramme.toFixed(1)],
    ['Use 2+ Mechanisms', fmtPct(k.multiMechanismPct)],
    ['Most Common', k.topMechanism ? k.topMechanism.value : '—'],
    ['Strongest Pairing', k.topPair ? `${k.topPair.a} + ${k.topPair.b}` : '—']
  ];
  return `
    <div class="kpi-row" style="grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); margin-bottom: 24px;">
      ${cards.map(([label, value]) => `<div class="kpi-item"><div class="kpi-label">${label}</div><div class="kpi-value" style="font-size: 18px;">${escapeHtml(String(value))}</div></div>`).join('')}
    </div>
  `;
}

function barRow(rows, valueFmt) {
  return rows.map(r => `
    <div class="drilldown-bar-row">
      <span class="dbr-label" title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</span>
      <span class="dbr-pct">${valueFmt(r.value)}</span>
    </div>
  `).join('') || '<div class="drilldown-empty">No data.</div>';
}

function mechanismGridHTML(rows, selected) {
  return `
    <div class="mechanism-spectrum">
      <div class="mechanism-spectrum-labels"><span>More transactional</span><span>More experiential</span></div>
      <div class="mechanism-spectrum-bar" style="background:${MECHANISM_SPECTRUM_GRADIENT}"></div>
    </div>
    <div class="mechanism-grid mechanism-grid-spectrum" style="--mech-count:${rows.length}">
      ${rows.map(r => {
        const c = mechanismSpectrumColor(r.value);
        return `
        <button type="button" class="mechanism-card ${r.value === selected ? 'active' : ''}" data-mech="${escapeHtml(r.value)}" ${c ? `style="border-top:3px solid ${c}"` : ''}>
          <div class="mechanism-card-name">${escapeHtml(r.value)}</div>
          <div class="mechanism-card-pct" ${c ? `style="color:${c}"` : ''}>${fmtPct(r.pct)}</div>
          <div class="mechanism-card-count">${fmtNum(r.measureValue)} programme${r.measureValue === 1 ? '' : 's'}</div>
        </button>`;
      }).join('')}
    </div>
  `;
}

function renderDetail(el, mechanism, programmes, ctx) {
  if (!mechanism) {
    el.innerHTML = '<div class="drilldown-empty">Click a mechanism above to see its profile — where it\'s used, what it pairs with, and how it has trended over time.</div>';
    return;
  }
  const profile = mechanismProfile(programmes, mechanism);
  el.innerHTML = `
    <div class="drilldown-title">${escapeHtml(mechanism)}</div>
    <button type="button" class="drill-count-link" id="mech-count-link">${fmtNum(profile.count)} programme${profile.count === 1 ? '' : 's'} →</button>
    <div class="workspace-columns" style="margin-top: 18px;">
      <div>
        <div class="drilldown-block"><div class="drilldown-block-label">Often Paired With</div>${barRow(profile.coOccurring.map(r => ({ label: r.value, value: r.count })), (v) => fmtNum(v))}</div>
        <div class="drilldown-block"><div class="drilldown-block-label">Positioning</div>${barRow(profile.positioning.rows.map(r => ({ label: r.value, value: r.pct })), (v) => fmtPct(v))}</div>
        <div class="drilldown-block"><div class="drilldown-block-label">Membership</div>${barRow(profile.membership.rows.map(r => ({ label: r.value, value: r.pct })), (v) => fmtPct(v))}</div>
      </div>
      <div id="mech-trend-card"></div>
    </div>
  `;
  el.querySelector('#mech-count-link').addEventListener('click', () => {
    openProgrammeListModal({ title: mechanism, subtitle: `Mechanism · ${fmtNum(profile.count)} programme(s)`, programmes: profile.subset });
  });

  const trendCard = el.querySelector('#mech-trend-card');
  if (!profile.trend.years.length) {
    showEmptyChartState(trendCard, 'No launch year recorded for programmes using this mechanism.');
  } else {
    const title = `${mechanism} — Launch Year Trend`;
    const subtitle = ctx.filtersSummaryText();
    mountChartCard(trendCard, {
      title, subtitle,
      buildChart: (chartEl) => renderLineChart(chartEl, {
        title, subtitle, categories: profile.trend.years, series: profile.trend.series, mode: 'line',
        onSelect: (year) => {
          const subset = profile.subset.filter(p => p.launch_year === Number(year));
          openProgrammeListModal({ title: `${mechanism} · ${year}`, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
        }
      }),
      getTableData: () => ({ headers: ['Launch Year', 'Programmes'], rows: profile.trend.years.map((y, i) => [y, Math.round(profile.trend.series[0].values[i])]) }),
      filename: `${mechanism}-trend`,
      saveTitle: title,
      onSave: async (name, takeaway) => {
        const row = await saveAnalysis({ name, lab: 'mechanisms', config: { selectedMechanism: mechanism, globalFilters: ctx.getGlobalFilters() } });
        if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
      }
    });
  }
}

export function mount(container, ctx) {
  const state = { selectedMechanism: null };
  let lastProgrammes = [];

  container.innerHTML = `
    <div id="mech-kpis"></div>
    <div id="mech-stacking-card"></div>
    <div class="workspace-prompt" style="margin-top: 8px;">
      <div class="workspace-prompt-label">Every mechanism in use — click one to inspect it</div>
      <div id="mech-grid-root"></div>
    </div>
    <div class="drilldown-panel" id="mech-detail" style="margin-top: 16px;"></div>
    <div class="workspace-prompt" style="margin-top: 28px;">
      <div class="workspace-prompt-label">Co-occurrence</div>
    </div>
    <div class="workspace-columns" id="mech-cooccur-row"></div>
  `;

  const kpisEl = container.querySelector('#mech-kpis');
  const stackingCard = container.querySelector('#mech-stacking-card');
  const gridRoot = container.querySelector('#mech-grid-root');
  const detailEl = container.querySelector('#mech-detail');
  const cooccurRow = container.querySelector('#mech-cooccur-row');

  function selectMechanism(mechanism) {
    state.selectedMechanism = mechanism;
    ctx.persist(state);
    gridRoot.querySelectorAll('.mechanism-card').forEach(c => c.classList.toggle('active', c.dataset.mech === mechanism));
    renderDetail(detailEl, mechanism, lastProgrammes, ctx);
  }

  function render(programmes) {
    lastProgrammes = programmes;
    const k = mechanismKpis(programmes);
    kpisEl.innerHTML = kpiRowHTML(k);

    const stackRows = mechanismStackingDistribution(programmes).filter(d => d.count > 0);
    if (!stackRows.length) {
      showEmptyChartState(stackingCard, 'No programmes match the current filters.');
    } else {
      const subtitle = ctx.filtersSummaryText();
      mountChartCard(stackingCard, {
        title: 'Mechanisms per Programme', subtitle,
        note: 'How many distinct mechanisms a programme combines — 0 means no mechanism recorded.',
        buildChart: (el) => renderHBarChart(el, {
          title: 'Mechanisms per Programme', subtitle,
          rows: stackRows.map(d => ({ label: `${d.bucket} mechanism${d.bucket === '1' ? '' : 's'}`, value: d.count })),
          onSelect: (label) => {
            const bucket = stackRows.find(d => `${d.bucket} mechanism${d.bucket === '1' ? '' : 's'}` === label)?.bucket;
            if (!bucket) return;
            const subset = programmes.filter(p => {
              const n = new Set((p.mechanisms || []).filter(Boolean)).size;
              return bucket === '4+' ? n >= 4 : n === Number(bucket);
            });
            openProgrammeListModal({ title: label, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
          }
        }),
        getTableData: () => ({ headers: ['Mechanisms per Programme', 'Programmes'], rows: stackRows.map(d => [d.bucket, d.count]) }),
        filename: 'mechanisms-per-programme',
        saveTitle: 'Mechanisms per Programme',
        onSave: async (name, takeaway) => {
          const row = await saveAnalysis({ name, lab: 'mechanisms', config: { view: 'stacking', globalFilters: ctx.getGlobalFilters() } });
          if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
        }
      });
    }

    const dist = distribution(programmes, 'mechanisms', { measure: 'count' });
    if (!dist.rows.length) {
      gridRoot.innerHTML = '<div class="drilldown-empty">No programmes with a recorded mechanism match the current filters.</div>';
    } else {
      if (state.selectedMechanism && !dist.rows.some(r => r.value === state.selectedMechanism)) state.selectedMechanism = null;
      gridRoot.innerHTML = mechanismGridHTML(dist.rows, state.selectedMechanism);
      gridRoot.querySelectorAll('.mechanism-card').forEach(btn => btn.addEventListener('click', () => selectMechanism(btn.dataset.mech)));
    }
    renderDetail(detailEl, state.selectedMechanism, programmes, ctx);

    const co = mechanismCooccurrence(programmes);
    if (co.mechanisms.length < 2) {
      showEmptyChartState(cooccurRow, 'Not enough mechanisms recorded to show co-occurrence.');
    } else {
      cooccurRow.innerHTML = '<div id="mech-heatmap-card"></div><div id="mech-pairs-card"></div>';
      const heatSubtitle = `${ctx.filtersSummaryText()} · programmes with both mechanisms`;
      mountChartCard(cooccurRow.querySelector('#mech-heatmap-card'), {
        title: 'Mechanism × Mechanism', subtitle: heatSubtitle,
        buildChart: (el) => renderHeatmap(el, {
            labelColor: mechanismSpectrumColor,
          title: 'Mechanism × Mechanism', subtitle: heatSubtitle,
          rows: co.mechanisms, cols: co.mechanisms, matrix: co.matrix,
          cellText: (v) => fmtNum(v),
          onSelect: (rowMech, colMech) => {
            const subset = programmesMatching(programmes, [{ dimKey: 'mechanisms', value: rowMech }, { dimKey: 'mechanisms', value: colMech }]);
            openProgrammeListModal({ title: rowMech === colMech ? rowMech : `${rowMech} + ${colMech}`, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
          }
        }),
        getTableData: () => ({ headers: ['', ...co.mechanisms], rows: co.mechanisms.map((m, i) => [m, ...co.matrix[i]]) }),
        filename: 'mechanism-cooccurrence',
        saveTitle: 'Mechanism × Mechanism',
        onSave: async (name, takeaway) => {
          const row = await saveAnalysis({ name, lab: 'mechanisms', config: { view: 'cooccurrence', globalFilters: ctx.getGlobalFilters() } });
          if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
        }
      });

      const pairs = mechanismTopPairs(programmes, 10);
      const pairsCard = cooccurRow.querySelector('#mech-pairs-card');
      if (!pairs.length) {
        showEmptyChartState(pairsCard, 'No mechanism pairs found.');
      } else {
        const pairSubtitle = ctx.filtersSummaryText();
        const pairByLabel = new Map(pairs.map(p => [`${p.a} + ${p.b}`, p]));
        mountChartCard(pairsCard, {
          title: 'Strongest Pairings', subtitle: pairSubtitle,
          buildChart: (el) => renderHBarChart(el, {
            title: 'Strongest Pairings', subtitle: pairSubtitle,
            rows: pairs.map(p => ({ label: `${p.a} + ${p.b}`, value: p.count })),
            onSelect: (label) => {
              const p = pairByLabel.get(label);
              if (!p) return;
              const subset = programmesMatching(programmes, [{ dimKey: 'mechanisms', value: p.a }, { dimKey: 'mechanisms', value: p.b }]);
              openProgrammeListModal({ title: label, subtitle: `${fmtNum(subset.length)} programme(s)`, programmes: subset });
            }
          }),
          getTableData: () => ({ headers: ['Pairing', 'Programmes'], rows: pairs.map(p => [`${p.a} + ${p.b}`, p.count]) }),
          filename: 'mechanism-top-pairs',
          saveTitle: 'Strongest Pairings',
          onSave: async (name, takeaway) => {
            const row = await saveAnalysis({ name, lab: 'mechanisms', config: { view: 'pairs', globalFilters: ctx.getGlobalFilters() } });
            if (takeaway) await addNote({ title: name, note_text: takeaway, linked_analysis_id: row.id, tags: [] });
          }
        });
      }
    }
  }

  function applyConfig(config) {
    if (config.selectedMechanism) state.selectedMechanism = config.selectedMechanism;
    render(lastProgrammes);
  }

  function getConfig() { return { ...state }; }

  return { render, applyConfig, getConfig };
}
