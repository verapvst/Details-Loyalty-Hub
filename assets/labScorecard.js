// Analysis — Scorecard workspace: the 14 mechanisms and 16 benefits of Steering 1, each with its
// scorecard tier (Prioritize / Consider / Exclude) next to how often it appears in the benchmark,
// overall and in each of the 7 Core Industries. Counts always respect the filters at the top.
import { escapeHtml } from './fields.js';
import { MECHANISMS_14, BENEFITS_16, SCORECARD_MECHANISMS, SCORECARD_BENEFITS } from './options.js';
import { openProgrammeListModal } from './chartToolbar.js';

const CORE = ['Hotels', 'Golf', 'Food & Beverage', 'Wellness', 'Beach', 'Marine', 'Nightlife'];
const TIER_CLASS = { Prioritize: 'tier-prioritize', Consider: 'tier-consider', Exclude: 'tier-exclude' };

const VIEWS = {
  mechanisms: { label: 'Mechanisms', items: MECHANISMS_14.map(m => ({ name: m.name, family: m.family, text: m.definition })), score: SCORECARD_MECHANISMS, field: 'mechanisms' },
  benefits: { label: 'Benefits', items: BENEFITS_16.map(b => ({ name: b.name, family: b.family, text: b.examples })), score: SCORECARD_BENEFITS, field: 'benefits' }
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const heat = (p) => `background: rgba(177,143,70,${Math.min(0.55, p / 100 * 0.7).toFixed(2)})`;

export function mount(container, ctx) {
  const state = { view: 'mechanisms' };
  let programmes = [];

  function render(list) {
    if (list) programmes = list;
    const v = VIEWS[state.view];
    const total = programmes.length;
    const coded = programmes.filter(p => (p[v.field] || []).length).length;
    const byIndustry = Object.fromEntries(CORE.map(i => [i, programmes.filter(p => p.industry === i)]));
    const rows = v.items.map(it => {
      const sc = v.score[it.name] || {};
      const withIt = programmes.filter(p => (p[v.field] || []).includes(it.name));
      return { ...it, ...sc, n: withIt.length, withIt };
    }).sort((a, b) => (a.rank || 99) - (b.rank || 99));

    container.innerHTML = `
      <div class="sc-head">
        <div class="sc-toggle">
          ${Object.entries(VIEWS).map(([k, x]) => `<button type="button" class="sc-pill ${k === state.view ? 'active' : ''}" data-view="${k}">${x.label}</button>`).join('')}
        </div>
        <div class="sc-note">Ranked by Steering 1 scorecard. Percentages are the share of programmes in the current view (${total}) that use each ${state.view === 'mechanisms' ? 'mechanism' : 'benefit'}; ${coded} of ${total} are coded. A programme can have several.</div>
      </div>
      <div class="sc-legend"><span class="sc-tier tier-prioritize">Prioritize</span><span class="sc-tier tier-consider">Consider</span><span class="sc-tier tier-exclude">Exclude</span><span class="sc-note">Tiers are relative to the ${v.items.length} ${state.view} compared (mean ± 0.5 SD of the weighted scores).</span></div>
      <div class="sc-table-wrap"><table class="sc-table">
        <thead><tr><th>#</th><th>${v.label.slice(0, -1)}</th><th>Tier</th><th>Score</th><th>Programmes</th><th>All</th>${CORE.map(i => `<th title="${escapeHtml(i)}">${escapeHtml(i === 'Food & Beverage' ? 'F&B' : i)}<span class="sc-n">n=${byIndustry[i].length}</span></th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr data-i="${i}">
              <td class="sc-rank">${r.rank ?? ''}</td>
              <td class="sc-name"><strong>${escapeHtml(r.name)}</strong><span class="sc-family">${escapeHtml(r.family)}</span></td>
              <td><span class="sc-tier ${TIER_CLASS[r.tier] || ''}">${escapeHtml(r.tier || '')}</span></td>
              <td>${r.score != null ? r.score.toFixed(1) : ''}</td>
              <td><button type="button" class="sc-link" data-open="${i}">${r.n}</button></td>
              <td class="sc-cell" style="${heat(pct(r.n, total))}">${pct(r.n, total)}%</td>
              ${CORE.map(ind => { const base = byIndustry[ind]; const c = base.filter(p => (p[v.field] || []).includes(r.name)).length; const p = pct(c, base.length); return `<td class="sc-cell" style="${heat(p)}" title="${c} of ${base.length}">${base.length ? p + '%' : '–'}</td>`; }).join('')}
            </tr>`).join('')}
        </tbody>
      </table></div>`;
    container.querySelectorAll('.sc-pill').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; render(); ctx.persist(state); }));
    container.querySelectorAll('.sc-link').forEach(b => b.addEventListener('click', () => {
      const r = rows[Number(b.dataset.open)];
      openProgrammeListModal({ title: r.name, subtitle: `${r.tier || ''} · ${r.n} programme${r.n === 1 ? '' : 's'} · ${r.text}`, programmes: r.withIt });
    }));
  }

  return { render, getConfig: () => ({ ...state }), applyConfig: (c) => { if (c && VIEWS[c.view]) state.view = c.view; } };
}
