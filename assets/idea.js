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
  loadIdea, interestNames, toggleInterest, updateIdea, deleteIdea,
  STATUS_LABEL, PRIORITY_LABEL, categorySelectHTML, mechanismsChipsHTML,
  readPickerValue, wireInlineAdds, addCustomOptionInline
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

let idea = null;
let allInsights = [];
let allFavourites = [];
let comments = [];
let scores = [];
let activeCommentTab = 'team';

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

function classificationBlockHTML() {
  return `
    <div class="record-block">
      <h3>Description &amp; Classification</h3>
      <div class="form-field full" style="margin-bottom: 16px;">
        <label>Description</label>
        <textarea id="idea-description" rows="3" placeholder="Optional…">${escapeHtml(idea.description || '')}</textarea>
      </div>
      <div class="form-grid">
        <div class="form-field full">
          <label>Category</label>
          ${categorySelectHTML(idea.category)}
        </div>
        <div class="form-field full" id="idea-mechanisms-field" ${idea.category === 'Mechanism' ? '' : 'hidden'}>
          <label>Mechanisms</label>
          ${mechanismsChipsHTML(idea.mechanisms || [])}
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
      <h3>Scorecard</h3>
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
  root.innerHTML = `
    ${headBlockHTML()}
    <div class="record-body">
      ${classificationBlockHTML()}
      ${interestBlockHTML()}
      ${swotBlockHTML()}
      ${scorecardBlockHTML()}
      ${validationBlockHTML()}
      ${evidenceBlockHTML(evidence)}
      ${commentsBlockHTML()}
      <div class="record-block">
        <button type="button" class="btn-danger-text" id="idea-delete-btn">Delete Idea</button>
      </div>
    </div>
  `;

  wireBackLink(root.querySelector('.record-back'), 'brainstorm.html');

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
  // The Mechanisms picker is only relevant (and only shown) once Category = "Mechanism".
  function syncMechanismsField() {
    const select = root.querySelector('#idea-category-picker select');
    const wrap = root.querySelector('#idea-mechanisms-field');
    if (select && wrap) wrap.hidden = select.value !== 'Mechanism';
  }
  wirePickerSave(root.querySelector('#idea-category-picker'), 'category');
  root.querySelector('#idea-category-picker select')?.addEventListener('change', syncMechanismsField);
  wirePickerSave(root.querySelector('#idea-mechanisms-picker'), 'mechanisms');
  const PICKER_FIELD = { 'idea-category-picker': 'category', 'idea-mechanisms-picker': 'mechanisms' };
  wireInlineAdds(root, (freshPicker) => {
    // "+ Add" already pre-selected the new value in the DOM but nothing has saved it
    // yet, so save once right away in addition to (re)wiring future changes.
    const save = wirePickerSave(freshPicker, PICKER_FIELD[freshPicker.id]);
    if (save) save();
    if (freshPicker.id === 'idea-category-picker') {
      freshPicker.querySelector('select').addEventListener('change', syncMechanismsField);
      syncMechanismsField();
    }
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

  root.querySelector('#idea-validation-group').querySelectorAll('[data-validation]').forEach(btn => {
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

// ---------------- Boot ----------------

await loadEvidenceRefs();
await loadComments();
await loadScores();
await reload();
