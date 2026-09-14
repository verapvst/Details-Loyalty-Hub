import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { FIGURE_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';

initNav('figures');

const listEl = document.getElementById('figure-list');
const noSourcesNote = document.getElementById('no-sources-note');
const addBtn = document.getElementById('btn-add-figure');

let sources = [];

function renderRow(f) {
  const citationTag = f.sources ? f.sources.citation_tag : null;
  const sourceLink = f.sources ? f.sources.link_or_path : null;
  const isUrl = /^https?:\/\//i.test(sourceLink || '');

  return `
    <div class="list-row">
      <div class="list-row-top">
        <div>
          <div class="badge badge-muted" style="margin-bottom: 8px;">${escapeHtml(f.market || '')}</div>
          <div class="figure-value">${escapeHtml(f.value)}</div>
        </div>
        ${isUrl ? `<a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener" class="btn-outline btn-sm">Visit Website</a>` : ''}
      </div>
      <div class="list-row-body">${escapeHtml(f.statistic)}</div>
      <div class="list-row-meta">
        ${citationTag ? `<span class="badge badge-green">${escapeHtml(citationTag)}</span>` : ''}
        ${f.created_by ? `<span>Added by ${escapeHtml(f.created_by)}</span>` : ''}
      </div>
    </div>
  `;
}

async function loadSources() {
  const { data } = await supabase.from('sources').select('id, citation_tag').order('citation_tag');
  sources = data || [];
  addBtn.disabled = sources.length === 0;
  noSourcesNote.hidden = sources.length > 0;
}

async function loadFigures() {
  const { data, error } = await supabase
    .from('figures')
    .select('*, sources(citation_tag, link_or_path)')
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<div class="error-state">Couldn't load figures: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || !data.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="em-title">No figures yet</div><p>Add the first market stat once you have a source to link it to.</p></div>`;
    return;
  }

  listEl.innerHTML = data.map(renderRow).join('');
}

function openAddModal() {
  const root = document.getElementById('add-figure-root');
  const sourceOptions = sources.map(s => `<option value="${s.id}">${escapeHtml(s.citation_tag)}</option>`).join('');
  const fieldsHTML = FIGURE_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="add-modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head">
          <h2>Add Figure</h2>
          <button type="button" class="form-modal-close" id="close-btn">&times;</button>
        </div>
        <form id="add-form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">
              ${fieldsHTML}
              <div class="form-field full">
                <label>Source *</label>
                <select name="source_id" required>
                  <option value=""></option>
                  ${sourceOptions}
                </select>
              </div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">Save Figure</button>
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
    const data = readFormValues(e.target, FIGURE_FIELDS);
    data.source_id = e.target.elements.source_id.value;
    data.created_by = getIdentity();
    data.created_at = new Date().toISOString();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { error } = await supabase.from('figures').insert(data);
    if (error) {
      errorEl.textContent = `Couldn't save figure: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Figure';
      return;
    }

    close();
    showToast('Figure added.');
    loadFigures();
  });
}

addBtn.addEventListener('click', openAddModal);

loadSources().then(loadFigures);
