// Milestones: fixed deadlines, approximate windows ("Late September"), or genuinely
// TBD project dates. Deliberately its own tiny module (not folded into tasks.js) since
// it has its own precision toggle logic, but it's still rendered inside tasks.html.
import { supabase } from './supabase.js';
import { getIdentity, showToast } from './app.js';
import { getOptionList } from './customOptions.js';
import { escapeHtml } from './fields.js';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BADGE_CLASS = { deadline: 'badge-red', steering: 'badge-muted', presentation: 'badge-green' };

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function loadMilestones() {
  const { data } = await supabase.from('milestones').select('*');
  const rows = data || [];
  return rows.sort((a, b) =>
    (a.date_from || a.date_to || '9999-99').localeCompare(b.date_from || b.date_to || '9999-99')
  );
}

// Whether a milestone has passed. TBD milestones (no anchor date at all) are always
// "upcoming" — there's nothing to compare against yet. This is deliberately computed,
// not stored, so nothing needs manual updating as dates pass.
export function milestoneStatus(m) {
  if (m.precision === 'tbd' && !m.date_to && !m.date_from) return 'upcoming';
  const anchor = m.date_to || m.date_from;
  if (!anchor) return 'upcoming';
  return anchor < toDateStr(new Date()) ? 'completed' : 'upcoming';
}

export function milestoneDateLabel(m) {
  if (m.precision === 'exact' && m.date_from) {
    const d = new Date(m.date_from + 'T00:00:00');
    return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
  }
  return m.date_label || 'TBD';
}

export function renderMilestoneStrip(container, milestones, { onEdit, onAdd }) {
  if (!milestones.length) {
    container.innerHTML = `
      <div class="milestone-strip-empty">
        No milestones yet. <button type="button" class="btn-text" id="milestone-strip-add">+ Add the first one</button>
      </div>
    `;
    document.getElementById('milestone-strip-add').addEventListener('click', onAdd);
    return;
  }

  container.innerHTML = `
    <div class="milestone-strip">
      ${milestones.map((m, i) => `
        <button type="button" class="milestone-chip ${milestoneStatus(m) === 'completed' ? 'completed' : ''}" data-milestone-id="${m.id}">
          ${milestoneStatus(m) === 'completed' ? '<span class="milestone-chip-check">✓</span>' : ''}
          <span class="milestone-chip-date">${escapeHtml(milestoneDateLabel(m))}</span>
          <span class="milestone-chip-title">${escapeHtml(m.title)}</span>
        </button>
        ${i < milestones.length - 1 ? '<span class="milestone-chip-arrow">→</span>' : ''}
      `).join('')}
      <button type="button" class="btn-text milestone-strip-add" id="milestone-strip-add">+ Add</button>
    </div>
  `;

  container.querySelectorAll('[data-milestone-id]').forEach(btn => {
    btn.addEventListener('click', () => onEdit(milestones.find(m => m.id === btn.dataset.milestoneId)));
  });
  document.getElementById('milestone-strip-add').addEventListener('click', onAdd);
}

function wirePrecisionToggle(form) {
  const sel = form.elements['precision'];
  const blocks = { exact: 'precision-block-exact', window: 'precision-block-window', tbd: 'precision-block-tbd' };
  function sync() {
    Object.entries(blocks).forEach(([val, id]) => {
      document.getElementById(id).hidden = sel.value !== val;
    });
  }
  sel.addEventListener('change', sync);
  sync();
}

export function openMilestoneModal({ milestone, onChange }) {
  let root = document.getElementById('milestone-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'milestone-modal-root';
    document.body.appendChild(root);
  }

  const m = milestone || {};
  const typeOptions = getOptionList('milestone_type');
  const precisionOptions = getOptionList('milestone_precision');
  const precision = m.precision || 'exact';

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="milestone-modal">
      <div class="form-modal" style="max-width: 520px;">
        <div class="form-modal-head">
          <h2>${milestone ? 'Edit Milestone' : 'Add Milestone'}</h2>
          <button type="button" class="form-modal-close" id="milestone-modal-close">&times;</button>
        </div>
        <form id="milestone-form">
          <div class="form-modal-body">
            <div class="form-error" id="milestone-form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full"><label>Title *</label><input type="text" name="title" required value="${escapeHtml(m.title)}" /></div>
              <div class="form-field"><label>Type *</label>
                <select name="milestone_type" required>${typeOptions.map(o => `<option value="${o.value}" ${o.value === m.milestone_type ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
              </div>
              <div class="form-field"><label>Precision *</label>
                <select name="precision" required>${precisionOptions.map(o => `<option value="${o.value}" ${o.value === precision ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
              </div>
            </div>

            <div id="precision-block-exact" class="mech-block" ${precision === 'exact' ? '' : 'hidden'}>
              <div class="form-grid">
                <div class="form-field"><label>Date</label><input type="date" name="exact_date" value="${m.precision === 'exact' ? (m.date_from || '') : ''}" /></div>
              </div>
            </div>

            <div id="precision-block-window" class="mech-block" ${precision === 'window' ? '' : 'hidden'}>
              <div class="form-grid">
                <div class="form-field"><label>From</label><input type="date" name="window_from" value="${m.precision === 'window' ? (m.date_from || '') : ''}" /></div>
                <div class="form-field"><label>To</label><input type="date" name="window_to" value="${m.precision === 'window' ? (m.date_to || '') : ''}" /></div>
                <div class="form-field full"><label>Label shown instead of a date (e.g. "Late September")</label><input type="text" name="window_label" value="${escapeHtml(m.precision === 'window' ? m.date_label : '')}" /></div>
              </div>
            </div>

            <div id="precision-block-tbd" class="mech-block" ${precision === 'tbd' ? '' : 'hidden'}>
              <div class="form-grid">
                <div class="form-field full"><label>Label (optional, e.g. "Awaiting confirmation")</label><input type="text" name="tbd_label" value="${escapeHtml(m.precision === 'tbd' ? m.date_label : '')}" /></div>
              </div>
            </div>

            <div class="form-grid" style="margin-top: 14px;">
              <div class="form-field full"><label>Notes</label><textarea name="notes" rows="2">${escapeHtml(m.notes)}</textarea></div>
            </div>
          </div>
          <div class="form-modal-foot">
            ${milestone ? `<button type="button" class="btn-danger-text" id="milestone-delete" style="margin-right:auto;">Delete</button>` : ''}
            <button type="button" class="btn-text" id="milestone-cancel">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('milestone-modal');
  const close = () => root.innerHTML = '';
  document.getElementById('milestone-modal-close').addEventListener('click', close);
  document.getElementById('milestone-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  wirePrecisionToggle(document.getElementById('milestone-form'));

  if (milestone) {
    document.getElementById('milestone-delete').addEventListener('click', async () => {
      if (!confirm('Delete this milestone?')) return;
      await supabase.from('milestones').delete().eq('id', milestone.id);
      close();
      showToast('Milestone deleted.');
      onChange();
    });
  }

  document.getElementById('milestone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('milestone-form-error');
    errorEl.hidden = true;

    const precisionVal = form.elements['precision'].value;
    const payload = {
      title: form.elements['title'].value.trim(),
      milestone_type: form.elements['milestone_type'].value,
      precision: precisionVal,
      notes: form.elements['notes'].value.trim() || null
    };

    if (precisionVal === 'exact') {
      const d = form.elements['exact_date'].value || null;
      payload.date_from = d;
      payload.date_to = d;
      payload.date_label = null;
    } else if (precisionVal === 'window') {
      payload.date_from = form.elements['window_from'].value || null;
      payload.date_to = form.elements['window_to'].value || null;
      payload.date_label = form.elements['window_label'].value.trim() || null;
    } else {
      payload.date_from = null;
      payload.date_to = null;
      payload.date_label = form.elements['tbd_label'].value.trim() || null;
    }

    let error;
    if (milestone) {
      ({ error } = await supabase.from('milestones').update(payload).eq('id', milestone.id));
    } else {
      ({ error } = await supabase.from('milestones').insert({
        ...payload, created_by: getIdentity(), created_at: new Date().toISOString()
      }));
    }

    if (error) {
      errorEl.textContent = `Couldn't save milestone: ${error.message}`;
      errorEl.hidden = false;
      return;
    }

    close();
    showToast(milestone ? 'Milestone updated.' : 'Milestone added.');
    onChange();
  });
}

export { BADGE_CLASS as MILESTONE_BADGE_CLASS };
