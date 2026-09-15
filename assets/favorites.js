import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { heartHTML, likeSummary, targetTypeLabel, openLikeModal, openTargetPickerModal } from './likes.js';

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
        <button type="button" class="btn-text" data-like-edit="${e.id}" style="margin-left: auto;">Edit</button>
        <button type="button" class="task-remove" data-like-delete="${e.id}">&times;</button>
      </div>
      ${e.description ? `<div class="favorite-entry-desc">${escapeHtml(e.description)}</div>` : ''}
      ${e.psychological_effect_notes ? `<div class="favorite-entry-notes">${escapeHtml(e.psychological_effect_notes)}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="list-row favorite-row" data-programme-id="${g.programme_id}" data-programme-name="${escapeHtml(g.programme_name)}">
      <div class="list-row-top">
        <div>
          <div class="badge badge-muted" style="margin-bottom: 4px;">${escapeHtml(targetTypeLabel(g.target_type))}</div>
          <div class="list-row-title">
            <a href="programme.html?id=${g.programme_id}" class="favorite-programme-link">${escapeHtml(g.programme_name)}</a>
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

function wireEntryDelete() {
  listEl.querySelectorAll('[data-like-delete]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this favorite?')) return;
      await supabase.from('likes').delete().eq('id', btn.dataset.likeDelete);
      await loadAllLikes();
    });
  });
}

// Any team member can edit any entry (matches the rest of the app — tasks, meetings,
// sources are all editable by anyone), not just the person who originally added it.
function wireEntryEdit() {
  listEl.querySelectorAll('[data-like-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = allLikes.find(l => l.id === btn.dataset.likeEdit);
      if (!entry) return;
      const groupEntries = allLikes.filter(l =>
        l.programme_id === entry.programme_id && l.target_type === entry.target_type && l.target_label === entry.target_label
      );
      openLikeModal({
        programmeId: entry.programme_id,
        programmeName: entry.programmes?.programme_name || 'Unknown programme',
        targetType: entry.target_type, targetLabel: entry.target_label, targetId: entry.target_id,
        existingLike: entry, likes: groupEntries,
        onChange: loadAllLikes
      });
    });
  });
}

// The programme name is a real link (for hover affordance / opening in a new tab),
// but the whole row is clickable too — only the heart, edit and delete buttons opt out.
function wireRowNavigation() {
  listEl.querySelectorAll('.favorite-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.like-heart') || e.target.closest('[data-like-delete]') || e.target.closest('[data-like-edit]') || e.target.closest('a')) return;
      window.location.href = `programme.html?id=${row.dataset.programmeId}`;
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
  wireEntryEdit();
  wireEntryDelete();
  wireRowNavigation();
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

// "Add Favourite" from this page: pick a programme first, then hand off to the same
// target picker used from the programme page itself — same underlying object either way.
function openProgrammePickerModal() {
  let root = document.getElementById('like-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'like-modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="programme-picker-modal">
      <div class="form-modal" style="max-width: 460px;">
        <div class="form-modal-head">
          <h2>Add Favourite</h2>
          <button type="button" class="form-modal-close" id="pp-close">&times;</button>
        </div>
        <div class="form-modal-body">
          <div class="form-field full">
            <label>Programme</label>
            <select id="pp-programme"><option value="">Loading…</option></select>
          </div>
        </div>
        <div class="form-modal-foot">
          <button type="button" class="btn-text" id="pp-cancel">Cancel</button>
          <button type="button" class="btn-primary" id="pp-next">Next</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('programme-picker-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('pp-close').addEventListener('click', close);
  document.getElementById('pp-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const sel = document.getElementById('pp-programme');
  supabase.from('programmes').select('id, programme_name').order('programme_name').then(({ data }) => {
    const programmes = data || [];
    sel.innerHTML = '<option value=""></option>' +
      programmes.map(p => `<option value="${p.id}">${escapeHtml(p.programme_name)}</option>`).join('');
  });

  document.getElementById('pp-next').addEventListener('click', async () => {
    const programmeId = sel.value;
    if (!programmeId) { showToast('Pick a programme first.', true); return; }
    const programmeName = sel.options[sel.selectedIndex].textContent;

    const [{ data: programme }, { data: tiers }, { data: features }, { data: programmeLikes }] = await Promise.all([
      supabase.from('programmes').select('*').eq('id', programmeId).single(),
      supabase.from('programme_tiers').select('*').eq('programme_id', programmeId),
      supabase.from('programme_features').select('*').eq('programme_id', programmeId),
      supabase.from('likes').select('*').eq('programme_id', programmeId)
    ]);

    close();
    openTargetPickerModal({
      programmeId, programmeName, programme, tiers: tiers || [], features: features || [],
      likes: programmeLikes || [], onChange: loadAllLikes
    });
  });
}

document.getElementById('btn-add-favourite').addEventListener('click', openProgrammePickerModal);

loadAllLikes();
