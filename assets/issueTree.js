// Brainstorm — Issue Tree. Convergent thinking: the team's central strategic
// hypothesis, broken down the Minto/MECE way into WHY (deductive factors) and HOW
// (inductive strategic pillars) — the exact shape the Details project's own
// deliverables use. A node's evidence is a reference to an existing Insight,
// Programme or Idea (never copied text), and a HOW node can be promoted straight
// into a Next Step, which is how a validated branch becomes project direction.
//
// One active tree at a time (like Saved Analyses, starting over archives the old one
// instead of destroying it) — kept in its own table so hypotheses can change across
// project phases without losing the history of what was tried before.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { openNextStepModal } from './next-steps.js';

const BRANCH_LABEL = { why: 'WHY', how: 'HOW' };
const EVIDENCE_LABEL = { none: 'No evidence', indicative: 'Indicative', supported: 'Supported', strongly_supported: 'Strongly supported' };
const EVIDENCE_DOT = { none: '○', indicative: '◐', supported: '●', strongly_supported: '●' };
const STATUS_LABEL = { draft: 'Draft', supported: 'Supported', final: 'Final' };
const HYPOTHESIS_LABEL = { open: 'Open', supported: 'Supported', not_supported: 'Not supported' };

let missingTable = false;
export function issueTreeTableReady() { return !missingTable; }
function isMissingTableError(error) { return error && (error.code === '42P01' || error.code === 'PGRST205'); }

export async function loadCurrentTree() {
  const { data, error } = await supabase
    .from('issue_trees')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) { missingTable = isMissingTableError(error); return null; }
  missingTable = false;
  return (data && data[0]) || null;
}

export async function createTree(title) {
  const { data, error } = await supabase
    .from('issue_trees')
    .insert({ title, created_by: getIdentity() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setHypothesisStatus(treeId, status) {
  await supabase.from('issue_trees').update({ hypothesis_status: status }).eq('id', treeId);
}

export async function archiveTree(treeId) {
  await supabase.from('issue_trees').update({ archived: true }).eq('id', treeId);
}

export async function loadNodes(treeId) {
  const { data, error } = await supabase
    .from('issue_nodes')
    .select('*, issue_node_insights(figure_id), issue_node_programmes(programme_id), issue_node_ideas(idea_id)')
    .eq('tree_id', treeId)
    .order('order_index', { ascending: true });
  if (error) return [];
  return data || [];
}

// parentId null = counting top-level siblings within one branch column; parentId set
// = counting children of that node (which all share its branch already, but matching
// on branch too costs nothing and keeps this correct even if that ever weren't true).
function siblingsOf(nodes, parentId, branch) {
  return nodes.filter(n => n.parent_id === parentId && n.branch === branch);
}

export async function addNode({ treeId, parentId, branch, title }, nodes) {
  const order_index = siblingsOf(nodes, parentId, branch).length;
  const { error } = await supabase.from('issue_nodes').insert({
    tree_id: treeId, parent_id: parentId, branch, title, order_index, created_by: getIdentity()
  });
  if (error) showToast(`Couldn't add: ${error.message}`, true);
}

export async function updateNode(nodeId, patch) {
  await supabase.from('issue_nodes').update(patch).eq('id', nodeId);
}

export async function deleteNode(node) {
  if (!confirm(`Delete "${node.title}"${node.children?.length ? ' and everything under it' : ''}? This can't be undone.`)) return false;
  await supabase.from('issue_nodes').delete().eq('id', node.id);
  return true;
}

export async function moveNode(node, siblings, direction) {
  const idx = siblings.findIndex(s => s.id === node.id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  await Promise.all([
    supabase.from('issue_nodes').update({ order_index: other.order_index }).eq('id', node.id),
    supabase.from('issue_nodes').update({ order_index: node.order_index }).eq('id', other.id)
  ]);
}

export async function addNodeInsight(nodeId, figureId) { await supabase.from('issue_node_insights').insert({ node_id: nodeId, figure_id: figureId }); }
export async function removeNodeInsight(nodeId, figureId) { await supabase.from('issue_node_insights').delete().eq('node_id', nodeId).eq('figure_id', figureId); }
export async function addNodeProgramme(nodeId, programmeId) { await supabase.from('issue_node_programmes').insert({ node_id: nodeId, programme_id: programmeId }); }
export async function removeNodeProgramme(nodeId, programmeId) { await supabase.from('issue_node_programmes').delete().eq('node_id', nodeId).eq('programme_id', programmeId); }
export async function addNodeIdea(nodeId, ideaId) { await supabase.from('issue_node_ideas').insert({ node_id: nodeId, idea_id: ideaId }); }
export async function removeNodeIdea(nodeId, ideaId) { await supabase.from('issue_node_ideas').delete().eq('node_id', nodeId).eq('idea_id', ideaId); }

export async function promoteNodeToNextStep(node, onChange) {
  openNextStepModal({
    step: null,
    prefill: { title: node.title, text: node.title, related_node_id: node.id },
    onChange
  });
}

// ---------------- Tree layout (nested by parent_id, columns by branch) ----------------

function buildTree(nodes, branch) {
  const top = nodes.filter(n => n.parent_id === null && n.branch === branch).sort((a, b) => a.order_index - b.order_index);
  const attachChildren = (node) => {
    const children = nodes.filter(n => n.parent_id === node.id).sort((a, b) => a.order_index - b.order_index);
    return { ...node, children: children.map(attachChildren) };
  };
  return top.map(attachChildren);
}

function nodeRowHTML(node, depth) {
  const hasChildren = node.children && node.children.length > 0;
  return `
    <div class="issue-node" data-node-id="${node.id}" style="margin-left: ${depth * 18}px;">
      <div class="issue-node-row">
        ${hasChildren ? `<button type="button" class="issue-node-toggle" data-node-toggle="${node.id}">▾</button>` : '<span class="issue-node-toggle-spacer"></span>'}
        <span class="issue-evidence-dot issue-evidence-${node.evidence_strength}" title="${EVIDENCE_LABEL[node.evidence_strength]}">${EVIDENCE_DOT[node.evidence_strength]}</span>
        <button type="button" class="issue-node-title" data-node-open="${node.id}">${escapeHtml(node.title)}</button>
      </div>
      <div class="issue-node-children" data-node-children="${node.id}">
        ${(node.children || []).map(c => nodeRowHTML(c, depth + 1)).join('')}
        <button type="button" class="btn-text issue-add-child" data-node-add-child="${node.id}" style="margin-left: ${(depth + 1) * 18 + 20}px;">+ Add sub-point</button>
      </div>
    </div>
  `;
}

function branchColumnHTML(branch, topNodes) {
  const addLabel = branch === 'why' ? '+ Add factor' : '+ Add strategic pillar';
  return `
    <div class="issue-branch-column" data-branch="${branch}">
      <div class="issue-branch-head">${BRANCH_LABEL[branch]}</div>
      <div class="issue-branch-body">
        ${topNodes.map(n => nodeRowHTML(n, 0)).join('') || '<div class="drilldown-empty">Nothing yet.</div>'}
      </div>
      <button type="button" class="btn-text issue-add-top" data-branch-add="${branch}">${addLabel}</button>
    </div>
  `;
}

export function renderIssueTree(container, tree, nodes, ctx) {
  const whyTop = buildTree(nodes, 'why');
  const howTop = buildTree(nodes, 'how');

  container.innerHTML = `
    <div class="issue-hypothesis">
      <div class="issue-hypothesis-title" id="issue-hypothesis-title">${escapeHtml(tree.title)}</div>
      <div class="control-toggle-group" id="issue-hypothesis-status">
        ${['open', 'supported', 'not_supported'].map(s => `<button type="button" class="control-toggle ${tree.hypothesis_status === s ? 'active' : ''}" data-hyp-status="${s}">${HYPOTHESIS_LABEL[s]}</button>`).join('')}
      </div>
      <button type="button" class="btn-text" id="issue-hypothesis-edit">Edit question</button>
    </div>
    <div class="issue-branches">
      ${branchColumnHTML('why', whyTop)}
      ${branchColumnHTML('how', howTop)}
    </div>
  `;

  container.querySelector('#issue-hypothesis-status').querySelectorAll('[data-hyp-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await setHypothesisStatus(tree.id, btn.dataset.hypStatus);
      ctx.onChange();
    });
  });
  container.querySelector('#issue-hypothesis-edit').addEventListener('click', async () => {
    const next = prompt('Central hypothesis / question:', tree.title)?.trim();
    if (!next || next === tree.title) return;
    await supabase.from('issue_trees').update({ title: next }).eq('id', tree.id);
    ctx.onChange();
  });

  container.querySelectorAll('[data-node-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kids = container.querySelector(`[data-node-children="${btn.dataset.nodeToggle}"]`);
      const collapsed = kids.style.display === 'none';
      kids.style.display = collapsed ? '' : 'none';
      btn.textContent = collapsed ? '▾' : '▸';
    });
  });
  container.querySelectorAll('[data-node-open]').forEach(btn => {
    btn.addEventListener('click', () => ctx.onOpenNode(btn.dataset.nodeOpen));
  });
  container.querySelectorAll('[data-node-add-child]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const title = prompt('Title:')?.trim();
      if (!title) return;
      const parent = nodes.find(n => n.id === btn.dataset.nodeAddChild);
      await addNode({ treeId: tree.id, parentId: parent.id, branch: parent.branch, title }, nodes);
      ctx.onChange();
    });
  });
  container.querySelectorAll('[data-branch-add]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const title = prompt('Title:')?.trim();
      if (!title) return;
      await addNode({ treeId: tree.id, parentId: null, branch: btn.dataset.branchAdd, title }, nodes);
      ctx.onChange();
    });
  });
}

// ---------------- Empty state (no tree yet) ----------------

export function renderEmptyTreeState(container, ctx) {
  container.innerHTML = `
    <div class="workspace-prompt">
      <div class="workspace-prompt-label">What's the central strategic question?</div>
      <div class="settings-add-row" style="max-width: 640px;">
        <input type="text" id="issue-tree-new-title" placeholder="e.g. Should Details develop an ecosystem-wide loyalty strategy?" />
        <button type="button" class="btn-primary" id="issue-tree-new-btn">Create Issue Tree</button>
      </div>
    </div>
  `;
  container.querySelector('#issue-tree-new-btn').addEventListener('click', async () => {
    const input = container.querySelector('#issue-tree-new-title');
    const title = input.value.trim();
    if (!title) return;
    try { await createTree(title); ctx.onChange(); }
    catch (e) { showToast(e.message, true); }
  });
}

// ---------------- Node detail side panel ----------------

function evidenceListHTML(items, onRemoveAttr) {
  if (!items.length) return `<div class="drilldown-empty">None yet.</div>`;
  return items.map(item => `
    <div class="issue-evidence-item">
      <span>${escapeHtml(item.label)}</span>
      <button type="button" class="btn-text" data-${onRemoveAttr}="${item.id}">Remove</button>
    </div>
  `).join('');
}

export function nodeDetailHTML(node, refs) {
  const insights = (node.issue_node_insights || []).map(r => refs.insightsById.get(r.figure_id)).filter(Boolean);
  const programmes = (node.issue_node_programmes || []).map(r => refs.programmesById.get(r.programme_id)).filter(Boolean);
  const ideas = (node.issue_node_ideas || []).map(r => refs.ideasById.get(r.idea_id)).filter(Boolean);

  return `
    <div class="side-panel-head">
      <h2>${escapeHtml(node.title)}</h2>
      <button type="button" class="side-panel-close" id="node-panel-close">&times;</button>
    </div>
    <div class="side-panel-body">
      <div class="form-field full">
        <label>Description</label>
        <textarea id="node-description" rows="3" placeholder="Optional…">${escapeHtml(node.description || '')}</textarea>
      </div>
      <div class="form-field">
        <label>Evidence strength</label>
        <div class="control-toggle-group" id="node-evidence-strength">
          ${Object.keys(EVIDENCE_LABEL).map(k => `<button type="button" class="control-toggle ${node.evidence_strength === k ? 'active' : ''}" data-evidence="${k}">${EVIDENCE_LABEL[k]}</button>`).join('')}
        </div>
      </div>
      <div class="form-field">
        <label>Status</label>
        <div class="control-toggle-group" id="node-status">
          ${Object.keys(STATUS_LABEL).map(k => `<button type="button" class="control-toggle ${node.status === k ? 'active' : ''}" data-status="${k}">${STATUS_LABEL[k]}</button>`).join('')}
        </div>
      </div>

      <div class="form-field full">
        <label>Evidence <button type="button" class="btn-text" id="node-add-evidence" style="float:right;">+ Add evidence</button></label>
        <div class="drilldown-block-label">Insights</div>
        ${evidenceListHTML(insights.map(i => ({ id: i.id, label: i.title || i.insight_text || 'Untitled' })), 'remove-insight')}
        <div class="drilldown-block-label" style="margin-top:10px;">Programmes</div>
        ${evidenceListHTML(programmes.map(p => ({ id: p.id, label: p.programme_name })), 'remove-programme')}
        <div class="drilldown-block-label" style="margin-top:10px;">Ideas</div>
        ${evidenceListHTML(ideas.map(i => ({ id: i.id, label: i.title })), 'remove-idea')}
      </div>

      ${node.branch === 'how' ? '<button type="button" class="btn-primary" id="node-promote-btn" style="margin-top: 8px;">&rarr; Promote to Next Step</button>' : ''}

      <div class="side-panel-actions">
        <button type="button" class="btn-danger-text" id="node-delete-btn">Delete</button>
      </div>
    </div>
  `;
}

export function wireNodeDetail(panelEl, node, refs, ctx) {
  panelEl.querySelector('#node-panel-close').addEventListener('click', ctx.onClose);
  panelEl.querySelector('#node-description').addEventListener('change', async (e) => {
    await updateNode(node.id, { description: e.target.value.trim() || null });
    ctx.onChange();
  });
  panelEl.querySelector('#node-evidence-strength').querySelectorAll('[data-evidence]').forEach(btn => {
    btn.addEventListener('click', async () => { await updateNode(node.id, { evidence_strength: btn.dataset.evidence }); ctx.onChange(); });
  });
  panelEl.querySelector('#node-status').querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', async () => { await updateNode(node.id, { status: btn.dataset.status }); ctx.onChange(); });
  });
  panelEl.querySelector('#node-add-evidence').addEventListener('click', () => ctx.onAddEvidence(node));
  panelEl.querySelectorAll('[data-remove-insight]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeInsight(node.id, btn.dataset.removeInsight); ctx.onChange(); }));
  panelEl.querySelectorAll('[data-remove-programme]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeProgramme(node.id, btn.dataset.removeProgramme); ctx.onChange(); }));
  panelEl.querySelectorAll('[data-remove-idea]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeIdea(node.id, btn.dataset.removeIdea); ctx.onChange(); }));
  const promoteBtn = panelEl.querySelector('#node-promote-btn');
  if (promoteBtn) promoteBtn.addEventListener('click', () => promoteNodeToNextStep(node, ctx.onPromote || ctx.onChange));
  panelEl.querySelector('#node-delete-btn').addEventListener('click', async () => {
    const deleted = await deleteNode(node);
    if (deleted) { ctx.onChange(); ctx.onClose(); }
  });
}

// ---------------- Evidence picker modal (search Insights / Programmes / Ideas) ----------------

export function openEvidencePickerModal(node, refs, ctx) {
  let root = document.getElementById('evidence-picker-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'evidence-picker-root';
    document.body.appendChild(root);
  }

  const tabs = [
    { key: 'insight', label: 'Insights', items: refs.allInsights.map(i => ({ id: i.id, label: i.title || i.insight_text || 'Untitled' })) },
    { key: 'programme', label: 'Programmes', items: refs.allProgrammes.map(p => ({ id: p.id, label: p.programme_name })) },
    { key: 'idea', label: 'Ideas', items: refs.allIdeas.map(i => ({ id: i.id, label: i.title })) }
  ];
  let activeTab = 'insight';

  function renderList(filter) {
    const tab = tabs.find(t => t.key === activeTab);
    const q = filter.trim().toLowerCase();
    const matches = tab.items.filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 40);
    root.querySelector('#evidence-picker-results').innerHTML = matches.map(m =>
      `<button type="button" class="prog-list-row" data-pick="${m.id}">${escapeHtml(m.label)}</button>`
    ).join('') || '<div class="drilldown-empty">No matches.</div>';
    root.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (activeTab === 'insight') await addNodeInsight(node.id, btn.dataset.pick);
        else if (activeTab === 'programme') await addNodeProgramme(node.id, btn.dataset.pick);
        else await addNodeIdea(node.id, btn.dataset.pick);
        close();
        ctx.onChange();
      });
    });
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="evidence-picker-modal">
      <div class="form-modal" style="max-width: 520px;">
        <div class="form-modal-head"><h2>Add evidence to "${escapeHtml(node.title)}"</h2><button type="button" class="form-modal-close" id="evidence-picker-close">&times;</button></div>
        <div class="form-modal-body">
          <div class="lab-tabs" style="padding: 0; margin-bottom: 14px;">
            ${tabs.map(t => `<button type="button" class="lab-tab ${t.key === activeTab ? 'active' : ''}" data-evidence-tab="${t.key}">${t.label}</button>`).join('')}
          </div>
          <input type="text" id="evidence-picker-search" placeholder="Search…" style="width:100%; padding: 10px 14px; border: none; border-radius: var(--radius); background: var(--surface-alt); font-size: 13px; margin-bottom: 12px;" />
          <div id="evidence-picker-results" style="max-height: 320px; overflow-y: auto;"></div>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('evidence-picker-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('evidence-picker-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  root.querySelectorAll('[data-evidence-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.evidenceTab;
      root.querySelectorAll('[data-evidence-tab]').forEach(b => b.classList.toggle('active', b === btn));
      renderList(root.querySelector('#evidence-picker-search').value);
    });
  });
  root.querySelector('#evidence-picker-search').addEventListener('input', (e) => renderList(e.target.value));
  renderList('');
}

// ---------------- Promote idea -> node picker ----------------

export function openPromoteIdeaModal(idea, tree, nodes, ctx) {
  let root = document.getElementById('promote-idea-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'promote-idea-root';
    document.body.appendChild(root);
  }

  const nodeOptionsHTML = (branch) => nodes.filter(n => n.branch === branch)
    .map(n => `<option value="${n.id}">${'— '.repeat(n.parent_id ? 1 : 0)}${escapeHtml(n.title)}</option>`).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="promote-idea-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Add "${escapeHtml(idea.title)}" to Issue Tree</h2><button type="button" class="form-modal-close" id="promote-idea-close">&times;</button></div>
        <div class="form-modal-body">
          <div class="form-field full">
            <label>Branch</label>
            <div class="control-toggle-group" id="promote-branch">
              <button type="button" class="control-toggle active" data-branch="why">WHY</button>
              <button type="button" class="control-toggle" data-branch="how">HOW</button>
            </div>
          </div>
          <div class="form-field full">
            <label>Attach under</label>
            <select id="promote-node-select">
              <option value="">— New top-level node —</option>
              ${nodeOptionsHTML('why')}
            </select>
          </div>
          <div class="form-field full" id="promote-new-title-field">
            <label>New node title</label>
            <input type="text" id="promote-new-title" value="${escapeHtml(idea.title)}" />
          </div>
        </div>
        <div class="form-modal-foot">
          <button type="button" class="btn-text" id="promote-idea-cancel">Cancel</button>
          <button type="button" class="btn-primary" id="promote-idea-confirm">Add</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('promote-idea-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('promote-idea-close').addEventListener('click', close);
  document.getElementById('promote-idea-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let branch = 'why';
  const select = document.getElementById('promote-node-select');
  root.querySelectorAll('[data-branch]').forEach(btn => {
    btn.addEventListener('click', () => {
      branch = btn.dataset.branch;
      root.querySelectorAll('[data-branch]').forEach(b => b.classList.toggle('active', b === btn));
      select.innerHTML = `<option value="">— New top-level node —</option>${nodeOptionsHTML(branch)}`;
      document.getElementById('promote-new-title-field').hidden = false; // select resets to "new node" but doesn't fire 'change'
    });
  });
  select.addEventListener('change', () => {
    document.getElementById('promote-new-title-field').hidden = !!select.value;
  });

  document.getElementById('promote-idea-confirm').addEventListener('click', async () => {
    let activeTree = tree;
    if (!activeTree) {
      const hypothesis = prompt('No Issue Tree yet — what\'s the central strategic question?', idea.title)?.trim();
      if (!hypothesis) return;
      try { activeTree = await createTree(hypothesis); }
      catch (e) { showToast(e.message, true); return; }
    }
    let nodeId = select.value;
    if (!nodeId) {
      const title = document.getElementById('promote-new-title').value.trim();
      if (!title) return;
      const { data, error } = await supabase.from('issue_nodes').insert({
        tree_id: activeTree.id, parent_id: null, branch, title,
        order_index: nodes.filter(n => n.branch === branch && !n.parent_id).length,
        created_by: getIdentity()
      }).select().single();
      if (error) { showToast(`Couldn't add: ${error.message}`, true); return; }
      nodeId = data.id;
    }
    await addNodeIdea(nodeId, idea.id);
    close();
    showToast('Added to Issue Tree.');
    ctx.onChange();
  });
}
