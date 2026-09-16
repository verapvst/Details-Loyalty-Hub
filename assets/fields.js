import { PINNED_COUNTRIES } from './options.js';
import { getOptionList, mergedScopeGroups } from './customOptions.js';
import { getAppSetting } from './appSettings.js';

// Plain-text clipboard copy for detail-view "Copy Insight / Copy Citation" actions —
// clean text suitable for pasting into a slide, thesis, or an AI prompt, no HTML.
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || '');
    return true;
  } catch {
    return false;
  }
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A picklist entry is normally a plain string (value === label). A few lists — ones tied
// to a fixed database constraint, like task status — use { value, label } instead so the
// stored value can stay machine-friendly while the dropdown shows a nicer label.
function optionTag(o, selected) {
  const value = typeof o === 'object' ? o.value : o;
  const label = typeof o === 'object' ? o.label : o;
  return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

// A deactivated value can still be sitting on an existing record — if so it must stay
// selectable/visible when editing that record, even though it's no longer offered for
// new ones. Appended at the end, labeled so it's clear why it looks out of place.
function withOrphanValue(list, selected) {
  if (!selected) return list;
  const values = list.map(o => typeof o === 'object' ? o.value : o);
  if (values.includes(selected)) return list;
  return [...list, { value: selected, label: `${selected} (inactive)` }];
}

function selectOptionsHTML(optionKey, selected) {
  const list = withOrphanValue(getOptionList(optionKey), selected);
  const blank = `<option value="" ${!selected ? 'selected' : ''}></option>`;

  if (optionKey === 'country') {
    const pinnedOrder = getAppSetting('pinned_countries', PINNED_COUNTRIES);
    const pinned = pinnedOrder.filter(c => list.includes(c));
    const rest = list.filter(c => !pinned.includes(c));
    return blank +
      `<optgroup label="Most Used">${pinned.map(o => optionTag(o, selected)).join('')}</optgroup>` +
      `<optgroup label="All Countries">${rest.map(o => optionTag(o, selected)).join('')}</optgroup>`;
  }

  return blank + list.map(o => optionTag(o, selected)).join('');
}

// Renders a checkbox group for a multi-select field. `selected` is an array.
export function checkboxGroupHTML(fieldKey, optionKey, selected) {
  const sel = Array.isArray(selected) ? selected : [];
  const list = getOptionList(optionKey);
  const orphaned = sel.filter(v => !list.includes(v)).map(v => ({ value: v, label: `${v} (inactive)` }));
  return `<div class="checkbox-row">${[...list, ...orphaned].map(o => {
    const value = typeof o === 'object' ? o.value : o;
    const label = typeof o === 'object' ? o.label : o;
    const checked = sel.includes(value) ? 'checked' : '';
    return `<label class="checkbox-item"><input type="checkbox" name="${fieldKey}" value="${escapeHtml(value)}" ${checked} /> ${escapeHtml(label)}</label>`;
  }).join('')}</div>`;
}

// A checkbox-row plus a small "All"/"Clear" toggle button — for people-picker lists
// (assignees, participants) where selecting the whole team one-by-one is tedious.
// Call wireSelectAllToggle() on the containing form/element after inserting this HTML.
export function checkboxRowWithAllHTML(fieldName, members, selected = []) {
  const allSelected = members.length > 0 && members.every(m => selected.includes(m));
  return `
    <div class="checkbox-row-with-all">
      <div class="checkbox-row">${members.map(name => `
        <label class="checkbox-item"><input type="checkbox" name="${fieldName}" value="${escapeHtml(name)}" ${selected.includes(name) ? 'checked' : ''} /> ${escapeHtml(name)}</label>
      `).join('')}</div>
      <button type="button" class="btn-text select-all-toggle" data-select-all="${fieldName}">${allSelected ? 'Clear' : 'All'}</button>
    </div>
  `;
}

// Wires every [data-select-all] button within `root` to toggle all checkboxes sharing
// its field name, and keeps the button's own All/Clear label in sync with manual clicks.
export function wireSelectAllToggle(root) {
  root.querySelectorAll('[data-select-all]').forEach(btn => {
    const checkboxes = root.querySelectorAll(`input[name="${btn.dataset.selectAll}"]`);
    const sync = () => { btn.textContent = [...checkboxes].every(cb => cb.checked) ? 'Clear' : 'All'; };
    btn.addEventListener('click', () => {
      const selectAll = !([...checkboxes].every(cb => cb.checked));
      checkboxes.forEach(cb => { cb.checked = selectAll; });
      sync();
    });
    checkboxes.forEach(cb => cb.addEventListener('change', sync));
  });
}

// Scope (Sources / Data & Insights): rendered as 3 fixed visual groups + one shared
// "Other" — always under the field name "scope", read back with readCheckboxGroup.
// Group NAMES are fixed (not Settings-editable); the VALUES within them are merged
// with whatever the team has added/deactivated via Settings (mergedScopeGroups).
export function scopeCheckboxGroupsHTML(selected = []) {
  const sel = Array.isArray(selected) ? selected : [];
  const groups = mergedScopeGroups(sel);
  return Object.entries(groups).map(([group, values]) => values.length ? `
    <div class="form-section-label" style="margin-top: 12px;">${escapeHtml(group)}</div>
    <div class="checkbox-row">${values.map(v => `
      <label class="checkbox-item"><input type="checkbox" name="scope" value="${escapeHtml(v)}" ${sel.includes(v) ? 'checked' : ''} /> ${escapeHtml(v)}</label>
    `).join('')}</div>
  ` : '').join('');
}

// Reads every checked checkbox for a given field name into an array of values.
export function readCheckboxGroup(formEl, fieldKey) {
  return [...formEl.querySelectorAll(`input[name="${fieldKey}"]:checked`)].map(cb => cb.value);
}

// Renders a bare input/select/textarea (no wrapping label) for a given field def + current value.
export function inputHTML(field, value) {
  const v = value === null || value === undefined ? '' : value;
  const req = field.required ? 'required' : '';
  switch (field.type) {
    case 'select':
      return `<select name="${field.key}" ${req}>${selectOptionsHTML(field.options, v)}</select>`;
    case 'multiselect':
      return checkboxGroupHTML(field.key, field.options, value);
    case 'textarea':
      return `<textarea name="${field.key}" rows="3" ${req}>${escapeHtml(v)}</textarea>`;
    case 'number':
      return `<input type="number" name="${field.key}" value="${escapeHtml(v)}" ${req} />`;
    case 'date':
      return `<input type="date" name="${field.key}" value="${escapeHtml(v)}" ${req} />`;
    case 'time':
      return `<input type="time" name="${field.key}" value="${escapeHtml(v)}" ${req} />`;
    default:
      return `<input type="text" name="${field.key}" value="${escapeHtml(v)}" ${req} />`;
  }
}

export function readFormValues(formEl, allFields) {
  const data = {};
  allFields.forEach(field => {
    if (field.type === 'multiselect') return; // read separately via readCheckboxGroup
    const el = formEl.elements[field.key];
    if (!el) return;
    const raw = el.value.trim();
    if (field.type === 'number') {
      data[field.key] = raw === '' ? null : Number(raw);
    } else {
      data[field.key] = raw === '' ? null : raw;
    }
  });
  return data;
}
