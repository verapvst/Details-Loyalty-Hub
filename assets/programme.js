import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { PROGRAMME_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';
import { loadCustomOptions } from './customOptions.js';

initNav('database');
await loadCustomOptions();

const ALL_FIELDS = PROGRAMME_FIELDS.flatMap(s => s.fields);
const root = document.getElementById('record-root');
const params = new URLSearchParams(window.location.search);
const programmeId = params.get('id');

let programme = null;
let tiers = [];
let editing = false;

if (!programmeId) {
  root.innerHTML = `<div class="error-state">No programme selected. <a href="index.html">Back to Database</a></div>`;
  throw new Error('Missing programme id');
}

function fieldValueDisplay(value) {
  if (value === null || value === undefined || value === '') return `<span class="value empty">—</span>`;
  return `<span class="value">${escapeHtml(value)}</span>`;
}

function recordBlockHTML(section) {
  const fields = section.fields.map(f => `
    <div class="record-field ${f.full ? 'full' : ''} ${editing ? 'editing' : ''}">
      <label>${f.label}</label>
      ${editing ? inputHTML(f, programme[f.key]) : fieldValueDisplay(programme[f.key])}
    </div>
  `).join('');
  return `<div class="record-block"><h3>${section.section}</h3><div class="record-grid">${fields}</div></div>`;
}

function tierRowEditHTML(t) {
  return `
    <div class="tier-row">
      <input type="text" placeholder="Tier name" data-tier="name" value="${escapeHtml(t.tier_name)}" />
      <input type="number" step="0.01" placeholder="Tier price" data-tier="price" value="${t.tier_price ?? ''}" />
      <button type="button" class="tier-remove">&times;</button>
    </div>
  `;
}

function tiersBlockHTML() {
  if (editing) {
    const rows = (tiers.length ? tiers : [{ tier_name: '', tier_price: '' }]).map(tierRowEditHTML).join('');
    return `
      <div class="record-block">
        <h3>Programme Tiers</h3>
        <div class="tier-rows" id="tier-rows">${rows}</div>
        <button type="button" class="btn-add-tier" id="btn-add-tier">+ Add tier</button>
      </div>
    `;
  }
  if (!tiers.length) {
    return `<div class="record-block"><h3>Programme Tiers</h3><p class="value empty">No tiers recorded</p></div>`;
  }
  const rows = tiers.map(t => `
    <tr>
      <td class="tier-order-num">${t.tier_order ?? ''}</td>
      <td>${escapeHtml(t.tier_name)}</td>
      <td>${t.tier_price === null || t.tier_price === undefined ? '—' : t.tier_price}</td>
    </tr>
  `).join('');
  return `
    <div class="record-block">
      <h3>Programme Tiers</h3>
      <table class="record-tier-table">
        <thead><tr><th>Order</th><th>Tier Name</th><th>Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function render() {
  const sub = [programme.company, programme.country].filter(Boolean).join(' · ');

  root.innerHTML = `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="index.html" class="record-back">&larr; Back to Database</a>
        <div class="record-top">
          <div>
            <div class="record-title">${escapeHtml(programme.programme_name)}</div>
            <div class="record-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="record-actions">
            ${editing
              ? `<button type="button" class="btn-text" id="btn-cancel-edit">Cancel</button>
                 <button type="button" class="btn-primary" id="btn-save">Save</button>`
              : `<button type="button" class="btn-outline" id="btn-edit">Edit</button>`}
          </div>
        </div>
      </div>
    </div>
    <form id="record-form">
      <div class="record-body">
        ${(!editing && programme.cover_image_url)
          ? `<div class="record-cover" id="record-cover-img"><img src="${escapeHtml(programme.cover_image_url)}" alt="" onerror="this.closest('.record-cover').remove()" /></div>`
          : ''}
        ${PROGRAMME_FIELDS.map(section => recordBlockHTML(section) + (section.section === 'Tier Structure' ? tiersBlockHTML() : '')).join('')}
      </div>
    </form>
  `;

  if (editing) {
    const tierRows = document.getElementById('tier-rows');
    const wireRemove = () => {
      tierRows.querySelectorAll('.tier-remove').forEach(btn => {
        btn.onclick = () => {
          if (tierRows.children.length > 1) btn.closest('.tier-row').remove();
        };
      });
    };
    wireRemove();
    document.getElementById('btn-add-tier').addEventListener('click', () => {
      tierRows.insertAdjacentHTML('beforeend', tierRowEditHTML({ tier_name: '', tier_price: '' }));
      wireRemove();
    });
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      editing = false;
      render();
    });
    document.getElementById('btn-save').addEventListener('click', saveChanges);
  } else {
    document.getElementById('btn-edit').addEventListener('click', () => {
      editing = true;
      render();
    });
  }
}

async function saveChanges() {
  const form = document.getElementById('record-form');
  const updated = readFormValues(form, ALL_FIELDS);

  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const { error: updateError } = await supabase
    .from('programmes')
    .update(updated)
    .eq('id', programmeId);

  if (updateError) {
    showToast(`Couldn't save: ${updateError.message}`, true);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    return;
  }

  const tierRows = [...document.querySelectorAll('#tier-rows .tier-row')].map((row, idx) => {
    const name = row.querySelector('[data-tier="name"]').value.trim();
    const price = row.querySelector('[data-tier="price"]').value.trim();
    return name ? { tier_order: idx + 1, tier_name: name, tier_price: price === '' ? null : Number(price), programme_id: programmeId } : null;
  }).filter(Boolean);

  await supabase.from('programme_tiers').delete().eq('programme_id', programmeId);
  if (tierRows.length) {
    const { error: tierError } = await supabase.from('programme_tiers').insert(tierRows);
    if (tierError) showToast(`Saved programme, but tiers failed: ${tierError.message}`, true);
  }

  Object.assign(programme, updated);
  await loadTiers();
  editing = false;
  render();
  showToast('Programme saved.');
}

async function loadTiers() {
  const { data } = await supabase
    .from('programme_tiers')
    .select('*')
    .eq('programme_id', programmeId)
    .order('tier_order', { ascending: true });
  tiers = data || [];
}

async function load() {
  const { data, error } = await supabase
    .from('programmes')
    .select('*')
    .eq('id', programmeId)
    .single();

  if (error || !data) {
    root.innerHTML = `<div class="error-state">Couldn't load this programme. <a href="index.html">Back to Database</a></div>`;
    return;
  }

  programme = data;
  await loadTiers();
  render();
}

load();
