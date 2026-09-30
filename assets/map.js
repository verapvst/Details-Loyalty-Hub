import { initNav } from './app.js';
import { escapeHtml } from './fields.js';
import {
  loadPortfolioAssets, CATEGORY_ORDER, CATEGORY_COLORS, categoryColor, categoryLabel,
  ALGARVE_BOUNDS, PORTUGAL_BOUNDS
} from './mapData.js';

// Chrome/Safari restore a previous scroll offset on reload by default, which
// on a page with no natural scroll (the shell is exactly viewport-height)
// only ever shows as the header clipped a few px under the fixed nav.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

await initNav('map');

const state = { activeCategories: new Set(CATEGORY_ORDER), query: '' };
let allAssets = [];
let markersByAssetId = new Map();
let map, markerLayer;

function primaryCategory(asset) {
  const cats = asset.categories || [];
  return CATEGORY_ORDER.find(c => cats.includes(c)) || cats[0] || null;
}

function matchesFilters(asset) {
  const cats = asset.categories || [];
  if (!cats.some(c => state.activeCategories.has(c))) return false;
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return (asset.asset_name || '').toLowerCase().includes(q) || (asset.location || '').toLowerCase().includes(q);
}

function visibleAssets() {
  return allAssets.filter(matchesFilters);
}

// ---------------- Legend ----------------

function renderLegend() {
  const el = document.getElementById('map-legend');
  const counts = new Map(CATEGORY_ORDER.map(c => [c, 0]));
  allAssets.forEach(a => (a.categories || []).forEach(c => counts.has(c) && counts.set(c, counts.get(c) + 1)));

  el.innerHTML = CATEGORY_ORDER.map(cat => {
    const active = state.activeCategories.has(cat);
    return `
      <button type="button" class="map-legend-item ${active ? '' : 'inactive'}" data-cat="${escapeHtml(cat)}">
        <span class="map-legend-dot" style="background:${categoryColor(cat)}"></span>
        <span class="map-legend-label">${escapeHtml(categoryLabel(cat))}</span>
        <span class="map-legend-count">${counts.get(cat)}</span>
      </button>
    `;
  }).join('');

  el.querySelectorAll('.map-legend-item').forEach(btn => btn.addEventListener('click', () => {
    const cat = btn.dataset.cat;
    if (state.activeCategories.has(cat)) state.activeCategories.delete(cat);
    else state.activeCategories.add(cat);
    render();
  }));
}

// ---------------- Individual markers ----------------
// L.marker (not circleMarker) — Leaflet.markercluster only clusters actual
// Marker instances, not vector/Path layers, so the coloured dot is a divIcon
// styled in CSS (.map-dot-icon) rather than an SVG circleMarker.

function markerDiameter(confidence) {
  return confidence === 'approximate' ? 14 : 16;
}

// A single asset in 2+ categories (Monte Rei: Golf + Resort, equally — not
// "mostly golf") gets the same even-split pie treatment as a cluster of
// several assets, just sized down to dot scale, instead of collapsing to one
// "primary" colour — nothing about these categories is actually weighted, so
// the dot shouldn't imply one is dominant. A single-category asset keeps the
// cheaper flat-colour dot (still the common case: 26 of 32 assets).
function assetDotHTML(asset, size) {
  const cats = asset.categories || [];
  const borderStyle = asset.coordinate_confidence === 'approximate' ? 'dashed' : 'solid';
  if (cats.length <= 1) {
    const color = categoryColor(cats[0]);
    return `<span class="map-dot-icon" style="width:${size}px;height:${size}px;background:${color};border-width:1.5px;border-style:${borderStyle};"></span>`;
  }
  // A stroke-drawn donut ring (fine for the larger cluster icons) breaks down at
  // this scale: filling the hole needs a stroke much thicker than the radius,
  // and the later-drawn arc's thick round ends then bleed across the centre and
  // overpaint most of the earlier one — an even split rendered as ~90/10. Filled
  // pie wedges (true sectors from the centre) don't have that failure mode at
  // any radius, so individual dots use those instead of donutSegmentsSVG.
  const counts = cats.map(cat => ({ color: categoryColor(cat), count: 1 }));
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${pieSlicesSVG(counts, size)}</svg>`;
  return `<span class="map-dot-icon map-dot-icon-pie" style="width:${size}px;height:${size}px;border-width:2px;border-style:${borderStyle};">${svg}</span>`;
}

function pieSlicesSVG(counts, size) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  const c = size / 2;
  const r = c;
  let angle = -Math.PI / 2;
  return counts.map(({ color, count }) => {
    const sweep = (count / total) * 2 * Math.PI;
    const next = angle + sweep;
    const x1 = (c + r * Math.cos(angle)).toFixed(2), y1 = (c + r * Math.sin(angle)).toFixed(2);
    const x2 = (c + r * Math.cos(next)).toFixed(2), y2 = (c + r * Math.sin(next)).toFixed(2);
    const largeArc = sweep > Math.PI ? 1 : 0;
    angle = next;
    return `<path d="M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />`;
  }).join('');
}

function buildMarker(asset) {
  const cat = primaryCategory(asset);
  const size = markerDiameter(asset.coordinate_confidence) + ((asset.categories || []).length > 1 ? 2 : 0);
  const html = assetDotHTML(asset, size);
  const icon = L.divIcon({ className: 'map-dot-icon-wrap', html, iconSize: [size, size] });
  const m = L.marker([asset.latitude, asset.longitude], { icon });
  m._assetCategory = cat;
  m._assetCategories = asset.categories || [cat];
  m.on('click', () => openInfoPanel(asset));
  m.bindTooltip(asset.asset_name, { direction: 'top', offset: [0, -size / 2], opacity: 0.95 });
  return m;
}

// ---------------- Cluster icon: a mini donut chart of what's in the cluster ----------------
// Answers exactly "what kind of assets does this area have" at a glance, without
// opening anything — a cluster of all-green dots reads as "just golf here", one
// with 3 colours reads as "hotel + golf + F&B ecosystem". Stroke-dasharray donut
// segments (no trig/path-arc math needed), ordered by CATEGORY_ORDER so the same
// category always gets the same clock position across every cluster on the map.

function donutSegmentsSVG(counts, size, strokeWidth) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return counts.map(({ color, count }) => {
    const dash = (count / total) * circumference;
    const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${c} ${c})" />`;
    offset += dash;
    return el;
  }).join('');
}

function buildClusterIcon(cluster) {
  const markers = cluster.getAllChildMarkers();
  // Each marker contributes to EVERY one of its categories, not just a single
  // "primary" one — otherwise a Golf+Resort asset like Palmares or Monte Rei
  // always reads as pure Resort in the cluster donut and its Golf side
  // disappears the moment you zoom out past the individual-marker view.
  // Weighted 1/N per category so a multi-category asset still counts as one
  // asset overall (matches the "total" badge), just split across its colours.
  const byCategory = new Map();
  markers.forEach(m => {
    const cats = m._assetCategories && m._assetCategories.length ? m._assetCategories : [m._assetCategory];
    const weight = 1 / cats.length;
    cats.forEach(cat => byCategory.set(cat, (byCategory.get(cat) || 0) + weight));
  });
  const counts = CATEGORY_ORDER.filter(cat => byCategory.has(cat)).map(cat => ({ color: categoryColor(cat), count: byCategory.get(cat) }));
  const total = markers.length;
  const size = total < 8 ? 42 : total < 20 ? 52 : 64;
  const strokeWidth = Math.round(size * 0.22);

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${(size - strokeWidth) / 2}" fill="#FFFFFF" />
    ${counts.length > 1
      ? donutSegmentsSVG(counts, size, strokeWidth)
      : `<circle cx="${size / 2}" cy="${size / 2}" r="${(size - strokeWidth) / 2}" fill="none" stroke="${counts[0]?.color || '#6E6E73'}" stroke-width="${strokeWidth}" />`}
  </svg>`;

  return L.divIcon({
    html: `<div class="map-cluster-icon" style="width:${size}px;height:${size}px;">${svg}<span class="map-cluster-count">${total}</span></div>`,
    className: 'map-cluster-wrap',
    iconSize: L.point(size, size)
  });
}

// ---------------- Markers ----------------

function renderMarkers() {
  markerLayer.clearLayers();
  markersByAssetId.clear();
  const markers = [];
  visibleAssets().forEach(asset => {
    if (asset.latitude == null || asset.longitude == null) return;
    const m = buildMarker(asset);
    markers.push(m);
    markersByAssetId.set(asset.id, m);
  });
  markerLayer.addLayers(markers);
}

// ---------------- Sidebar list ----------------

function renderList() {
  const listEl = document.getElementById('map-asset-list');
  const shown = visibleAssets().sort((a, b) => a.asset_name.localeCompare(b.asset_name));
  document.getElementById('map-list-count').textContent = shown.length;
  document.getElementById('map-total-count').textContent = allAssets.length;

  if (!shown.length) {
    listEl.innerHTML = '<div class="map-list-empty">No assets match the current filters.</div>';
    return;
  }
  listEl.innerHTML = shown.map(a => {
    const cat = primaryCategory(a);
    return `
      <button type="button" class="map-list-item" data-id="${escapeHtml(a.id)}">
        <span class="map-list-dot" style="background:${categoryColor(cat)}"></span>
        <span class="map-list-text">
          <span class="map-list-name">${escapeHtml(a.asset_name)}</span>
          <span class="map-list-loc">${escapeHtml(a.location || '')}</span>
        </span>
      </button>
    `;
  }).join('');

  listEl.querySelectorAll('.map-list-item').forEach(btn => btn.addEventListener('click', () => {
    const asset = allAssets.find(a => a.id === btn.dataset.id);
    if (!asset) return;
    openInfoPanel(asset);
    const marker = markersByAssetId.get(asset.id);
    if (marker) {
      // Zooms/pans just enough to pop the marker out of its cluster, rather than
      // only centring on an area where it might still be hidden inside one.
      markerLayer.zoomToShowLayer(marker, () => {});
    } else if (asset.latitude != null && asset.longitude != null) {
      map.flyTo([asset.latitude, asset.longitude], Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
  }));
}

// ---------------- Info panel ----------------

function confidenceNote(confidence) {
  if (confidence === 'approximate') return 'Location is approximate (town-level) — exact address not confirmed.';
  if (confidence === 'street') return 'Location matched to the street, not the exact building.';
  return null;
}

function openInfoPanel(asset) {
  const overlay = document.getElementById('map-info-overlay');
  const panel = document.getElementById('map-info-panel');
  const cats = asset.categories || [];
  const note = confidenceNote(asset.coordinate_confidence);

  panel.innerHTML = `
    <button type="button" class="map-info-close" aria-label="Close">&times;</button>
    <div class="map-info-cats">
      ${cats.map(c => `<span class="map-info-cat-chip" style="border-color:${categoryColor(c)}; color:${categoryColor(c)}">${escapeHtml(categoryLabel(c))}</span>`).join('')}
    </div>
    <h3 class="map-info-title">${escapeHtml(asset.asset_name)}</h3>
    <div class="map-info-loc">${escapeHtml(asset.location || '')}</div>
    ${asset.notes ? `<p class="map-info-notes">${escapeHtml(asset.notes)}</p>` : ''}
    ${note ? `<p class="map-info-confidence">${escapeHtml(note)}</p>` : ''}
    ${asset.website_url ? `<a class="btn-primary map-info-link" href="${escapeHtml(asset.website_url)}" target="_blank" rel="noopener">Visit official site →</a>` : ''}
  `;
  panel.querySelector('.map-info-close').addEventListener('click', closeInfoPanel);
  overlay.hidden = false;

  document.querySelectorAll('.map-list-item.active').forEach(el => el.classList.remove('active'));
  document.querySelector(`.map-list-item[data-id="${asset.id}"]`)?.classList.add('active');
}

function closeInfoPanel() {
  document.getElementById('map-info-overlay').hidden = true;
}

// ---------------- Map setup ----------------

function initMap() {
  // Esri World Light Gray Canvas — keyless, muted/minimal basemap (CARTO's
  // Positron tiles started requiring a paid API key as of 23 Sep 2026, days
  // before this was built — confirmed live, not assumed from memory).
  map = L.map('map-canvas', { zoomControl: true, minZoom: 6, maxZoom: 17 });
  const attribution = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution, maxZoom: 16, maxNativeZoom: 16 }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, maxNativeZoom: 16 }).addTo(map);

  // Past zoom 15, individual assets in even the densest cluster (Vilamoura) are
  // far enough apart on screen to split into their own dots — matches "zoom in
  // until you see the actual assets, not just the mix".
  markerLayer = L.markerClusterGroup({
    iconCreateFunction: buildClusterIcon,
    maxClusterRadius: 55,
    disableClusteringAtZoom: 15,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
  }).addTo(map);

  map.fitBounds(PORTUGAL_BOUNDS, { padding: [20, 20] });

  // The canvas sits in a flex layout (sidebar width resolves the map's width),
  // so Leaflet can measure its container a frame too early on first paint and
  // under-render tiles on one side until something nudges it. Re-measuring
  // once after layout settles, and again on any later resize, avoids that.
  requestAnimationFrame(() => map.invalidateSize());
  window.addEventListener('resize', () => map.invalidateSize());

  document.getElementById('map-info-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'map-info-overlay') closeInfoPanel();
  });

  document.querySelectorAll('.map-region-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.map-region-btn').forEach(b => b.classList.toggle('active', b === btn));
    map.flyToBounds(btn.dataset.region === 'algarve' ? ALGARVE_BOUNDS : PORTUGAL_BOUNDS, { padding: [20, 20], duration: 0.8 });
  }));

  document.getElementById('map-search').addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    render();
  });
}

function render() {
  renderLegend();
  renderMarkers();
  renderList();
}

async function boot() {
  initMap();
  try {
    allAssets = await loadPortfolioAssets();
    render();
  } catch (err) {
    console.error('Failed to load portfolio_assets', err);
    document.getElementById('map-asset-list').innerHTML = `<div class="map-list-empty">Couldn't load the portfolio (${escapeHtml(err.message || 'unknown error')}). If this is a fresh setup, run supabase/033_portfolio_assets.sql first.</div>`;
  }
}

boot();
