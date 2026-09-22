// Brainstorm — Ideas board. Divergent thinking: raw ideas, hypotheses, opportunities,
// captured before they're forced into the structure of the Issue Tree. Idea -> Exploring
// -> Validated -> Archived. Each idea has its own page (idea.html) for everything past
// the basics — SWOT, validation, evidence, comments — this file is just the board and
// the lightweight Add form.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { getOptionList, addOption, loadCustomOptions } from './customOptions.js';
import { getActiveTeamMembers } from './teamMembers.js';

export const STATUS_LABEL = { idea: 'Idea', exploring: 'Exploring', validated: 'Validated', archived: 'Archived' };
const STATUSES = ['idea', 'exploring', 'validated', 'archived'];
const PRIORITIES = ['low', 'medium', 'high'];
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

// One color per Type value, purely so the board is scannable at a glance — the 6
// built-in badge colors map 1:1 onto the 6 built-in Types. A custom Type added later
// just falls back to the neutral badge rather than needing a 7th color invented.
export const TYPE_BADGE_CLASS = {
  'Strategic Choice': 'badge-dark',
  'Mechanism': 'badge-green',
  'Design Parameter': 'badge-muted',
  'Positioning / Value Proposition': 'badge-meeting',
  'Enabling Technology': 'badge-yellow',
  'Concept': 'badge-red'
};
export const RELATION_LABEL_FORWARD = {
  combines_with: 'Combines with', alternative_to: 'Alternative to',
  depends_on: 'Depends on', built_from: 'Built from'
};
export const RELATION_LABEL_REVERSE = {
  combines_with: 'Combines with', alternative_to: 'Alternative to',
  depends_on: 'Required by', built_from: 'Used in'
};

let missingTable = false;
export function ideasTableReady() { return !missingTable; }
function isMissingTableError(error) { return error && (error.code === '42P01' || error.code === 'PGRST205'); }

export async function loadIdeas() {
  const { data, error } = await supabase
    .from('brainstorm_ideas')
    .select('*, brainstorm_idea_interest(*), issue_node_ideas(node_id)')
    .order('created_at', { ascending: false });
  if (error) { missingTable = isMissingTableError(error); return []; }
  missingTable = false;
  return data || [];
}

export async function loadIdea(id) {
  const { data, error } = await supabase
    .from('brainstorm_ideas')
    .select('*, brainstorm_idea_interest(*), issue_node_ideas(node_id)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export function ideasByStatus(ideas, status) {
  return ideas.filter(i => i.status === status);
}

export function interestNames(idea) {
  return (idea.brainstorm_idea_interest || []).map(r => r.member_name).sort();
}

export async function toggleInterest(ideaId, interested) {
  const me = getIdentity();
  if (!me) { showToast('Pick your name first.', true); return; }
  if (interested) {
    await supabase.from('brainstorm_idea_interest').delete().eq('idea_id', ideaId).eq('member_name', me);
  } else {
    await supabase.from('brainstorm_idea_interest').insert({ idea_id: ideaId, member_name: me });
  }
}

export async function updateIdea(ideaId, patch) {
  await supabase.from('brainstorm_ideas').update(patch).eq('id', ideaId);
}

export async function updateIdeaStatus(ideaId, status) {
  await updateIdea(ideaId, { status });
}

export async function deleteIdea(ideaId) {
  await supabase.from('brainstorm_ideas').delete().eq('id', ideaId);
}

// ---------------- Reusable pickers (Type / Category / Mechanisms / Vertical / Audience / Objective) ----------------
// Each one can grow itself: the "+ Add" prompt writes straight into custom_options —
// the same table and the same list Settings manages — so a value typed here shows up
// in Settings too, and vice versa. No separate "quick add" list to keep in sync.
// Type and Category are orthogonal tags (altitude vs content area), never a hierarchy
// — see options.js for the full reasoning. Vertical/Audience are dual-purpose: an
// optional per-idea tag here, and (via the same option lists) the Scorecard's column
// headers on the idea page.

export async function addCustomOptionInline(listKey) {
  const value = prompt('New value:')?.trim();
  if (!value) return null;
  const { error } = await addOption(listKey, value);
  if (error) {
    showToast(error.code === '23505' ? 'That value already exists.' : `Couldn't add: ${error.message}`, true);
    return null;
  }
  await loadCustomOptions();
  return value;
}

// Every picker (a select or a chip group) is wrapped in one `.idea-picker` container
// carrying its own list key and kind — so one delegated wiring function (wireInlineAdds,
// below) can handle "+ Add" for any of them, on both the Add Idea modal and the idea
// page, without field-specific branching.
function selectPickerHTML(listKey, wrapperId, selected, addLabel) {
  const options = getOptionList(listKey);
  return `
    <div class="idea-picker" id="${wrapperId}" data-picker-kind="select" data-picker-key="${listKey}">
      <select>
        <option value="">—</option>
        ${options.map(c => `<option value="${escapeHtml(c)}" ${selected === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <button type="button" class="btn-text idea-picker-add" style="margin-top:6px;">${addLabel}</button>
    </div>
  `;
}

function chipsPickerHTML(listKey, wrapperId, selected, addLabel) {
  const options = getOptionList(listKey);
  return `
    <div class="idea-picker" id="${wrapperId}" data-picker-kind="chips" data-picker-key="${listKey}">
      <div class="chip-row">
        ${options.map(v => `<label class="checkbox-item"><input type="checkbox" value="${escapeHtml(v)}" ${selected.includes(v) ? 'checked' : ''} /> ${escapeHtml(v)}</label>`).join('')}
      </div>
      <button type="button" class="btn-text idea-picker-add" style="margin-top:6px;">${addLabel}</button>
    </div>
  `;
}

// Tag 1 — altitude: what kind of decision/idea this is.
export function typeSelectHTML(selected) { return selectPickerHTML('brainstorm_type', 'idea-type-picker', selected, '+ Add type'); }
// Tag 2 — content area: what part of the loyalty system this concerns.
export function categorySelectHTML(selected) { return selectPickerHTML('brainstorm_category', 'idea-category-picker', selected, '+ Add category'); }
// Only relevant (and only shown) when Type = "Mechanism" — reuses the same Mechanisms
// taxonomy as Loyalty Programmes, rather than a Brainstorm-specific list.
export function mechanismsChipsHTML(selected = []) { return chipsPickerHTML('mechanisms', 'idea-mechanisms-picker', selected, '+ Add mechanism'); }
// Optional per-idea tags — same vocabulary as the Scorecard's column headers.
export function verticalChipsHTML(selected = []) { return chipsPickerHTML('brainstorm_vertical', 'idea-vertical-picker', selected, '+ Add vertical'); }
export function audienceChipsHTML(selected = []) { return chipsPickerHTML('brainstorm_audience', 'idea-audience-picker', selected, '+ Add audience'); }
// Optional, multi-select: what customer behaviour this idea targets.
export function objectiveChipsHTML(selected = []) { return chipsPickerHTML('brainstorm_objective', 'idea-objective-picker', selected, '+ Add objective'); }

// Reads a picker's current value regardless of kind — a single select's value, or the
// checked values of a chip group.
export function readPickerValue(pickerEl) {
  if (!pickerEl) return pickerEl?.dataset.pickerKind === 'select' ? null : [];
  if (pickerEl.dataset.pickerKind === 'select') return pickerEl.querySelector('select').value || null;
  return [...pickerEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
}

// Wires one picker's "+ Add" button. Re-rendering replaces the picker element (so a
// fresh option list shows), then re-wires only that new element — not the whole
// root — so sibling pickers never pick up a second, duplicate listener. `onChanged`
// (optional) fires after the swap, so a caller with its own per-field auto-save
// listeners (the idea page; the Add Idea modal has none, it only reads at submit) can
// re-attach them to the new checkboxes/select — they were replaced along with the rest.
function wirePicker(root, picker, onChanged) {
  const btn = picker.querySelector('.idea-picker-add');
  const addLabel = btn.textContent;
  btn.addEventListener('click', async () => {
    const listKey = picker.dataset.pickerKey;
    const kind = picker.dataset.pickerKind;
    const current = readPickerValue(picker);
    const value = await addCustomOptionInline(listKey);
    if (!value) return;
    const nextSelected = kind === 'select' ? value : [...current, value];
    const html = kind === 'select' ? selectPickerHTML(listKey, picker.id, nextSelected, addLabel) : chipsPickerHTML(listKey, picker.id, nextSelected, addLabel);
    picker.outerHTML = html;
    const fresh = root.querySelector(`#${picker.id}`);
    wirePicker(root, fresh, onChanged);
    if (onChanged) onChanged(fresh);
  });
}

// Wires every `.idea-picker` inside `root` (the Add Idea modal, or the idea page) once.
export function wireInlineAdds(root, onChanged) {
  root.querySelectorAll('.idea-picker').forEach(picker => wirePicker(root, picker, onChanged));
}

// ---------------- Board (kanban columns, no drag-and-drop) ----------------

function ideaCardHTML(idea) {
  const names = interestNames(idea);
  const inTree = (idea.issue_node_ideas || []).length > 0;
  const typeBadge = idea.type ? `<span class="badge ${TYPE_BADGE_CLASS[idea.type] || 'badge-muted'}">${escapeHtml(idea.type)}</span>` : '';
  const categoryBadge = idea.category ? `<span class="badge badge-muted">${escapeHtml(idea.category)}</span>` : '';
  return `
    <a href="idea.html?id=${idea.id}" class="idea-card">
      <div class="idea-card-title">${escapeHtml(idea.title)}</div>
      ${typeBadge || categoryBadge ? `<div class="idea-card-tags">${typeBadge}${categoryBadge}</div>` : ''}
      <div class="idea-card-meta">
        <span class="idea-priority idea-priority-${idea.priority}">${PRIORITY_LABEL[idea.priority] || 'Medium'}</span>
        <span class="idea-interest-count">${names.length}/${getActiveTeamMembers().length} interested</span>
      </div>
      ${inTree ? '<div class="idea-card-tree-link">&rarr; In Issue Tree</div>' : ''}
    </a>
  `;
}

export function renderIdeaBoard(container, ideas, ctx) {
  const cols = STATUSES.map(status => {
    const items = ideasByStatus(ideas, status);
    const collapsedAttr = status === 'archived' ? 'data-collapsed="true"' : '';
    return `
      <div class="idea-column" data-status="${status}" ${collapsedAttr}>
        <div class="idea-column-head" data-idea-col-toggle="${status}">
          <span class="idea-column-title">${STATUS_LABEL[status]}</span>
          <span class="idea-column-count">${items.length}</span>
        </div>
        <div class="idea-column-body">
          ${items.map(ideaCardHTML).join('') || '<div class="drilldown-empty">Nothing here.</div>'}
          ${status === 'idea' ? '<button type="button" class="btn-text idea-add-btn" id="idea-add-btn">+ Add idea</button>' : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="idea-board">${cols}</div>`;

  const archivedCol = container.querySelector('.idea-column[data-status="archived"]');
  if (archivedCol) archivedCol.querySelector('.idea-column-body').hidden = true;

  container.querySelectorAll('[data-idea-col-toggle]').forEach(head => {
    head.addEventListener('click', () => {
      const body = head.nextElementSibling;
      body.hidden = !body.hidden;
    });
  });

  const addBtn = container.querySelector('#idea-add-btn');
  if (addBtn) addBtn.addEventListener('click', openAddIdeaModal);
}

// ---------------- Type <-> Mechanisms visibility ----------------
// The Mechanisms multi-pick only makes sense (and is only shown) when Type is
// "Mechanism". Re-run after any change to the type picker, including after its own
// "+ Add" swaps in a fresh <select>.
function syncMechanismsVisibility(root) {
  const select = root.querySelector('#idea-type-picker select');
  const wrap = root.querySelector('#idea-mechanisms-field');
  if (!select || !wrap) return;
  wrap.hidden = select.value !== 'Mechanism';
}

// ---------------- Add modal (Title/Description/Type(+Mechanisms)/Category/Priority) ----------------
// The four mandatory fields from the reviewed architecture, plus Priority (already
// defaults sensibly) — nothing else, so this stays inside the ~20-30s capture target.
// Vertical/Audience/Objective/evidence/SWOT/etc. all live on the idea's own page,
// opened immediately after creating it here, revealed progressively as it matures.

export function openAddIdeaModal() {
  let root = document.getElementById('idea-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'idea-modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="idea-modal">
      <div class="form-modal" style="max-width: 520px;">
        <div class="form-modal-head"><h2>Add Idea</h2><button type="button" class="form-modal-close" id="idea-modal-close">&times;</button></div>
        <form id="idea-form">
          <div class="form-modal-body">
            <div class="form-error" id="idea-form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full">
                <label>Title</label>
                <input type="text" name="title" required />
              </div>
              <div class="form-field full">
                <label>Description</label>
                <textarea name="description" rows="3" required></textarea>
              </div>
              <div class="form-field full">
                <label>Type <span style="font-weight:400; color: var(--muted);">— what kind of decision is this?</span></label>
                ${typeSelectHTML(null)}
              </div>
              <div class="form-field full" id="idea-mechanisms-field" hidden>
                <label>Mechanisms</label>
                ${mechanismsChipsHTML([])}
              </div>
              <div class="form-field full">
                <label>Category <span style="font-weight:400; color: var(--muted);">— what part of the system?</span></label>
                ${categorySelectHTML(null)}
              </div>
              <div class="form-field full">
                <label>Priority</label>
                <select name="priority">
                  ${PRIORITIES.map(p => `<option value="${p}" ${p === 'medium' ? 'selected' : ''}>${PRIORITY_LABEL[p]}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="idea-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Add Idea</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('idea-modal');
  const close = () => overlay.remove();
  document.getElementById('idea-modal-close').addEventListener('click', close);
  document.getElementById('idea-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  function wireTypeChange() {
    root.querySelector('#idea-type-picker select').addEventListener('change', () => syncMechanismsVisibility(root));
    syncMechanismsVisibility(root);
  }
  wireInlineAdds(root, (freshPicker) => { if (freshPicker.id === 'idea-type-picker') wireTypeChange(); });
  wireTypeChange();

  document.getElementById('idea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.elements['title'].value.trim();
    if (!title) return;
    const type = readPickerValue(root.querySelector('#idea-type-picker'));
    const data = {
      title,
      description: form.elements['description'].value.trim() || null,
      type,
      category: readPickerValue(root.querySelector('#idea-category-picker')),
      mechanisms: type === 'Mechanism' ? readPickerValue(root.querySelector('#idea-mechanisms-picker')) : null,
      priority: form.elements['priority'].value,
      status: 'idea',
      created_by: getIdentity()
    };
    const { data: inserted, error } = await supabase.from('brainstorm_ideas').insert(data).select().single();
    if (error) {
      const errorEl = document.getElementById('idea-form-error');
      errorEl.textContent = `Couldn't save: ${error.message}`;
      errorEl.hidden = false;
      return;
    }
    window.location.href = `idea.html?id=${inserted.id}`;
  });
}

// ---------------- Relationships ----------------
// One small graph, not a taxonomy: combines_with/alternative_to are symmetric
// (direction is just an artifact of who clicked "+ Add" first), depends_on/built_from
// are directional. A Concept is simply an idea whose Type is "Concept" and which has
// one or more built_from relationships pointing at its ingredient ideas — no separate
// Concepts table, no copying: the ingredient ideas stay exactly as first written.

export async function loadIdeaRelationships(ideaId) {
  const { data, error } = await supabase
    .from('idea_relationships')
    .select('*, from_idea:brainstorm_ideas!from_idea_id(id,title), to_idea:brainstorm_ideas!to_idea_id(id,title)')
    .or(`from_idea_id.eq.${ideaId},to_idea_id.eq.${ideaId}`)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export async function addRelationship(fromIdeaId, toIdeaId, relationType) {
  return supabase.from('idea_relationships').insert({ from_idea_id: fromIdeaId, to_idea_id: toIdeaId, relation_type: relationType });
}

export async function removeRelationship(id) {
  return supabase.from('idea_relationships').delete().eq('id', id);
}
