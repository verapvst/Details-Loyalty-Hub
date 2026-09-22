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

// ---------------- Reusable pickers (Category / Mechanisms) ----------------
// Each one can grow itself: the "+ Add" prompt writes straight into custom_options —
// the same table and the same list Settings manages — so a value typed here shows up
// in Settings too, and vice versa. No separate "quick add" list to keep in sync.
// Vertical/Audience are no longer per-idea tag pickers — they're reused as the
// Scorecard's column headers instead (see idea.js).

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

// Every picker (the Category select, the Vertical/Audience chip groups) is wrapped in
// one `.idea-picker` container carrying its own list key and kind — so one delegated
// wiring function (wireInlineAdds, below) can handle "+ Add" for any of them, on both
// the Add Idea modal and the idea page, without field-specific branching.
function categoryPickerHTML(selected) {
  const options = getOptionList('brainstorm_category');
  return `
    <div class="idea-picker" id="idea-category-picker" data-picker-kind="select" data-picker-key="brainstorm_category">
      <select id="idea-category-select">
        <option value="">—</option>
        ${options.map(c => `<option value="${escapeHtml(c)}" ${selected === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <button type="button" class="btn-text idea-picker-add" style="margin-top:6px;">+ Add category</button>
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

export function categorySelectHTML(selected) { return categoryPickerHTML(selected); }
// Only relevant (and only shown) when Category = "Mechanism" — reuses the same
// Mechanisms taxonomy as Loyalty Programmes, rather than a Brainstorm-specific list.
export function mechanismsChipsHTML(selected = []) { return chipsPickerHTML('mechanisms', 'idea-mechanisms-picker', selected, '+ Add mechanism'); }

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
    const html = kind === 'select' ? categoryPickerHTML(nextSelected) : chipsPickerHTML(listKey, picker.id, nextSelected, addLabel);
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
  return `
    <a href="idea.html?id=${idea.id}" class="idea-card">
      <div class="idea-card-title">${escapeHtml(idea.title)}</div>
      ${idea.category ? `<span class="badge badge-muted idea-card-theme">${escapeHtml(idea.category)}</span>` : ''}
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

// ---------------- Category <-> Mechanisms visibility ----------------
// The Mechanisms multi-pick only makes sense (and is only shown) when Category is
// "Mechanism". Re-run after any change to the category picker, including after its
// own "+ Add" swaps in a fresh <select>.
function syncMechanismsVisibility(root) {
  const select = root.querySelector('#idea-category-picker select');
  const wrap = root.querySelector('#idea-mechanisms-field');
  if (!select || !wrap) return;
  wrap.hidden = select.value !== 'Mechanism';
}

// ---------------- Add modal (Title/Description/Category(+Mechanisms)/Priority) ----------------
// Deliberately minimal — evidence (Insights/Favourites), SWOT, the Scorecard, validation
// and comments all live on the idea's own page, opened immediately after creating it here.

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
                <label>Description <span style="font-weight:400; color: var(--muted);">(optional)</span></label>
                <textarea name="description" rows="3"></textarea>
              </div>
              <div class="form-field full">
                <label>Category</label>
                ${categorySelectHTML(null)}
              </div>
              <div class="form-field full" id="idea-mechanisms-field" hidden>
                <label>Mechanisms</label>
                ${mechanismsChipsHTML([])}
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
  function wireCategoryChange() {
    root.querySelector('#idea-category-picker select').addEventListener('change', () => syncMechanismsVisibility(root));
    syncMechanismsVisibility(root);
  }
  wireInlineAdds(root, (freshPicker) => { if (freshPicker.id === 'idea-category-picker') wireCategoryChange(); });
  wireCategoryChange();

  document.getElementById('idea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.elements['title'].value.trim();
    if (!title) return;
    const category = readPickerValue(root.querySelector('#idea-category-picker'));
    const data = {
      title,
      description: form.elements['description'].value.trim() || null,
      category,
      mechanisms: category === 'Mechanism' ? readPickerValue(root.querySelector('#idea-mechanisms-picker')) : null,
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
