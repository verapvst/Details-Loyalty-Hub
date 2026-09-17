import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { heartHTML, likeSummary, targetTypeLabel, openLikeModal, openTargetPickerModal } from './likes.js';

await initNav('favorites');

const listEl = document.getElementById('favorite-list');
const sectionCount = document.getElementById('section-count');
const filterType = document.getElementById('filter-type');
const filterProgramme = document.getElementById('filter-programme');
const searchInput = document.getElementById('search-input');

let allLikes = [];
let groups = [];

function groupKey(g) {
  return `${g.programme_id}|${g.target_type}|${g.target_label}`;
}

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
        cover_image_url: l.programmes?.cover_image_url || null,
        industry: l.programmes?.industry || null,
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

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// The row's title is the actual takeaway (why someone found it interesting), not
// just what was tagged — falls back to the target label when no one has written a
// description yet, same "graceful fallback" pattern used for Insight titles.
function rowTitle(g) {
  return g.entries.find(e => e.description)?.description || g.target_label;
}

// Library row, not a card: logo, title, secondary line, metadata badges on the
// right — one line each, a hairline separator between rows, no container per item.
// Everything else (who liked it, psychological effect, edit/delete, the heart)
// lives behind a click — see openFavoriteDetailModal.
function renderRow(g) {
  const subParts = [g.programme_name, g.industry].filter(Boolean);
  const logo = g.cover_image_url
    ? `<div class="lib-row-logo"><img src="${escapeHtml(g.cover_image_url)}" alt="" onerror="this.parentElement.remove()" /></div>`
    : `<div class="lib-row-logo-fallback">${escapeHtml(initial(g.programme_name))}</div>`;

  return `
    <div class="lib-row" data-group-key="${escapeHtml(groupKey(g))}">
      ${logo}
      <div class="lib-row-body">
        <div class="lib-row-title">${escapeHtml(rowTitle(g))}</div>
        <div class="lib-row-sub">${escapeHtml(subParts.join(' · '))}</div>
      </div>
      <div class="lib-row-meta">
        <span class="badge badge-muted">${escapeHtml(targetTypeLabel(g.target_type))}</span>
        ${g.entries.length > 1 ? `<span class="badge badge-muted">${g.entries.length} notes</span>` : ''}
      </div>
    </div>
  `;
}

// Read/edit surface for one group — everything the old inline card used to show
// (every entry, psychological effect, notes, per-entry Edit/Delete, the heart) now
// lives here instead of in the overview. Re-renders itself in place after any change
// so Edit/Delete/heart all stay usable without closing and reopening.
function openFavoriteDetailModal(g, { onChange }) {
  let root = document.getElementById('favorite-detail-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'favorite-detail-root';
    document.body.appendChild(root);
  }

  function renderModal() {
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

    root.innerHTML = `
      <div class="modal-overlay" id="favorite-detail-modal">
        <div class="form-modal" style="max-width: 560px;">
          <div class="form-modal-head">
            <div>
              <div class="badge badge-muted" style="margin-bottom: 8px;">${escapeHtml(targetTypeLabel(g.target_type))}</div>
              <h2 style="font-size: 20px;">
                <a href="programme.html?id=${g.programme_id}" class="favorite-programme-link">${escapeHtml(g.programme_name)}</a>
                <span style="color: var(--muted); font-weight: 400;"> · ${escapeHtml(g.target_label)}</span>
              </h2>
            </div>
            <button type="button" class="form-modal-close" id="favorite-detail-close">&times;</button>
          </div>
          <div class="form-modal-body">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span id="favorite-detail-heart"></span>
              <span class="settings-hint" style="margin: 0;">${summary.mine ? 'You liked this. Click the heart to remove or edit your note.' : 'Click the heart to add your own note.'}</span>
            </div>
            <div class="favorite-entries">${entriesHTML || '<div class="settings-hint" style="margin:0;">No notes yet.</div>'}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="favorite-detail-close-btn">Close</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('favorite-detail-heart').innerHTML = heartHTML(g.target_type, g.target_label, g.target_id, summary);

    const overlay = document.getElementById('favorite-detail-modal');
    const close = () => root.innerHTML = '';
    document.getElementById('favorite-detail-close').addEventListener('click', close);
    document.getElementById('favorite-detail-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const openEditor = (existingLike) => openLikeModal({
      programmeId: g.programme_id, programmeName: g.programme_name,
      targetType: g.target_type, targetLabel: g.target_label, targetId: g.target_id,
      existingLike, likes: g.entries,
      onChange: async () => { await onChange(); refreshAndRerender(); }
    });

    root.querySelector('.like-heart').addEventListener('click', () => openEditor(summary.mine));
    root.querySelectorAll('[data-like-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditor(g.entries.find(e => e.id === btn.dataset.likeEdit)));
    });
    root.querySelectorAll('[data-like-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this favorite?')) return;
        await supabase.from('likes').delete().eq('id', btn.dataset.likeDelete);
        await onChange();
        refreshAndRerender();
      });
    });
  }

  // After any change, re-derive this group from the freshly reloaded data — if the
  // last entry was just deleted the group no longer exists, so close instead.
  function refreshAndRerender() {
    if (!document.getElementById('favorite-detail-modal')) return; // closed itself meanwhile
    const updated = groups.find(gr => groupKey(gr) === groupKey(g));
    if (!updated) { root.innerHTML = ''; return; }
    g.entries = updated.entries;
    renderModal();
  }

  renderModal();
}

function wireRowClicks() {
  listEl.querySelectorAll('.lib-row').forEach(row => {
    row.addEventListener('click', () => {
      const group = groups.find(g => groupKey(g) === row.dataset.groupKey);
      if (group) openFavoriteDetailModal(group, { onChange: loadAllLikes });
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

  listEl.innerHTML = filtered.map(renderRow).join('');
  wireRowClicks();
}

async function loadAllLikes() {
  const { data, error } = await supabase
    .from('likes')
    .select('*, programmes(programme_name, cover_image_url, industry)')
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
