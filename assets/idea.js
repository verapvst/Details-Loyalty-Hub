// Brainstorm — Idea detail page. Everything past the basics lives here: SWOT, a
// validation level, evidence linked to Insights/Favourites (referenced, not copied),
// and a categorized comment thread (Team / Details / Professor). Promoting a
// Validated idea into the Issue Tree also happens from here.
import { supabase } from './supabase.js';
import { initNav, getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { fieldPlainText } from './richText.js';
import { loadCustomOptions, getOptionList } from './customOptions.js';
import { loadTeamMembers, getActiveTeamMembers } from './teamMembers.js';
import { wireBackLink } from './backLink.js';
import {
  loadIdea, loadIdeas, interestNames, toggleInterest, updateIdea, deleteIdea,
  STATUS_LABEL, PRIORITY_LABEL, TYPE_BADGE_CLASS, RELATION_LABEL_FORWARD, RELATION_LABEL_REVERSE,
  typeSelectHTML, categorySelectHTML, mechanismsChipsHTML, verticalChipsHTML, audienceChipsHTML, objectiveChipsHTML,
  readPickerValue, wireInlineAdds, addCustomOptionInline,
  loadIdeaRelationships, addRelationship, removeRelationship
} from './brainstormIdeas.js';
import { loadCurrentTree, loadNodes, openPromoteIdeaModal } from './issueTree.js';

await initNav('brainstorm');
await Promise.all([loadCustomOptions(), loadTeamMembers()]);

const root = document.getElementById('idea-root');
const params = new URLSearchParams(window.location.search);
const ideaId = params.get('id');

if (!ideaId) {
  root.innerHTML = `<div class="error-state">No idea selected. <a href="brainstorm.html">Back to Brainstorm</a></div>`;
  throw new Error('Missing idea id');
}

const STATUSES = ['idea', 'exploring', 'validated', 'archived'];
const VALIDATION_LABEL = { none: 'No evidence', indicative: 'Indicative', supported: 'Supported', strongly_supported: 'Strongly supported' };
const COMMENT_CATEGORY_LABEL = { team: 'Team', details: 'Details', professor: 'Professor' };
// Scorecard: every number means the same thing everywhere, so a "3" on Feasibility and
// a "3" on Market Fit are directly comparable.
const SCORE_LABEL = { 1: 'Poor', 2: 'Weak', 3: 'Moderate', 4: 'Strong', 5: 'Excellent' };
// Evaluation-stage ranking: a fixed, small set (not the extensible Concept Scorecard
// dimensions) — one pass across the whole pool, stored in the same idea_scores table
// under a non-vertical "Overall" pseudo-column, never mixed into the per-segment grid.
const OVERALL_DIMENSIONS = ['Strategic Fit', 'Customer Value', 'Feasibility', 'Differentiation'];
const OVERALL_COLUMN = 'Overall';
const RELATION_TYPES = ['combines_with', 'alternative_to', 'depends_on', 'built_from'];

let idea = null;
let allInsights = [];
let allFavourites = [];
let allIdeas = [];
let comments = [];
let scores = [];
let relationships = [];
let activeCommentTab = 'team';
// "Show more" while status is still Idea — a session-only UI toggle, not persisted, so
// re-renders after that point don't collapse it back on the user mid-edit.
let midTierExpanded = false;

// Scorecard columns = every Vertical value, then every Audience value — both still
// managed in Settings, just reused here as column headers instead of per-idea tags.
function scorecardColumns() {
  return [...getOptionList('brainstorm_vertical'), ...getOptionList('brainstorm_audience')];
}

async function loadEvidenceRefs() {
  const [{ data: figuresData }, { data: likesData }] = await Promise.all([
    supabase.from('figures').select('id, title, insight_text').order('created_at', { ascending: false }),
    supabase.from('likes').select('id, target_label, target_type, description').order('created_at', { ascending: false })
  ]);
  // insight_text is rich text (HTML/delta), not plain — flatten it once here.
  allInsights = (figuresData || []).map(f => ({ ...f, insight_text: fieldPlainText(f.insight_text) }));
  allFavourites = likesData || [];
}

async function loadIdeaEvidence() {
  const [{ data: insightLinks }, { data: favLinks }] = await Promise.all([
    supabase.from('idea_insights').select('figure_id').eq('idea_id', ideaId),
    supabase.from('idea_favourites').select('like_id').eq('idea_id', ideaId)
  ]);
  return {
    insights: (insightLinks || []).map(r => allInsights.find(i => i.id === r.figure_id)).filter(Boolean),
    favourites: (favLinks || []).map(r => allFavourites.find(f => f.id === r.like_id)).filter(Boolean)
  };
}

async function loadComments() {
  const { data } = await supabase.from('idea_comments').select('*').eq('idea_id', ideaId).order('created_at', { ascending: true });
  comments = data || [];
}

async function loadScores() {
  const { data } = await supabase.from('idea_scores').select('*').eq('idea_id', ideaId);
  scores = data || [];
}

async function loadRelationshipsForIdea() {
  relationships = await loadIdeaRelationships(ideaId);
}

function favouriteLabel(f) {
  return `${f.target_label || 'Untitled'} (${f.target_type || 'feature'})`;
}

// ---------------- Sections ----------------

function headBlockHTML() {
  return `
    <div class="record-head">
      <div class="record-head-inner">
        <a href="brainstorm.html" class="record-back">&larr; Back to Brainstorm</a>
        <div class="record-title" style="font-size: 26px;">${escapeHtml(idea.title)}</div>
        <div class="idea-card-tags" style="margin-top: 10px;">
          ${idea.type ? `<span class="badge ${TYPE_BADGE_CLASS[idea.type] || 'badge-muted'}">${escapeHtml(idea.type)}</span>` : ''}
          ${idea.category ? `<span class="badge badge-muted">${escapeHtml(idea.category)}</span>` : ''}
        </div>
        <div class="record-actions" style="margin-top: 14px; flex-wrap: wrap; gap: 10px;">
          <select id="idea-status-select" class="control-select">
            ${STATUSES.map(s => `<option value="${s}" ${idea.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
          </select>
          <select id="idea-priority-select" class="control-select">
            ${Object.keys(PRIORITY_LABEL).map(p => `<option value="${p}" ${idea.priority === p ? 'selected' : ''}>${PRIORITY_LABEL[p]}</option>`).join('')}
          </select>
          <button type="button" class="btn-text" id="idea-rename-btn">Rename</button>
          ${idea.status === 'validated' ? '<button type="button" class="btn-primary" id="idea-promote-btn">&rarr; Add to Issue Tree</button>' : ''}
        </div>
      </div>
    </div>
  `;
}

// The four mandatory fields (Title is in the head block) — always visible regardless
// of status, per the reviewed architecture: Type (altitude) and Category (content
// area) are orthogonal tags, never a hierarchy.
function classificationBlockHTML() {
  return `
    <div class="record-block">
      <h3>Description &amp; Classification</h3>
      <div class="form-field full" style="margin-bottom: 16px;">
        <label>Description</label>
        <textarea id="idea-description" rows="3" placeholder="…">${escapeHtml(idea.description || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-field full">
          <label>Type <span style="font-weight:400; color: var(--muted);">— what kind of decision is this?</span></label>
          ${typeSelectHTML(idea.type)}
        </div>
        <div class="form-field full" id="idea-mechanisms-field" ${idea.type === 'Mechanism' ? '' : 'hidden'}>
          <label>Mechanisms</label>
          ${mechanismsChipsHTML(idea.mechanisms || [])}
        </div>
        <div class="form-field full">
          <label>Category <span style="font-weight:400; color: var(--muted);">— what part of the system?</span></label>
          ${categorySelectHTML(idea.category)}
        </div>
      </div>
    </div>
  `;
}

// Vertical/Audience/Objective — optional, revealed once the idea leaves the raw stage
// (see the mid-tier "show more" wrapper in render()).
function scopeObjectiveBlockHTML() {
  return `
    <div class="record-block">
      <h3>Scope &amp; Objective</h3>
      <div class="form-grid">
        <div class="form-field full">
          <label>Vertical</label>
          ${verticalChipsHTML(idea.vertical || [])}
        </div>
        <div class="form-field full">
          <label>Audience</label>
          ${audienceChipsHTML(idea.audience || [])}
        </div>
        <div class="form-field full">
          <label>Customer Objective <span style="font-weight:400; color: var(--muted);">— what behaviour is this trying to change?</span></label>
          ${objectiveChipsHTML(idea.objective || [])}
        </div>
      </div>
    </div>
  `;
}

function interestBlockHTML() {
  const names = interestNames(idea);
  const me = getIdentity();
  return `
    <div class="record-block">
      <h3>Team Interest</h3>
      <button type="button" class="btn-outline btn-sm" id="idea-interest-toggle">${names.includes(me) ? '✓ Interested' : "+ I'm interested"}</button>
      <div class="settings-hint" style="margin: 10px 0 0;">${names.length ? escapeHtml(names.join(', ')) : 'No one yet.'} (${names.length}/${getActiveTeamMembers().length})</div>
    </div>
  `;
}

function relationshipLabelFor(rel) {
  const isForward = rel.from_idea_id === idea.id;
  const other = isForward ? rel.to_idea : rel.from_idea;
  const label = isForward ? RELATION_LABEL_FORWARD[rel.relation_type] : RELATION_LABEL_REVERSE[rel.relation_type];
  return { label, other };
}

function relationshipsBlockHTML() {
  return `
    <div class="record-block">
      <h3>Relationships <button type="button" class="btn-text" id="idea-add-relationship" style="float:right;">+ Add</button></h3>
      ${!relationships.length ? '<div class="drilldown-empty">None yet.</div>' : relationships.map(rel => {
        const { label, other } = relationshipLabelFor(rel);
        if (!other) return '';
        return `
          <div class="issue-evidence-item">
            <span>${escapeHtml(label)}: <a href="idea.html?id=${other.id}">${escapeHtml(other.title)}</a></span>
            <button type="button" class="btn-text" data-remove-relationship="${rel.id}">Remove</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function swotBlockHTML() {
  const fields = [
    ['swot_strengths', 'Strengths'], ['swot_weaknesses', 'Weaknesses'],
    ['swot_opportunities', 'Opportunities'], ['swot_threats', 'Threats']
  ];
  return `
    <div class="record-block">
      <h3>SWOT</h3>
      <div class="swot-grid">
        ${fields.map(([key, label]) => `
          <div class="form-field">
            <label>${label}</label>
            <textarea class="idea-swot-field" data-swot-field="${key}" rows="4" placeholder="…">${escapeHtml(idea[key] || '')}</textarea>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Evaluation-stage: one pass, four fixed dimensions, no per-segment breakdown — a
// ranking tool for the whole pool. Reuses idea_scores under the non-vertical "Overall"
// pseudo-column rather than a new table; the rich per-segment Scorecard below is a
// separate, deliberately Concept-only use of the same table.
function overallScoreBlockHTML() {
  const scoreFor = (dimension) => scores.find(s => s.dimension === dimension && s.column_key === OVERALL_COLUMN)?.score || '';
  return `
    <div class="record-block">
      <h3>Overall Score</h3>
      <div class="settings-hint" style="margin-bottom: 12px;">A quick ranking pass for shortlisting — not per-segment. That's the Scorecard below, reserved for Concepts.</div>
      <div class="overall-score-row">
        ${OVERALL_DIMENSIONS.map(dim => {
          const val = scoreFor(dim);
          return `
            <div class="overall-score-item">
              <label>${escapeHtml(dim)}</label>
              <select class="idea-overall-select" data-dimension="${escapeHtml(dim)}">
                <option value="">—</option>
                ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(val) === String(n) ? 'selected' : ''}>${n} · ${SCORE_LABEL[n]}</option>`).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function scorecardBlockHTML() {
  const dimensions = getOptionList('brainstorm_dimension');
  const columns = scorecardColumns();
  const scoreFor = (dimension, column) => scores.find(s => s.dimension === dimension && s.column_key === column)?.score || '';
  if (!dimensions.length || !columns.length) {
    return `
      <div class="record-block">
        <h3>Scorecard</h3>
        <div class="drilldown-empty">No dimensions or columns configured yet — add some in Settings &rarr; Calendar &amp; Tasks.</div>
      </div>
    `;
  }
  return `
    <div class="record-block">
      <h3>Scorecard <span class="settings-hint" style="font-weight:400;">— Concept only</span></h3>
      <div class="settings-hint" style="margin-bottom: 12px;">How effective this idea could be per segment. 1 = Poor, 5 = Excellent — the same scale on every dimension.</div>
      <div style="overflow-x: auto;">
        <table class="idea-scorecard">
          <thead>
            <tr><th></th>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${dimensions.map(d => `
              <tr>
                <th>${escapeHtml(d)}</th>
                ${columns.map(c => {
                  const val = scoreFor(d, c);
                  return `
                    <td class="idea-score-cell${val ? ` score-${val}` : ''}">
                      <select class="idea-score-select" data-dimension="${escapeHtml(d)}" data-column="${escapeHtml(c)}">
                        <option value="">—</option>
                        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(val) === String(n) ? 'selected' : ''}>${n} · ${SCORE_LABEL[n]}</option>`).join('')}
                      </select>
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn-text" id="idea-add-dimension" style="margin-top: 10px;">+ Add dimension</button>
    </div>
  `;
}

function validationBlockHTML() {
  return `
    <div class="record-block">
      <h3>Validation Level</h3>
      <div class="control-toggle-group" id="idea-validation-group">
        ${Object.keys(VALIDATION_LABEL).map(k => `<button type="button" class="control-toggle ${idea.validation_level === k ? 'active' : ''}" data-validation="${k}">${VALIDATION_LABEL[k]}</button>`).join('')}
      </div>
    </div>
  `;
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

function evidenceBlockHTML(evidence) {
  return `
    <div class="record-block">
      <h3>Evidence</h3>
      <div class="drilldown-block-label">Insights <button type="button" class="btn-text" id="idea-add-insight" style="float:right;">+ Add</button></div>
      ${evidenceListItemsHTML(evidence.insights, i => i.title || i.insight_text || 'Untitled', 'remove-insight')}
      <div class="drilldown-block-label" style="margin-top:14px;">Favourites <button type="button" class="btn-text" id="idea-add-favourite" style="float:right;">+ Add</button></div>
      ${evidenceListItemsHTML(evidence.favourites, favouriteLabel, 'remove-favourite')}
    </div>
  `;
}

function commentsBlockHTML() {
  const tabs = Object.keys(COMMENT_CATEGORY_LABEL);
  const visible = comments.filter(c => c.category === activeCommentTab);
  return `
    <div class="record-block">
      <h3>Comments</h3>
      <div class="control-toggle-group" id="idea-comment-tabs">
        ${tabs.map(t => `<button type="button" class="control-toggle ${activeCommentTab === t ? 'active' : ''}" data-comment-tab="${t}">${COMMENT_CATEGORY_LABEL[t]}</button>`).join('')}
      </div>
      <div id="idea-comment-list" style="margin: 14px 0;">
        ${visible.length ? visible.map(c => `
          <div class="idea-comment">
            <div class="idea-comment-meta">${escapeHtml(c.author || 'Someone')} · ${new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div class="idea-comment-text">${escapeHtml(c.text)}</div>
          </div>
        `).join('') : '<div class="drilldown-empty">No comments yet.</div>'}
      </div>
      <div class="settings-add-row">
        <input type="text" id="idea-comment-input" placeholder="Add a ${COMMENT_CATEGORY_LABEL[activeCommentTab].toLowerCase()} comment…" />
        <button type="button" class="btn-primary" id="idea-comment-add">Add</button>
      </div>
    </div>
  `;
}

// ---------------- Render + wiring ----------------

async function render() {
  const evidence = await loadIdeaEvidence();
  // Mid-tier (Vertical/Audience/Objective, Team Interest, Relationships, Evidence,
  // Comments): present in the DOM always, just visually collapsed behind "Show more"
  // while status is still Idea — not re-fetched or re-built on expand, purely a
  // `hidden` toggle. Evaluation (Validation Level, Overall Score, SWOT) and the Concept
  // Scorecard are driven by Status/Type directly (their own selects already trigger a
  // full reload), so they don't exist in the DOM at all until the idea has earned them.
  const midTierOpen = idea.status !== 'idea' || midTierExpanded;
  const showEvaluation = idea.status === 'validated' || idea.status === 'archived';
  const showConceptScorecard = idea.type === 'Concept';

  root.innerHTML = `
    ${headBlockHTML()}
    <div class="record-body">
      ${classificationBlockHTML()}
      ${!midTierOpen ? '<button type="button" class="btn-text" id="idea-showmore-btn">Show more — Vertical, Audience, Objective, Team Interest, Relationships, Evidence, Comments</button>' : ''}
      <div id="idea-midtier" ${midTierOpen ? '' : 'hidden'}>
        ${scopeObjectiveBlockHTML()}
        ${interestBlockHTML()}
        ${relationshipsBlockHTML()}
        ${evidenceBlockHTML(evidence)}
        ${commentsBlockHTML()}
      </div>
      ${showEvaluation ? validationBlockHTML() + overallScoreBlockHTML() + swotBlockHTML() : ''}
      ${showConceptScorecard ? scorecardBlockHTML() : ''}
      <div class="record-block">
        <button type="button" class="btn-danger-text" id="idea-delete-btn">Delete Idea</button>
      </div>
    </div>
  `;

  wireBackLink(root.querySelector('.record-back'), 'brainstorm.html');

  root.querySelector('#idea-showmore-btn')?.addEventListener('click', () => {
    midTierExpanded = true;
    render();
  });

  // Attaches the listener that saves a picker's value under `field` on every change.
  // Re-called whenever "+ Add" swaps a picker for a fresh one (see wireInlineAdds
  // below) — its inputs are new elements with no listener of their own yet.
  function wirePickerSave(picker, field) {
    if (!picker) return;
    const save = () => updateIdea(idea.id, { [field]: readPickerValue(picker) });
    if (picker.dataset.pickerKind === 'select') picker.querySelector('select').addEventListener('change', save);
    else picker.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', save));
    return save;
  }
  // The Mechanisms picker is only relevant (and only shown) once Type = "Mechanism".
  function syncMechanismsField() {
    const select = root.querySelector('#idea-type-picker select');
    const wrap = root.querySelector('#idea-mechanisms-field');
    if (select && wrap) wrap.hidden = select.value !== 'Mechanism';
  }
  const PICKER_FIELD = {
    'idea-type-picker': 'type', 'idea-category-picker': 'category', 'idea-mechanisms-picker': 'mechanisms',
    'idea-vertical-picker': 'vertical', 'idea-audience-picker': 'audience', 'idea-objective-picker': 'objective'
  };
  // Type is the one picker that also gates the Concept Scorecard (see render()), so —
  // unlike every other picker, which just saves in place with no reload — its own save
  // has to finish before reload() re-fetches, or the Scorecard would appear/disappear a
  // beat late (or not at all). Re-wired after "+ Add type" too, on the fresh <select>.
  function wireTypePicker(picker) {
    if (!picker) return;
    const select = picker.querySelector('select');
    select.addEventListener('change', async () => {
      syncMechanismsField();
      await updateIdea(idea.id, { type: select.value || null });
      await reload();
    });
    syncMechanismsField();
  }
  Object.entries(PICKER_FIELD).forEach(([id, field]) => {
    if (id === 'idea-type-picker') return;
    wirePickerSave(root.querySelector(`#${id}`), field);
  });
  wireTypePicker(root.querySelector('#idea-type-picker'));
  wireInlineAdds(root, (freshPicker) => {
    if (freshPicker.id === 'idea-type-picker') {
      // "+ Add" already pre-selected the new value in the DOM but nothing has saved it
      // yet — save once right away (reload() picks it up), then re-wire for next time.
      updateIdea(idea.id, { type: readPickerValue(freshPicker) }).then(reload);
      return;
    }
    // "+ Add" already pre-selected the new value in the DOM but nothing has saved it
    // yet, so save once right away in addition to (re)wiring future changes.
    const save = wirePickerSave(freshPicker, PICKER_FIELD[freshPicker.id]);
    if (save) save();
  });

  root.querySelectorAll('.idea-score-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const dimension = sel.dataset.dimension;
      const column_key = sel.dataset.column;
      const value = sel.value;
      sel.closest('td').className = 'idea-score-cell' + (value ? ` score-${value}` : '');
      scores = scores.filter(s => !(s.dimension === dimension && s.column_key === column_key));
      if (!value) {
        await supabase.from('idea_scores').delete().eq('idea_id', idea.id).eq('dimension', dimension).eq('column_key', column_key);
      } else {
        const score = Number(value);
        await supabase.from('idea_scores').upsert({ idea_id: idea.id, dimension, column_key, score }, { onConflict: 'idea_id,dimension,column_key' });
        scores.push({ idea_id: idea.id, dimension, column_key, score });
      }
    });
  });
  root.querySelector('#idea-add-dimension')?.addEventListener('click', async () => {
    const value = await addCustomOptionInline('brainstorm_dimension');
    if (!value) return;
    render();
  });

  root.querySelectorAll('.idea-overall-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const dimension = sel.dataset.dimension;
      const value = sel.value;
      scores = scores.filter(s => !(s.dimension === dimension && s.column_key === OVERALL_COLUMN));
      if (!value) {
        await supabase.from('idea_scores').delete().eq('idea_id', idea.id).eq('dimension', dimension).eq('column_key', OVERALL_COLUMN);
      } else {
        const score = Number(value);
        await supabase.from('idea_scores').upsert({ idea_id: idea.id, dimension, column_key: OVERALL_COLUMN, score }, { onConflict: 'idea_id,dimension,column_key' });
        scores.push({ idea_id: idea.id, dimension, column_key: OVERALL_COLUMN, score });
      }
    });
  });

  root.querySelector('#idea-add-relationship')?.addEventListener('click', openRelationshipPicker);
  root.querySelectorAll('[data-remove-relationship]').forEach(btn => btn.addEventListener('click', async () => {
    await removeRelationship(btn.dataset.removeRelationship);
    await loadRelationshipsForIdea();
    render();
  }));

  root.querySelector('#idea-rename-btn').addEventListener('click', async () => {
    const next = prompt('Title:', idea.title)?.trim();
    if (!next || next === idea.title) return;
    await updateIdea(idea.id, { title: next });
    await reload();
  });
  root.querySelector('#idea-status-select').addEventListener('change', async (e) => {
    await updateIdea(idea.id, { status: e.target.value });
    await reload();
  });
  root.querySelector('#idea-priority-select').addEventListener('change', async (e) => {
    await updateIdea(idea.id, { priority: e.target.value });
    await reload();
  });
  const promoteBtn = root.querySelector('#idea-promote-btn');
  if (promoteBtn) promoteBtn.addEventListener('click', async () => {
    const tree = await loadCurrentTree();
    const nodes = tree ? await loadNodes(tree.id) : [];
    openPromoteIdeaModal(idea, tree, nodes, { onChange: reload });
  });

  root.querySelector('#idea-description').addEventListener('change', async (e) => {
    await updateIdea(idea.id, { description: e.target.value.trim() || null });
  });

  root.querySelector('#idea-interest-toggle').addEventListener('click', async () => {
    await toggleInterest(idea.id, interestNames(idea).includes(getIdentity()));
    await reload();
  });

  root.querySelectorAll('.idea-swot-field').forEach(ta => {
    ta.addEventListener('change', async () => {
      await updateIdea(idea.id, { [ta.dataset.swotField]: ta.value.trim() || null });
    });
  });

  root.querySelector('#idea-validation-group')?.querySelectorAll('[data-validation]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateIdea(idea.id, { validation_level: btn.dataset.validation });
      await reload();
    });
  });

  root.querySelector('#idea-add-insight').addEventListener('click', () => openEvidencePicker('insight'));
  root.querySelector('#idea-add-favourite').addEventListener('click', () => openEvidencePicker('favourite'));
  root.querySelectorAll('[data-remove-insight]').forEach(btn => btn.addEventListener('click', async () => {
    await supabase.from('idea_insights').delete().eq('idea_id', idea.id).eq('figure_id', btn.dataset.removeInsight);
    await render();
  }));
  root.querySelectorAll('[data-remove-favourite]').forEach(btn => btn.addEventListener('click', async () => {
    await supabase.from('idea_favourites').delete().eq('idea_id', idea.id).eq('like_id', btn.dataset.removeFavourite);
    await render();
  }));

  root.querySelector('#idea-comment-tabs').querySelectorAll('[data-comment-tab]').forEach(btn => {
    btn.addEventListener('click', () => { activeCommentTab = btn.dataset.commentTab; render(); });
  });
  root.querySelector('#idea-comment-add').addEventListener('click', async () => {
    const input = root.querySelector('#idea-comment-input');
    const text = input.value.trim();
    if (!text) return;
    await supabase.from('idea_comments').insert({ idea_id: idea.id, category: activeCommentTab, author: getIdentity(), text });
    await loadComments();
    render();
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

// ---------------- Evidence picker (Insights / Favourites) ----------------

function openEvidencePicker(kind) {
  let modalRoot = document.getElementById('idea-evidence-picker-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'idea-evidence-picker-root';
    document.body.appendChild(modalRoot);
  }
  const isInsight = kind === 'insight';
  const items = isInsight
    ? allInsights.map(i => ({ id: i.id, label: i.title || i.insight_text || 'Untitled' }))
    : allFavourites.map(f => ({ id: f.id, label: favouriteLabel(f) }));

  function renderList(filter) {
    const q = filter.trim().toLowerCase();
    const matches = items.filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 40);
    modalRoot.querySelector('#idea-evidence-results').innerHTML = matches.map(m =>
      `<button type="button" class="prog-list-row" data-pick="${m.id}">${escapeHtml(m.label)}</button>`
    ).join('') || '<div class="drilldown-empty">No matches.</div>';
    modalRoot.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (isInsight) await supabase.from('idea_insights').insert({ idea_id: idea.id, figure_id: btn.dataset.pick });
        else await supabase.from('idea_favourites').insert({ idea_id: idea.id, like_id: btn.dataset.pick });
        close();
        render();
      });
    });
  }

  modalRoot.innerHTML = `
    <div class="modal-overlay form-overlay" id="idea-evidence-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Add ${isInsight ? 'Insight' : 'Favourite'}</h2><button type="button" class="form-modal-close" id="idea-evidence-close">&times;</button></div>
        <div class="form-modal-body">
          <input type="text" id="idea-evidence-search" placeholder="Search…" style="width:100%; padding: 10px 14px; border: none; border-radius: var(--radius); background: var(--surface-alt); font-size: 13px; margin-bottom: 12px;" />
          <div id="idea-evidence-results" style="max-height: 320px; overflow-y: auto;"></div>
        </div>
      </div>
    </div>
  `;
  const overlay = document.getElementById('idea-evidence-modal');
  const close = () => modalRoot.innerHTML = '';
  document.getElementById('idea-evidence-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#idea-evidence-search').addEventListener('input', (e) => renderList(e.target.value));
  renderList('');
}

// ---------------- Relationship picker ----------------

function openRelationshipPicker() {
  let modalRoot = document.getElementById('idea-relationship-picker-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'idea-relationship-picker-root';
    document.body.appendChild(modalRoot);
  }
  const items = allIdeas.filter(i => i.id !== idea.id).map(i => ({ id: i.id, label: i.title }));
  let relationType = RELATION_TYPES[0];

  function renderList(filter) {
    const q = filter.trim().toLowerCase();
    const matches = items.filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 40);
    modalRoot.querySelector('#idea-relationship-results').innerHTML = matches.map(m =>
      `<button type="button" class="prog-list-row" data-pick="${m.id}">${escapeHtml(m.label)}</button>`
    ).join('') || '<div class="drilldown-empty">No matches.</div>';
    modalRoot.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await addRelationship(idea.id, btn.dataset.pick, relationType);
        if (error) {
          showToast(error.code === '23505' ? 'That relationship already exists.' : `Couldn't add: ${error.message}`, true);
          return;
        }
        close();
        await loadRelationshipsForIdea();
        render();
      });
    });
  }

  modalRoot.innerHTML = `
    <div class="modal-overlay form-overlay" id="idea-relationship-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Add Relationship</h2><button type="button" class="form-modal-close" id="idea-relationship-close">&times;</button></div>
        <div class="form-modal-body">
          <div class="form-field full" style="margin-bottom:12px;">
            <label>Relationship</label>
            <select id="idea-relationship-type">
              ${RELATION_TYPES.map(t => `<option value="${t}">${escapeHtml(RELATION_LABEL_FORWARD[t])}</option>`).join('')}
            </select>
          </div>
          <input type="text" id="idea-relationship-search" placeholder="Search ideas…" style="width:100%; padding: 10px 14px; border: none; border-radius: var(--radius); background: var(--surface-alt); font-size: 13px; margin-bottom: 12px;" />
          <div id="idea-relationship-results" style="max-height: 320px; overflow-y: auto;"></div>
        </div>
      </div>
    </div>
  `;
  const overlay = document.getElementById('idea-relationship-modal');
  const close = () => modalRoot.innerHTML = '';
  document.getElementById('idea-relationship-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modalRoot.querySelector('#idea-relationship-type').addEventListener('change', (e) => { relationType = e.target.value; });
  modalRoot.querySelector('#idea-relationship-search').addEventListener('input', (e) => renderList(e.target.value));
  renderList('');
}

// ---------------- Boot ----------------

await loadEvidenceRefs();
allIdeas = await loadIdeas();
await loadComments();
await loadScores();
await loadRelationshipsForIdea();
await reload();
