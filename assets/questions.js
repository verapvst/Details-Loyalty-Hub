// Questions & Support Needed: things the team wants to raise with the professor/client.
// Managed manually here (add / answer / delete); the Weekly Report pulls in whichever
// are still unanswered when a report is generated — independent of the report period.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';

export async function loadQuestions() {
  const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
  return data || [];
}

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
        <div class="form-modal-head"><h2>Add Question</h2><button type="button" class="form-modal-close" id="question-modal-close">&times;</button></div>
        <form id="question-form">
          <div class="form-modal-body">
            <div class="form-error" id="question-form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full"><label>Question *</label><textarea name="question_text" rows="3" required placeholder="e.g. Should we include luxury hospitality as its own benchmark category?"></textarea></div>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="question-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Add Question</button>
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
    const text = e.target.elements['question_text'].value.trim();
    if (!text) return;

    const { error } = await supabase.from('questions').insert({
      question_text: text, asked_by: getIdentity(), status: 'open', created_at: new Date().toISOString()
    });
    if (error) {
      const errorEl = document.getElementById('question-form-error');
      errorEl.textContent = `Couldn't add question: ${error.message}`;
      errorEl.hidden = false;
      return;
    }
    close();
    showToast('Question added.');
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

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="question-modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Answer Question</h2><button type="button" class="form-modal-close" id="question-modal-close">&times;</button></div>
        <form id="answer-form">
          <div class="form-modal-body">
            <div class="form-field full"><label>Question</label><div class="like-target-display">${escapeHtml(question.question_text)}</div></div>
            <div class="form-field full" style="margin-top:14px;"><label>Answer</label><textarea name="answer" rows="3">${escapeHtml(question.answer)}</textarea></div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="question-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Mark Answered</button>
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
    showToast('Question marked answered.');
    onChange();
  });
}

export function renderQuestionsSection(container, questions, { onChange }) {
  if (!questions.length) {
    container.innerHTML = `<div class="empty-state"><div class="em-title">No questions yet</div><p>Add something you want to raise with the professor or client.</p></div>`;
    return;
  }

  container.innerHTML = questions.map(q => `
    <div class="question-row ${q.status === 'answered' ? 'answered' : ''}" data-question-id="${q.id}">
      <span class="badge ${q.status === 'answered' ? 'badge-green' : 'badge-red'}">${q.status === 'answered' ? 'Answered' : 'Open'}</span>
      <div class="question-main">
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        <div class="question-meta">${q.asked_by ? `Asked by ${escapeHtml(q.asked_by)}` : ''}${q.answer ? ` · ${escapeHtml(q.answer)}` : ''}</div>
      </div>
      ${q.status === 'open' ? `<button type="button" class="btn-text" data-question-answer="${q.id}">Answer</button>` : ''}
      <button type="button" class="task-remove" data-question-delete="${q.id}">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-question-answer]').forEach(btn => {
    btn.addEventListener('click', () => openAnswerModal(questions.find(q => q.id === btn.dataset.questionAnswer), { onChange }));
  });
  container.querySelectorAll('[data-question-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this question?')) return;
      await supabase.from('questions').delete().eq('id', btn.dataset.questionDelete);
      showToast('Question deleted.');
      onChange();
    });
  });
}
