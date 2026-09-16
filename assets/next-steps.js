// Next Steps: a manual, strategic-direction workspace inside Weekly Reports — deliberately
// NOT a Task. No assignee, due date, or task type; a Next Step never becomes a Task and a
// Task never becomes a Next Step. Active items surface in the next generated report; marking
// one done archives it out of future reports without deleting its history.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { escapeHtml } from './fields.js';
import { toEditableHtml } from './richText.js';

export async function loadNextSteps() {
  const { data } = await supabase.from('next_steps').select('*').order('created_at', { ascending: false });
  return data || [];
}

export function activeNextSteps(steps) {
  return steps.filter(s => s.status === 'active');
}

// Displayed on the compact list — falls back to the full text when no short Title
// was set (same fallback pattern used for Insight titles).
export function nextStepDisplayTitle(s) {
  return s.title || s.text;
}

// One modal for both Add (step=null) and Edit (step=existing row) — Title and
// Details are optional; only the main Next Step text is required.
export function openNextStepModal({ step, onChange }) {
  let root = document.getElementById('next-step-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'next-step-modal-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="next-step-modal">
      <div class="form-modal" style="max-width: 500px;">
        <div class="form-modal-head"><h2>${step ? 'Edit' : 'Add'} Next Step</h2><button type="button" class="form-modal-close" id="next-step-close">&times;</button></div>
        <form id="next-step-form">
          <div class="form-modal-body">
            <div class="form-field full">
              <label>Title <span style="font-weight:400; color: var(--muted);">(optional — shown on the list; falls back to the text below)</span></label>
              <input type="text" name="title" value="${escapeHtml(step?.title)}" placeholder="Short label, e.g. Benchmark Analysis" />
            </div>
            <div class="form-field full">
              <label>Next Step *</label>
              <textarea name="text" rows="2" required placeholder="e.g. Start analysing the benchmark data">${escapeHtml(step?.text)}</textarea>
            </div>
            <div class="form-field full">
              <label>Details <span style="font-weight:400; color: var(--muted);">(optional — full context, shown only when opened)</span></label>
              <textarea name="details" rows="5" placeholder="What this involves, why it's next…">${escapeHtml(step?.details)}</textarea>
            </div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="next-step-cancel">Cancel</button>
            <button type="submit" class="btn-primary">${step ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('next-step-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('next-step-close').addEventListener('click', close);
  document.getElementById('next-step-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('next-step-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const text = form.elements['text'].value.trim();
    if (!text) return;

    const payload = {
      title: form.elements['title'].value.trim() || null,
      text,
      details: form.elements['details'].value.trim() || null
    };

    let error;
    if (step) {
      ({ error } = await supabase.from('next_steps').update(payload).eq('id', step.id));
    } else {
      payload.status = 'active';
      payload.created_by = getIdentity();
      payload.created_at = new Date().toISOString();
      ({ error } = await supabase.from('next_steps').insert(payload));
    }
    if (error) {
      showToast(`Couldn't save: ${error.message}`, true);
      return;
    }
    close();
    showToast(step ? 'Next Step updated.' : 'Next Step added.');
    onChange();
  });
}

// Read-only view opened by clicking a row — the "bigger section" for Details, kept
// out of the compact list. Edit hands off to the same Add/Edit modal above.
function openNextStepDetailModal(step, { onChange }) {
  let root = document.getElementById('next-step-detail-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'next-step-detail-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal-overlay" id="next-step-detail-modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head">
          <h2>Next Step</h2>
          <button type="button" class="form-modal-close" id="next-step-detail-close">&times;</button>
        </div>
        <div class="form-modal-body">
          <div class="form-field full">
            <label>Next Step</label>
            <div class="like-target-display">${escapeHtml(step.text)}</div>
          </div>
          ${step.details ? `
            <div class="form-field full" style="margin-top: 14px;">
              <label>Details</label>
              <div class="rich-text-display">${toEditableHtml(step.details)}</div>
            </div>` : ''}
        </div>
        <div class="form-modal-foot">
          <button type="button" class="btn-text" id="next-step-detail-edit">Edit</button>
          <button type="button" class="btn-primary" id="next-step-detail-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('next-step-detail-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('next-step-detail-close').addEventListener('click', close);
  document.getElementById('next-step-detail-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('next-step-detail-edit').addEventListener('click', () => {
    close();
    openNextStepModal({ step, onChange });
  });
}

function stepRowHTML(s) {
  return `
    <div class="task-row ${s.status === 'done' ? 'cancelled' : ''}" data-next-step-id="${s.id}">
      <div class="task-main" data-next-step-view="${s.id}" style="cursor:pointer;">
        <div class="task-title">${escapeHtml(nextStepDisplayTitle(s))}</div>
        <div class="task-assignees">${s.created_by ? `Added by ${escapeHtml(s.created_by)}` : ''}${s.details ? ' · <span class="badge badge-muted">Details</span>' : ''}</div>
      </div>
      ${s.status === 'active' ? `<button type="button" class="btn-text" data-next-step-done="${s.id}">Mark Done</button>` : ''}
      <button type="button" class="task-remove" data-next-step-delete="${s.id}">&times;</button>
    </div>
  `;
}

// Active steps render up top (what will appear in the next report); done ones sit
// behind a "Show done" toggle — kept for reference, never auto-deleted.
export function renderNextStepsSection(container, steps, { onChange }) {
  const active = steps.filter(s => s.status === 'active');
  const done = steps.filter(s => s.status === 'done');

  if (!steps.length) {
    container.innerHTML = `<div class="empty-state"><div class="em-title">No Next Steps yet</div><p>Add a high-level direction for the project — not an assigned task.</p></div>`;
    return;
  }

  const activeHTML = active.length
    ? active.map(stepRowHTML).join('')
    : `<div class="empty-state"><div class="em-title">Nothing active</div><p>All done for now — add a new direction, or check completed ones below.</p></div>`;
  const doneHTML = done.length
    ? `<button type="button" class="btn-text" id="toggle-done-steps" style="margin-top:10px;">Show done (${done.length})</button>
       <div id="done-steps-list" hidden style="margin-top:8px;">${done.map(stepRowHTML).join('')}</div>`
    : '';

  container.innerHTML = activeHTML + doneHTML;

  const toggle = document.getElementById('toggle-done-steps');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const list = document.getElementById('done-steps-list');
      list.hidden = !list.hidden;
      toggle.textContent = list.hidden ? `Show done (${done.length})` : 'Hide done';
    });
  }

  container.querySelectorAll('[data-next-step-view]').forEach(el => {
    el.addEventListener('click', () => openNextStepDetailModal(steps.find(s => s.id === el.dataset.nextStepView), { onChange }));
  });
  container.querySelectorAll('[data-next-step-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await supabase.from('next_steps').update({ status: 'done', archived_at: new Date().toISOString() }).eq('id', btn.dataset.nextStepDone);
      showToast('Marked done.');
      onChange();
    });
  });
  container.querySelectorAll('[data-next-step-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this Next Step?')) return;
      await supabase.from('next_steps').delete().eq('id', btn.dataset.nextStepDelete);
      showToast('Deleted.');
      onChange();
    });
  });
}
