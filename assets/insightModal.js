// Shared Insight Add/Edit modal + Information Type legend/definitions — used by both
// the Data & Insights list page (figures.js) and the Insight Detail page (insight.js).
// Kept as its own small module (not a generic "modal engine") so each entity type's
// modal stays simple and independent, matching sourceModal.js's shape.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { INSIGHT_FIELDS, INSIGHT_TYPE_DEFINITIONS } from './options.js';
import { inputHTML, readFormValues, escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { getCustomRows } from './customOptions.js';
import { wireRichTextEditors, getRichTextValue } from './richText.js';

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

function sourceDisplayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

// A searchable combobox rather than a plain <select> — scales to a much larger source
// library than a native dropdown would. Reuses the same sources data already loaded
// for the page (no separate source-management system); already alphabetical (the
// caller's query is ordered by source_name), search narrows further by name or author.
function sourcePickerHTML(selectedSource) {
  const label = selectedSource ? sourceDisplayName(selectedSource) : '';
  return `
    <div class="source-picker">
      <input type="text" id="source-search" placeholder="Search sources by name…" autocomplete="off" value="${escapeHtml(label)}" />
      <input type="hidden" name="source_id" id="source-id-input" value="${selectedSource ? selectedSource.id : ''}" />
      <div class="source-picker-dropdown" id="source-picker-dropdown" hidden></div>
    </div>
  `;
}

function wireSourcePicker({ form, sources, onSelect }) {
  const searchInput = form.querySelector('#source-search');
  const hiddenInput = form.querySelector('#source-id-input');
  const dropdown = form.querySelector('#source-picker-dropdown');

  function renderOptions(query) {
    const q = query.trim().toLowerCase();
    const matches = !q ? sources : sources.filter(s =>
      sourceDisplayName(s).toLowerCase().includes(q) || (s.author_org || '').toLowerCase().includes(q)
    );
    dropdown.innerHTML = matches.length
      ? matches.map(s => `
        <div class="source-picker-option" data-id="${s.id}">
          <div class="source-picker-option-name">${escapeHtml(sourceDisplayName(s))}</div>
          ${(s.author_org || s.year) ? `<div class="source-picker-option-meta">${[s.author_org, s.year].filter(Boolean).map(v => escapeHtml(String(v))).join(' · ')}</div>` : ''}
        </div>
      `).join('')
      : `<div class="source-picker-empty">No sources match.</div>`;
    dropdown.hidden = false;

    dropdown.querySelectorAll('.source-picker-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => e.preventDefault()); // survive the input's blur
      opt.addEventListener('click', () => {
        const picked = sources.find(s => s.id === opt.dataset.id);
        searchInput.value = sourceDisplayName(picked);
        hiddenInput.value = picked.id;
        dropdown.hidden = true;
        onSelect(picked);
      });
    });
  }

  searchInput.addEventListener('focus', () => renderOptions(''));
  searchInput.addEventListener('input', () => renderOptions(searchInput.value));
  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !e.target.closest('.source-picker')) dropdown.hidden = true;
  });
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

  const selectedSource = insight ? sources.find(s => s.id === insight.source_id) : null;
  const fieldsHTML = INSIGHT_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${f.key === 'insight_type' ? `<div class="type-legend" style="margin: 2px 0 6px;">${typeLegendHTML()}</div>` : ''}
      ${inputHTML(f, insight ? insight[f.key] : '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal" style="max-width: 620px;">
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
                ${sourcePickerHTML(selectedSource)}
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

  wireRichTextEditors(form);
  wireSourcePicker({
    form, sources,
    onSelect: (picked) => {
      const scopeContainer = document.getElementById('insight-scope-groups');
      const currentlyChecked = readCheckboxGroup(form, 'scope');
      if (currentlyChecked.length) return; // don't overwrite a researcher's own edits
      scopeContainer.innerHTML = scopeCheckboxGroupsHTML(picked?.scope || []);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const sourceId = form.elements['source_id'].value;
    if (!sourceId) {
      errorEl.textContent = 'Select a Source.';
      errorEl.hidden = false;
      return;
    }

    const scope = readCheckboxGroup(form, 'scope');
    if (!scope.length) {
      errorEl.textContent = 'Select at least one Scope.';
      errorEl.hidden = false;
      return;
    }

    const data = readFormValues(e.target, INSIGHT_FIELDS);
    data.source_id = sourceId;
    data.scope = scope;
    data.insight_text = getRichTextValue(form, 'insight_text');
    data.supporting_detail = getRichTextValue(form, 'supporting_detail');

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
