// Questions & Support Needed: a manual workspace inside Weekly Reports (not Calendar/Tasks).
// Two item types — Question (needs an answer) and Support Needed (needs access/data/help) —
// each with a simple lifecycle: active items surface in the next generated report; resolved
// items keep their answer as history but stop appearing in future reports. Nothing is deleted
// on resolve — only an explicit Delete removes a row for good.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';

export async function loadQuestions() {
  const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
  return data || [];
}

const TYPE_LABEL = { question: 'Question', support: 'Support Needed' };

export function openQuestionModal({ onChange }) {
  let root = document.getElementById('question-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'question-modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="question-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Add Question / Support Needed</h2><button type="button" class="form-modal-close" id="question-modal-close">&times;</button></div>
        <form id="question-form">
          <div class="form-modal-body">
            <div class="form-error" id="question-form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full">
                <label>Type</label>
                <select name="item_type">
                  <option value="question">Question</option>
                  <option value="support">Support Needed</option>
                </select>
              </div>
              <div class="form-field full">
                <label>Text *</label>
                <textarea name="question_text" rows="3" required placeholder="e.g. Should we include luxury hospitality as its own benchmark category? / Need access to the customer segmentation data."></textarea>
              </div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="question-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Add</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('question-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('question-modal-close').addEventListener('click', close);
  document.getElementById('question-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const text = form.elements['question_text'].value.trim();
    if (!text) return;

    const { error } = await supabase.from('questions').insert({
      item_type: form.elements['item_type'].value,
      question_text: text, asked_by: getIdentity(), status: 'open', created_at: new Date().toISOString()
    });
    if (error) {
      const errorEl = document.getElementById('question-form-error');
      errorEl.textContent = `Couldn't add: ${error.message}`;
      errorEl.hidden = false;
      return;
    }
    close();
    showToast('Added.');
    onChange();
  });
}

function openAnswerModal(question, { onChange }) {
  let root = document.getElementById('question-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'question-modal-root';
    document.body.appendChild(root);
  }

  const label = question.item_type === 'support' ? 'Support Needed' : 'Question';

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="question-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Resolve ${label}</h2><button type="button" class="form-modal-close" id="question-modal-close">&times;</button></div>
        <form id="answer-form">
          <div class="form-modal-body">
            <div class="form-field full"><label>${label}</label><div class="like-target-display">${escapeHtml(question.question_text)}</div></div>
            <div class="form-field full" style="margin-top:14px;"><label>Response / Answer</label><textarea name="answer" rows="3">${escapeHtml(question.answer)}</textarea></div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="question-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Mark Resolved</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('question-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('question-modal-close').addEventListener('click', close);
  document.getElementById('question-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('answer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const answer = e.target.elements['answer'].value.trim() || null;
    await supabase.from('questions').update({
      status: 'answered', answer, answered_at: new Date().toISOString()
    }).eq('id', question.id);
    close();
    showToast('Marked resolved.');
    onChange();
  });
}

function questionRowHTML(q) {
  return `
    <div class="question-row ${q.status === 'answered' ? 'answered' : ''}" data-question-id="${q.id}">
      <span class="badge ${q.status === 'answered' ? 'badge-green' : 'badge-red'}">${q.status === 'answered' ? 'Resolved' : 'Open'}</span>
      <div class="question-main">
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        <div class="question-meta">${q.asked_by ? `Asked by ${escapeHtml(q.asked_by)}` : ''}${q.answer ? ` · ${escapeHtml(q.answer)}` : ''}</div>
      </div>
      ${q.status === 'open' ? `<button type="button" class="btn-text" data-question-answer="${q.id}">Resolve</button>` : ''}
      <button type="button" class="task-remove" data-question-delete="${q.id}">&times;</button>
    </div>
  `;
}

// Renders Questions and Support Needed as two labeled groups, active items only by
// default, with a "Show resolved" toggle to reveal the archived history in place.
export function renderQuestionsSection(container, questions, { onChange }) {
  const open = questions.filter(q => q.status === 'open');
  const resolved = questions.filter(q => q.status === 'answered');

  if (!questions.length) {
    container.innerHTML = `<div class="empty-state"><div class="em-title">Nothing yet</div><p>Add a Question or Support Needed item to raise with the professor or client.</p></div>`;
    return;
  }

  const groupHTML = (type, label) => {
    const items = open.filter(q => q.item_type === type);
    if (!items.length) return '';
    return `<div class="form-section-label">${label}</div>${items.map(questionRowHTML).join('')}`;
  };

  const openHTML = groupHTML('question', 'Questions') + groupHTML('support', 'Support Needed');
  const resolvedHTML = resolved.length
    ? `<button type="button" class="btn-text" id="toggle-resolved" style="margin-top:10px;">Show resolved (${resolved.length})</button>
       <div id="resolved-list" hidden style="margin-top:8px;">${resolved.map(questionRowHTML).join('')}</div>`
    : '';

  container.innerHTML = (openHTML || `<div class="empty-state"><div class="em-title">Nothing active</div><p>All caught up — add a new item, or check resolved history below.</p></div>`) + resolvedHTML;

  const toggle = document.getElementById('toggle-resolved');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const list = document.getElementById('resolved-list');
      list.hidden = !list.hidden;
      toggle.textContent = list.hidden ? `Show resolved (${resolved.length})` : 'Hide resolved';
    });
  }

  container.querySelectorAll('[data-question-answer]').forEach(btn => {
    btn.addEventListener('click', () => openAnswerModal(questions.find(q => q.id === btn.dataset.questionAnswer), { onChange }));
  });
  container.querySelectorAll('[data-question-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this item?')) return;
      await supabase.from('questions').delete().eq('id', btn.dataset.questionDelete);
      showToast('Deleted.');
      onChange();
    });
  });
}

export function activeQuestions(questions) {
  return questions.filter(q => q.status === 'open');
}
