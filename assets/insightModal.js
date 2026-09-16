// Shared Insight Add/Edit modal + Information Type legend/definitions — used by both
// the Data & Insights list page (figures.js) and the Insight Detail page (insight.js).
// Kept as its own small module (not a generic "modal engine") so each entity type's
// modal stays simple and independent, matching sourceModal.js's shape.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { INSIGHT_FIELDS, INSIGHT_TYPE_DEFINITIONS } from './options.js';
import { inputHTML, readFormValues, escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { getCustomRows } from './customOptions.js';

// The 8 built-in definitions are fixed/developer-controlled; a custom Information
// Type added via Settings can carry its own short definition (stored in
// custom_options.note), shown as a tooltip the same way.
export function definitionFor(type) {
  if (INSIGHT_TYPE_DEFINITIONS[type]) return INSIGHT_TYPE_DEFINITIONS[type];
  const custom = getCustomRows('insight_type').find(r => r.value === type);
  return custom?.note || '';
}

export function typeLegendHTML() {
  const builtIn = Object.keys(INSIGHT_TYPE_DEFINITIONS);
  const custom = getCustomRows('insight_type').filter(r => r.active !== false).map(r => r.value);
  return [...builtIn, ...custom].map(type =>
    `<span class="type-legend-item" data-tooltip="${escapeHtml(definitionFor(type))}">${escapeHtml(type)}</span>`
  ).join('<span class="type-legend-sep"> · </span>');
}

// One modal for both Add (insight=null) and Edit (insight=existing row). Scope starts
// as a snapshot copy of the chosen Source's Scope (not a live link) and stays fully
// editable from that point on — picking a different source only re-copies its Scope
// while the field is still empty, so it never clobbers a researcher's own edits.
export function openInsightModal({ insight, sources, onChange }) {
  let root = document.getElementById('insight-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'insight-modal-root';
    document.body.appendChild(root);
  }

  const sourceOptions = sources.map(s => `<option value="${s.id}" ${insight && insight.source_id === s.id ? 'selected' : ''}>${escapeHtml(s.source_name || s.citation_tag || 'Untitled source')}</option>`).join('');
  const fieldsHTML = INSIGHT_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${f.key === 'insight_type' ? `<div class="type-legend" style="margin: 2px 0 6px;">${typeLegendHTML()}</div>` : ''}
      ${inputHTML(f, insight ? insight[f.key] : '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head">
          <h2>${insight ? 'Edit Insight' : 'Add Insight'}</h2>
          <button type="button" class="form-modal-close" id="close-btn">&times;</button>
        </div>
        <form id="add-form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full">
                <label>Source *</label>
                <select name="source_id" id="insight-source-select" required>
                  <option value=""></option>
                  ${sourceOptions}
                </select>
              </div>
              ${fieldsHTML}
            </div>
            <div class="form-section-label" style="margin-top: 16px;">Scope *</div>
            <div class="settings-hint" style="margin-bottom: 6px;">Starts from the Source's Scope — narrow it down or add to it for this specific insight.</div>
            <div id="insight-scope-groups">${scopeCheckboxGroupsHTML(insight?.scope || [])}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">${insight ? 'Save Changes' : 'Save Insight'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('add-modal');
  const form = document.getElementById('add-form');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('insight-source-select').addEventListener('change', (e) => {
    const scopeContainer = document.getElementById('insight-scope-groups');
    const currentlyChecked = readCheckboxGroup(form, 'scope');
    if (currentlyChecked.length) return; // don't overwrite a researcher's own edits
    const picked = sources.find(s => s.id === e.target.value);
    scopeContainer.innerHTML = scopeCheckboxGroupsHTML(picked?.scope || []);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const scope = readCheckboxGroup(form, 'scope');
    if (!scope.length) {
      errorEl.textContent = 'Select at least one Scope.';
      errorEl.hidden = false;
      return;
    }

    const data = readFormValues(e.target, INSIGHT_FIELDS);
    data.source_id = e.target.elements.source_id.value;
    data.scope = scope;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    let error;
    if (insight) {
      data.updated_by = getIdentity();
      data.updated_at = new Date().toISOString();
      ({ error } = await supabase.from('figures').update(data).eq('id', insight.id));
    } else {
      data.created_by = getIdentity();
      data.created_at = new Date().toISOString();
      ({ error } = await supabase.from('figures').insert(data));
    }

    if (error) {
      errorEl.textContent = `Couldn't save insight: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = insight ? 'Save Changes' : 'Save Insight';
      return;
    }

    close();
    showToast(insight ? 'Insight updated.' : 'Insight added.');
    onChange();
  });
}
