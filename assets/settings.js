import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { OPTIONS } from './options.js';
import { loadCustomOptions, getCustomRows, listKeys, LIST_LABELS } from './customOptions.js';
import { escapeHtml } from './fields.js';

initNav('settings');
await loadCustomOptions();

const identity = getIdentity();
const listSelect = document.getElementById('list-select');
const detailEl = document.getElementById('list-detail');

listSelect.innerHTML = listKeys().map(k => `<option value="${k}">${LIST_LABELS[k]}</option>`).join('');
listSelect.addEventListener('change', () => renderDetail(listSelect.value));

async function addValue(key, value) {
  const { error } = await supabase.from('custom_options').insert({
    list_key: key, value, created_by: identity, created_at: new Date().toISOString()
  });
  if (error) {
    showToast(error.code === '23505' ? 'That value already exists.' : `Couldn't add value: ${error.message}`, true);
    return;
  }
  await loadCustomOptions();
  renderDetail(key);
  showToast('Value added.');
}

async function removeValue(id, key) {
  await supabase.from('custom_options').delete().eq('id', id);
  await loadCustomOptions();
  renderDetail(key);
  showToast('Value removed.');
}

function renderDetail(key) {
  const builtIn = OPTIONS[key] || [];
  const custom = getCustomRows(key);

  detailEl.innerHTML = `
    <div class="settings-block">
      <h3>${LIST_LABELS[key]}</h3>
      <div class="settings-hint">${builtIn.length} built-in value${builtIn.length === 1 ? '' : 's'} already in the dropdown. Anything you add here shows up right after them.</div>
      <div class="chip-row" id="chip-row">
        ${custom.length ? custom.map(row => `
          <span class="chip">${escapeHtml(row.value)}<button type="button" data-remove="${row.id}">&times;</button></span>
        `).join('') : '<span class="settings-hint" style="margin:0;">No custom values added yet.</span>'}
      </div>
      <div class="settings-add-row">
        <input type="text" id="new-value" placeholder="Add a new value…" />
        <button type="button" class="btn-primary" id="btn-add-value">Add</button>
      </div>
    </div>
  `;

  detailEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeValue(btn.dataset.remove, key));
  });

  const input = document.getElementById('new-value');
  const submit = () => {
    const value = input.value.trim();
    if (!value) return;
    addValue(key, value);
    input.value = '';
  };
  document.getElementById('btn-add-value').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
}

renderDetail(listSelect.value);
