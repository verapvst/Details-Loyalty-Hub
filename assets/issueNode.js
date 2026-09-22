// Brainstorm — Issue Analysis. The full-page workspace for one Issue Tree node: a
// research notebook, not a form — hypothesis, evidence, analysis notes and open
// questions once analysis starts, key insight/prioritisation/recommendation once it's
// mature enough. See issueTree.js for the render/wiring logic this page just hosts.
import { supabase } from './supabase.js';
import { initNav } from './app.js';
import { fieldPlainText } from './richText.js';
import { loadQuestions, openQuestionModal } from './questions.js';
import { loadIdeas } from './brainstormIdeas.js';
import {
  loadNode, loadNodes, loadCurrentTree, issueAnalysisHTML, wireIssueAnalysis,
  openEvidencePickerModal
} from './issueTree.js';

await initNav('brainstorm-issue-tree');

const root = document.getElementById('issue-node-root');
const params = new URLSearchParams(window.location.search);
const nodeId = params.get('id');

if (!nodeId) {
  root.innerHTML = `<div class="error-state">No issue selected. <a href="brainstorm.html?tab=issue-tree">Back to Issue Tree</a></div>`;
  throw new Error('Missing node id');
}

let node = null;
let tree = null;
let allNodes = [];
let allInsights = [];
let allProgrammes = [];
let allIdeas = [];
let allQuestions = [];

async function loadEvidenceRefs() {
  const [{ data: figuresData }, { data: programmesData }] = await Promise.all([
    supabase.from('figures').select('id, title, insight_text').order('created_at', { ascending: false }),
    supabase.from('programmes').select('id, programme_name').order('programme_name')
  ]);
  allInsights = (figuresData || []).map(f => ({ ...f, insight_text: fieldPlainText(f.insight_text) }));
  allProgrammes = programmesData || [];
}

function refsForRender() {
  return {
    insightsById: new Map(allInsights.map(i => [i.id, i])),
    programmesById: new Map(allProgrammes.map(p => [p.id, p])),
    ideasById: new Map(allIdeas.map(i => [i.id, i])),
    nodesById: new Map(allNodes.map(n => [n.id, n])),
    allInsights, allProgrammes, allIdeas,
    questionsForNode: allQuestions.filter(q => q.related_node_id === node.id)
  };
}

async function render() {
  root.innerHTML = issueAnalysisHTML(node, tree, refsForRender());
  wireIssueAnalysis(root, node, refsForRender(), {
    onChange: reload,
    onDelete: () => { window.location.href = 'brainstorm.html?tab=issue-tree'; },
    onAddIdea: (n) => openEvidencePickerModal(n, { allInsights, allProgrammes, allIdeas }, { onChange: reload }, 'idea'),
    onAddEvidence: (n, kind) => openEvidencePickerModal(n, { allInsights, allProgrammes, allIdeas }, { onChange: reload }, kind),
    onAddQuestion: (n) => openQuestionModal({ prefill: { related_node_id: n.id }, onChange: reloadQuestionsAndRender })
  });
}

async function reloadQuestionsAndRender() {
  allQuestions = await loadQuestions();
  render();
}

async function reload() {
  node = await loadNode(nodeId);
  if (!node) {
    root.innerHTML = `<div class="error-state">Couldn't load this issue. <a href="brainstorm.html?tab=issue-tree">Back to Issue Tree</a></div>`;
    return;
  }
  tree = await loadCurrentTree();
  allNodes = tree ? await loadNodes(tree.id) : [];
  render();
}

await loadEvidenceRefs();
allIdeas = await loadIdeas();
allQuestions = await loadQuestions();
await reload();
