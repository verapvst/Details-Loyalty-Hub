import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { SOURCE_FIELDS, generateShortCitation, generateFullCitation } from './options.js';
import { inputHTML, readFormValues, escapeHtml, scopeCheckboxGroupsHTML, readCheckboxGroup } from './fields.js';
import { loadCustomOptions } from './customOptions.js';

await initNav('sources');
await loadCustomOptions();

const listEl = document.getElementById('source-list');
const searchInput = document.getElementById('search-input');
let allSources = [];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Legacy rows added before this restructure may not have source_name/short_citation
// yet (only the migration's one-time backfill from the old citation_tag) — fall back
// to whatever is present so nothing old looks blank.
function displayName(s) {
  return s.source_name || s.citation_tag || 'Untitled source';
}

function renderRow(s) {
  const isUrl = /^https?:\/\//i.test(s.link_or_path || '');
  const linkButton = isUrl
    ? `<a href="${escapeHtml(s.link_or_path)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Website</a>`
    : '';
  const scopeChips = (s.scope || []).map(v => `<span class="badge badge-muted">${escapeHtml(v)}</span>`).join('');

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div>
          ${s.source_type ? `<div class="badge badge-green" style="margin-bottom: 6px;">${escapeHtml(s.source_type)}</div>` : ''}
          <div class="list-row-title">${escapeHtml(displayName(s))}</div>
        </div>
        ${linkButton}
      </div>
      <div class="list-row-body">${escapeHtml(s.short_citation || s.full_citation || '')}</div>
      ${scopeChips ? `<div class="chip-row" style="margin: 10px 0 0;">${scopeChips}</div>` : ''}
      <div class="list-row-meta">
        ${s.author_org ? `<span>${escapeHtml(s.author_org)}</span>` : ''}
        ${s.year ? `<span>${s.year}</span>` : ''}
        ${s.created_by ? `<span>Added by ${escapeHtml(s.created_by)}</span>` : ''}
        ${s.created_at ? `<span>${formatDate(s.created_at)}</span>` : ''}
        <button type="button" class="btn-text" data-source-edit="${s.id}">Edit</button>
        <button type="button" class="btn-danger-text" data-source-delete="${s.id}">Delete</button>
      </div>
    </div>
  `;
}

function applyFilterAndRender() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = !q ? allSources : allSources.filter(s => {
    const hay = `${displayName(s)} ${s.author_org || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    listEl.innerHTML = allSources.length
      ? `<div class="empty-state"><div class="em-title">No sources match</div><p>Try a different search.</p></div>`
      : `<div class="empty-state"><div class="em-title">No sources yet</div><p>Add the first one to start citing stats and findings.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderRow).join('');
  wireRowActions();
}

async function loadSources() {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load sources: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allSources = data || [];
  applyFilterAndRender();
}

searchInput.addEventListener('input', applyFilterAndRender);

function wireRowActions() {
  listEl.querySelectorAll('[data-source-edit]').forEach(btn => {
    btn.addEventListener('click', () => openSourceModal(allSources.find(s => s.id === btn.dataset.sourceEdit)));
  });
  listEl.querySelectorAll('[data-source-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sourceId = btn.dataset.sourceDelete;
      const { count } = await supabase.from('figures').select('id', { count: 'exact', head: true }).eq('source_id', sourceId);
      if (count > 0) {
        showToast(`Can't delete — ${count} insight${count === 1 ? '' : 's'} still cite${count === 1 ? 's' : ''} this source. Remove or reassign them first.`, true);
        return;
      }
      if (!confirm('Delete this source?')) return;
      await supabase.from('sources').delete().eq('id', sourceId);
      showToast('Source deleted.');
      loadSources();
    });
  });
}

// One modal for both Add (source=null) and Edit (source=existing row). Short/Full
// Citation are pre-filled from the other fields but stay fully editable — for a new
// source they keep auto-updating live as the driver fields change (until the
// researcher types into a citation field directly); for an existing source they're
// left untouched unless "Regenerate" is used, so a hand-tuned citation is never
// silently overwritten by an unrelated edit.
function openSourceModal(source) {
  const root = document.getElementById('add-source-root');
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
            <div class="form-section-label" style="margin-top: 16px;">Scope *</div>
            <div class="settings-hint" style="margin-bottom: 6px;">What this source is about — select every topic it covers.</div>
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
    loadSources();
  });
}

document.getElementById('btn-add-source').addEventListener('click', () => openSourceModal(null));

loadSources();
