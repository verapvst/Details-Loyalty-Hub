// Analysis tab — Database Snapshot (KPIs + compact context line + Data Quality card).
// Section 5 / 30 of the spec: a handful of numbers, always computed live, plus an
// always-visible (never hidden inside a headline %) completeness indicator.
import { escapeHtml } from './fields.js';
import { snapshotKpis, dataQuality, suspiciousLaunchYears } from './analysisData.js';
import { fmtPct, fmtNum } from './charts.js';

export function mountKpiSnapshot() {
  const kpiRow = document.getElementById('snapshot-kpi-row');
  const contextLine = document.getElementById('snapshot-context-line');
  const dqCard = document.getElementById('data-quality-card');
  const currentYear = new Date().getFullYear();

  function render(programmes) {
    const k = snapshotKpis(programmes);
    kpiRow.innerHTML = [
      ['Programmes', fmtNum(k.total)],
      ['Companies', fmtNum(k.companies)],
      ['Industries Covered', fmtNum(k.industries)],
      ['Countries Covered', fmtNum(k.countries)],
      ['Geographic Markets', fmtNum(k.geoMarkets)],
      ['Free', fmtPct(k.freePct)],
      ['Paid / Subscription', fmtPct(k.paidPct + k.subscriptionPct)],
      ['Tiered', fmtPct(k.tieredPct)]
    ].map(([label, value]) => `
      <div class="kpi-item"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div></div>
    `).join('');

    contextLine.innerHTML = k.total
      ? `<b>${fmtNum(k.total)}</b> programmes · <b>${fmtNum(k.companies)}</b> companies · <b>${fmtNum(k.industries)}</b> industries · <b>${fmtNum(k.countries)}</b> countries · <b>${fmtPct(k.freePct)}</b> free · <b>${fmtPct(k.tieredPct)}</b> tiered`
      : 'No programmes match the current filters.';

    const dq = dataQuality(programmes);
    const suspicious = suspiciousLaunchYears(programmes);
    dqCard.innerHTML = `
      <h3>Data Quality</h3>
      <div class="settings-hint" style="margin-bottom: 2px;">How complete the current (filtered) dataset is — shown directly rather than folded into a headline percentage.</div>
      ${dq.map(f => `
        <div class="data-quality-row">
          <span class="dq-label">${escapeHtml(f.label)}</span>
          <span class="dq-bar-track"><span class="dq-bar-fill" style="width:${f.pct.toFixed(1)}%"></span></span>
          <span class="dq-pct">${fmtPct(f.pct)} (${f.missing} missing)</span>
        </div>
      `).join('')}
      ${suspicious.length ? `<div class="chart-card-note" style="margin-top: 12px;">${suspicious.length} programme(s) have an implausible Launch Year (before 1850 or after ${currentYear + 1}) — worth checking the record rather than assuming the analysis is wrong.</div>` : ''}
    `;
  }

  return render;
}
