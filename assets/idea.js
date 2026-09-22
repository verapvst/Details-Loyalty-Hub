// Brainstorm — Idea detail page. Deliberately minimal: an idea is a raw thought, not
// an analytical workspace. Title, description, one optional tag, who/when — and a
// single real action, Promote to Issue, which is where its thinking actually
// continues (see issueTree.js). The idea itself is never deleted on promotion; it
// stays intact and linked, since the same idea may end up relevant to more than one
// Issue.
import { initNav, getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { wireBackLink } from './backLink.js';
import { loadIdea, updateIdea, deleteIdea } from './brainstormIdeas.js';
import { loadCurrentTree, loadNodes, openPromoteIdeaModal } from './issueTree.js';

await initNav('brainstorm-ideas');

const root = document.getElementById('idea-root');
const params = new URLSearchParams(window.location.search);
const ideaId = params.get('id');

if (!ideaId) {
  root.innerHTML = `<div class="error-state">No idea selected. <a href="brainstorm.html">Back to Brainstorm</a></div>`;
  throw new Error('Missing idea id');
}

let idea = null;

function headBlockHTML() {
  const promotedNodeId = (idea.issue_node_ideas || [])[0]?.node_id;
  return `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="brainstorm.html" class="record-back">&larr; Back to Brainstorm</a>
        <div class="record-title" style="font-size: 26px;">${escapeHtml(idea.title)}</div>
        <div class="record-sub">${idea.created_by ? `${escapeHtml(idea.created_by)} · ` : ''}${idea.created_at ? new Date(idea.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</div>
        <div class="record-actions" style="margin-top: 14px; flex-wrap: wrap; gap: 10px;">
          <button type="button" class="btn-text" id="idea-rename-btn">Rename</button>
          ${idea.status === 'archived'
            ? '<button type="button" class="btn-outline btn-sm" id="idea-unarchive-btn">Unarchive</button>'
            : '<button type="button" class="btn-outline btn-sm" id="idea-archive-btn">Archive</button>'}
          ${promotedNodeId
            ? `<a href="issue-node.html?id=${promotedNodeId}" class="btn-primary">&rarr; In Issue Tree</a>`
            : '<button type="button" class="btn-primary" id="idea-promote-btn">&rarr; Promote to Issue</button>'}
        </div>
      </div>
    </div>
  `;
}

function bodyHTML() {
  return `
    <div class="record-body">
      <div class="record-block">
        <h3>Description</h3>
        <textarea id="idea-description" rows="4" placeholder="What's the thought? One or two sentences is plenty.">${escapeHtml(idea.description || '')}</textarea>
      </div>
      <div class="record-block">
        <h3>Tag <span class="settings-hint" style="font-weight:400;">— optional, one word or short phrase</span></h3>
        <input type="text" id="idea-theme" value="${escapeHtml(idea.theme || '')}" placeholder="e.g. Membership, Ecosystem…" style="width:100%; max-width:320px; padding: 10px 14px; border: none; border-radius: var(--radius); background: var(--surface-alt); font-size: 13px; outline: none;" />
      </div>
      <div class="record-block">
        <button type="button" class="btn-danger-text" id="idea-delete-btn">Delete Idea</button>
      </div>
    </div>
  `;
}

async function render() {
  root.innerHTML = headBlockHTML() + bodyHTML();
  wireBackLink(root.querySelector('.record-back'), 'brainstorm.html');

  root.querySelector('#idea-rename-btn').addEventListener('click', async () => {
    const next = prompt('Title:', idea.title)?.trim();
    if (!next || next === idea.title) return;
    await updateIdea(idea.id, { title: next });
    await reload();
  });
  root.querySelector('#idea-archive-btn')?.addEventListener('click', async () => {
    await updateIdea(idea.id, { status: 'archived' });
    await reload();
  });
  root.querySelector('#idea-unarchive-btn')?.addEventListener('click', async () => {
    await updateIdea(idea.id, { status: 'inbox' });
    await reload();
  });
  root.querySelector('#idea-promote-btn')?.addEventListener('click', async () => {
    const tree = await loadCurrentTree();
    const nodes = tree ? await loadNodes(tree.id) : [];
    openPromoteIdeaModal(idea, tree, nodes, { onChange: reload });
  });
  root.querySelector('#idea-description').addEventListener('change', async (e) => {
    await updateIdea(idea.id, { description: e.target.value.trim() || null });
  });
  root.querySelector('#idea-theme').addEventListener('change', async (e) => {
    await updateIdea(idea.id, { theme: e.target.value.trim() || null });
  });
  root.querySelector('#idea-delete-btn').addEventListener('click', async () => {
    if (!confirm(`Delete "${idea.title}"? This can't be undone.`)) return;
    await deleteIdea(idea.id);
    showToast('Idea deleted.');
    window.location.href = 'brainstorm.html';
  });
}

async function reload() {
  idea = await loadIdea(ideaId);
  if (!idea) {
    root.innerHTML = `<div class="error-state">Couldn't load this idea. <a href="brainstorm.html">Back to Brainstorm</a></div>`;
    return;
  }
  render();
}

await reload();
