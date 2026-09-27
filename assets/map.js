import { initNav } from './app.js';
import { escapeHtml } from './fields.js';
import {
  loadPortfolioAssets, CATEGORY_ORDER, CATEGORY_COLORS, categoryColor, categoryLabel,
  ALGARVE_BOUNDS, PORTUGAL_BOUNDS
} from './mapData.js';

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

// ---------------- Markers ----------------

function markerRadius(confidence) {
  return confidence === 'approximate' ? 7 : 8;
}

function buildMarker(asset) {
  const cat = primaryCategory(asset);
  const color = categoryColor(cat);
  const isMulti = (asset.categories || []).length > 1;
  const m = L.circleMarker([asset.latitude, asset.longitude], {
    radius: markerRadius(asset.coordinate_confidence),
    color: '#FFFFFF',
    weight: isMulti ? 2.5 : 1.5,
    fillColor: color,
    fillOpacity: 0.92,
    opacity: 1,
    dashArray: asset.coordinate_confidence === 'approximate' ? '2,2' : null
  });
  m.on('click', () => openInfoPanel(asset));
  m.bindTooltip(asset.asset_name, { direction: 'top', offset: [0, -6], opacity: 0.95 });
  return m;
}

function renderMarkers() {
  markerLayer.clearLayers();
  markersByAssetId.clear();
  visibleAssets().forEach(asset => {
    if (asset.latitude == null || asset.longitude == null) return;
    const m = buildMarker(asset);
    m.addTo(markerLayer);
    markersByAssetId.set(asset.id, m);
  });
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
    if (asset.latitude != null && asset.longitude != null) {
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
  map = L.map('map-canvas', { zoomControl: true, minZoom: 6, maxZoom: 16 });
  const attribution = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution, maxZoom: 16 }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  map.fitBounds(PORTUGAL_BOUNDS, { padding: [20, 20] });

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
