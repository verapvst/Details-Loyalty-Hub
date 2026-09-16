import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { loadCustomOptions } from './customOptions.js';
import { openSourceModal } from './sourceModal.js';

await initNav('sources');
await loadCustomOptions();

const listEl = document.getElementById('source-list');
const searchInput = document.getElementById('search-input');
let allSources = [];

// Legacy rows added before this restructure may not have source_name/short_citation
// yet (only the migration's one-time backfill from the old citation_tag) — fall back
// to whatever is present so nothing old looks blank.
function displayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

// Compact, scannable row: Short Citation, Source Name, and a Type · Scope meta line —
// nothing else. Full citation, URL, author/year detail and Edit/Delete all live on
// the Source Detail page (source.html) — this list is for browsing, not reading.
function renderRow(s) {
  const shortCitation = s.short_citation || s.citation_tag;
  const metaParts = [s.source_type, ...(s.scope || [])].filter(Boolean);

  return `
    <a href="source.html?id=${s.id}" class="list-row" style="display: block; text-decoration: none; color: inherit;">
      ${shortCitation ? `<div class="badge badge-muted" style="margin-bottom: 6px;">${escapeHtml(shortCitation)}</div>` : ''}
      <div class="list-row-title">${escapeHtml(displayName(s))}</div>
      ${metaParts.length ? `<div class="list-row-meta" style="margin-top: 6px;">${metaParts.map(escapeHtml).join(' · ')}</div>` : ''}
    </a>
  `;
}

function applyFilterAndRender() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = !q ? allSources : allSources.filter(s => {
    const hay = `${displayName(s)} ${s.author_org || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    listEl.innerHTML = allSources.length
      ? `<div class="empty-state"><div class="em-title">No sources match</div><p>Try a different search.</p></div>`
      : `<div class="empty-state"><div class="em-title">No sources yet</div><p>Add the first one to start citing stats and findings.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderRow).join('');
}

async function loadSources() {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load sources: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allSources = data || [];
  applyFilterAndRender();
}

searchInput.addEventListener('input', applyFilterAndRender);

document.getElementById('btn-add-source').addEventListener('click', () => openSourceModal({ source: null, onChange: loadSources }));

loadSources();
