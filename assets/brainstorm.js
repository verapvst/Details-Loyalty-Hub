// Brainstorm: where the team's thinking becomes the project's strategic direction.
// Four tabs: Ideas (a lightweight inbox — raw thoughts, nothing more) -> Issue Tree
// (convergent — the Minto/MECE WHY-HOW structure your Strategy Consulting course's
// own Issue Analysis deliverables use, and where the platform's real analytical
// weight lives) -> Questions (research gaps, linkable to a specific Issue) -> Next
// Steps (committed direction, born from a promoted Issue Tree node). Both an Idea
// and an Issue node now have their own full page (idea.html / issue-node.html) —
// this file only owns the board/tree overview and the tab switching.
import { initNav } from './app.js';
import { loadQuestions, renderQuestionsSection, openQuestionModal } from './questions.js';
import { loadNextSteps, renderNextStepsSection } from './next-steps.js';
import { loadIdeas, ideasTableReady, renderIdeaInbox } from './brainstormIdeas.js';
import { loadCurrentTree, loadNodes, issueTreeTableReady, renderIssueTree, renderEmptyTreeState } from './issueTree.js';

// ---------------- Tabs ----------------
// Which tab to open — the nav drawer's Brainstorms children link here with ?tab=, so a
// fresh load honours that over whatever was last active; switching tabs in-page
// (showTab, below) doesn't touch the URL. Same pattern as tasks.js.

const TABS = ['ideas', 'issue-tree', 'questions', 'next-steps'];
const TAB_STORAGE_KEY = 'brainstorm_active_tab';
let activeTab = (() => {
  const fromURL = new URLSearchParams(window.location.search).get('tab');
  if (TABS.includes(fromURL)) return fromURL;
  try { const saved = localStorage.getItem(TAB_STORAGE_KEY); return TABS.includes(saved) ? saved : TABS[0]; }
  catch { return TABS[0]; }
})();

await initNav(`brainstorm-${activeTab}`);

function showTab(tab) {
  activeTab = tab;
  try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* private mode etc. */ }
  document.querySelectorAll('.lab-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  TABS.forEach(t => { document.getElementById(`workspace-${t}`).hidden = t !== tab; });
}
document.querySelectorAll('.lab-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

// ---------------- Ideas ----------------
// Each row links straight to its own page (idea.html) — no in-page detail here.

let ideas = [];

async function reloadIdeas() {
  ideas = await loadIdeas();
  if (!ideasTableReady()) {
    document.getElementById('idea-board-root').innerHTML = `<div class="setup-note">Ideas aren't set up yet. Run <code>supabase/026_brainstorm_ideas_and_issue_tree.sql</code> once in the Supabase SQL editor to enable this.</div>`;
    return;
  }
  renderIdeaInbox(document.getElementById('idea-board-root'), ideas, { onChange: reloadIdeas });
}

// ---------------- Issue Tree ----------------
// Each node also links straight to its own page (issue-node.html) now.

async function reloadTree() {
  const root = document.getElementById('issue-tree-root');
  const currentTree = await loadCurrentTree();
  if (!issueTreeTableReady()) {
    root.innerHTML = `<div class="setup-note">The Issue Tree isn't set up yet. Run <code>supabase/026_brainstorm_ideas_and_issue_tree.sql</code> once in the Supabase SQL editor to enable this.</div>`;
    return;
  }
  if (!currentTree) {
    renderEmptyTreeState(root, { onChange: reloadTree });
    return;
  }
  const nodes = await loadNodes(currentTree.id);
  renderIssueTree(root, currentTree, nodes, { onChange: reloadTree });
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
await reloadIdeas();
await reloadTree();
reloadQuestions();
reloadNextSteps();
