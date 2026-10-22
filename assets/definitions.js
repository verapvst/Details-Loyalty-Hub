// Hover definitions for every mechanism and benefit, on every page: rest the mouse on a name (chart label, bar,
// table row, chip) and the Steering 1 definition (slides 24-25) plus its scorecard tier appears.
import { DEFINITIONS, SCORECARD_MECHANISMS, SCORECARD_BENEFITS } from './options.js';

let tip = null;
let current = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'def-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  return tip;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function lookup(el) {
  // The element itself or up to two ancestors whose whole text (or title) is exactly a mechanism/benefit name.
  for (let i = 0, n = el; n && i < 3; i++, n = n.parentElement) {
    const candidates = [n.getAttribute && n.getAttribute('data-def-name'), n.getAttribute && n.getAttribute('title'), n.dataset && n.dataset.origTitle, (n.textContent || '').trim()];
    for (const c of candidates) {
      if (c && DEFINITIONS[c]) return { name: c, node: n };
      // Chart labels are cut with an ellipsis: match the full name that starts with the visible text.
      if (c && c.endsWith('…') && c.length > 6) { const full = Object.keys(DEFINITIONS).find(k => k.startsWith(c.slice(0, -1))); if (full) return { name: full, node: n }; }
    }
  }
  return null;
}

function show(found, x, y) {
  const d = DEFINITIONS[found.name];
  const sc = (d.kind === 'Mechanism' ? SCORECARD_MECHANISMS : SCORECARD_BENEFITS)[found.name];
  const t = ensureTip();
  t.innerHTML = `<div class="def-name">${esc(found.name)}</div><div class="def-meta">${esc(d.kind)} · ${esc(d.family)}</div><div class="def-text">${esc(d.text)}</div>${sc ? `<div class="def-score"><span class="sc-tier tier-${sc.tier.toLowerCase()}">${sc.tier}</span> scorecard rank ${sc.rank} of ${d.kind === 'Mechanism' ? 14 : 16} · score ${sc.score.toFixed(1)}</div>` : ''}`;
  t.hidden = false;
  move(x, y);
}

function move(x, y) {
  if (!tip || tip.hidden) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(x + 14, window.innerWidth - w - 8)) + 'px';
  tip.style.top = Math.max(8, (y + 18 + h > window.innerHeight) ? y - h - 12 : y + 18) + 'px';
}

function hide() {
  if (tip) tip.hidden = true;
  if (current && current.dataset.origTitle !== undefined) { current.setAttribute('title', current.dataset.origTitle); delete current.dataset.origTitle; }
  current = null;
}

document.addEventListener('mouseover', (e) => {
  const found = e.target instanceof Element ? lookup(e.target) : null;
  if (!found) { hide(); return; }
  if (current === found.node) return;
  hide();
  current = found.node;
  // Replace the browser's own tooltip (which only repeats the name) with the definition.
  if (current.hasAttribute('title')) { current.dataset.origTitle = current.getAttribute('title'); current.removeAttribute('title'); }
  show(found, e.clientX, e.clientY);
});
document.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hide(); });
document.addEventListener('scroll', hide, true);
