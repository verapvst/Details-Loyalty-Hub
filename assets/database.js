import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import {
  PROGRAMME_IDENTITY_FIELDS, PROGRAMME_CLASSIFICATION_FIELDS, PROGRAMME_GEOGRAPHY_FIELDS,
  PROGRAMME_MEMBERSHIP_FIELDS, PROGRAMME_SOURCE_FIELDS, INDUSTRY_SUBS
} from './options.js';
import { inputHTML, readFormValues, readCheckboxGroup, escapeHtml } from './fields.js';
import { loadCustomOptions, getOptionList, getSubIndustryOptions } from './customOptions.js';
import { syncFiltersToURL, restoreFiltersFromURL } from './filterUrlSync.js';

await initNav('database');
await loadCustomOptions();

let allProgrammes = [];

const cardGrid = document.getElementById('card-grid');
const sectionCount = document.getElementById('section-count');
const filterIndustry = document.getElementById('filter-industry');
const filterGeography = document.getElementById('filter-geography');
const filterType = document.getElementById('filter-type');
const filterAddedBy = document.getElementById('filter-added-by');
const searchInput = document.getElementById('search-input');

const URL_FILTER_FIELDS = [
  { key: 'industry', get: () => filterIndustry.value, set: v => { filterIndustry.value = v; } },
  { key: 'geography', get: () => filterGeography.value, set: v => { filterGeography.value = v; } },
  { key: 'type', get: () => filterType.value, set: v => { filterType.value = v; } },
  { key: 'added_by', get: () => filterAddedBy.value, set: v => { filterAddedBy.value = v; } },
  { key: 'q', get: () => searchInput.value.trim(), set: v => { searchInput.value = v; } }
];

function distinctSorted(list, key) {
  return [...new Set(list.map(p => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function distinctFromArrays(list, key) {
  const set = new Set();
  list.forEach(p => (p[key] || []).forEach(v => v && set.add(v)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function populateFilterOptions() {
  const fill = (selectEl, values) => {
    const current = selectEl.value;
    selectEl.innerHTML = '<option value="">All</option>' +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    selectEl.value = current;
  };
  fill(filterIndustry, distinctSorted(allProgrammes, 'industry'));
  fill(filterGeography, distinctFromArrays(allProgrammes, 'geographic_scope'));
  fill(filterType, distinctFromArrays(allProgrammes, 'mechanisms'));
  fill(filterAddedBy, distinctSorted(allProgrammes, 'created_by'));
}

function updateKPIs(list) {
  document.getElementById('kpi-total').textContent = list.length;
  document.getElementById('kpi-industries').textContent = new Set(list.map(p => p.industry).filter(Boolean)).size;
  document.getElementById('kpi-countries').textContent = new Set(list.map(p => p.country).filter(Boolean)).size;
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function renderCard(p) {
  const logo = p.cover_image_url
    ? `<div class="compact-card-logo"><img src="${escapeHtml(p.cover_image_url)}" alt="" onerror="this.parentElement.remove()" /></div>`
    : `<div class="compact-card-logo-fallback">${escapeHtml(initial(p.programme_name))}</div>`;

  const meta = [
    (p.mechanisms && p.mechanisms[0]) ? `<span class="badge badge-green">${escapeHtml(p.mechanisms[0])}</span>` : '',
    p.industry ? `<span class="badge badge-muted">${escapeHtml(p.industry)}</span>` : '',
    p.country ? `<span class="badge badge-muted">${escapeHtml(p.country)}</span>` : ''
  ].join('');

  return `
    <div class="compact-card" data-id="${p.id}">
      <div class="compact-card-head">
        ${logo}
        <div class="compact-card-body">
          <div class="compact-card-title">${escapeHtml(p.programme_name)}</div>
          ${p.company ? `<div class="compact-card-sub">${escapeHtml(p.company)}</div>` : ''}
        </div>
      </div>
      ${meta ? `<div class="compact-card-meta">${meta}</div>` : ''}
    </div>
  `;
}

function applyFiltersAndRender() {
  syncFiltersToURL(URL_FILTER_FIELDS);
  const industry = filterIndustry.value;
  const geography = filterGeography.value;
  const type = filterType.value;
  const addedBy = filterAddedBy.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allProgrammes.filter(p => {
    if (industry && p.industry !== industry) return false;
    if (geography && !(p.geographic_scope || []).includes(geography)) return false;
    if (type && !(p.mechanisms || []).includes(type)) return false;
    if (addedBy && p.created_by !== addedBy) return false;
    if (q) {
      const hay = `${p.programme_name || ''} ${p.company || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sectionCount.textContent = `${filtered.length} of ${allProgrammes.length}`;

  if (filtered.length === 0) {
    cardGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="em-title">No programmes match</div>
        <p>Try adjusting or clearing the filters.</p>
      </div>`;
    return;
  }

  cardGrid.innerHTML = filtered.map(renderCard).join('');
  cardGrid.querySelectorAll('.compact-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `programme.html?id=${encodeURIComponent(card.dataset.id)}`;
    });
  });
}

async function loadProgrammes() {
  const { data, error } = await supabase
    .from('programmes')
    .select('*, programme_tiers(*), programme_features(*)')
    .order('programme_name', { ascending: true });

  if (error) {
    cardGrid.innerHTML = `<div class="error-state" style="grid-column: 1 / -1;">Couldn't load programmes: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allProgrammes = data || [];
  updateKPIs(allProgrammes);
  populateFilterOptions();
  restoreFiltersFromURL(URL_FILTER_FIELDS);
  applyFiltersAndRender();
}

[filterIndustry, filterGeography, filterType, filterAddedBy].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterIndustry.value = '';
  filterGeography.value = '';
  filterType.value = '';
  filterAddedBy.value = '';
  searchInput.value = '';
  applyFiltersAndRender();
});

// ---------------- Add Programme modal ----------------

function fieldsGridHTML(fields, values = {}) {
  return fields.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, values[f.key])}
    </div>
  `).join('');
}

function subIndustryOptionsHTML(industry, selected) {
  const subs = getSubIndustryOptions(industry, INDUSTRY_SUBS);
  return '<option value=""></option>' + subs.map(s =>
    `<option value="${escapeHtml(s)}" ${s === selected ? 'selected' : ''}>${escapeHtml(s)}</option>`
  ).join('');
}

function wireSubIndustryCascade(form, initialSubIndustry) {
  const industrySel = form.elements['industry'];
  const subSel = form.elements['sub_industry'];
  industrySel.addEventListener('change', () => {
    subSel.innerHTML = subIndustryOptionsHTML(industrySel.value, null);
  });
  subSel.innerHTML = subIndustryOptionsHTML(industrySel.value, initialSubIndustry);
}

function tierRowHTML(t = {}) {
  return `
    <div class="tier-row-v2">
      <input type="text" placeholder="Tier name" data-tier="name" value="${escapeHtml(t.tier_name)}" />
      <input type="number" step="0.01" placeholder="Fee" data-tier="fee" value="${t.tier_price ?? ''}" />
      <select data-tier="currency">${getOptionList('currency').map(c => `<option ${c === (t.currency || 'EUR') ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <input type="number" step="0.01" placeholder="Qualification amount" data-tier="qual_amount" value="${t.qualification_amount ?? ''}" />
      <select data-tier="qual_unit"><option value=""></option>${getOptionList('qualification_unit').map(u => `<option ${u === t.qualification_unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <input type="text" placeholder="Note (optional)" data-tier="note" value="${escapeHtml(t.note)}" />
      <button type="button" class="tier-remove">&times;</button>
    </div>
  `;
}

function featureRowHTML(f = {}) {
  return `
    <div class="feature-row">
      <input type="text" placeholder="Feature name" data-feature="name" value="${escapeHtml(f.feature_name)}" />
      <button type="button" class="tier-remove">&times;</button>
    </div>
  `;
}

function wireRepeatingRows(container, addBtn, rowHTML, rowSelector) {
  const wireRemove = () => {
    container.querySelectorAll('.tier-remove').forEach(btn => {
      btn.onclick = () => { if (container.children.length > 1) btn.closest(rowSelector).remove(); };
    });
  };
  wireRemove();
  addBtn.addEventListener('click', () => {
    container.insertAdjacentHTML('beforeend', rowHTML());
    wireRemove();
  });
  return wireRemove;
}

const MECHANISM_BLOCKS = {
  Points: 'block-points',
  Discounts: 'block-discounts',
  Partnerships: 'block-partnerships',
  Tiering: 'block-tiering'
};

function wireMechanismToggle(form) {
  function sync() {
    const checked = readCheckboxGroup(form, 'mechanisms');
    Object.entries(MECHANISM_BLOCKS).forEach(([mech, blockId]) => {
      const el = document.getElementById(blockId);
      if (el) el.hidden = !checked.includes(mech);
    });
  }
  form.querySelectorAll('input[name="mechanisms"]').forEach(cb => cb.addEventListener('change', sync));
  sync();
}

function mechanismsSectionHTML(p = {}) {
  const tiers = p.programme_tiers && p.programme_tiers.length ? p.programme_tiers : [{}];
  return `
    <div class="form-section-label">Mechanisms</div>
    ${inputHTML({ key: 'mechanisms', type: 'multiselect', options: 'mechanisms' }, p.mechanisms)}

    <div id="block-points" class="mech-block" hidden>
      <div class="form-section-label" style="margin-top:20px;">Points</div>
      <div class="form-grid">
        <div class="form-field"><label>Expires?</label>${inputHTML({ key: 'points_expires', type: 'select', options: 'yes_no' }, p.points_expires === true ? 'Yes' : (p.points_expires === false ? 'No' : ''))}</div>
        <div class="form-field"><label>Expiration Period</label>${inputHTML({ key: 'points_expiration_period', type: 'text' }, p.points_expiration_period)}</div>
        <div class="form-field full"><label>Earning / Redemption Notes</label>${inputHTML({ key: 'points_notes', type: 'textarea' }, p.points_notes)}</div>
      </div>
    </div>

    <div id="block-discounts" class="mech-block" hidden>
      <div class="form-section-label" style="margin-top:20px;">Discounts</div>
      ${inputHTML({ key: 'discount_types', type: 'multiselect', options: 'discount_type' }, p.discount_types)}
    </div>

    <div id="block-partnerships" class="mech-block" hidden>
      <div class="form-section-label" style="margin-top:20px;">Partnerships</div>
      <div class="form-field full"><label>Partner Companies (separate with ;)</label>
        <input type="text" name="partner_companies" placeholder="Emirates; Uber; Booking.com" value="${escapeHtml((p.partner_companies || []).join('; '))}" />
      </div>
    </div>

    <div id="block-tiering" class="mech-block" hidden>
      <div class="form-section-label" style="margin-top:20px;">Tier Structure</div>
      <div class="tier-rows" id="tier-rows">${tiers.map(tierRowHTML).join('')}</div>
      <button type="button" class="btn-add-tier" id="btn-add-tier">+ Add tier</button>
    </div>
  `;
}

function featuresSectionHTML(features = []) {
  const rows = features.length ? features : [{}];
  return `
    <div class="form-section-label">Features</div>
    <div class="tier-rows" id="feature-rows">${rows.map(featureRowHTML).join('')}</div>
    <button type="button" class="btn-add-tier" id="btn-add-feature">+ Add feature</button>
  `;
}

function gatherTierRows(container) {
  return [...container.querySelectorAll('.tier-row-v2')].map((row, idx) => {
    const name = row.querySelector('[data-tier="name"]').value.trim();
    if (!name) return null;
    const fee = row.querySelector('[data-tier="fee"]').value.trim();
    const qualAmount = row.querySelector('[data-tier="qual_amount"]').value.trim();
    return {
      tier_order: idx + 1,
      tier_name: name,
      tier_price: fee === '' ? null : Number(fee),
      currency: row.querySelector('[data-tier="currency"]').value || 'EUR',
      qualification_amount: qualAmount === '' ? null : Number(qualAmount),
      qualification_unit: row.querySelector('[data-tier="qual_unit"]').value || null,
      note: row.querySelector('[data-tier="note"]').value.trim() || null
    };
  }).filter(Boolean);
}

function gatherFeatureRows(container) {
  return [...container.querySelectorAll('.feature-row')].map(row => {
    const name = row.querySelector('[data-feature="name"]').value.trim();
    return name ? { feature_name: name } : null;
  }).filter(Boolean);
}

function openAddModal() {
  const root = document.getElementById('add-programme-root');
  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal">
        <div class="form-modal-head">
          <h2>Add Programme</h2>
          <button type="button" class="form-modal-close" id="add-modal-close">&times;</button>
        </div>
        <form id="add-form">
          <div class="form-modal-body">
            <div class="form-error" id="add-form-error" hidden></div>

            <div class="form-section-label">Identity</div>
            <div class="form-grid">${fieldsGridHTML(PROGRAMME_IDENTITY_FIELDS)}</div>

            <div class="form-section-label" style="margin-top:20px;">Classification</div>
            <div class="form-grid">
              ${fieldsGridHTML(PROGRAMME_CLASSIFICATION_FIELDS.filter(f => f.key === 'industry'))}
              <div class="form-field"><label>Sub-Industry *</label><select name="sub_industry" required></select></div>
              ${fieldsGridHTML(PROGRAMME_CLASSIFICATION_FIELDS.filter(f => f.key !== 'industry'))}
            </div>
            <div class="form-field full" style="margin-top:10px;"><label>Target Customer</label>${inputHTML({ key: 'target_customer', type: 'multiselect', options: 'target_customer' }, [])}</div>

            <div class="form-section-label" style="margin-top:20px;">Geography</div>
            <div class="form-grid">${fieldsGridHTML(PROGRAMME_GEOGRAPHY_FIELDS)}</div>
            <div class="form-field full" style="margin-top:10px;"><label>Geographic Scope</label>${inputHTML({ key: 'geographic_scope', type: 'multiselect', options: 'geographic_scope' }, [])}</div>

            <div class="form-section-label" style="margin-top:20px;">Membership</div>
            <div class="form-grid">${fieldsGridHTML(PROGRAMME_MEMBERSHIP_FIELDS)}</div>

            ${mechanismsSectionHTML()}
            ${featuresSectionHTML()}

            <div class="form-section-label" style="margin-top:20px;">Source</div>
            <div class="form-grid">${fieldsGridHTML(PROGRAMME_SOURCE_FIELDS)}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="add-cancel">Cancel</button>
            <button type="submit" class="btn-primary" id="add-submit">Save Programme</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('add-modal');
  const closeModal = () => root.innerHTML = '';
  document.getElementById('add-modal-close').addEventListener('click', closeModal);
  document.getElementById('add-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  const form = document.getElementById('add-form');
  wireSubIndustryCascade(form, null);
  wireMechanismToggle(form);

  const tierRows = document.getElementById('tier-rows');
  wireRepeatingRows(tierRows, document.getElementById('btn-add-tier'), tierRowHTML, '.tier-row-v2');
  const featureRows = document.getElementById('feature-rows');
  wireRepeatingRows(featureRows, document.getElementById('btn-add-feature'), featureRowHTML, '.feature-row');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('add-form-error');
    errorEl.hidden = true;

    const data = {
      ...readFormValues(form, PROGRAMME_IDENTITY_FIELDS),
      ...readFormValues(form, PROGRAMME_CLASSIFICATION_FIELDS),
      ...readFormValues(form, PROGRAMME_GEOGRAPHY_FIELDS),
      ...readFormValues(form, PROGRAMME_MEMBERSHIP_FIELDS),
      ...readFormValues(form, PROGRAMME_SOURCE_FIELDS),
      sub_industry: form.elements['sub_industry'].value || null,
      target_customer: readCheckboxGroup(form, 'target_customer'),
      geographic_scope: readCheckboxGroup(form, 'geographic_scope'),
      mechanisms: readCheckboxGroup(form, 'mechanisms'),
      discount_types: readCheckboxGroup(form, 'discount_types'),
      points_expires: form.elements['points_expires'].value === 'Yes' ? true : (form.elements['points_expires'].value === 'No' ? false : null),
      points_expiration_period: form.elements['points_expiration_period'].value.trim() || null,
      points_notes: form.elements['points_notes'].value.trim() || null,
      partner_companies: form.elements['partner_companies'].value.split(';').map(s => s.trim()).filter(Boolean)
    };

    const tiers = gatherTierRows(tierRows);
    const features = gatherFeatureRows(featureRows);

    const submitBtn = document.getElementById('add-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { data: inserted, error } = await supabase.from('programmes').insert(data).select().single();

    if (error) {
      errorEl.textContent = `Couldn't save programme: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Programme';
      return;
    }

    if (tiers.length) {
      const { error: tierError } = await supabase.from('programme_tiers').insert(tiers.map(t => ({ ...t, programme_id: inserted.id })));
      if (tierError) showToast(`Programme saved, but tiers failed: ${tierError.message}`, true);
    }
    if (features.length) {
      const { error: featError } = await supabase.from('programme_features').insert(features.map(f => ({ ...f, programme_id: inserted.id })));
      if (featError) showToast(`Programme saved, but features failed: ${featError.message}`, true);
    }

    closeModal();
    showToast('Programme added.');
    loadProgrammes();
  });
}

document.getElementById('btn-add-programme').addEventListener('click', openAddModal);

loadProgrammes();
