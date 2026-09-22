import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity, navLabel, renameIdentityIfMatches } from './app.js';
import { OPTIONS, SCOPE_GROUPS, PINNED_COUNTRIES } from './options.js';
import {
  loadCustomOptions, getOptionList, getCustomRows, getDeactivatedBuiltins, hasUsageCheck, countOptionUsage,
  addOption, setOptionActive, deleteOption, deactivateBuiltin, reactivateBuiltin,
  addScopeValue
} from './customOptions.js';
import { loadTeamMembers, getAllTeamMembers, teamAvatarUrl } from './teamMembers.js';
import { loadAppSettings, getAppSetting, setAppSetting } from './appSettings.js';
import { escapeHtml } from './fields.js';

await initNav('settings');
await Promise.all([loadCustomOptions(), loadTeamMembers(), loadAppSettings()]);

// ---------------- Shared building blocks ----------------

// One row per value: dimmed + "Reactivate" when inactive, "Deactivate" when active.
// A custom (team-added) value that's inactive also gets a "Delete" button — checked
// live against real usage before it's allowed to actually remove the row, so a value
// still on existing records can never be silently orphaned.
function chipHTML({ value, active, note, actions }) {
  return `
    <span class="chip settings-chip ${active ? '' : 'inactive'}">
      <span>${escapeHtml(value)}${note ? ` <span class="settings-chip-note" title="${escapeHtml(note)}">ⓘ</span>` : ''}</span>
      ${actions}
    </span>
  `;
}

function cardShellHTML(title, hint, bodyHTML) {
  return `
    <div class="settings-block">
      <h3>${escapeHtml(title)}</h3>
      ${hint ? `<div class="settings-hint">${hint}</div>` : ''}
      ${bodyHTML}
    </div>
  `;
}

// ---------------- Generic flat-list card (most picklists) ----------------

function renderFlatListCard(container, listKey, label, { withNote = false } = {}) {
  const builtIn = OPTIONS[listKey] || [];
  const deactivatedBuiltins = getDeactivatedBuiltins(listKey);
  const customRows = getCustomRows(listKey);

  const builtInChips = builtIn
    .map(v => typeof v === 'object' ? v.value : v)
    .map(value => {
      const active = !deactivatedBuiltins.includes(value);
      const actionBtn = active
        ? `<button type="button" class="chip-action" data-deactivate-builtin="${escapeHtml(value)}">Deactivate</button>`
        : `<button type="button" class="chip-action" data-reactivate-builtin="${escapeHtml(value)}">Reactivate</button>`;
      return chipHTML({ value, active, actions: actionBtn });
    }).join('');

  const customChips = customRows.map(row => {
    const active = row.active !== false;
    const actions = active
      ? `<button type="button" class="chip-action" data-deactivate-custom="${row.id}">Deactivate</button>`
      : `<button type="button" class="chip-action" data-reactivate-custom="${row.id}">Reactivate</button>
         <button type="button" class="chip-action chip-action-danger" data-delete-custom="${row.id}" data-delete-value="${escapeHtml(row.value)}" data-delete-list="${listKey}">Delete</button>`;
    return chipHTML({ value: row.value, active, note: row.note, actions });
  }).join('');

  const noteFieldHTML = withNote ? `<input type="text" class="settings-note-input" id="note-${listKey}" placeholder="Optional short definition (shown as a tooltip)" />` : '';

  // A stable per-list card element: created once, its contents replaced on every
  // rerender (rather than appending a fresh card each time Add/Deactivate fires).
  let card = document.getElementById(`card-${listKey}`);
  if (!card) {
    card = document.createElement('div');
    card.id = `card-${listKey}`;
    card.className = 'settings-block';
    container.appendChild(card);
  }
  card.innerHTML = `
    <h3>${escapeHtml(label)}</h3>
    <div class="settings-hint">${builtIn.length} built-in value${builtIn.length === 1 ? '' : 's'}. Deactivate hides an option from new entries without touching existing records.</div>
    <div class="chip-row">${builtInChips}${customChips || ''}</div>
    <div class="settings-add-row" style="margin-top: 14px; flex-wrap: wrap;">
      <input type="text" id="add-${listKey}" placeholder="Add a new value…" />
      ${noteFieldHTML}
      <button type="button" class="btn-primary" data-add-list="${listKey}">Add</button>
    </div>
  `;
  wireCardActions(card, listKey, () => renderFlatListCard(container, listKey, label, { withNote }));
}

// Shared wiring for every flat-list card (built-in and custom, generic across lists).
function wireCardActions(container, listKey, rerender) {
  container.querySelectorAll(`[data-add-list="${listKey}"]`).forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = document.getElementById(`add-${listKey}`);
      const value = input.value.trim();
      if (!value) return;
      const noteInput = document.getElementById(`note-${listKey}`);
      const extra = noteInput?.value.trim() ? { note: noteInput.value.trim() } : {};
      const { error } = await addOption(listKey, value, extra);
      if (error) {
        showToast(error.code === '23505' ? 'That value already exists.' : `Couldn't add value: ${error.message}`, true);
        return;
      }
      await loadCustomOptions();
      showToast('Value added.');
      rerender();
    });
  });

  container.querySelectorAll('[data-deactivate-builtin]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      await deactivateBuiltin(listKey, btn.dataset.deactivateBuiltin);
      await loadCustomOptions();
      showToast('Deactivated. Hidden from new entries, existing records unaffected.');
      rerender();
    });
  });
  container.querySelectorAll('[data-reactivate-builtin]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      await reactivateBuiltin(listKey, btn.dataset.reactivateBuiltin);
      await loadCustomOptions();
      showToast('Reactivated.');
      rerender();
    });
  });
  container.querySelectorAll('[data-deactivate-custom]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      await setOptionActive(btn.dataset.deactivateCustom, false);
      await loadCustomOptions();
      showToast('Deactivated. Hidden from new entries, existing records unaffected.');
      rerender();
    });
  });
  container.querySelectorAll('[data-reactivate-custom]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      await setOptionActive(btn.dataset.reactivateCustom, true);
      await loadCustomOptions();
      showToast('Reactivated.');
      rerender();
    });
  });
  container.querySelectorAll('[data-delete-custom]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      const key = btn.dataset.deleteList;
      const value = btn.dataset.deleteValue;
      const usage = hasUsageCheck(key) ? await countOptionUsage(key, value) : 0;
      if (usage > 0) {
        showToast(`Can't delete: still used by ${usage} record${usage === 1 ? '' : 's'}. It stays deactivated instead.`, true);
        return;
      }
      if (!confirm(`Permanently delete "${value}"? This can't be undone.`)) return;
      await deleteOption(btn.dataset.deleteCustom);
      await loadCustomOptions();
      showToast('Deleted.');
      rerender();
    });
  });
}

// ---------------- Navigation (tab display labels) ----------------

const NAV_ITEMS = [
  { key: 'loyalty-programs', label: 'Loyalty Programs' },
  { key: 'database', label: 'Database' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'tasks', label: 'Schedules & Tasks' },
  { key: 'tasks-calendar', label: 'Calendar' },
  { key: 'tasks-tasks', label: 'Tasks' },
  { key: 'tasks-polls', label: 'Polls' },
  { key: 'reports', label: 'Weekly Reports' },
  { key: 'brainstorm', label: 'Brainstorms' },
  { key: 'brainstorm-ideas', label: 'Ideas' },
  { key: 'brainstorm-issue-tree', label: 'Issue Tree' },
  { key: 'brainstorm-questions', label: 'Questions' },
  { key: 'brainstorm-next-steps', label: 'Next Steps' },
  { key: 'research', label: 'Research' },
  { key: 'figures', label: 'Data Insights' },
  { key: 'sources', label: 'Sources' },
  { key: 'settings', label: 'Settings' }
];

function renderNavigationCard() {
  const container = document.getElementById('nav-settings-cards');
  const rowsHTML = NAV_ITEMS.map(item => `
    <div class="settings-nav-row" data-nav-key="${item.key}">
      <span class="settings-nav-key">${item.key}</span>
      <input type="text" value="${escapeHtml(navLabel(item.key))}" data-nav-label-input="${item.key}" />
      <button type="button" class="btn-text" data-nav-save="${item.key}">Save</button>
    </div>
  `).join('');

  container.innerHTML = cardShellHTML('Tab display names', 'The technical key and route never change; only what the team sees.', rowsHTML);

  container.querySelectorAll('[data-nav-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.navSave;
      const input = container.querySelector(`[data-nav-label-input="${key}"]`);
      const value = input.value.trim();
      if (!value) return;
      const { error } = await setAppSetting(`nav_label:${key}`, value);
      if (error) { showToast(`Couldn't save: ${error.message}`, true); return; }
      showToast('Tab name updated. Reload other pages to see it in the nav.');
    });
  });
}

// ---------------- Team ----------------

const AVATAR_ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function memberInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function memberRowHTML(m) {
  const url = m.avatar_path ? teamAvatarUrl(m.avatar_path) : null;
  return `
    <div class="team-member-row ${m.active ? '' : 'inactive'}" data-member-row="${m.id}">
      <div class="team-member-avatar">
        ${url ? `<img src="${escapeHtml(url)}" alt="" />` : escapeHtml(memberInitial(m.name))}
      </div>
      <div class="team-member-main">
        <div class="team-member-name">${escapeHtml(m.name)}${m.active ? '' : ' <span class="settings-hint" style="display:inline; margin:0;">(inactive)</span>'}</div>
        <div class="team-member-actions">
          <button type="button" class="btn-text" data-team-rename="${m.id}">Rename</button>
          <button type="button" class="btn-text" data-team-avatar-pick="${m.id}">${url ? 'Change photo' : 'Add photo'}</button>
          ${url ? `<button type="button" class="btn-text" data-team-avatar-remove="${m.id}">Remove photo</button>` : ''}
          ${m.active
            ? `<button type="button" class="btn-text" data-team-deactivate="${m.id}">Deactivate</button>`
            : `<button type="button" class="btn-text" data-team-reactivate="${m.id}">Reactivate</button>`}
        </div>
      </div>
      <input type="file" hidden data-team-avatar-input="${m.id}" accept="${AVATAR_ACCEPT.join(',')}" />
    </div>
  `;
}

function renderTeamCard() {
  const container = document.getElementById('team-settings-card');
  const rows = getAllTeamMembers();
  const rowsHTML = rows.length ? rows.map(memberRowHTML).join('') : '<span class="settings-hint" style="margin:0;">No team members yet.</span>';

  container.innerHTML = cardShellHTML('Members', 'Renaming updates every programme, insight, like, task and note this person is attached to, so history keeps showing their current name.', `
    <div class="team-member-list">${rowsHTML}</div>
    <div class="settings-add-row" style="margin-top: 14px;">
      <input type="text" id="add-team-member" placeholder="Add a team member…" />
      <button type="button" class="btn-primary" id="btn-add-team-member">Add</button>
    </div>
  `);

  document.getElementById('btn-add-team-member').addEventListener('click', async () => {
    const input = document.getElementById('add-team-member');
    const name = input.value.trim();
    if (!name) return;
    const { error } = await supabase.from('app_team_members').insert({ name });
    if (error) {
      showToast(error.code === '23505' ? 'That name already exists.' : `Couldn't add: ${error.message}`, true);
      return;
    }
    await loadTeamMembers();
    showToast('Team member added.');
    renderTeamCard();
  });

  container.querySelectorAll('[data-team-deactivate]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('app_team_members').update({ active: false }).eq('id', btn.dataset.teamDeactivate);
      await loadTeamMembers();
      showToast('Deactivated. Removed from future pickers, existing records unaffected.');
      renderTeamCard();
    });
  });
  container.querySelectorAll('[data-team-reactivate]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('app_team_members').update({ active: true }).eq('id', btn.dataset.teamReactivate);
      await loadTeamMembers();
      showToast('Reactivated.');
      renderTeamCard();
    });
  });

  container.querySelectorAll('[data-team-rename]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.teamRename;
      const member = getAllTeamMembers().find(r => r.id === id);
      if (!member) return;
      const newName = prompt('New name:', member.name)?.trim();
      if (!newName || newName === member.name) return;
      const { error } = await supabase.rpc('rename_team_member', { p_id: id, p_new_name: newName });
      if (error) {
        showToast(error.code === '23505' ? 'That name already exists.' : `Couldn't rename: ${error.message}`, true);
        return;
      }
      renameIdentityIfMatches(member.name, newName);
      await loadTeamMembers();
      showToast(`Renamed to ${newName}. Updated everywhere this name is used.`);
      renderTeamCard();
    });
  });

  container.querySelectorAll('[data-team-avatar-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelector(`[data-team-avatar-input="${btn.dataset.teamAvatarPick}"]`).click();
    });
  });
  container.querySelectorAll('[data-team-avatar-input]').forEach(input => {
    input.addEventListener('change', () => uploadMemberAvatar(input.dataset.teamAvatarInput, input.files[0]));
  });
  container.querySelectorAll('[data-team-avatar-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeMemberAvatar(btn.dataset.teamAvatarRemove));
  });
}

async function uploadMemberAvatar(id, file) {
  if (!file) return;
  if (!AVATAR_ACCEPT.includes(file.type)) {
    showToast('Please choose a PNG, JPG or WebP image.', true);
    return;
  }
  if (file.size > AVATAR_MAX_BYTES) {
    showToast("That image is larger than 5MB. Please use a smaller file.", true);
    return;
  }
  const member = getAllTeamMembers().find(r => r.id === id);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('team-avatars').upload(path, file);
  if (uploadError) {
    showToast(`Couldn't upload photo: ${uploadError.message}`, true);
    return;
  }
  const { error } = await supabase.from('app_team_members').update({ avatar_path: path }).eq('id', id);
  if (error) {
    showToast(`Couldn't save photo: ${error.message}`, true);
    return;
  }
  if (member?.avatar_path) supabase.storage.from('team-avatars').remove([member.avatar_path]); // best-effort cleanup of the replaced file
  await loadTeamMembers();
  showToast('Photo updated.');
  renderTeamCard();
}

async function removeMemberAvatar(id) {
  const member = getAllTeamMembers().find(r => r.id === id);
  if (!member?.avatar_path) return;
  await supabase.from('app_team_members').update({ avatar_path: null }).eq('id', id);
  supabase.storage.from('team-avatars').remove([member.avatar_path]); // best-effort
  await loadTeamMembers();
  renderTeamCard();
}

// ---------------- Pinned Countries ----------------

function renderPinnedCountriesCard() {
  const container = document.getElementById('pinned-countries-card');
  const pinned = getAppSetting('pinned_countries', PINNED_COUNTRIES);
  const allCountries = getOptionList('country').filter(c => c !== 'Other');

  const rowsHTML = pinned.map((c, i) => `
    <div class="settings-pinned-row">
      <span>${escapeHtml(c)}</span>
      <div class="settings-pinned-actions">
        <button type="button" class="btn-text" data-move-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn-text" data-move-down="${i}" ${i === pinned.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="chip-action chip-action-danger" data-remove-pinned="${i}">Remove</button>
      </div>
    </div>
  `).join('');

  const addOptionsHTML = allCountries.filter(c => !pinned.includes(c)).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  container.innerHTML = cardShellHTML('Pinned Countries', 'Shown at the top of every Country dropdown, in this order (a genuine exception since the full list is 190+ options long).', `
    <div class="settings-pinned-list">${rowsHTML || '<span class="settings-hint" style="margin:0;">No countries pinned.</span>'}</div>
    <div class="settings-add-row" style="margin-top: 14px;">
      <select id="add-pinned-country"><option value="">Add a country to pin…</option>${addOptionsHTML}</select>
      <button type="button" class="btn-primary" id="btn-add-pinned-country">Add</button>
    </div>
  `);

  async function save(newList) {
    const { error } = await setAppSetting('pinned_countries', newList);
    if (error) { showToast(`Couldn't save: ${error.message}`, true); return; }
    renderPinnedCountriesCard();
  }

  document.getElementById('btn-add-pinned-country').addEventListener('click', () => {
    const sel = document.getElementById('add-pinned-country');
    if (!sel.value) return;
    save([...pinned, sel.value]);
  });
  container.querySelectorAll('[data-remove-pinned]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.removePinned);
      save(pinned.filter((_, idx) => idx !== i));
    });
  });
  container.querySelectorAll('[data-move-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.moveUp);
      const copy = [...pinned];
      [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
      save(copy);
    });
  });
  container.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.moveDown);
      const copy = [...pinned];
      [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
      save(copy);
    });
  });
}


// ---------------- Scope (shared by Sources + Data & Insights) ----------------

function renderScopeCard() {
  const container = document.getElementById('scope-card');
  const deactivatedBuiltins = getDeactivatedBuiltins('scope');
  const customRows = getCustomRows('scope');

  // Shows every value — active AND inactive — so the team can see an option exists
  // but is turned off, and reactivate it. This is the management view; the runtime
  // picker (mergedScopeGroups, used by scopeCheckboxGroupsHTML) hides inactive ones.
  const groupsHTML = Object.entries(SCOPE_GROUPS).map(([groupName, builtInValues]) => {
    const builtInChips = builtInValues.map(value => {
      const active = !deactivatedBuiltins.includes(value);
      const actionBtn = active
        ? `<button type="button" class="chip-action" data-deactivate-builtin="${escapeHtml(value)}">Deactivate</button>`
        : `<button type="button" class="chip-action" data-reactivate-builtin="${escapeHtml(value)}">Reactivate</button>`;
      return chipHTML({ value, active, actions: actionBtn });
    }).join('');
    const customChips = customRows.filter(r => (r.group_name || 'Other') === groupName).map(row => {
      const active = row.active !== false;
      const actions = active
        ? `<button type="button" class="chip-action" data-deactivate-custom="${row.id}">Deactivate</button>`
        : `<button type="button" class="chip-action" data-reactivate-custom="${row.id}">Reactivate</button>
           <button type="button" class="chip-action chip-action-danger" data-delete-custom="${row.id}" data-delete-value="${escapeHtml(row.value)}" data-delete-list="scope">Delete</button>`;
      return chipHTML({ value: row.value, active, actions });
    }).join('');
    return `<div class="form-section-label" style="margin-top: 12px;">${escapeHtml(groupName)}</div><div class="chip-row">${builtInChips}${customChips}</div>`;
  }).join('');

  const groupOptionsHTML = Object.keys(SCOPE_GROUPS).map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');

  container.innerHTML = cardShellHTML('Scope', 'Shared by Sources and Data & Insights. The 3 groups are fixed; add new values within one of them.', `
    ${groupsHTML}
    <div class="settings-add-row" style="margin-top: 14px;">
      <select id="scope-group-select">${groupOptionsHTML}</select>
      <input type="text" id="add-scope-value" placeholder="Add a value to that group…" />
      <button type="button" class="btn-primary" id="btn-add-scope-value">Add</button>
    </div>
  `);

  document.getElementById('btn-add-scope-value').addEventListener('click', async () => {
    const group = document.getElementById('scope-group-select').value;
    const input = document.getElementById('add-scope-value');
    const value = input.value.trim();
    if (!value) return;
    const { error } = await addScopeValue(group, value);
    if (error) {
      showToast(error.code === '23505' ? 'That value already exists.' : `Couldn't add value: ${error.message}`, true);
      return;
    }
    await loadCustomOptions();
    showToast('Scope value added.');
    renderScopeCard();
  });
  wireCardActions(container, 'scope', renderScopeCard);
}

// ---------------- Init ----------------

renderNavigationCard();
renderTeamCard();

const programmesContainer = document.getElementById('programmes-settings-cards');
renderFlatListCard(programmesContainer, 'industry', 'Industries');
renderFlatListCard(programmesContainer, 'programme_positioning', 'Programme Positioning');
renderFlatListCard(programmesContainer, 'target_customer', 'Target Customer');
renderFlatListCard(programmesContainer, 'geographic_scope', 'Geographic Scope');
renderFlatListCard(programmesContainer, 'membership_type', 'Membership Type');
renderFlatListCard(programmesContainer, 'access_registration', 'Access / Registration');
renderFlatListCard(programmesContainer, 'mechanisms', 'Mechanisms');
renderFlatListCard(programmesContainer, 'discount_type', 'Discount Types');
renderFlatListCard(programmesContainer, 'qualification_unit', 'Tier Qualification Units');
const pinnedHolder = document.createElement('div');
pinnedHolder.id = 'pinned-countries-card';
pinnedHolder.className = 'settings-block';
programmesContainer.appendChild(pinnedHolder);
renderPinnedCountriesCard();

const sourcesInsightsContainer = document.getElementById('sources-insights-settings-cards');
renderFlatListCard(sourcesInsightsContainer, 'source_type', 'Source Type');
const scopeHolder = document.createElement('div');
scopeHolder.id = 'scope-card';
scopeHolder.className = 'settings-block';
sourcesInsightsContainer.appendChild(scopeHolder);
renderScopeCard();
renderFlatListCard(sourcesInsightsContainer, 'insight_type', 'Information Type', { withNote: true });

const calendarContainer = document.getElementById('calendar-settings-cards');
renderFlatListCard(calendarContainer, 'meeting_type', 'Meeting Type');
renderFlatListCard(calendarContainer, 'task_type', 'Task Type');
renderFlatListCard(calendarContainer, 'brainstorm_type', 'Idea Types (Brainstorm)');
renderFlatListCard(calendarContainer, 'brainstorm_category', 'Idea Categories (Brainstorm)');
renderFlatListCard(calendarContainer, 'brainstorm_objective', 'Idea Customer Objectives (Brainstorm)');
renderFlatListCard(calendarContainer, 'brainstorm_vertical', 'Idea Vertical / Scorecard Columns (Brainstorm)');
renderFlatListCard(calendarContainer, 'brainstorm_audience', 'Idea Audience / Scorecard Columns (Brainstorm)');
renderFlatListCard(calendarContainer, 'brainstorm_dimension', 'Idea Scorecard Dimensions (Brainstorm)');

// ---------------- Locked by default ----------------
// Every field above saves itself immediately on interaction (no single form/Save
// button) — CSS-disabling the whole content area is what actually keeps a stray
// click from changing anything, rather than trying to gate each control one by one.
// "Done" just re-locks; nothing here defers changes to commit later, so there's no
// real "Cancel" to offer without rebuilding every card as a staged form.
const settingsContent = document.getElementById('settings-content');
const lockBanner = document.getElementById('settings-lock-banner');
const editBtn = document.getElementById('btn-settings-edit');
let settingsLocked = true;

function applySettingsLockState() {
  settingsContent.classList.toggle('settings-locked', settingsLocked);
  lockBanner.hidden = !settingsLocked;
  editBtn.textContent = settingsLocked ? 'Edit' : 'Done';
  editBtn.classList.toggle('btn-primary', !settingsLocked);
  editBtn.classList.toggle('btn-outline', settingsLocked);
}

editBtn.addEventListener('click', () => {
  settingsLocked = !settingsLocked;
  applySettingsLockState();
});

applySettingsLockState();
