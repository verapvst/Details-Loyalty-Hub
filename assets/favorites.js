import { supabase } from './supabase.js';
import { initNav } from './app.js';
import { escapeHtml } from './fields.js';
import { heartHTML, likeSummary, targetTypeLabel, openLikeModal } from './likes.js';

initNav('favorites');

const listEl = document.getElementById('favorite-list');
const sectionCount = document.getElementById('section-count');
const filterType = document.getElementById('filter-type');
const filterProgramme = document.getElementById('filter-programme');
const searchInput = document.getElementById('search-input');

let allLikes = [];
let groups = [];

// One Like row per person's annotation on a target — grouped here into one card per
// (programme, target) so the shared heart/count and each person's note sit together.
function buildGroups() {
  const map = new Map();
  allLikes.forEach(l => {
    const key = `${l.programme_id}|${l.target_type}|${l.target_label}`;
    if (!map.has(key)) {
      map.set(key, {
        programme_id: l.programme_id,
        programme_name: l.programmes?.programme_name || 'Unknown programme',
        target_type: l.target_type,
        target_label: l.target_label,
        target_id: l.target_id,
        entries: []
      });
    }
    map.get(key).entries.push(l);
  });
  groups = [...map.values()].sort((a, b) =>
    a.programme_name.localeCompare(b.programme_name) || a.target_type.localeCompare(b.target_type)
  );
}

function distinctSorted(list, key) {
  return [...new Set(list.map(g => g[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateFilters() {
  const currentType = filterType.value;
  const currentProg = filterProgramme.value;

  filterType.innerHTML = '<option value="">All</option>' +
    distinctSorted(groups, 'target_type').map(t => `<option value="${t}">${escapeHtml(targetTypeLabel(t))}</option>`).join('');
  filterProgramme.innerHTML = '<option value="">All</option>' +
    distinctSorted(groups, 'programme_name').map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');

  filterType.value = currentType;
  filterProgramme.value = currentProg;
}

function renderGroup(g) {
  const summary = likeSummary(g.entries, g.target_type, g.target_label);
  const entriesHTML = g.entries.map(e => `
    <div class="favorite-entry">
      <div class="favorite-entry-head">
        <span class="favorite-entry-person">${escapeHtml(e.liked_by || 'Unknown')}</span>
        ${(e.psychological_effect && e.psychological_effect.length) ? `
          <div class="chip-row" style="margin: 0;">
            ${e.psychological_effect.map(p => `<span class="chip" style="padding: 3px 10px;">${escapeHtml(p)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      ${e.description ? `<div class="favorite-entry-desc">${escapeHtml(e.description)}</div>` : ''}
      ${e.psychological_effect_notes ? `<div class="favorite-entry-notes">${escapeHtml(e.psychological_effect_notes)}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div>
          <div class="badge badge-muted" style="margin-bottom: 8px;">${escapeHtml(targetTypeLabel(g.target_type))}</div>
          <div class="list-row-title">
            <a href="programme.html?id=${g.programme_id}" style="color: inherit;">${escapeHtml(g.programme_name)}</a>
            <span style="color: var(--muted); font-weight: 400;"> — ${escapeHtml(g.target_label)}</span>
          </div>
        </div>
        <div class="favorite-heart-wrap" data-programme-id="${g.programme_id}" data-programme-name="${escapeHtml(g.programme_name)}">
          ${heartHTML(g.target_type, g.target_label, g.target_id, summary)}
        </div>
      </div>
      <div class="favorite-entries">${entriesHTML}</div>
    </div>
  `;
}

// heartHTML's buttons only carry target info — each card here can belong to a
// different programme, so wire per-card rather than reusing likes.js's wireHearts
// (which assumes every heart in a container shares one programme/likes context).
function wireFavoriteHearts() {
  listEl.querySelectorAll('.favorite-heart-wrap').forEach(wrap => {
    const btn = wrap.querySelector('.like-heart');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const programmeId = wrap.dataset.programmeId;
      const programmeName = wrap.dataset.programmeName;
      const targetType = btn.dataset.targetType;
      const targetLabel = btn.dataset.targetLabel;
      const targetId = btn.dataset.targetId || null;
      const groupEntries = allLikes.filter(l =>
        l.programme_id === programmeId && l.target_type === targetType && l.target_label === targetLabel
      );
      const { mine } = likeSummary(groupEntries, targetType, targetLabel);
      openLikeModal({
        programmeId, programmeName, targetType, targetLabel, targetId,
        existingLike: mine, likes: groupEntries,
        onChange: loadAllLikes
      });
    });
  });
}

function applyFiltersAndRender() {
  const type = filterType.value;
  const prog = filterProgramme.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = groups.filter(g => {
    if (type && g.target_type !== type) return false;
    if (prog && g.programme_name !== prog) return false;
    if (q) {
      const hay = [
        g.programme_name, g.target_label,
        ...g.entries.flatMap(e => [e.description, e.psychological_effect_notes, e.liked_by])
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sectionCount.textContent = `${filtered.length} of ${groups.length}`;

  if (!filtered.length) {
    listEl.innerHTML = groups.length
      ? `<div class="empty-state"><div class="em-title">No favorites match</div><p>Try adjusting or clearing the filters.</p></div>`
      : `<div class="empty-state"><div class="em-title">No favorites yet</div><p>Heart a mechanism, benefit, or feature on any programme's page to see it here.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderGroup).join('');
  wireFavoriteHearts();
}

async function loadAllLikes() {
  const { data, error } = await supabase
    .from('likes')
    .select('*, programmes(programme_name)')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load favorites: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allLikes = data || [];
  buildGroups();
  populateFilters();
  applyFiltersAndRender();
}

[filterType, filterProgramme].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterType.value = '';
  filterProgramme.value = '';
  searchInput.value = '';
  applyFiltersAndRender();
});

loadAllLikes();
