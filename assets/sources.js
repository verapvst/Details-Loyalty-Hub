import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { SOURCE_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';

initNav('sources');

const listEl = document.getElementById('source-list');
let allSources = [];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderRow(s) {
  const isUrl = /^https?:\/\//i.test(s.link_or_path || '');
  const linkButton = isUrl
    ? `<a href="${escapeHtml(s.link_or_path)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Website</a>`
    : '';
  const pathNote = (s.link_or_path && !isUrl) ? `<span>${escapeHtml(s.link_or_path)}</span>` : '';

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div class="list-row-title">${escapeHtml(s.citation_tag)}</div>
        ${linkButton}
      </div>
      <div class="list-row-body">${escapeHtml(s.full_citation)}</div>
      <div class="list-row-meta">
        ${pathNote}
        ${s.created_by ? `<span>Added by ${escapeHtml(s.created_by)}</span>` : ''}
        ${s.created_at ? `<span>${formatDate(s.created_at)}</span>` : ''}
        <button type="button" class="btn-text" data-source-edit="${s.id}">Edit</button>
        <button type="button" class="btn-danger-text" data-source-delete="${s.id}">Delete</button>
      </div>
    </div>
  `;
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

  if (!allSources.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="em-title">No sources yet</div><p>Add the first one to start citing stats and quotes.</p></div>`;
    return;
  }

  listEl.innerHTML = allSources.map(renderRow).join('');
  wireRowActions();
}

function wireRowActions() {
  listEl.querySelectorAll('[data-source-edit]').forEach(btn => {
    btn.addEventListener('click', () => openSourceModal(allSources.find(s => s.id === btn.dataset.sourceEdit)));
  });
  listEl.querySelectorAll('[data-source-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this source? Any linked insights will keep the source name but lose the link.')) return;
      await supabase.from('sources').delete().eq('id', btn.dataset.sourceDelete);
      showToast('Source deleted.');
      loadSources();
    });
  });
}

// One modal for both Add (source=null) and Edit (source=existing row).
function openSourceModal(source) {
  const root = document.getElementById('add-source-root');
  const fieldsHTML = SOURCE_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, source ? source[f.key] : '')}
    </div>
  `).join('');

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
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;
    const data = readFormValues(e.target, SOURCE_FIELDS);

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
