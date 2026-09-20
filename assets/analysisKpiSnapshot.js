// Analysis tab — Database Snapshot KPIs. A single row of numbers, always computed
// live from the current (filtered) dataset. Every card that maps to a concrete subset
// of programmes (Programmes / Free / Paid & Subscription / Tiered) is clickable and
// opens the exact list behind it — clicking anything on this page should always make
// it obvious which programmes the number is talking about.
import { escapeHtml } from './fields.js';
import { snapshotKpis } from './analysisData.js';
import { fmtPct, fmtNum } from './charts.js';
import { openProgrammeListModal } from './chartToolbar.js';

export function mountKpiSnapshot() {
  const kpiRow = document.getElementById('snapshot-kpi-row');
  let lastProgrammes = [];

  function render(programmes) {
    lastProgrammes = programmes;
    const k = snapshotKpis(programmes);
    const cards = [
      { label: 'Programmes', value: fmtNum(k.total), filter: () => programmes },
      { label: 'Companies', value: fmtNum(k.companies) },
      { label: 'Industries Covered', value: fmtNum(k.industries) },
      { label: 'Countries Covered', value: fmtNum(k.countries) },
      { label: 'Geographic Markets', value: fmtNum(k.geoMarkets) },
      { label: 'Free', value: fmtPct(k.freePct), filter: () => programmes.filter(p => p.membership_type === 'Free') },
      { label: 'Paid / Subscription', value: fmtPct(k.paidPct + k.subscriptionPct), filter: () => programmes.filter(p => p.membership_type === 'Paid' || p.membership_type === 'Subscription') },
      { label: 'Tiered', value: fmtPct(k.tieredPct), filter: () => programmes.filter(p => (p.mechanisms || []).includes('Tiering')) }
    ];

    kpiRow.innerHTML = cards.map((c, i) => `
      <div class="kpi-item ${c.filter ? 'kpi-item-clickable' : ''}" data-kpi="${i}">
        <div class="kpi-label">${escapeHtml(c.label)}</div>
        <div class="kpi-value">${escapeHtml(c.value)}</div>
      </div>
    `).join('');

    kpiRow.querySelectorAll('.kpi-item-clickable').forEach(el => {
      const card = cards[Number(el.dataset.kpi)];
      el.addEventListener('click', () => {
        openProgrammeListModal({ title: card.label, subtitle: `${fmtNum(card.filter().length)} of ${fmtNum(programmes.length)} programmes`, programmes: card.filter() });
      });
    });
  }

  return render;
}
