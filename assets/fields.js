import { PINNED_COUNTRIES } from './options.js';
import { getOptionList } from './customOptions.js';

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optionTag(o, selected) {
  return `<option value="${escapeHtml(o)}" ${o === selected ? 'selected' : ''}>${escapeHtml(o)}</option>`;
}

function selectOptionsHTML(optionKey, selected) {
  const list = getOptionList(optionKey);
  const blank = `<option value="" ${!selected ? 'selected' : ''}></option>`;

  if (optionKey === 'country') {
    const pinned = PINNED_COUNTRIES.filter(c => list.includes(c));
    const rest = list.filter(c => !pinned.includes(c));
    return blank +
      `<optgroup label="Most Used">${pinned.map(o => optionTag(o, selected)).join('')}</optgroup>` +
      `<optgroup label="All Countries">${rest.map(o => optionTag(o, selected)).join('')}</optgroup>`;
  }

  return blank + list.map(o => optionTag(o, selected)).join('');
}

// Renders a bare input/select/textarea (no wrapping label) for a given field def + current value.
export function inputHTML(field, value) {
  const v = value === null || value === undefined ? '' : value;
  const req = field.required ? 'required' : '';
  switch (field.type) {
    case 'select':
      return `<select name="${field.key}" ${req}>${selectOptionsHTML(field.options, v)}</select>`;
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
