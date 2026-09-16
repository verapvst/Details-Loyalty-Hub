import { supabase } from './supabase.js';
import { initNav, showToast } from './app.js';
import {
  PROGRAMME_IDENTITY_FIELDS, PROGRAMME_CLASSIFICATION_FIELDS, PROGRAMME_GEOGRAPHY_FIELDS,
  PROGRAMME_MEMBERSHIP_FIELDS, PROGRAMME_SOURCE_FIELDS, INDUSTRY_SUBS
} from './options.js';
import { inputHTML, readFormValues, readCheckboxGroup, escapeHtml } from './fields.js';
import { loadCustomOptions, getOptionList, getSubIndustryOptions } from './customOptions.js';
import { loadLikes, likeSummary, heartHTML, wireHearts, openTargetPickerModal } from './likes.js';

await initNav('database');
await loadCustomOptions();

const root = document.getElementById('record-root');
const params = new URLSearchParams(window.location.search);
const programmeId = params.get('id');

let programme = null;
let tiers = [];
let features = [];
let likes = [];
let editing = false;

if (!programmeId) {
  root.innerHTML = `<div class="error-state">No programme selected. <a href="index.html">Back to Database</a></div>`;
  throw new Error('Missing programme id');
}

function valueOrEmpty(v) {
  if (v === null || v === undefined || v === '') return `<span class="value empty">—</span>`;
  return `<span class="value">${escapeHtml(v)}</span>`;
}

function chipsOrEmpty(arr) {
  if (!Array.isArray(arr) || !arr.length) return `<span class="value empty">—</span>`;
  return `<div class="chip-row" style="margin-bottom:0;">${arr.map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('')}</div>`;
}

// Like chips: same as chipsOrEmpty but each chip carries its own heart button.
function likeableChipsHTML(targetType, arr) {
  if (!Array.isArray(arr) || !arr.length) return `<span class="value empty">—</span>`;
  return `<div class="chip-row" style="margin-bottom:0;">${arr.map(v => `
    <span class="like-chip">
      <span class="badge badge-muted">${escapeHtml(v)}</span>
      ${heartHTML(targetType, v, null, likeSummary(likes, targetType, v))}
    </span>
  `).join('')}</div>`;
}

function simpleFieldsBlockHTML(title, fields) {
  const cells = fields.map(f => `
    <div class="record-field ${f.full ? 'full' : ''} ${editing ? 'editing' : ''}">
      <label>${f.label}</label>
      ${editing ? inputHTML(f, programme[f.key]) : valueOrEmpty(programme[f.key])}
    </div>
  `).join('');
  return `<div class="record-block"><h3>${title}</h3><div class="record-grid">${cells}</div></div>`;
}

function classificationBlockHTML() {
  const industryField = PROGRAMME_CLASSIFICATION_FIELDS.find(f => f.key === 'industry');
  const positioningField = PROGRAMME_CLASSIFICATION_FIELDS.find(f => f.key === 'programme_positioning');
  const subOptions = editing
    ? '<option value=""></option>' + getSubIndustryOptions(programme.industry, INDUSTRY_SUBS).map(s =>
        `<option value="${escapeHtml(s)}" ${s === programme.sub_industry ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')
    : '';

  return `
    <div class="record-block">
      <h3>Classification</h3>
      <div class="record-grid">
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Industry</label>
          ${editing ? inputHTML(industryField, programme.industry) : valueOrEmpty(programme.industry)}
        </div>
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Sub-Industry</label>
          ${editing ? `<select name="sub_industry" id="record-sub-industry" required>${subOptions}</select>` : valueOrEmpty(programme.sub_industry)}
        </div>
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Programme Positioning</label>
          ${editing ? inputHTML(positioningField, programme.programme_positioning) : valueOrEmpty(programme.programme_positioning)}
        </div>
        <div class="record-field full">
          <label>Target Customer</label>
          ${editing ? inputHTML({ key: 'target_customer', type: 'multiselect', options: 'target_customer' }, programme.target_customer) : likeableChipsHTML('target_customer', programme.target_customer)}
        </div>
      </div>
    </div>
  `;
}

function geographyBlockHTML() {
  const countryField = PROGRAMME_GEOGRAPHY_FIELDS.find(f => f.key === 'country');
  return `
    <div class="record-block">
      <h3>Geography</h3>
      <div class="record-grid">
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Company Country</label>
          ${editing ? inputHTML(countryField, programme.country) : valueOrEmpty(programme.country)}
        </div>
        <div class="record-field full">
          <label>Geographic Scope</label>
          ${editing ? inputHTML({ key: 'geographic_scope', type: 'multiselect', options: 'geographic_scope' }, programme.geographic_scope) : chipsOrEmpty(programme.geographic_scope)}
        </div>
      </div>
    </div>
  `;
}

function membershipBlockHTML() {
  const mtField = PROGRAMME_MEMBERSHIP_FIELDS.find(f => f.key === 'membership_type');
  const arField = PROGRAMME_MEMBERSHIP_FIELDS.find(f => f.key === 'access_registration');
  const mtDisplay = programme.membership_type
    ? `<span class="like-chip"><span class="value">${escapeHtml(programme.membership_type)}</span>${heartHTML('membership_type', programme.membership_type, null, likeSummary(likes, 'membership_type', programme.membership_type))}</span>`
    : valueOrEmpty(programme.membership_type);

  return `
    <div class="record-block">
      <h3>Membership</h3>
      <div class="record-grid">
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Membership Type</label>
          ${editing ? inputHTML(mtField, programme.membership_type) : mtDisplay}
        </div>
        <div class="record-field ${editing ? 'editing' : ''}">
          <label>Access / Registration</label>
          ${editing ? inputHTML(arField, programme.access_registration) : valueOrEmpty(programme.access_registration)}
        </div>
      </div>
    </div>
  `;
}

function tierRowEditHTML(t = {}) {
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

function featureRowEditHTML(f = {}) {
  return `
    <div class="feature-row">
      <input type="text" placeholder="Feature name" data-feature="name" value="${escapeHtml(f.feature_name)}" />
      <button type="button" class="tier-remove">&times;</button>
    </div>
  `;
}

const MECHANISM_BLOCKS = { Points: 'r-block-points', Discounts: 'r-block-discounts', Partnerships: 'r-block-partnerships', Tiering: 'r-block-tiering' };

function mechanismsBenefitsBlockHTML() {
  const mechanisms = programme.mechanisms || [];

  if (!editing) {
    const pointsInfo = mechanisms.includes('Points') && (programme.points_expires !== null || programme.points_notes)
      ? `<div class="record-field full"><label>Points Details</label><span class="value">${
          programme.points_expires === true ? `Expires${programme.points_expiration_period ? ` (${escapeHtml(programme.points_expiration_period)})` : ''}` :
          programme.points_expires === false ? 'Does not expire' : ''
        }${programme.points_notes ? ` — ${escapeHtml(programme.points_notes)}` : ''}</span></div>` : '';
    const discountInfo = mechanisms.includes('Discounts') && programme.discount_types && programme.discount_types.length
      ? `<div class="record-field full"><label>Discount Type</label>${chipsOrEmpty(programme.discount_types)}</div>` : '';
    const partnerInfo = mechanisms.includes('Partnerships') && programme.partner_companies && programme.partner_companies.length
      ? `<div class="record-field full"><label>Partner Companies</label>${chipsOrEmpty(programme.partner_companies)}</div>` : '';

    return `
      <div class="record-block">
        <h3>Mechanisms &amp; Benefits</h3>
        <div class="record-grid">
          <div class="record-field full"><label>Mechanisms</label>${likeableChipsHTML('mechanism', mechanisms)}</div>
          ${pointsInfo}${discountInfo}${partnerInfo}
          <div class="record-field full"><label>Benefits</label>${likeableChipsHTML('benefit', programme.benefits)}</div>
        </div>
      </div>
      ${tiersDisplayBlockHTML()}
    `;
  }

  const tierList = tiers.length ? tiers : [{}];
  return `
    <div class="record-block">
      <h3>Mechanisms &amp; Benefits</h3>
      <div class="form-section-label" style="margin-top:0;">Mechanisms</div>
      ${inputHTML({ key: 'mechanisms', type: 'multiselect', options: 'mechanisms' }, mechanisms)}

      <div id="r-block-points" class="mech-block" hidden>
        <div class="form-section-label">Points</div>
        <div class="form-grid">
          <div class="form-field"><label>Expires?</label>${inputHTML({ key: 'points_expires', type: 'select', options: 'yes_no' }, programme.points_expires === true ? 'Yes' : (programme.points_expires === false ? 'No' : ''))}</div>
          <div class="form-field"><label>Expiration Period</label>${inputHTML({ key: 'points_expiration_period', type: 'text' }, programme.points_expiration_period)}</div>
          <div class="form-field full"><label>Earning / Redemption Notes</label>${inputHTML({ key: 'points_notes', type: 'textarea' }, programme.points_notes)}</div>
        </div>
      </div>

      <div id="r-block-discounts" class="mech-block" hidden>
        <div class="form-section-label">Discounts</div>
        ${inputHTML({ key: 'discount_types', type: 'multiselect', options: 'discount_type' }, programme.discount_types)}
      </div>

      <div id="r-block-partnerships" class="mech-block" hidden>
        <div class="form-section-label">Partnerships</div>
        <div class="form-field full"><label>Partner Companies (separate with ;)</label>
          <input type="text" name="partner_companies" value="${escapeHtml((programme.partner_companies || []).join('; '))}" />
        </div>
      </div>

      <div id="r-block-tiering" class="mech-block" hidden>
        <div class="form-section-label">Tier Structure</div>
        <div class="tier-rows" id="tier-rows">${tierList.map(tierRowEditHTML).join('')}</div>
        <button type="button" class="btn-add-tier" id="btn-add-tier">+ Add tier</button>
      </div>

      <div class="form-section-label">Benefits</div>
      ${inputHTML({ key: 'benefits', type: 'multiselect', options: 'benefits' }, programme.benefits)}
    </div>
  `;
}

function tiersDisplayBlockHTML() {
  if (!tiers.length) return '';
  const rows = tiers.map(t => `
    <tr>
      <td class="tier-order-num">${t.tier_order ?? ''}</td>
      <td>${escapeHtml(t.tier_name)}</td>
      <td>${t.tier_price === null || t.tier_price === undefined ? '—' : `${t.tier_price} ${escapeHtml(t.currency || 'EUR')}`}</td>
      <td>${t.qualification_amount !== null && t.qualification_amount !== undefined ? `${t.qualification_amount} ` : ''}${escapeHtml(t.qualification_unit) || '—'}</td>
      <td>${escapeHtml(t.note) || ''}</td>
      <td>${heartHTML('tier', t.tier_name, t.id, likeSummary(likes, 'tier', t.tier_name))}</td>
    </tr>
  `).join('');
  return `
    <div class="record-block">
      <h3>Programme Tiers</h3>
      <table class="record-tier-table">
        <thead><tr><th>Order</th><th>Tier Name</th><th>Fee</th><th>Qualification</th><th>Note</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function featuresBlockHTML() {
  if (!editing) {
    if (!features.length) return `<div class="record-block"><h3>Features</h3><p class="value empty">No features recorded</p></div>`;
    return `<div class="record-block"><h3>Features</h3><div class="chip-row" style="margin-bottom:0;">${features.map(f => `
      <span class="like-chip">
        <span class="badge badge-green">${escapeHtml(f.feature_name)}</span>
        ${heartHTML('feature', f.feature_name, f.id, likeSummary(likes, 'feature', f.feature_name))}
      </span>
    `).join('')}</div></div>`;
  }
  const rows = features.length ? features : [{}];
  return `
    <div class="record-block">
      <h3>Features</h3>
      <div class="tier-rows" id="feature-rows">${rows.map(featureRowEditHTML).join('')}</div>
      <button type="button" class="btn-add-tier" id="btn-add-feature">+ Add feature</button>
    </div>
  `;
}

function addFavouriteBlockHTML() {
  if (editing) return '';
  return `
    <div class="record-block">
      <h3>Favourite something from this programme</h3>
      <p class="settings-hint" style="margin-bottom: 14px;">Didn't click a heart above? Pick any mechanism, benefit, tier, feature or other element to favourite it directly.</p>
      <button type="button" class="btn-outline" id="btn-add-favourite">+ Add Favourite</button>
    </div>
  `;
}

function sourceBlockHTML() {
  if (!editing) {
    const isUrl = /^https?:\/\//i.test(programme.source_url || '');
    return `
      <div class="record-block">
        <h3>Source</h3>
        ${isUrl
          ? `<a href="${escapeHtml(programme.source_url)}" target="_blank" rel="noopener" class="btn-outline">Visit Website</a>`
          : valueOrEmpty(programme.source_url)}
      </div>
    `;
  }
  return simpleFieldsBlockHTML('Source', PROGRAMME_SOURCE_FIELDS);
}

function wireMechanismToggle(container) {
  function sync() {
    const checked = readCheckboxGroup(container, 'mechanisms');
    Object.entries(MECHANISM_BLOCKS).forEach(([mech, blockId]) => {
      const el = document.getElementById(blockId);
      if (el) el.hidden = !checked.includes(mech);
    });
  }
  container.querySelectorAll('input[name="mechanisms"]').forEach(cb => cb.addEventListener('change', sync));
  sync();
}

function render() {
  const sub = [programme.company, programme.country].filter(Boolean).join(' · ');
  const logo = (!editing && programme.cover_image_url)
    ? `<div class="record-logo"><img src="${escapeHtml(programme.cover_image_url)}" alt="" onerror="this.parentElement.remove()" /></div>`
    : '';

  root.innerHTML = `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="index.html" class="record-back">&larr; Back to Database</a>
        <div class="record-top">
          <div style="display: flex; align-items: center; gap: 18px;">
            ${logo}
            <div>
              <div class="record-title">${escapeHtml(programme.programme_name)}</div>
              <div class="record-sub">${escapeHtml(sub)}</div>
            </div>
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
        ${simpleFieldsBlockHTML('Identity', PROGRAMME_IDENTITY_FIELDS)}
        ${classificationBlockHTML()}
        ${geographyBlockHTML()}
        ${membershipBlockHTML()}
        ${mechanismsBenefitsBlockHTML()}
        ${featuresBlockHTML()}
        ${sourceBlockHTML()}
        ${addFavouriteBlockHTML()}
      </div>
    </form>
  `;

  if (editing) {
    const form = document.getElementById('record-form');
    const industrySel = form.elements['industry'];
    industrySel.addEventListener('change', () => {
      const subSel = document.getElementById('record-sub-industry');
      subSel.innerHTML = '<option value=""></option>' + getSubIndustryOptions(industrySel.value, INDUSTRY_SUBS).map(s => `<option>${escapeHtml(s)}</option>`).join('');
    });

    wireMechanismToggle(form);

    const tierRows = document.getElementById('tier-rows');
    const wireTierRemove = () => {
      tierRows.querySelectorAll('.tier-remove').forEach(btn => {
        btn.onclick = () => { if (tierRows.children.length > 1) btn.closest('.tier-row-v2').remove(); };
      });
    };
    wireTierRemove();
    document.getElementById('btn-add-tier').addEventListener('click', () => {
      tierRows.insertAdjacentHTML('beforeend', tierRowEditHTML());
      wireTierRemove();
    });

    const featureRows = document.getElementById('feature-rows');
    const wireFeatureRemove = () => {
      featureRows.querySelectorAll('.tier-remove').forEach(btn => {
        btn.onclick = () => { if (featureRows.children.length > 1) btn.closest('.feature-row').remove(); };
      });
    };
    wireFeatureRemove();
    document.getElementById('btn-add-feature').addEventListener('click', () => {
      featureRows.insertAdjacentHTML('beforeend', featureRowEditHTML());
      wireFeatureRemove();
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => { editing = false; render(); });
    document.getElementById('btn-save').addEventListener('click', saveChanges);
  } else {
    document.getElementById('btn-edit').addEventListener('click', () => { editing = true; render(); });
    wireHearts(root, {
      programmeId,
      programmeName: programme.programme_name,
      likes,
      onChange: (newLikes) => { likes = newLikes; render(); }
    });
    document.getElementById('btn-add-favourite').addEventListener('click', () => {
      openTargetPickerModal({
        programmeId, programmeName: programme.programme_name, programme, tiers, features, likes,
        onChange: (newLikes) => { likes = newLikes; render(); }
      });
    });
  }
}

async function saveChanges() {
  const form = document.getElementById('record-form');
  const updated = {
    ...readFormValues(form, PROGRAMME_IDENTITY_FIELDS),
    ...readFormValues(form, PROGRAMME_CLASSIFICATION_FIELDS),
    ...readFormValues(form, PROGRAMME_GEOGRAPHY_FIELDS),
    ...readFormValues(form, PROGRAMME_MEMBERSHIP_FIELDS),
    ...readFormValues(form, PROGRAMME_SOURCE_FIELDS),
    sub_industry: document.getElementById('record-sub-industry').value || null,
    target_customer: readCheckboxGroup(form, 'target_customer'),
    geographic_scope: readCheckboxGroup(form, 'geographic_scope'),
    mechanisms: readCheckboxGroup(form, 'mechanisms'),
    benefits: readCheckboxGroup(form, 'benefits'),
    discount_types: readCheckboxGroup(form, 'discount_types'),
    points_expires: form.elements['points_expires'].value === 'Yes' ? true : (form.elements['points_expires'].value === 'No' ? false : null),
    points_expiration_period: form.elements['points_expiration_period'].value.trim() || null,
    points_notes: form.elements['points_notes'].value.trim() || null,
    partner_companies: form.elements['partner_companies'].value.split(';').map(s => s.trim()).filter(Boolean),
    updated_at: new Date().toISOString()
  };

  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const { error: updateError } = await supabase.from('programmes').update(updated).eq('id', programmeId);
  if (updateError) {
    showToast(`Couldn't save: ${updateError.message}`, true);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    return;
  }

  const tierRows = [...document.querySelectorAll('#tier-rows .tier-row-v2')].map((row, idx) => {
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
      note: row.querySelector('[data-tier="note"]').value.trim() || null,
      programme_id: programmeId
    };
  }).filter(Boolean);

  await supabase.from('programme_tiers').delete().eq('programme_id', programmeId);
  if (tierRows.length) {
    const { error: tierError } = await supabase.from('programme_tiers').insert(tierRows);
    if (tierError) showToast(`Saved programme, but tiers failed: ${tierError.message}`, true);
  }

  const featureRows = [...document.querySelectorAll('#feature-rows .feature-row')].map(row => {
    const name = row.querySelector('[data-feature="name"]').value.trim();
    return name ? { feature_name: name, programme_id: programmeId } : null;
  }).filter(Boolean);

  await supabase.from('programme_features').delete().eq('programme_id', programmeId);
  if (featureRows.length) {
    const { error: featError } = await supabase.from('programme_features').insert(featureRows);
    if (featError) showToast(`Saved programme, but features failed: ${featError.message}`, true);
  }

  Object.assign(programme, updated);
  await loadTiersAndFeatures();
  editing = false;
  render();
  showToast('Programme saved.');
}

async function loadTiersAndFeatures() {
  const [{ data: tierData }, { data: featureData }] = await Promise.all([
    supabase.from('programme_tiers').select('*').eq('programme_id', programmeId).order('tier_order', { ascending: true }),
    supabase.from('programme_features').select('*').eq('programme_id', programmeId).order('created_at', { ascending: true })
  ]);
  tiers = tierData || [];
  features = featureData || [];
}

async function load() {
  const { data, error } = await supabase.from('programmes').select('*').eq('id', programmeId).single();
  if (error || !data) {
    root.innerHTML = `<div class="error-state">Couldn't load this programme. <a href="index.html">Back to Database</a></div>`;
    return;
  }
  programme = data;
  await loadTiersAndFeatures();
  likes = await loadLikes(programmeId);
  render();
}

load();
