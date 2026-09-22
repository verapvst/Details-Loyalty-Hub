// Brainstorm — Issue Tree. Convergent thinking: the team's central strategic
// hypothesis, broken down the Minto/MECE way into WHY (deductive: external
// opportunity x internal capability) and HOW (inductive: Areas of Action -> Main
// Issues -> Sub-Issues) — the exact shape your Strategy Consulting course's own
// "Issue Analysis" deliverables use (Groups 02/03/04/05/08/09, Indie Campers 2022).
//
// A node's evidence is a reference to an existing Insight, Programme or Idea (never
// copied), and a HOW node can be promoted straight into a Next Step, which is how a
// validated branch becomes project direction. This is where the platform's real
// analytical weight lives — Ideas (brainstormIdeas.js) stay a lightweight inbox;
// everything past "here's a raw thought" (hypothesis, evidence, prioritisation,
// recommendation) happens here, on the Issue a promoted idea becomes part of.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { getOptionList, addOption, loadCustomOptions } from './customOptions.js';
import { openNextStepModal } from './next-steps.js';

const BRANCH_LABEL = { why: 'WHY', how: 'HOW' };
const EVIDENCE_LABEL = { none: 'No evidence', indicative: 'Indicative', supported: 'Supported', strongly_supported: 'Strongly supported' };
const EVIDENCE_DOT = { none: '○', indicative: '◐', supported: '●', strongly_supported: '●' };
export const STATUS_LABEL = { draft: 'Draft', supported: 'Supported', final: 'Final' };
const HYPOTHESIS_LABEL = { open: 'Open', supported: 'Supported', not_supported: 'Not supported' };
// A small, defensible set — never one generic "Fit" score (see the architecture
// proposal, Section 6). Same 1-5 scale, same meaning, on every dimension.
const SCORE_LABEL = { 1: 'Poor', 2: 'Weak', 3: 'Moderate', 4: 'Strong', 5: 'Excellent' };
export const PRIORITISATION_DIMENSIONS = [
  { key: 'customer_value_impact', label: 'Customer Value Impact' },
  { key: 'business_impact', label: 'Business Impact' },
  { key: 'strategic_differentiation', label: 'Strategic Differentiation' },
  { key: 'implementation_complexity', label: 'Implementation Complexity' }
];
export const COMPLEXITY_DRIVERS = ['Technology', 'Operations', 'Organisation', 'Partnerships', 'Data', 'Cost', 'Time'];

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

export async function updateTree(treeId, patch) {
  await supabase.from('issue_trees').update(patch).eq('id', treeId);
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

export async function loadNode(nodeId) {
  const { data, error } = await supabase
    .from('issue_nodes')
    .select('*, issue_node_insights(figure_id), issue_node_programmes(programme_id), issue_node_ideas(idea_id)')
    .eq('id', nodeId)
    .single();
  if (error) return null;
  return data;
}

// parentId null = counting top-level siblings within one branch column; parentId set
// = counting children of that node (which all share its branch already, but matching
// on branch too costs nothing and keeps this correct even if that ever weren't true).
function siblingsOf(nodes, parentId, branch) {
  return nodes.filter(n => n.parent_id === parentId && n.branch === branch);
}

export async function addNode({ treeId, parentId, branch, title }, nodes) {
  const order_index = siblingsOf(nodes, parentId, branch).length;
  const { data, error } = await supabase.from('issue_nodes').insert({
    tree_id: treeId, parent_id: parentId, branch, title, order_index, created_by: getIdentity()
  }).select().single();
  if (error) { showToast(`Couldn't add: ${error.message}`, true); return null; }
  return data;
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

// ---------------- Tree layout ----------------
// WHY renders as one generic nested column (External Analysis / Internal Analysis
// are just top-level WHY nodes the team creates themselves — no special-casing
// needed, the deductive two-pillar shape is a convention, not a schema constraint).
// HOW renders as a grid of columns, one per top-level node — each top-level HOW node
// is an "Area of Action" in your course's own vocabulary; its children are Main
// Issues, and theirs are Sub-Issues, phrased as questions.

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
        <a href="issue-node.html?id=${node.id}" class="issue-node-title">${escapeHtml(node.title)}</a>
      </div>
      <div class="issue-node-children" data-node-children="${node.id}">
        ${(node.children || []).map(c => nodeRowHTML(c, depth + 1)).join('')}
        <button type="button" class="btn-text issue-add-child" data-node-add-child="${node.id}" style="margin-left: ${(depth + 1) * 18 + 20}px;">+ Add sub-point</button>
      </div>
    </div>
  `;
}

function whyColumnHTML(topNodes) {
  return `
    <div class="issue-branch-column" data-branch="why">
      <div class="issue-branch-head">WHY <span class="issue-branch-subhead">— deductive, external × internal</span></div>
      <div class="issue-branch-body">
        ${topNodes.map(n => nodeRowHTML(n, 0)).join('') || '<div class="drilldown-empty">Nothing yet. Start with an "External Analysis" and an "Internal Analysis" node.</div>'}
      </div>
      <button type="button" class="btn-text issue-add-top" data-branch-add="why">+ Add factor</button>
    </div>
  `;
}

function howAreaColumnHTML(areaNode) {
  return `
    <div class="issue-area-column" data-node-id="${areaNode.id}">
      <div class="issue-area-head">
        <a href="issue-node.html?id=${areaNode.id}" class="issue-area-title">${escapeHtml(areaNode.title)}</a>
        <span class="issue-evidence-dot issue-evidence-${areaNode.evidence_strength}" title="${EVIDENCE_LABEL[areaNode.evidence_strength]}">${EVIDENCE_DOT[areaNode.evidence_strength]}</span>
      </div>
      <div class="issue-branch-body">
        ${(areaNode.children || []).map(n => nodeRowHTML(n, 0)).join('') || '<div class="drilldown-empty">No Main Issues yet.</div>'}
        <button type="button" class="btn-text issue-add-child" data-node-add-child="${areaNode.id}">+ Add Main Issue</button>
      </div>
    </div>
  `;
}

function howSectionHTML(topNodes) {
  return `
    <div style="margin-top: 8px;">
      <div class="issue-branch-head" style="margin-bottom: 14px;">HOW <span class="issue-branch-subhead">— inductive, Areas of Action &rarr; Main Issues &rarr; Sub-Issues</span></div>
      <div class="issue-how-grid">
        ${topNodes.map(howAreaColumnHTML).join('')}
      </div>
      <button type="button" class="btn-text issue-add-top" data-branch-add="how" style="margin-top: 14px;">+ Add Area of Action</button>
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
    ${tree.hypothesis_status === 'supported' ? `
      <div class="record-block" style="margin-bottom: 20px;">
        <h3>Recommendation</h3>
        <textarea id="issue-tree-recommendation" rows="3" placeholder="Once the WHY and HOW branches support it, write the thesis-level position here.">${escapeHtml(tree.recommendation_text || '')}</textarea>
      </div>
    ` : ''}
    ${whyColumnHTML(whyTop)}
    ${howSectionHTML(howTop)}
  `;

  container.querySelector('#issue-hypothesis-status').querySelectorAll('[data-hyp-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await setHypothesisStatus(tree.id, btn.dataset.hypStatus);
      ctx.onChange();
    });
  });
  container.querySelector('#issue-hypothesis-edit').addEventListener('click', async () => {
    const next = prompt('Central question:', tree.title)?.trim();
    if (!next || next === tree.title) return;
    await supabase.from('issue_trees').update({ title: next }).eq('id', tree.id);
    ctx.onChange();
  });
  container.querySelector('#issue-tree-recommendation')?.addEventListener('change', async (e) => {
    await updateTree(tree.id, { recommendation_text: e.target.value.trim() || null });
  });

  container.querySelectorAll('[data-node-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kids = container.querySelector(`[data-node-children="${btn.dataset.nodeToggle}"]`);
      const collapsed = kids.style.display === 'none';
      kids.style.display = collapsed ? '' : 'none';
      btn.textContent = collapsed ? '▾' : '▸';
    });
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
        <input type="text" id="issue-tree-new-title" placeholder="e.g. How should Details design a loyalty strategy that creates value for customers and for the business across its ecosystem?" />
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

// ---------------- Vertical / Audience relevance chips (Issue-level, not Idea-level) ----------------
// Binary applicability tags by default — the same "+ Add" inline-growth pattern used
// everywhere else, writing straight into custom_options so Settings and this page
// always agree. Deliberately NOT a scored grid by default (see the architecture
// proposal, Section 6) — that stays available as the opt-in issue_node_relevance_scores
// table for the rare Issue that needs graded relevance, not built into this pass.
function relevanceChipsHTML(listKey, wrapperId, selected, addLabel) {
  const options = getOptionList(listKey);
  return `
    <div class="idea-picker" id="${wrapperId}" data-picker-kind="chips" data-picker-key="${listKey}">
      <div class="chip-row">
        ${options.map(v => `<label class="checkbox-item"><input type="checkbox" value="${escapeHtml(v)}" ${selected.includes(v) ? 'checked' : ''} /> ${escapeHtml(v)}</label>`).join('')}
      </div>
      <button type="button" class="btn-text relevance-picker-add" style="margin-top:6px;">${addLabel}</button>
    </div>
  `;
}
function readChipValue(pickerEl) {
  if (!pickerEl) return [];
  return [...pickerEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
}
function wireRelevancePicker(root, picker, onChanged) {
  const btn = picker.querySelector('.relevance-picker-add');
  const addLabel = btn.textContent;
  btn.addEventListener('click', async () => {
    const listKey = picker.dataset.pickerKey;
    const current = readChipValue(picker);
    const value = prompt('New value:')?.trim();
    if (!value) return;
    const { error } = await addOption(listKey, value);
    if (error) { showToast(error.code === '23505' ? 'That value already exists.' : `Couldn't add: ${error.message}`, true); return; }
    await loadCustomOptions();
    const html = relevanceChipsHTML(listKey, picker.id, [...current, value], addLabel);
    picker.outerHTML = html;
    const fresh = root.querySelector(`#${picker.id}`);
    wireRelevancePicker(root, fresh, onChanged);
    if (onChanged) onChanged(fresh);
  });
}

// ---------------- Issue Analysis — full page ----------------
// Progressive disclosure keyed to node.status, exactly like the idea detail page used
// to be keyed to idea status: draft shows only the issue statement and why it
// matters; once analysis starts (status = supported or final is also fine to already
// show it — the gate is simply "not draft") hypothesis/evidence/notes/relevance/
// questions appear; key insight, prioritisation and recommendation only appear once
// the node has reached Supported or Final.

function crumbHTML(node, nodesById) {
  const chain = [];
  let cur = node;
  while (cur) { chain.unshift(cur); cur = cur.parent_id ? nodesById.get(cur.parent_id) : null; }
  return chain.map((n, i) => i === chain.length - 1
    ? `<span class="issue-crumb-current">${escapeHtml(n.title)}</span>`
    : `<a href="issue-node.html?id=${n.id}">${escapeHtml(n.title)}</a>`
  ).join(' <span class="issue-crumb-sep">/</span> ');
}

function evidenceListItemsHTML(items, labelFn, removeAttr) {
  if (!items.length) return '<div class="drilldown-empty">None yet.</div>';
  return items.map(item => `
    <div class="issue-evidence-item">
      <span>${escapeHtml(labelFn(item))}</span>
      <button type="button" class="btn-text" data-${removeAttr}="${item.id}">Remove</button>
    </div>
  `).join('');
}

export function issueAnalysisHTML(node, tree, refs) {
  const insights = (node.issue_node_insights || []).map(r => refs.insightsById.get(r.figure_id)).filter(Boolean);
  const programmes = (node.issue_node_programmes || []).map(r => refs.programmesById.get(r.programme_id)).filter(Boolean);
  const ideas = (node.issue_node_ideas || []).map(r => refs.ideasById.get(r.idea_id)).filter(Boolean);
  const questions = refs.questionsForNode || [];
  const isDraft = node.status === 'draft';
  const isMature = node.status === 'supported' || node.status === 'final';
  const vertical = node.vertical_relevance || [];
  const audience = node.audience_relevance || [];
  const complexityDrivers = node.complexity_drivers || [];

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
      <div style="font-size:12px; color:var(--muted);"><a href="brainstorm.html?tab=issue-tree" style="color:var(--muted-light);">&larr; Issue Tree</a> &nbsp;/&nbsp; ${crumbHTML(node, refs.nodesById)}</div>
      <span class="badge ${node.status === 'final' ? 'badge-green' : node.status === 'supported' ? 'badge-dark' : 'badge-muted'}">${STATUS_LABEL[node.status]}</span>
    </div>

    <div style="padding-bottom: 24px; border-bottom: 1px solid var(--border); margin-bottom: 28px;">
      <div class="settings-hint" style="margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; font-size: 10.5px;">${BRANCH_LABEL[node.branch]}${node.is_concept ? ' · Concept' : ''}</div>
      <div class="record-title" style="font-size: 30px;" id="issue-node-title">${escapeHtml(node.title)}</div>
    </div>

    <div class="workspace-columns" style="grid-template-columns: 1fr 300px;">
      <div>
        <div class="record-block">
          <h3>Why this matters</h3>
          <textarea id="issue-description" rows="3" placeholder="Short explanation of why this question matters…">${escapeHtml(node.description || '')}</textarea>
        </div>

        <div class="record-block">
          <h3>Ideas linked to this issue <button type="button" class="btn-text" id="issue-add-idea" style="float:right;">+ Add</button></h3>
          ${evidenceListItemsHTML(ideas, i => i.title, 'remove-idea')}
        </div>

        ${!isDraft ? `
          <div class="record-block">
            <h3>Hypothesis</h3>
            <textarea id="issue-hypothesis" rows="3" placeholder="What do we currently believe? e.g. &quot;Yes — ...&quot; or &quot;No — ...&quot;">${escapeHtml(node.hypothesis || '')}</textarea>
            <div class="form-field full" style="margin-top: 14px;">
              <label>Analysis tool <span style="font-weight:400; color: var(--muted);">— what will test this hypothesis</span></label>
              <input type="text" id="issue-analysis-tool" value="${escapeHtml(node.analysis_tool || '')}" placeholder="e.g. SWOT Analysis, Competitive Benchmarking, Willingness-to-Pay Survey…" />
            </div>
          </div>

          <div class="record-block">
            <h3>Evidence</h3>
            <div class="drilldown-block-label">Insights <button type="button" class="btn-text" id="issue-add-insight" style="float:right;">+ Add</button></div>
            ${evidenceListItemsHTML(insights, i => i.title || i.insight_text || 'Untitled', 'remove-insight')}
            <div class="drilldown-block-label" style="margin-top:14px;">Programmes <button type="button" class="btn-text" id="issue-add-programme" style="float:right;">+ Add</button></div>
            ${evidenceListItemsHTML(programmes, p => p.programme_name, 'remove-programme')}
          </div>

          <div class="record-block">
            <h3>Analysis notes</h3>
            <textarea id="issue-analysis-notes" rows="4" placeholder="Develop the thinking here — what the evidence suggests, open trade-offs, what's still missing…">${escapeHtml(node.analysis_notes || '')}</textarea>
          </div>

          <div class="record-block">
            <h3>Open questions <button type="button" class="btn-text" id="issue-add-question" style="float:right;">+ Add</button></h3>
            ${questions.length ? questions.map(q => `
              <div class="issue-evidence-item">
                <span>${escapeHtml(q.title || q.question_text)}${q.status === 'answered' ? ' <span class="badge badge-green" style="margin-left:6px;">Resolved</span>' : ''}</span>
              </div>
            `).join('') : '<div class="drilldown-empty">None yet.</div>'}
          </div>
        ` : `
          <div class="drilldown-panel" style="margin-bottom: 18px;">
            <div style="font-size: 13px; color: var(--muted);">Hypothesis, evidence, analysis notes and open questions appear once this issue moves past <strong>Draft</strong>.</div>
          </div>
        `}

        ${isMature ? `
          <div class="record-block">
            <h3>Key insight</h3>
            <textarea id="issue-key-insight" rows="2" placeholder="The synthesised conclusion, once the evidence supports one…">${escapeHtml(node.key_insight || '')}</textarea>
          </div>
          <div class="record-block">
            <h3>Recommendation</h3>
            <textarea id="issue-recommendation" rows="3" placeholder="The implication — what should Details actually do about this?">${escapeHtml(node.recommendation || '')}</textarea>
          </div>
        ` : ''}

        <div class="record-block">
          <button type="button" class="btn-danger-text" id="issue-delete-btn">Delete Issue</button>
        </div>
      </div>

      <div>
        <div class="drilldown-panel" style="margin-bottom: 16px;">
          <div class="drilldown-block-label">Status</div>
          <div class="control-toggle-group" id="issue-status-group" style="margin-bottom: 14px;">
            ${Object.keys(STATUS_LABEL).map(k => `<button type="button" class="control-toggle ${node.status === k ? 'active' : ''}" data-status="${k}">${STATUS_LABEL[k]}</button>`).join('')}
          </div>
          <div class="drilldown-block-label">Evidence strength</div>
          <div class="control-toggle-group" id="issue-evidence-strength" style="margin-bottom: 14px; flex-wrap: wrap;">
            ${Object.keys(EVIDENCE_LABEL).map(k => `<button type="button" class="control-toggle ${node.evidence_strength === k ? 'active' : ''}" data-evidence="${k}">${EVIDENCE_LABEL[k]}</button>`).join('')}
          </div>
          <div class="drilldown-block-label">Vertical relevance</div>
          ${relevanceChipsHTML('brainstorm_vertical', 'issue-vertical-picker', vertical, '+ Add')}
          <div class="drilldown-block-label" style="margin-top:14px;">Audience relevance</div>
          ${relevanceChipsHTML('brainstorm_audience', 'issue-audience-picker', audience, '+ Add')}
          ${node.branch === 'how' ? `
            <div style="margin-top:14px;">
              <label class="checkbox-item"><input type="checkbox" id="issue-is-concept" ${node.is_concept ? 'checked' : ''} /> This is a Concept</label>
            </div>
          ` : ''}
        </div>

        ${isMature ? `
          <div class="drilldown-panel" style="margin-bottom: 16px;">
            <div class="drilldown-block-label">Prioritisation</div>
            ${PRIORITISATION_DIMENSIONS.map(d => `
              <div class="form-field full" style="margin-bottom: 10px;">
                <label>${d.label}</label>
                <select class="issue-priority-select" data-field="${d.key}">
                  <option value="">—</option>
                  ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(node[d.key]) === String(n) ? 'selected' : ''}>${n} · ${SCORE_LABEL[n]}</option>`).join('')}
                </select>
              </div>
            `).join('')}
            <div class="form-field full" style="margin-bottom: 10px;">
              <label>P&amp;L logic <span style="font-weight:400; color: var(--muted);">— what the Business Impact score rests on</span></label>
              <textarea id="issue-business-note" rows="2" placeholder="One line, not a fabricated number…">${escapeHtml(node.business_impact_note || '')}</textarea>
            </div>
            <div class="drilldown-block-label">Complexity drivers</div>
            <div class="chip-row" id="issue-complexity-drivers">
              ${COMPLEXITY_DRIVERS.map(d => `<label class="checkbox-item"><input type="checkbox" value="${d}" ${complexityDrivers.includes(d) ? 'checked' : ''} /> ${d}</label>`).join('')}
            </div>
            <div class="form-field full" style="margin-top: 10px;">
              <label>Risk / dependencies <span style="font-weight:400; color: var(--muted);">(optional, flagged not scored)</span></label>
              <textarea id="issue-risk-note" rows="2" placeholder="Regulatory, operational, technological, behavioural…">${escapeHtml(node.risk_note || '')}</textarea>
            </div>
          </div>
        ` : ''}

        ${node.branch === 'how' ? '<button type="button" class="btn-primary" id="issue-promote-btn" style="width:100%;">&rarr; Promote to Next Step</button>' : ''}
      </div>
    </div>
  `;
}

export function wireIssueAnalysis(root, node, refs, ctx) {
  root.querySelector('#issue-node-title').addEventListener('click', async () => {
    const next = prompt('Title:', node.title)?.trim();
    if (!next || next === node.title) return;
    await updateNode(node.id, { title: next });
    ctx.onChange();
  });
  root.querySelector('#issue-description').addEventListener('change', async (e) => {
    await updateNode(node.id, { description: e.target.value.trim() || null });
  });
  root.querySelector('#issue-add-idea').addEventListener('click', () => ctx.onAddIdea(node));
  root.querySelectorAll('[data-remove-idea]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeIdea(node.id, btn.dataset.removeIdea); ctx.onChange(); }));

  root.querySelector('#issue-hypothesis')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { hypothesis: e.target.value.trim() || null });
  });
  root.querySelector('#issue-analysis-tool')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { analysis_tool: e.target.value.trim() || null });
  });
  root.querySelector('#issue-analysis-notes')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { analysis_notes: e.target.value.trim() || null });
  });
  root.querySelector('#issue-add-insight')?.addEventListener('click', () => ctx.onAddEvidence(node, 'insight'));
  root.querySelector('#issue-add-programme')?.addEventListener('click', () => ctx.onAddEvidence(node, 'programme'));
  root.querySelectorAll('[data-remove-insight]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeInsight(node.id, btn.dataset.removeInsight); ctx.onChange(); }));
  root.querySelectorAll('[data-remove-programme]').forEach(btn => btn.addEventListener('click', async () => { await removeNodeProgramme(node.id, btn.dataset.removeProgramme); ctx.onChange(); }));
  root.querySelector('#issue-add-question')?.addEventListener('click', () => ctx.onAddQuestion(node));

  root.querySelector('#issue-key-insight')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { key_insight: e.target.value.trim() || null });
  });
  root.querySelector('#issue-recommendation')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { recommendation: e.target.value.trim() || null });
  });

  root.querySelector('#issue-status-group').querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', async () => { await updateNode(node.id, { status: btn.dataset.status }); ctx.onChange(); });
  });
  root.querySelector('#issue-evidence-strength').querySelectorAll('[data-evidence]').forEach(btn => {
    btn.addEventListener('click', async () => { await updateNode(node.id, { evidence_strength: btn.dataset.evidence }); ctx.onChange(); });
  });
  root.querySelector('#issue-is-concept')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { is_concept: e.target.checked });
  });

  function wireRelevance(pickerId, field) {
    const picker = root.querySelector(`#${pickerId}`);
    if (!picker) return;
    const save = () => updateNode(node.id, { [field]: readChipValue(picker) });
    picker.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', save));
    wireRelevancePicker(root, picker, (fresh) => {
      updateNode(node.id, { [field]: readChipValue(fresh) });
      fresh.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', save));
    });
  }
  wireRelevance('issue-vertical-picker', 'vertical_relevance');
  wireRelevance('issue-audience-picker', 'audience_relevance');

  root.querySelectorAll('.issue-priority-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      await updateNode(node.id, { [sel.dataset.field]: sel.value ? Number(sel.value) : null });
    });
  });
  root.querySelector('#issue-business-note')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { business_impact_note: e.target.value.trim() || null });
  });
  root.querySelector('#issue-risk-note')?.addEventListener('change', async (e) => {
    await updateNode(node.id, { risk_note: e.target.value.trim() || null });
  });
  root.querySelector('#issue-complexity-drivers')?.addEventListener('change', async () => {
    const checked = [...root.querySelectorAll('#issue-complexity-drivers input:checked')].map(cb => cb.value);
    await updateNode(node.id, { complexity_drivers: checked });
  });

  const promoteBtn = root.querySelector('#issue-promote-btn');
  if (promoteBtn) promoteBtn.addEventListener('click', () => promoteNodeToNextStep(node, ctx.onPromote || ctx.onChange));

  root.querySelector('#issue-delete-btn').addEventListener('click', async () => {
    const deleted = await deleteNode(node);
    if (deleted) ctx.onDelete();
  });
}

// ---------------- Evidence picker modal (search Insights / Programmes / Ideas) ----------------

export function openEvidencePickerModal(node, refs, ctx, kind) {
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
  let activeTab = kind && tabs.some(t => t.key === kind) ? kind : 'insight';

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
        <div class="form-modal-head"><h2>Add to "${escapeHtml(node.title)}"</h2><button type="button" class="form-modal-close" id="evidence-picker-close">&times;</button></div>
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
