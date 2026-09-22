// Brainstorm: where the team's thinking becomes the project's strategic direction.
// Four tabs: Ideas (divergent — raw thinking) -> Issue Tree (convergent — the Minto/
// MECE WHY-HOW hypothesis structure the project's deliverables use) -> Questions
// (research gaps) -> Next Steps (committed direction, born from a promoted Issue Tree
// node). Questions/Next Steps still feed the Weekly Report generator exactly as
// before — this file only changes where the day-to-day UI lives.
import { initNav, showToast } from './app.js';
import { supabase } from './supabase.js';
import { fieldPlainText } from './richText.js';
import { loadQuestions, renderQuestionsSection, openQuestionModal } from './questions.js';
import { loadNextSteps, renderNextStepsSection } from './next-steps.js';
import { loadIdeas, ideasTableReady, renderIdeaBoard } from './brainstormIdeas.js';
import {
  loadCurrentTree, loadNodes, issueTreeTableReady, renderIssueTree, renderEmptyTreeState,
  nodeDetailHTML, wireNodeDetail, openEvidencePickerModal
} from './issueTree.js';

await initNav('brainstorm');

// ---------------- Tabs ----------------

const TABS = ['ideas', 'issue-tree', 'questions', 'next-steps'];
const TAB_STORAGE_KEY = 'brainstorm_active_tab';
let activeTab = (() => {
  try { const saved = localStorage.getItem(TAB_STORAGE_KEY); return TABS.includes(saved) ? saved : TABS[0]; }
  catch { return TABS[0]; }
})();

function showTab(tab) {
  activeTab = tab;
  try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* private mode etc. */ }
  document.querySelectorAll('.lab-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  TABS.forEach(t => { document.getElementById(`workspace-${t}`).hidden = t !== tab; });
  closeSidePanel();
}
document.querySelectorAll('.lab-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

// ---------------- Side panel (shared by Ideas and Issue Tree node detail) ----------------

let currentPanel = null; // { type: 'idea' | 'node' }

function openSidePanel(html, wire) {
  const root = document.getElementById('side-panel-root');
  root.innerHTML = `<div class="side-panel-overlay" id="side-panel-overlay"><div class="side-panel">${html}</div></div>`;
  document.getElementById('side-panel-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'side-panel-overlay') closeSidePanel();
  });
  wire(root.querySelector('.side-panel'));
}
function closeSidePanel() {
  currentPanel = null;
  document.getElementById('side-panel-root').innerHTML = '';
}

// ---------------- Ideas ----------------
// Each card links straight to its own page (idea.html) now — no side panel here.

let ideas = [];

async function reloadIdeas() {
  ideas = await loadIdeas();
  if (!ideasTableReady()) {
    document.getElementById('idea-board-root').innerHTML = `<div class="setup-note">Ideas aren't set up yet. Run <code>supabase/026_brainstorm_ideas_and_issue_tree.sql</code> once in the Supabase SQL editor to enable this.</div>`;
    return;
  }
  renderIdeaBoard(document.getElementById('idea-board-root'), ideas, { onChange: reloadIdeas });
}

// ---------------- Issue Tree ----------------

let currentTree = null;
let currentNodes = [];
let allInsights = [];
let allProgrammes = [];

function refsForRender() {
  return {
    insightsById: new Map(allInsights.map(i => [i.id, i])),
    programmesById: new Map(allProgrammes.map(p => [p.id, p])),
    ideasById: new Map(ideas.map(i => [i.id, i]))
  };
}

function showNodePanel(nodeId) {
  const node = currentNodes.find(n => n.id === nodeId);
  if (!node) return;
  currentPanel = { type: 'node', id: nodeId };
  openSidePanel(nodeDetailHTML(node, refsForRender()), (panel) => wireNodeDetail(panel, node, refsForRender(), {
    onChange: reloadTree,
    onClose: closeSidePanel,
    onAddEvidence: (n) => openEvidencePickerModal(n, { allInsights, allProgrammes, allIdeas: ideas }, { onChange: reloadTree }),
    // Promoting a node opens the Next Step modal (see issueTree.js) — its own onChange
    // needs to refresh the Next Steps list, not the tree (nothing about the tree changes).
    onPromote: reloadNextSteps
  }));
}

async function reloadTree() {
  const root = document.getElementById('issue-tree-root');
  currentTree = await loadCurrentTree();
  if (!issueTreeTableReady()) {
    root.innerHTML = `<div class="setup-note">The Issue Tree isn't set up yet. Run <code>supabase/026_brainstorm_ideas_and_issue_tree.sql</code> once in the Supabase SQL editor to enable this.</div>`;
    return;
  }
  if (!currentTree) {
    currentNodes = [];
    renderEmptyTreeState(root, { onChange: reloadTree });
    return;
  }
  currentNodes = await loadNodes(currentTree.id);
  renderIssueTree(root, currentTree, currentNodes, {
    onChange: reloadTree,
    onOpenNode: showNodePanel
  });
  if (currentPanel?.type === 'node') {
    const node = currentNodes.find(n => n.id === currentPanel.id);
    if (node) showNodePanel(node.id); else closeSidePanel();
  }
}

async function loadEvidenceRefs() {
  const [{ data: figuresData }, { data: programmesData }] = await Promise.all([
    supabase.from('figures').select('id, title, insight_text').order('created_at', { ascending: false }),
    supabase.from('programmes').select('id, programme_name').order('programme_name')
  ]);
  // insight_text is rich text (HTML/delta), not plain — flatten it here once so every
  // consumer of allInsights (evidence picker, evidence list) can just read a label.
  allInsights = (figuresData || []).map(f => ({ ...f, insight_text: fieldPlainText(f.insight_text) }));
  allProgrammes = programmesData || [];
}

// ---------------- Questions & Next Steps (unchanged behaviour, just relocated UI) ----------------

async function reloadQuestions() {
  const qs = await loadQuestions();
  renderQuestionsSection(document.getElementById('question-list'), qs, { onChange: reloadQuestions });
}
document.getElementById('btn-add-question').addEventListener('click', () => openQuestionModal({ onChange: reloadQuestions }));

async function reloadNextSteps() {
  const steps = await loadNextSteps();
  renderNextStepsSection(document.getElementById('next-steps-list'), steps, { onChange: reloadNextSteps });
}

// ---------------- Boot ----------------

showTab(activeTab);
await loadEvidenceRefs();
await reloadIdeas();
await reloadTree();
reloadQuestions();
reloadNextSteps();
