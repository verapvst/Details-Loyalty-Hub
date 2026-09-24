// Analysis tab — dependency-free SVG chart rendering + export.
//
// Every chart is a single self-contained <svg> (title, subtitle, axes, legend and
// marks all drawn as SVG so "Download PNG" captures exactly what's on screen with a
// transparent background, presentation-ready). No charting library, no build step.
const SVG_NS = 'http://www.w3.org/2000/svg';

// Muted, low-saturation qualitative palette matching the app's gold/neutral aesthetic
// (assets/style.css --accent etc.) — deliberately not bright SaaS-dashboard colors.
export const PALETTE = [
  '#B18F46', '#4A6FA5', '#86775F', '#1E7A34', '#8E5572',
  '#B7791F', '#5C8374', '#93753A', '#A65E2E', '#6E6E73'
];
export function colorAt(i) { return PALETTE[i % PALETTE.length]; }

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== null && v !== undefined) node.setAttribute(k, v); });
  children.forEach(c => node.appendChild(c));
  return node;
}
function text(x, y, str, attrs = {}) {
  const t = el('text', { x, y, ...attrs });
  t.textContent = str;
  return t;
}

export function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString();
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
export function fmtPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function niceMax(max) {
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const residual = max / magnitude;
  let step;
  if (residual > 5) step = 10; else if (residual > 2) step = 5; else if (residual > 1) step = 2; else step = 1;
  return step * magnitude;
}

// No width/height attributes: the SVG's intrinsic aspect ratio comes from viewBox
// alone, so CSS (`width:100%; height:auto`) can scale it fluidly. `--native-w` records
// the size the chart was actually designed at: inside a normal chart card (which can
// be much wider than the chart on a big monitor) CSS caps width to this, so compact
// charts stay compact instead of stretching to fill whatever the card's width is;
// inside the Expand modal that cap is lifted on purpose, since growing bigger is the
// point there.
function baseSvg(width, height) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, xmlns: SVG_NS, class: 'analysis-svg' });
  svg.style.setProperty('--native-w', `${width}px`);
  return svg;
}

// Subtitles are built from live filter/measure state (ctx.filtersSummaryText(), a
// multi-select note, ...) so their length isn't bounded — SVG <text> never wraps on
// its own, so a long one used to just run past the chart's right edge and get
// silently clipped. Wrapping it onto as many lines as it needs (mirroring how
// legendRows() is measured before drawLegend() below) means it's always fully
// readable instead of cut off.
const SUBTITLE_CHAR_W = 5; // rough px per character at the subtitle's 9px font size
const SUBTITLE_LINE_H = 11;

function wrapSubtitle(subtitle, width) {
  if (!subtitle) return [];
  const maxChars = Math.max(20, Math.floor((width - 28) / SUBTITLE_CHAR_W));
  if (subtitle.length <= maxChars) return [subtitle];
  const words = subtitle.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  });
  if (cur) lines.push(cur);
  return lines;
}

// Measures the title/subtitle block's height BEFORE a chart's total canvas height is
// fixed, so callers whose height formula doesn't already self-adjust (anything that
// isn't derived from topOffset, e.g. a fixed-height legend or row list below it) can
// grow to fit however many lines the subtitle wrapped into instead of clipping them.
function titleBlockHeight(title, subtitle, width) {
  const lines = wrapSubtitle(subtitle, width);
  if (lines.length) return 34 + (lines.length - 1) * SUBTITLE_LINE_H + 12;
  if (title) return 32;
  return 10;
}

function titleBlock(svg, title, subtitle, width) {
  if (title) svg.appendChild(text(14, 20, title, { 'font-size': 12.5, 'font-weight': 600, fill: '#1D1D1F' }));
  const lines = wrapSubtitle(subtitle, width);
  lines.forEach((line, i) => svg.appendChild(text(14, 34 + i * SUBTITLE_LINE_H, line, { 'font-size': 9, fill: '#6E6E73' })));
  return titleBlockHeight(title, subtitle, width);
}

// How much taller the title block is than its single-line default (46/32/10) —
// callers whose height formula assumes a single-line subtitle add this so a wrapped
// one pushes everything below it down instead of overlapping or clipping.
function subtitleExtraHeight(title, subtitle, width) {
  const singleLineDefault = subtitle ? 46 : (title ? 32 : 10);
  return Math.max(0, titleBlockHeight(title, subtitle, width) - singleLineDefault);
}

const LEGEND_ROW_GAP = 16;

// Legend layout is measured BEFORE the chart's total height is fixed (see
// legendRows() below) so the svg can grow to fit however many rows a many-series
// chart wraps into — legend rows are never drawn past the bottom edge and clipped.
function legendItemWidth(item) { return 11 + 6 + item.name.length * 5.6 + 16; }

function legendRows(items, maxWidth) {
  let cx = 0, rows = 1;
  items.forEach((item) => {
    const w = legendItemWidth(item);
    if (cx + w > maxWidth && cx > 0) { cx = 0; rows++; }
    cx += w;
  });
  return rows;
}

function drawLegend(svg, items, x, y, maxWidth) {
  let cx = x;
  items.forEach((item) => {
    const w = legendItemWidth(item);
    if (cx + w > x + maxWidth && cx > x) { cx = x; y += LEGEND_ROW_GAP; }
    svg.appendChild(el('rect', { x: cx, y: y - 8, width: 9, height: 9, rx: 2, fill: item.color }));
    svg.appendChild(text(cx + 14, y, item.name, { 'font-size': 9, fill: '#1D1D1F' }));
    cx += w;
  });
}

// ---------------- Vertical bar / stacked / 100% stacked ----------------
// spec: { title, subtitle, categories:[str], series:[{name,values:[num]}], mode:'grouped'|'stacked'|'percent', valueSuffix }
export function renderBarChart(container, spec) {
  const width = 520;
  const baseHeight = 260 + subtitleExtraHeight(spec.title, spec.subtitle, width);
  const legendItems = spec.series.map((s, i) => ({ name: s.name, color: colorAt(i) }));
  const legendRowCount = spec.series.length > 1 ? legendRows(legendItems, width - 32) : 0;
  const legendH = legendRowCount * LEGEND_ROW_GAP;
  const height = baseHeight + legendH;
  const svg = baseSvg(width, height);
  const topOffset = titleBlock(svg, spec.title, spec.subtitle, width);

  const plotX = 44, plotY = topOffset + 8, plotW = width - plotX - 16, plotH = baseHeight - plotY - 26;
  const n = spec.categories.length;
  const percent = spec.mode === 'percent';
  const stacked = spec.mode === 'stacked' || percent;

  let maxVal;
  if (stacked) {
    const totals = spec.categories.map((_, ci) => spec.series.reduce((s, ser) => s + (ser.values[ci] || 0), 0));
    maxVal = percent ? Math.max(...totals, 1) : niceMax(Math.max(...totals, 1));
  } else {
    maxVal = niceMax(Math.max(...spec.series.flatMap(s => s.values), 1));
  }
  if (percent) maxVal = Math.max(...spec.categories.map((_, ci) => spec.series.reduce((s, ser) => s + (ser.values[ci] || 0), 0)), 100);

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const gy = plotY + plotH - (plotH * i) / gridSteps;
    svg.appendChild(el('line', { x1: plotX, y1: gy, x2: plotX + plotW, y2: gy, stroke: '#E8E8ED', 'stroke-width': 1 }));
    const val = (maxVal * i) / gridSteps;
    svg.appendChild(text(plotX - 8, gy + 3, percent ? `${Math.round(val)}%` : fmtNum(val), { 'font-size': 9.5, fill: '#AEAEB2', 'text-anchor': 'end' }));
  }

  const groupW = plotW / n;
  const barPad = groupW * 0.18;
  spec.categories.forEach((cat, ci) => {
    if (!stacked) {
      const bw = (groupW - barPad * 2) / spec.series.length;
      spec.series.forEach((s, si) => {
        const v = s.values[ci] || 0;
        const bh = (v / maxVal) * plotH;
        svg.appendChild(el('rect', {
          x: plotX + ci * groupW + barPad + si * bw, y: plotY + plotH - bh,
          width: Math.max(bw - 3, 1), height: bh, rx: 2, fill: colorAt(si),
          class: spec.onSelect ? 'bar-rect-clickable' : null, 'data-cat': cat, 'data-series': s.name
        }));
      });
    } else {
      let acc = 0;
      const total = spec.series.reduce((s, ser) => s + (ser.values[ci] || 0), 0);
      spec.series.forEach((s, si) => {
        const raw = s.values[ci] || 0;
        const v = percent ? (total ? (raw / total) * 100 : 0) : raw;
        const bh = (v / maxVal) * plotH;
        svg.appendChild(el('rect', {
          x: plotX + ci * groupW + barPad, y: plotY + plotH - acc - bh,
          width: Math.max(groupW - barPad * 2, 1), height: bh, fill: colorAt(si),
          class: spec.onSelect ? 'bar-rect-clickable' : null, 'data-cat': cat, 'data-series': s.name
        }));
        acc += bh;
      });
    }
    const labelStep = n > 14 ? Math.ceil(n / 14) : 1;
    if (ci % labelStep === 0) {
      svg.appendChild(text(plotX + ci * groupW + groupW / 2, plotY + plotH + 16, String(cat), { 'font-size': 9.5, fill: '#6E6E73', 'text-anchor': 'middle' }));
    }
  });

  svg.appendChild(el('line', { x1: plotX, y1: plotY + plotH, x2: plotX + plotW, y2: plotY + plotH, stroke: '#D8D8DC', 'stroke-width': 1 }));
  if (legendRowCount) drawLegend(svg, legendItems, 16, baseHeight + 10, width - 32);
  if (spec.onSelect) {
    svg.querySelectorAll('.bar-rect-clickable').forEach(rect => {
      rect.addEventListener('click', () => spec.onSelect(rect.getAttribute('data-cat'), rect.getAttribute('data-series')));
    });
  }
  container.appendChild(svg);
  return svg;
}

// ---------------- Horizontal bar (distribution) ----------------
// spec: { title, subtitle, rows:[{label,value,secondaryValue?}], valueLabel:fn, maxOverride, barColor }
export function renderHBarChart(container, spec) {
  const rowH = 18;
  const width = 520;
  const height = 62 + spec.rows.length * rowH + subtitleExtraHeight(spec.title, spec.subtitle, width);
  const svg = baseSvg(width, height);
  const topOffset = titleBlock(svg, spec.title, spec.subtitle, width);

  const CHAR_W = 5.4;
  const labelW = Math.min(150, Math.max(70, ...spec.rows.map(r => String(r.label).length * CHAR_W)));
  const plotX = 14 + labelW, plotY = topOffset + 6, plotW = width - plotX - 55;
  const maxVal = spec.maxOverride || niceMax(Math.max(...spec.rows.map(r => r.value), 1));
  const maxChars = Math.max(3, Math.floor((labelW - 4) / CHAR_W));

  spec.rows.forEach((r, i) => {
    const y = plotY + i * rowH;
    const fullLabel = String(r.label);
    // Long labels (e.g. a verbose qualification-unit name) are truncated with an
    // ellipsis rather than left to overflow past the SVG's left edge and get
    // silently clipped — the full text is still on hover and in View Data/export.
    const shown = fullLabel.length > maxChars ? `${fullLabel.slice(0, maxChars - 1)}…` : fullLabel;
    const labelEl = text(plotX - 8, y + rowH * 0.65, shown, { 'font-size': 10, fill: '#1D1D1F', 'text-anchor': 'end' });
    if (shown !== fullLabel) {
      const titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = fullLabel;
      labelEl.appendChild(titleEl);
    }
    svg.appendChild(labelEl);
    const bw = maxVal ? (r.value / maxVal) * plotW : 0;
    svg.appendChild(el('rect', {
      x: plotX, y: y + 3, width: Math.max(bw, 1), height: rowH - 7, rx: 3, fill: r.color || spec.barColor || colorAt(0),
      class: spec.onSelect ? 'hbar-rect hbar-rect-clickable' : 'hbar-rect', 'data-value': r.label
    }));
    const labelStr = spec.valueLabel ? spec.valueLabel(r) : fmtNum(r.value);
    svg.appendChild(text(plotX + bw + 6, y + rowH * 0.65, labelStr, { 'font-size': 9.5, fill: '#6E6E73' }));
  });

  if (spec.onSelect) {
    svg.querySelectorAll('.hbar-rect-clickable').forEach(rect => {
      rect.addEventListener('click', () => spec.onSelect(rect.getAttribute('data-value')));
    });
  }
  container.appendChild(svg);
  return svg;
}

// ---------------- Line / Area / Stacked Area ----------------
// spec: { title, subtitle, categories:[year], series:[{name,values}], mode:'line'|'area'|'stackedArea', percent }
export function renderLineChart(container, spec) {
  const width = 520;
  const baseHeight = 260 + subtitleExtraHeight(spec.title, spec.subtitle, width);
  const legendItems = spec.series.map((s, i) => ({ name: s.name, color: colorAt(i) }));
  const legendRowCount = spec.series.length > 1 ? legendRows(legendItems, width - 32) : 0;
  const legendH = legendRowCount * LEGEND_ROW_GAP;
  const height = baseHeight + legendH;
  const svg = baseSvg(width, height);
  const topOffset = titleBlock(svg, spec.title, spec.subtitle, width);

  const plotX = 44, plotY = topOffset + 8, plotW = width - plotX - 16, plotH = baseHeight - plotY - 26;
  const n = spec.categories.length;
  const stacked = spec.mode === 'stackedArea';
  const percent = !!spec.percent;

  let maxVal;
  if (stacked) {
    const totals = spec.categories.map((_, ci) => spec.series.reduce((s, ser) => s + (ser.values[ci] || 0), 0));
    maxVal = percent ? 100 : niceMax(Math.max(...totals, 1));
  } else {
    maxVal = niceMax(Math.max(...spec.series.flatMap(s => s.values), 1));
  }

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const gy = plotY + plotH - (plotH * i) / gridSteps;
    svg.appendChild(el('line', { x1: plotX, y1: gy, x2: plotX + plotW, y2: gy, stroke: '#E8E8ED', 'stroke-width': 1 }));
    const val = (maxVal * i) / gridSteps;
    svg.appendChild(text(plotX - 8, gy + 3, percent ? `${Math.round(val)}%` : fmtNum(val), { 'font-size': 9.5, fill: '#AEAEB2', 'text-anchor': 'end' }));
  }

  const xAt = (ci) => plotX + (n > 1 ? (ci / (n - 1)) * plotW : plotW / 2);

  if (stacked) {
    let accBottom = spec.categories.map(() => 0);
    spec.series.forEach((s, si) => {
      const topPts = spec.categories.map((_, ci) => {
        const total = spec.series.reduce((sum, ser) => sum + (ser.values[ci] || 0), 0);
        const raw = s.values[ci] || 0;
        const v = percent ? (total ? (raw / total) * 100 : 0) : raw;
        const top = accBottom[ci] + v;
        return top;
      });
      let d = `M ${xAt(0)} ${plotY + plotH - accBottom[0]} `;
      topPts.forEach((v, ci) => { d += `L ${xAt(ci)} ${plotY + plotH - v} `; });
      for (let ci = n - 1; ci >= 0; ci--) d += `L ${xAt(ci)} ${plotY + plotH - accBottom[ci]} `;
      d += 'Z';
      svg.appendChild(el('path', { d, fill: colorAt(si), 'fill-opacity': 0.85 }));
      accBottom = topPts;
    });
  } else {
    spec.series.forEach((s, si) => {
      const pts = s.values.map((v, ci) => [xAt(ci), plotY + plotH - (v / maxVal) * plotH]);
      if (spec.mode === 'area') {
        let d = `M ${pts[0][0]} ${plotY + plotH} `;
        pts.forEach(([x, y]) => { d += `L ${x} ${y} `; });
        d += `L ${pts[pts.length - 1][0]} ${plotY + plotH} Z`;
        svg.appendChild(el('path', { d, fill: colorAt(si), 'fill-opacity': 0.18 }));
      }
      let d = `M ${pts[0][0]} ${pts[0][1]} `;
      pts.forEach(([x, y]) => { d += `L ${x} ${y} `; });
      svg.appendChild(el('path', { d, fill: 'none', stroke: colorAt(si), 'stroke-width': 1.1, 'stroke-linejoin': 'round' }));
      if (spec.onSelect) {
        // No visible dot — just an invisible hit-area circle per point, so the line
        // itself stays a clean thin stroke while every point is still clickable.
        pts.forEach(([x, y], ci) => {
          const hitArea = el('circle', { cx: x, cy: y, r: 7, fill: 'transparent', class: 'line-point-clickable' });
          hitArea.addEventListener('click', () => spec.onSelect(spec.categories[ci], s.name));
          svg.appendChild(hitArea);
        });
      }
    });
  }

  const labelStep = n > 14 ? Math.ceil(n / 14) : 1;
  spec.categories.forEach((cat, ci) => {
    if (ci % labelStep === 0) svg.appendChild(text(xAt(ci), plotY + plotH + 16, String(cat), { 'font-size': 9.5, fill: '#6E6E73', 'text-anchor': 'middle' }));
  });
  svg.appendChild(el('line', { x1: plotX, y1: plotY + plotH, x2: plotX + plotW, y2: plotY + plotH, stroke: '#D8D8DC', 'stroke-width': 1 }));
  if (legendRowCount) drawLegend(svg, legendItems, 16, baseHeight + 10, width - 32);

  container.appendChild(svg);
  return svg;
}

// ---------------- Donut ----------------
// spec: { title, subtitle, data:[{label,value}] }
export function renderDonutChart(container, spec) {
  const width = 460;
  const r = 60, r0 = 35;
  // Height used to be fixed at 230 regardless of how many legend rows there were, so
  // a category list longer than ~11 items ran past the bottom edge and got clipped —
  // it now grows with the data, same principle as legendRows()/drawLegend() below.
  const topOffsetEstimate = titleBlockHeight(spec.title, spec.subtitle, width);
  const legendH = spec.data.length * 15 + 10;
  const circleH = topOffsetEstimate + r * 2 + 40;
  const height = Math.max(circleH, topOffsetEstimate + legendH + 14);
  const svg = baseSvg(width, height);
  const topOffset = titleBlock(svg, spec.title, spec.subtitle, width);
  const cx = 96, cy = topOffset + r + 16;
  const total = spec.data.reduce((s, d) => s + d.value, 0) || 1;

  let angle = -Math.PI / 2;
  spec.data.forEach((d, i) => {
    const frac = d.value / total;
    const a0 = angle, a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const p0o = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p1o = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const p0i = [cx + r0 * Math.cos(a1), cy + r0 * Math.sin(a1)];
    const p1i = [cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0)];
    const d_ = `M ${p0o[0]} ${p0o[1]} A ${r} ${r} 0 ${large} 1 ${p1o[0]} ${p1o[1]} L ${p0i[0]} ${p0i[1]} A ${r0} ${r0} 0 ${large} 0 ${p1i[0]} ${p1i[1]} Z`;
    const arcPath = el('path', { d: d_, fill: colorAt(i), class: spec.onSelect ? 'donut-arc donut-arc-clickable' : 'donut-arc', 'data-value': d.label });
    svg.appendChild(arcPath);
  });

  svg.appendChild(text(cx, cy - 3, fmtNum(total), { 'font-size': 17, 'font-weight': 600, fill: '#1D1D1F', 'text-anchor': 'middle' }));
  svg.appendChild(text(cx, cy + 12, 'programmes', { 'font-size': 8.5, fill: '#6E6E73', 'text-anchor': 'middle' }));

  const LEGEND_X = 182, CHAR_W = 5.3;
  const suffixMaxChars = 20; // " — 1,234 (100.0%)" never exceeds this
  const maxLabelChars = Math.max(8, Math.floor((width - LEGEND_X - 16) / CHAR_W) - suffixMaxChars);
  let ly = topOffset + 10;
  spec.data.forEach((d, i) => {
    const pct = total ? (d.value / total) * 100 : 0;
    const fullLabel = String(d.label);
    // A long category name (e.g. "Banking & Financial Services (incl. Credit Cards)")
    // used to just overflow past the SVG's right edge and get silently clipped — it's
    // truncated with an ellipsis instead, with the full name still on hover.
    const shownLabel = fullLabel.length > maxLabelChars ? `${fullLabel.slice(0, maxLabelChars - 1)}…` : fullLabel;
    svg.appendChild(el('rect', { x: LEGEND_X, y: ly - 7, width: 8, height: 8, rx: 2, fill: colorAt(i) }));
    const labelEl = text(LEGEND_X + 12, ly, `${shownLabel} — ${fmtNum(d.value)} (${fmtPct(pct)})`, { 'font-size': 9, fill: '#1D1D1F' });
    if (shownLabel !== fullLabel) {
      const titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = fullLabel;
      labelEl.appendChild(titleEl);
    }
    svg.appendChild(labelEl);
    ly += 15;
  });

  if (spec.onSelect) {
    svg.querySelectorAll('.donut-arc-clickable').forEach(arc => {
      arc.addEventListener('click', () => spec.onSelect(arc.getAttribute('data-value')));
    });
  }
  container.appendChild(svg);
  return svg;
}

// ---------------- Heatmap ----------------
// spec: { title, subtitle, rows:[str], cols:[str], matrix:[[num]], cellText:fn(v,r,c), colorMax, rowTotalLabel, colTotalLabel }
export function renderHeatmap(container, spec) {
  const ROW_CHAR_W = 5.2;
  const rowLabelW = Math.min(130, Math.max(64, ...spec.rows.map(r => String(r).length * ROW_CHAR_W)));
  const rowMaxChars = Math.max(3, Math.floor((rowLabelW - 4) / ROW_CHAR_W));
  const cellW = Math.max(34, Math.min(50, 460 / Math.max(spec.cols.length, 1)));
  const cellH = 20;
  const width = rowLabelW + cellW * spec.cols.length + 18;
  const colHeaderH = 40;
  const height = 42 + colHeaderH + cellH * spec.rows.length + 12 + subtitleExtraHeight(spec.title, spec.subtitle, width);
  const svg = baseSvg(width, height);
  const topOffset = titleBlock(svg, spec.title, spec.subtitle, width);

  const plotX = rowLabelW + 8, plotY = topOffset + colHeaderH;
  const maxV = spec.colorMax ?? Math.max(...spec.matrix.flat(), 1);

  spec.cols.forEach((c, ci) => {
    const g = el('g', { transform: `translate(${plotX + ci * cellW + cellW / 2}, ${plotY - 6}) rotate(-32)` });
    g.appendChild(text(0, 0, String(c), { 'font-size': 8.5, fill: '#1D1D1F', 'text-anchor': 'start' }));
    svg.appendChild(g);
    const cc = spec.labelColor ? spec.labelColor(c) : null;
    if (cc) svg.appendChild(el('rect', { x: plotX + ci * cellW, y: plotY - 4, width: cellW - 1.5, height: 2.5, rx: 1, fill: cc }));
  });

  spec.rows.forEach((r, ri) => {
    const fullLabel = String(r);
    const shown = fullLabel.length > rowMaxChars ? `${fullLabel.slice(0, rowMaxChars - 1)}…` : fullLabel;
    const labelEl = text(plotX - 8, plotY + ri * cellH + cellH / 2 + 3, shown, { 'font-size': 9, fill: '#1D1D1F', 'text-anchor': 'end' });
    if (shown !== fullLabel) {
      const titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = fullLabel;
      labelEl.appendChild(titleEl);
    }
    svg.appendChild(labelEl);
    const rc = spec.labelColor ? spec.labelColor(r) : null;
    if (rc) svg.appendChild(el('rect', { x: plotX - 5, y: plotY + ri * cellH + 2, width: 2.5, height: cellH - 5.5, rx: 1, fill: rc }));
    spec.cols.forEach((c, ci) => {
      const v = spec.matrix[ri][ci];
      const intensity = maxV ? Math.min(v / maxV, 1) : 0;
      const fill = mixColor('#F5EFE1', '#93753A', intensity);
      svg.appendChild(el('rect', {
        x: plotX + ci * cellW, y: plotY + ri * cellH, width: cellW - 1.5, height: cellH - 1.5, rx: 2, fill,
        class: spec.onSelect ? 'heatmap-cell-clickable' : null, 'data-row': String(r), 'data-col': String(c)
      }));
      const cellStr = spec.cellText ? spec.cellText(v, ri, ci) : fmtNum(v);
      svg.appendChild(text(plotX + ci * cellW + (cellW - 1.5) / 2, plotY + ri * cellH + cellH / 2 + 3, cellStr, { 'font-size': 8, fill: intensity > 0.55 ? '#FFFFFF' : '#1D1D1F', 'text-anchor': 'middle' }));
    });
  });

  if (spec.onSelect) {
    svg.querySelectorAll('.heatmap-cell-clickable').forEach(rect => {
      rect.addEventListener('click', () => spec.onSelect(rect.getAttribute('data-row'), rect.getAttribute('data-col')));
    });
  }
  container.appendChild(svg);
  return svg;
}

function mixColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------- Export ----------------

export function svgToPngBlob(svgEl, { scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    const vb = svgEl.viewBox.baseVal;
    const w = (vb && vb.width) || svgEl.width.baseVal.value || 680;
    const h = (vb && vb.height) || svgEl.height.baseVal.value || 400;
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not rasterize chart')); };
    img.src = url;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyTableToClipboard(headers, rows) {
  const tsv = [headers.join('\t'), ...rows.map(r => r.map(v => (v === null || v === undefined) ? '' : String(v)).join('\t'))].join('\n');
  try { await navigator.clipboard.writeText(tsv); return true; } catch { return false; }
}

export function downloadCSV(headers, rows, filename) {
  const esc = v => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

const SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let sheetJsPromise = null;
function ensureSheetJs() {
  if (window.XLSX) return Promise.resolve();
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SHEETJS_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the Excel export library.'));
      document.head.appendChild(script);
    });
  }
  return sheetJsPromise;
}

export async function downloadXLSX(headers, rows, filename) {
  await ensureSheetJs();
  const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Data');
  window.XLSX.writeFile(wb, filename);
}

// ---------------- Chart-type gating ----------------
// Keeps each Lab from offering nonsensical chart types for the dimensions picked.
export function compatibleChartTypes(xKind, yKind) {
  if (xKind === 'time' || yKind === 'time') return ['line', 'area', 'stackedArea', 'bar', 'stackedBar', 'stacked100Bar'];
  return ['heatmap', 'groupedBar', 'stackedBar', 'stacked100Bar'];
}
