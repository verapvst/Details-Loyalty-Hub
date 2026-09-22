// Brainstorm — Ideas inbox. Deliberately lightweight: a raw thought captured before
// it's lost, nothing more. No classification, no evidence, no scoring here — that
// analytical weight belongs on the Issue Tree, once an idea has actually been posed
// as a strategic question. See idea.js for the (equally lightweight) detail view and
// issueTree.js for where an idea's thinking continues after "Promote to Issue".
import { supabase } from './supabase.js';
import { getIdentity } from './app.js';
import { escapeHtml } from './fields.js';

export const STATUS_LABEL = { inbox: 'Inbox', archived: 'Archived' };

let missingTable = false;
export function ideasTableReady() { return !missingTable; }
function isMissingTableError(error) { return error && (error.code === '42P01' || error.code === 'PGRST205'); }

export async function loadIdeas() {
  const { data, error } = await supabase
    .from('brainstorm_ideas')
    .select('*, issue_node_ideas(node_id)')
    .order('created_at', { ascending: false });
  if (error) { missingTable = isMissingTableError(error); return []; }
  missingTable = false;
  return data || [];
}

export async function loadIdea(id) {
  const { data, error } = await supabase
    .from('brainstorm_ideas')
    .select('*, issue_node_ideas(node_id)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function updateIdea(ideaId, patch) {
  await supabase.from('brainstorm_ideas').update(patch).eq('id', ideaId);
}

export async function deleteIdea(ideaId) {
  await supabase.from('brainstorm_ideas').delete().eq('id', ideaId);
}

// ---------------- Inbox list ----------------

function ideaRowHTML(idea) {
  const inTree = (idea.issue_node_ideas || []).length > 0;
  const date = idea.created_at ? new Date(idea.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  return `
    <a href="idea.html?id=${idea.id}" class="idea-row">
      <div class="idea-row-main">
        <div class="idea-row-title">${escapeHtml(idea.title)}</div>
        ${idea.description ? `<div class="idea-row-desc">${escapeHtml(idea.description)}</div>` : ''}
      </div>
      ${idea.theme ? `<span class="tag-pill">${escapeHtml(idea.theme)}</span>` : ''}
      <span class="idea-row-meta">${escapeHtml(idea.created_by || '')}${idea.created_by && date ? ' · ' : ''}${date}</span>
      ${inTree ? '<span class="idea-row-promoted">&#10003; In Issue Tree</span>' : '<span class="idea-row-promote">&rarr; Promote to Issue</span>'}
    </a>
  `;
}

export function renderIdeaInbox(container, ideas, ctx) {
  const inbox = ideas.filter(i => i.status !== 'archived');
  const archived = ideas.filter(i => i.status === 'archived');

  container.innerHTML = `
    <div class="idea-inbox">
      ${inbox.map(ideaRowHTML).join('') || '<div class="drilldown-empty">Nothing in the inbox yet.</div>'}
      <button type="button" class="btn-text idea-add-btn" id="idea-add-btn">+ Add idea &mdash; title, one line, optional tag. That's it.</button>
    </div>
    ${archived.length ? `
      <div class="idea-column" data-collapsed="true" style="margin-top: 18px;">
        <div class="idea-column-head" data-idea-col-toggle="archived">
          <span class="idea-column-title">Archived</span>
          <span class="idea-column-count">${archived.length}</span>
        </div>
        <div class="idea-inbox" hidden>${archived.map(ideaRowHTML).join('')}</div>
      </div>
    ` : ''}
  `;

  container.querySelectorAll('[data-idea-col-toggle]').forEach(head => {
    head.addEventListener('click', () => { head.nextElementSibling.hidden = !head.nextElementSibling.hidden; });
  });

  container.querySelector('#idea-add-btn').addEventListener('click', () => openAddIdeaModal(ctx));
}

// ---------------- Add modal (Title / Description / Tag — nothing else) ----------------

export function openAddIdeaModal(ctx) {
  let root = document.getElementById('idea-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'idea-modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="idea-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Add Idea</h2><button type="button" class="form-modal-close" id="idea-modal-close">&times;</button></div>
        <form id="idea-form">
          <div class="form-modal-body">
            <div class="form-error" id="idea-form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full">
                <label>Title</label>
                <input type="text" name="title" required placeholder="e.g. Cross-vertical customer journeys" />
              </div>
              <div class="form-field full">
                <label>Description <span style="font-weight:400; color: var(--muted);">(optional, one line)</span></label>
                <textarea name="description" rows="2"></textarea>
              </div>
              <div class="form-field full">
                <label>Tag <span style="font-weight:400; color: var(--muted);">(optional)</span></label>
                <input type="text" name="theme" placeholder="e.g. Membership, Ecosystem…" />
              </div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="idea-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Add Idea</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('idea-modal');
  const close = () => overlay.remove();
  document.getElementById('idea-modal-close').addEventListener('click', close);
  document.getElementById('idea-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('idea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.elements['title'].value.trim();
    if (!title) return;
    const data = {
      title,
      description: form.elements['description'].value.trim() || null,
      theme: form.elements['theme'].value.trim() || null,
      status: 'inbox',
      created_by: getIdentity()
    };
    const { error } = await supabase.from('brainstorm_ideas').insert(data);
    if (error) {
      const errorEl = document.getElementById('idea-form-error');
      errorEl.textContent = `Couldn't save: ${error.message}`;
      errorEl.hidden = false;
      return;
    }
    close();
    if (ctx?.onChange) ctx.onChange();
  });
}
