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

function allInsightTypes() {
  const builtIn = Object.keys(INSIGHT_TYPE_DEFINITIONS);
  const custom = getCustomRows('insight_type').filter(r => r.active !== false).map(r => r.value);
  return [...builtIn, ...custom];
}

export function typeLegendHTML() {
  return allInsightTypes().map(type =>
    `<span class="type-legend-item" data-tooltip="${escapeHtml(definitionFor(type))}">${escapeHtml(type)}</span>`
  ).join('<span class="type-legend-sep"> · </span>');
}

// The Add/Edit Insight form's Information Type field: one compact row of clickable
// chips that ARE the selector (not a legend sitting above a separate <select>) — see,
// hover-for-definition, and pick all happen on the same control. Definitions stay
// exactly as defined in definitionFor(); this only changes how the field is presented.
function insightTypeSelectorHTML(selected) {
  const chips = allInsightTypes().map(type => `
    <button type="button" class="insight-type-chip has-tooltip ${type === selected ? 'active' : ''}"
      data-type="${escapeHtml(type)}" data-tooltip="${escapeHtml(definitionFor(type))}">${escapeHtml(type)}</button>
  `).join('');
  return `
    <div class="insight-type-selector" id="insight-type-selector">${chips}</div>
    <input type="hidden" name="insight_type" value="${escapeHtml(selected)}" />
  `;
}

// Scoped to #insight-type-selector, not just the shared .insight-type-chip class —
// the Visual/Evidence field below reuses that same class for its own Figure/Chart/
// Table/Diagram chips, and an unscoped query here would also catch those, stomping
// on insight_type whenever one of them was clicked.
function wireInsightTypeSelector(form) {
  const container = form.querySelector('#insight-type-selector');
  const hidden = form.elements['insight_type'];
  container.querySelectorAll('.insight-type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      hidden.value = chip.dataset.type;
      container.querySelectorAll('.insight-type-chip').forEach(c => c.classList.toggle('active', c === chip));
    });
  });
}

function sourceDisplayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

// ---------------- Visual / Evidence (optional image on an Insight) ----------------
// One Storage bucket, public-read — see supabase/021_insight_visual_evidence.sql.
// figures.image_path stores only the object path; the public URL is derived here so
// nothing goes stale if the bucket's URL ever changes.
const IMAGE_BUCKET = 'insight-images';
const IMAGE_ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
// What kind of visual it is (supabase/022_insight_visual_type.sql) — picking one is
// what reveals the upload area; it's meaningless without an image, so the app only
// ever sets/clears it together with image_path.
const VISUAL_TYPES = ['Figure', 'Chart', 'Table', 'Diagram'];

export function insightImageUrl(path) {
  if (!path) return null;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function visualEvidenceFieldHTML(insight) {
  const existingUrl = insight?.image_path ? insightImageUrl(insight.image_path) : null;
  const selectedType = insight?.visual_type || '';
  const hasType = !!selectedType;
  const chips = VISUAL_TYPES.map(t => `
    <button type="button" class="insight-type-chip" data-visual-type="${escapeHtml(t)}" data-active="${t === selectedType}">${escapeHtml(t)}</button>
  `).join('');
  return `
    <div class="form-field full">
      <label>Visual / Evidence <span style="font-weight:400; color: var(--muted);">(optional)</span></label>
      <div class="settings-hint" style="margin: -2px 0 8px;">Pick what kind of visual this is to add one.</div>
      <div class="insight-type-selector" id="visual-type-selector">${chips}</div>
      <input type="hidden" id="visual-type-input" value="${escapeHtml(selectedType)}" />
      <div class="visual-evidence-preview" id="visual-evidence-preview" ${(hasType && existingUrl) ? '' : 'hidden'}>
        <img id="visual-evidence-img" src="${existingUrl || ''}" alt="" />
        <button type="button" class="btn-text" id="visual-evidence-remove">Remove image</button>
      </div>
      <div class="visual-evidence-drop" id="visual-evidence-drop" ${(hasType && !existingUrl) ? '' : 'hidden'}>
        <p>Drag and drop an image, or <span class="visual-evidence-browse">choose a file</span></p>
        <p class="settings-hint" style="margin: 0;">PNG, JPG or WebP — up to 8MB.</p>
        <input type="file" id="visual-evidence-input" accept="${IMAGE_ACCEPT.join(',')}" hidden />
      </div>
      <div class="form-error" id="visual-evidence-error" hidden></div>
    </div>
  `;
}

// Returns an object whose apply() performs the actual upload/delete and resolves to
// { image_path, visual_type } values to write — either key can be `undefined` to
// leave that column untouched entirely, so an unrelated edit never clobbers an
// existing image/type.
function wireVisualEvidence(form, insight) {
  const typeSelector = form.querySelector('#visual-type-selector');
  const typeInput = form.querySelector('#visual-type-input');
  const preview = form.querySelector('#visual-evidence-preview');
  const dropZone = form.querySelector('#visual-evidence-drop');
  const img = form.querySelector('#visual-evidence-img');
  const fileInput = form.querySelector('#visual-evidence-input');
  const removeBtn = form.querySelector('#visual-evidence-remove');
  const errorEl = form.querySelector('#visual-evidence-error');

  const originalPath = insight?.image_path || null;
  const originalType = insight?.visual_type || null;
  let selectedFile = null;
  let removed = false;

  // Chips only reveal the upload area — the drop zone shows once a type is picked and
  // there's no image yet; the preview shows once there's an image (new or existing).
  function updateVisibility() {
    const hasType = !!typeInput.value;
    const hasImage = !!(selectedFile || (originalPath && !removed));
    preview.hidden = !(hasType && hasImage);
    dropZone.hidden = !(hasType && !hasImage);
  }

  typeSelector.querySelectorAll('[data-visual-type]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.active === 'true');
    chip.addEventListener('click', () => {
      typeInput.value = chip.dataset.visualType;
      typeSelector.querySelectorAll('[data-visual-type]').forEach(c => c.classList.toggle('active', c === chip));
      updateVisibility();
    });
  });

  function handleFile(file) {
    errorEl.hidden = true;
    if (!file) return;
    if (!IMAGE_ACCEPT.includes(file.type)) {
      errorEl.textContent = 'Please choose a PNG, JPG or WebP image.';
      errorEl.hidden = false;
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      errorEl.textContent = 'That image is larger than 8MB — please use a smaller file.';
      errorEl.hidden = false;
      return;
    }
    selectedFile = file;
    removed = false;
    img.src = URL.createObjectURL(file);
    updateVisibility();
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  ['dragover', 'dragenter'].forEach(evt => dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

  removeBtn.addEventListener('click', () => {
    selectedFile = null;
    removed = true;
    fileInput.value = '';
    img.src = '';
    updateVisibility();
  });

  return {
    async apply() {
      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, selectedFile);
        if (error) throw new Error(`Couldn't upload image: ${error.message}`);
        if (originalPath) supabase.storage.from(IMAGE_BUCKET).remove([originalPath]); // best-effort cleanup of the replaced file
        return { image_path: path, visual_type: typeInput.value || null };
      }
      if (removed && originalPath) {
        supabase.storage.from(IMAGE_BUCKET).remove([originalPath]); // best-effort
        return { image_path: null, visual_type: null };
      }
      // The image itself wasn't touched, but an existing one's type tag may have been.
      if (originalPath && typeInput.value !== (originalType || '')) {
        return { image_path: undefined, visual_type: typeInput.value || null };
      }
      return { image_path: undefined, visual_type: undefined };
    }
  };
}

// Most recent figures.created_at per source_id — a source used repeatedly stays near
// the top even if it was added months ago, which matters more for reuse than when it
// was first entered. One small query, computed once per modal open (not per keystroke).
// Exported so the Sources page (sources.js) can offer the same "Recently Used" sort
// without duplicating this logic.
export async function loadSourceUsage() {
  const { data } = await supabase.from('figures').select('source_id, created_at').not('source_id', 'is', null).order('created_at', { ascending: false });
  const usage = new Map();
  (data || []).forEach(row => { if (!usage.has(row.source_id)) usage.set(row.source_id, row.created_at); });
  return usage;
}

// Recently-used first (ISO timestamps sort correctly as strings), then never-used
// sources alphabetically after them.
export function sortSourcesByRecency(sources, usage) {
  return [...sources].sort((a, b) => {
    const at = usage.get(a.id), bt = usage.get(b.id);
    if (at && bt) return at < bt ? 1 : at > bt ? -1 : 0;
    if (at) return -1;
    if (bt) return 1;
    return sourceDisplayName(a).localeCompare(sourceDisplayName(b));
  });
}

// A searchable combobox rather than a plain <select> — scales to a much larger source
// library than a native dropdown would. Default (empty search) view is recency-first
// (see loadSourceUsage/sortSourcesByRecency); search matches by name, author/org,
// short citation and source type, kept in that same recency order.
function sourcePickerHTML(selectedSource) {
  const label = selectedSource ? sourceDisplayName(selectedSource) : '';
  return `
    <div class="source-picker">
      <input type="text" id="source-search" placeholder="Search sources by name, author or type…" autocomplete="off" value="${escapeHtml(label)}" />
      <input type="hidden" name="source_id" id="source-id-input" value="${selectedSource ? selectedSource.id : ''}" />
      <div class="source-picker-dropdown" id="source-picker-dropdown" hidden></div>
    </div>
  `;
}

// `getSources`/`getUsedIds` are functions (not plain values) so the picker keeps
// showing an immediate, unsorted list on first focus and silently upgrades to the
// recency-sorted one once loadSourceUsage() resolves — no spinner, no blocking.
function wireSourcePicker({ form, getSources, getUsedIds, onSelect }) {
  const searchInput = form.querySelector('#source-search');
  const hiddenInput = form.querySelector('#source-id-input');
  const dropdown = form.querySelector('#source-picker-dropdown');

  function renderOptions(query) {
    const sources = getSources();
    const q = query.trim().toLowerCase();
    const matches = !q ? sources : sources.filter(s => {
      const hay = `${sourceDisplayName(s)} ${s.author_org || ''} ${s.short_citation || ''} ${s.source_type || ''}`.toLowerCase();
      return hay.includes(q);
    });

    if (!matches.length) {
      dropdown.innerHTML = `<div class="source-picker-empty">No sources match.</div>`;
    } else {
      const usedIds = getUsedIds();
      const usedCount = !q ? matches.filter(s => usedIds.has(s.id)).length : 0;
      const optionHTML = s => `
        <div class="source-picker-option" data-id="${s.id}">
          <div class="source-picker-option-name">${escapeHtml(sourceDisplayName(s))}</div>
          ${(s.author_org || s.year) ? `<div class="source-picker-option-meta">${[s.author_org, s.year].filter(Boolean).map(v => escapeHtml(String(v))).join(' · ')}</div>` : ''}
        </div>
      `;
      dropdown.innerHTML = (usedCount > 0 && usedCount < matches.length)
        ? `<div class="source-picker-group-label">Recently Used</div>${matches.slice(0, usedCount).map(optionHTML).join('')}` +
          `<div class="source-picker-group-label">All Sources</div>${matches.slice(usedCount).map(optionHTML).join('')}`
        : matches.map(optionHTML).join('');
    }
    dropdown.hidden = false;

    dropdown.querySelectorAll('.source-picker-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => e.preventDefault()); // survive the input's blur
      opt.addEventListener('click', () => {
        const picked = getSources().find(s => s.id === opt.dataset.id);
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
  const fieldsHTML = INSIGHT_FIELDS.map(f => {
    const block = `
      <div class="form-field ${f.full ? 'full' : ''}">
        <label>${f.label}${f.required ? ' *' : ''}</label>
        ${f.key === 'insight_type' ? insightTypeSelectorHTML(insight?.insight_type) : inputHTML(f, insight ? insight[f.key] : '')}
      </div>
    `;
    // Visual/Evidence sits right after Main Insight, before Source Detail — matching
    // the "Title -> Main Insight -> Visual/Evidence -> Source -> Scope" shape.
    return f.key === 'supporting_detail' ? visualEvidenceFieldHTML(insight) + block : block;
  }).join('');

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
  wireInsightTypeSelector(form);
  const visualEvidence = wireVisualEvidence(form, insight);

  // Sources render immediately in whatever order the caller passed in; once usage
  // loads (near-instant, one small query) the picker silently re-sorts to
  // recently-used-first without blocking the modal or showing a spinner.
  let orderedSources = sources;
  let usedIds = new Set();
  loadSourceUsage().then(usage => {
    orderedSources = sortSourcesByRecency(sources, usage);
    usedIds = new Set(usage.keys());
  });

  wireSourcePicker({
    form, getSources: () => orderedSources, getUsedIds: () => usedIds,
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

    let visual;
    try {
      visual = await visualEvidence.apply();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = insight ? 'Save Changes' : 'Save Insight';
      return;
    }
    if (visual.image_path !== undefined) data.image_path = visual.image_path;
    if (visual.visual_type !== undefined) data.visual_type = visual.visual_type;

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
