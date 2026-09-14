import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import { PROGRAMME_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';
import { loadCustomOptions } from './customOptions.js';

initNav('database');
await loadCustomOptions();

const ALL_FIELDS = PROGRAMME_FIELDS.flatMap(s => s.fields);

let allProgrammes = [];

const cardGrid = document.getElementById('card-grid');
const sectionCount = document.getElementById('section-count');
const filterIndustry = document.getElementById('filter-industry');
const filterGeography = document.getElementById('filter-geography');
const filterType = document.getElementById('filter-type');
const searchInput = document.getElementById('search-input');

function distinctSorted(list, key) {
  return [...new Set(list.map(p => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateFilterOptions() {
  const fill = (selectEl, values) => {
    const current = selectEl.value;
    selectEl.innerHTML = '<option value="">All</option>' +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    selectEl.value = current;
  };
  fill(filterIndustry, distinctSorted(allProgrammes, 'industry'));
  fill(filterGeography, distinctSorted(allProgrammes, 'geography_market'));
  fill(filterType, distinctSorted(allProgrammes, 'primary_programme_type'));
}

function updateKPIs(list) {
  document.getElementById('kpi-total').textContent = list.length;
  document.getElementById('kpi-industries').textContent = new Set(list.map(p => p.industry).filter(Boolean)).size;
  document.getElementById('kpi-countries').textContent = new Set(list.map(p => p.country).filter(Boolean)).size;
}

function renderCard(p) {
  const badge = p.primary_programme_type
    ? `<span class="card-badge">${escapeHtml(p.primary_programme_type)}</span>` : '';
  const meta = [
    p.country ? `<span class="card-meta-item">${escapeHtml(p.country)}</span>` : '',
    p.industry ? `<span class="card-meta-item">${escapeHtml(p.industry)}</span>` : ''
  ].join('');

  const cover = p.cover_image_url
    ? `<div class="card-cover"><img src="${escapeHtml(p.cover_image_url)}" alt="" onerror="this.parentElement.remove()" /></div>` : '';

  return `
    <div class="programme-card" data-id="${p.id}">
      ${cover}
      <div class="card-top">
        <div>
          <div class="card-name">${escapeHtml(p.programme_name)}</div>
          <div class="card-company">${escapeHtml(p.company || '')}</div>
        </div>
        ${badge}
      </div>
      <div class="card-meta">${meta}</div>
    </div>
  `;
}

function applyFiltersAndRender() {
  const industry = filterIndustry.value;
  const geography = filterGeography.value;
  const type = filterType.value;
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allProgrammes.filter(p => {
    if (industry && p.industry !== industry) return false;
    if (geography && p.geography_market !== geography) return false;
    if (type && p.primary_programme_type !== type) return false;
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
  cardGrid.querySelectorAll('.programme-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `programme.html?id=${encodeURIComponent(card.dataset.id)}`;
    });
  });
}

async function loadProgrammes() {
  const { data, error } = await supabase
    .from('programmes')
    .select('*')
    .order('programme_name', { ascending: true });

  if (error) {
    cardGrid.innerHTML = `<div class="error-state" style="grid-column: 1 / -1;">Couldn't load programmes: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allProgrammes = data || [];
  updateKPIs(allProgrammes);
  populateFilterOptions();
  applyFiltersAndRender();
}

[filterIndustry, filterGeography, filterType].forEach(el => el.addEventListener('change', applyFiltersAndRender));
searchInput.addEventListener('input', applyFiltersAndRender);
document.getElementById('btn-clear-filters').addEventListener('click', () => {
  filterIndustry.value = '';
  filterGeography.value = '';
  filterType.value = '';
  searchInput.value = '';
  applyFiltersAndRender();
});

// ---------------- Add Programme modal ----------------

function fieldSectionHTML(section) {
  const fields = section.fields.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, '')}
    </div>
  `).join('');
  return `<div class="form-section-label">${section.section}</div><div class="form-grid">${fields}</div>`;
}

function tierRowHTML() {
  return `
    <div class="tier-row">
      <input type="text" placeholder="Tier name" data-tier="name" />
      <input type="number" step="0.01" placeholder="Tier price" data-tier="price" />
      <button type="button" class="tier-remove">&times;</button>
    </div>
  `;
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
            ${PROGRAMME_FIELDS.map(section => fieldSectionHTML(section) + (section.section === 'Tier Structure' ? `
              <div class="form-section-label">Programme Tiers</div>
              <div class="tier-rows" id="tier-rows">${tierRowHTML()}</div>
              <button type="button" class="btn-add-tier" id="btn-add-tier">+ Add tier</button>
            ` : '')).join('')}
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

  const tierRows = document.getElementById('tier-rows');
  document.getElementById('btn-add-tier').addEventListener('click', () => {
    tierRows.insertAdjacentHTML('beforeend', tierRowHTML());
    wireTierRemove();
  });

  function wireTierRemove() {
    tierRows.querySelectorAll('.tier-remove').forEach(btn => {
      btn.onclick = () => {
        if (tierRows.children.length > 1) btn.closest('.tier-row').remove();
      };
    });
  }
  wireTierRemove();

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('add-form-error');
    errorEl.hidden = true;

    const programmeData = readFormValues(form, ALL_FIELDS);

    const tiers = [...tierRows.querySelectorAll('.tier-row')].map((row, idx) => {
      const name = row.querySelector('[data-tier="name"]').value.trim();
      const price = row.querySelector('[data-tier="price"]').value.trim();
      return name ? { tier_order: idx + 1, tier_name: name, tier_price: price === '' ? null : Number(price) } : null;
    }).filter(Boolean);

    const submitBtn = document.getElementById('add-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { data: inserted, error } = await supabase
      .from('programmes')
      .insert(programmeData)
      .select()
      .single();

    if (error) {
      errorEl.textContent = `Couldn't save programme: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Programme';
      return;
    }

    if (tiers.length) {
      const tierRowsPayload = tiers.map(t => ({ ...t, programme_id: inserted.id }));
      const { error: tierError } = await supabase.from('programme_tiers').insert(tierRowsPayload);
      if (tierError) {
        showToast(`Programme saved, but tiers failed: ${tierError.message}`, true);
      }
    }

    closeModal();
    showToast('Programme added.');
    loadProgrammes();
  });
}

document.getElementById('btn-add-programme').addEventListener('click', openAddModal);

loadProgrammes();
