// Shared Source Add/Edit modal — used by both the Sources list page (sources.js) and
// the Source Detail page (source.js). Kept as its own small module, mirroring
// insightModal.js, rather than one generic "modal engine" for every entity type.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { SOURCE_FIELDS, generateShortCitation, generateFullCitation } from './options.js';
import { inputHTML, readFormValues, escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { teamMemberSelectHTML } from './teamMembers.js';

// One modal for both Add (source=null) and Edit (source=existing row). Short/Full
// Citation are pre-filled from the other fields but stay fully editable — for a new
// source they keep auto-updating live as the driver fields change (until the
// researcher types into a citation field directly); for an existing source they're
// left untouched unless "Regenerate" is used, so a hand-tuned citation is never
// silently overwritten by an unrelated edit.
export function openSourceModal({ source, onChange }) {
  let root = document.getElementById('source-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'source-modal-root';
    document.body.appendChild(root);
  }

  const fieldsHTML = SOURCE_FIELDS.map(f => {
    const isCitationField = f.key === 'short_citation' || f.key === 'full_citation';
    return `
      <div class="form-field ${f.full ? 'full' : ''}">
        <label>${f.label}${f.required ? ' *' : ''}${isCitationField ? ` <button type="button" class="btn-text" data-regen="${f.key}" style="font-weight:400;">Regenerate</button>` : ''}</label>
        ${inputHTML(f, source ? source[f.key] : '')}
      </div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head">
          <h2>${source ? 'Edit Source' : 'Add Source'}</h2>
          <button type="button" class="form-modal-close" id="close-btn">&times;</button>
        </div>
        <form id="add-form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">${fieldsHTML}</div>
            ${source ? `<div class="form-field" style="margin-top: 10px;"><label>Added by</label>${teamMemberSelectHTML('created_by', source.created_by)}</div>` : ''}
            <div class="form-section-label" style="margin-top: 16px;">Scope *</div>
            <div class="settings-hint" style="margin-bottom: 6px;">What this source is about. Select every topic it covers.</div>
            ${scopeCheckboxGroupsHTML(source?.scope || [])}
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">${source ? 'Save Changes' : 'Save Source'}</button>
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

  const driverFields = () => ({
    source_name: form.elements['source_name'].value.trim(),
    author_org: form.elements['author_org'].value.trim(),
    year: form.elements['year'].value ? Number(form.elements['year'].value) : null,
    source_type: form.elements['source_type'].value,
    link_or_path: form.elements['link_or_path'].value.trim()
  });
  const regenerate = (key) => {
    const d = driverFields();
    form.elements[key].value = key === 'short_citation' ? generateShortCitation(d) : generateFullCitation(d);
  };
  form.querySelectorAll('[data-regen]').forEach(btn => {
    btn.addEventListener('click', () => regenerate(btn.dataset.regen));
  });

  // Live auto-fill only for brand-new sources, and only until the researcher edits a
  // citation field by hand — after that, their edit wins for the rest of this session.
  if (!source) {
    let shortDirty = false, fullDirty = false;
    form.elements['short_citation'].addEventListener('input', () => { shortDirty = true; });
    form.elements['full_citation'].addEventListener('input', () => { fullDirty = true; });
    ['source_name', 'author_org', 'year', 'source_type', 'link_or_path'].forEach(key => {
      form.elements[key].addEventListener('input', () => {
        if (!shortDirty) regenerate('short_citation');
        if (!fullDirty) regenerate('full_citation');
      });
    });
  }

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

    const data = readFormValues(e.target, SOURCE_FIELDS);
    data.scope = scope;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    let error;
    if (source) {
      data.created_by = form.elements['created_by'].value || null;
      data.updated_by = getIdentity();
      data.updated_at = new Date().toISOString();
      ({ error } = await supabase.from('sources').update(data).eq('id', source.id));
    } else {
      data.created_by = getIdentity();
      data.created_at = new Date().toISOString();
      ({ error } = await supabase.from('sources').insert(data));
    }

    if (error) {
      errorEl.textContent = `Couldn't save source: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = source ? 'Save Changes' : 'Save Source';
      return;
    }

    close();
    showToast(source ? 'Source updated.' : 'Source added.');
    onChange();
  });
}
