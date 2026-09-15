import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { TEAM_MEMBERS, MEETING_FIELDS, TASK_FIELDS } from './options.js';
import { inputHTML, readFormValues, escapeHtml } from './fields.js';
import { loadCustomOptions, getOptionList } from './customOptions.js';
import {
  loadMilestones, milestoneStatus, milestoneDateLabel, renderMilestoneStrip,
  openMilestoneModal, MILESTONE_BADGE_CLASS
} from './milestones.js';

initNav('tasks');
await loadCustomOptions();

const identity = getIdentity();

let meetings = [];
let tasks = [];
let polls = [];
let milestones = [];

let calendarView = 'agenda'; // 'agenda' | 'month'
let monthCursor = new Date(2026, 8, 1); // September 2026 — start of the project period
const MONTH_MIN = new Date(2026, 8, 1);
const MONTH_MAX = new Date(2027, 0, 1); // January 2027 — last month occurrences run through

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysRemaining(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return { text: 'Today', soon: true };
  if (diff < 0) return { text: `${Math.abs(diff)}d ago`, soon: false };
  if (diff <= 3) return { text: `In ${diff}d`, soon: true };
  return { text: `In ${diff}d`, soon: false };
}

function formatTime(t) {
  return t ? t.slice(0, 5) : '';
}

function timeRangeLabel(start, end) {
  if (!start) return '';
  return end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
}

// Formats a Date as a local YYYY-MM-DD string. Deliberately not toISOString(),
// which converts to UTC first and can shift the date by a day off UTC.
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Expands a single start date into every occurrence date up to (and including)
// repeatUntil, at the given cadence. Returns [startDate] when not repeating.
function generateOccurrenceDates(startDate, repeat, repeatUntil) {
  if (!startDate || !repeat || repeat === 'none' || !repeatUntil) return [startDate];
  const until = new Date(repeatUntil + 'T00:00:00');
  const dates = [];
  let cur = new Date(startDate + 'T00:00:00');
  let guard = 0;
  while (cur <= until && guard < 500) {
    dates.push(toDateStr(cur));
    if (repeat === 'daily') cur.setDate(cur.getDate() + 1);
    else if (repeat === 'weekly') cur.setDate(cur.getDate() + 7);
    else if (repeat === 'biweekly') cur.setDate(cur.getDate() + 14);
    else if (repeat === 'monthly') cur.setMonth(cur.getMonth() + 1);
    else break;
    guard++;
  }
  return dates;
}

// Builds candidate poll slots across a day range x hour range, stepped by slotMinutes.
// A "to" time of 00:00 is treated as midnight at the end of that day (24:00).
function generateSlots(startDate, endDate, fromTime, toTime, slotMinutes) {
  const slots = [];
  if (!startDate || !fromTime || !toTime || !slotMinutes) return slots;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date((endDate || startDate) + 'T00:00:00');
  if (end < start) return slots;

  const [fh, fm] = fromTime.split(':').map(Number);
  const [th, tm] = toTime.split(':').map(Number);
  const startMin = fh * 60 + fm;
  const endMin = (th === 0 && tm === 0) ? 24 * 60 : th * 60 + tm;
  if (endMin <= startMin) return slots;

  let guard = 0;
  for (let d = new Date(start); d <= end && guard < 60; d.setDate(d.getDate() + 1), guard++) {
    const dateStr = toDateStr(d);
    for (let mins = startMin; mins < endMin; mins += slotMinutes) {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      slots.push({ slot_date: dateStr, slot_time: `${hh}:${mm}` });
    }
  }
  return slots;
}

function repeatFieldsHTML() {
  return `
    <div class="form-field">
      <label>Repeat</label>
      <select name="repeat">
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Every 2 weeks</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
    <div class="form-field" id="repeat-until-field" hidden>
      <label>Repeat Until</label>
      <input type="date" name="repeat_until" />
    </div>
  `;
}

function wireRepeatToggle(formEl) {
  const repeatSel = formEl.elements['repeat'];
  const untilField = formEl.querySelector('#repeat-until-field');
  repeatSel.addEventListener('change', () => {
    untilField.hidden = repeatSel.value === 'none';
  });
}

// ---------------- Scope chooser (recurring edit/cancel) ----------------
// Shared by meetings and tasks: any row with a recurrence_id needs an explicit
// choice of how far an edit or cancellation should reach, defaulting to the
// single occurrence so accidental whole-series changes can't happen by accident.
function chooseScope(title, defaultScope = 'occurrence') {
  return new Promise(resolve => {
    let root = document.getElementById('scope-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'scope-modal-root';
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <div class="modal-overlay" id="scope-overlay">
        <div class="identity-modal" style="max-width: 380px; text-align: left; padding: 32px 34px;">
          <h2 style="font-size: 20px; margin-bottom: 16px;">${escapeHtml(title)}</h2>
          <div class="scope-options">
            <label class="scope-option"><input type="radio" name="scope" value="occurrence" ${defaultScope === 'occurrence' ? 'checked' : ''} /> This occurrence</label>
            <label class="scope-option"><input type="radio" name="scope" value="following" ${defaultScope === 'following' ? 'checked' : ''} /> This and following</label>
            <label class="scope-option"><input type="radio" name="scope" value="series" ${defaultScope === 'series' ? 'checked' : ''} /> Entire series</label>
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:22px;">
            <button type="button" class="btn-text" id="scope-cancel">Cancel</button>
            <button type="button" class="btn-primary" id="scope-confirm">Continue</button>
          </div>
        </div>
      </div>
    `;
    const close = (val) => { root.innerHTML = ''; resolve(val); };
    document.getElementById('scope-cancel').addEventListener('click', () => close(null));
    document.getElementById('scope-confirm').addEventListener('click', () => {
      close(root.querySelector('input[name="scope"]:checked').value);
    });
    document.getElementById('scope-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'scope-overlay') close(null);
    });
  });
}

// ---------------- Agenda ----------------

function meetingSubtitle(m) {
  const parts = [];
  if (m.format) parts.push(m.format);
  if (m.location) parts.push(m.location);
  if (m.participants && m.participants.length) parts.push(`With: ${m.participants.join(', ')}`);
  if (m.notes) parts.push(m.notes);
  return parts.join(' · ');
}

function buildAgendaItems() {
  const items = [];

  meetings.forEach(m => items.push({
    date: m.meeting_date, time: m.meeting_time,
    timeLabel: timeRangeLabel(m.meeting_time, m.end_time),
    title: m.title, badgeText: m.meeting_type, badgeClass: 'badge-green',
    sub: meetingSubtitle(m), kind: 'meeting', cancelled: m.status === 'cancelled', raw: m
  }));

  tasks.filter(t => t.due_date).forEach(t => items.push({
    date: t.due_date, time: null, timeLabel: '',
    title: t.title, badgeText: t.task_type === 'Deliverable' ? 'Deliverable' : 'Task',
    badgeClass: t.task_type === 'Deliverable' ? 'badge-red' : 'badge-muted',
    sub: (t.assignees && t.assignees.length) ? `Assigned: ${t.assignees.join(', ')}` : 'Unassigned',
    kind: 'task', cancelled: t.status === 'cancelled', raw: t
  }));

  milestones.filter(m => m.date_from).forEach(m => items.push({
    date: m.date_from, time: null, timeLabel: '',
    title: m.title, badgeText: m.milestone_type[0].toUpperCase() + m.milestone_type.slice(1),
    badgeClass: MILESTONE_BADGE_CLASS[m.milestone_type] || 'badge-muted',
    sub: m.notes || '', kind: 'milestone', cancelled: false, raw: m,
    dateLabelOverride: m.precision !== 'exact' ? milestoneDateLabel(m) : null
  }));

  return items.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
}

function agendaRowHTML(item) {
  const d = new Date(`${item.date}T00:00:00`);
  const dr = daysRemaining(item.date);
  return `
    <div class="agenda-row ${item.cancelled ? 'cancelled' : ''}" data-kind="${item.kind}" data-id="${item.raw.id}">
      <div class="agenda-date-block">
        ${item.dateLabelOverride
          ? `<div class="agenda-date-window">${escapeHtml(item.dateLabelOverride)}</div>`
          : `<div class="agenda-date-day">${d.getDate()}</div><div class="agenda-date-mon">${DAY_ABBR[d.getDay()]}</div>`}
      </div>
      <div class="agenda-info">
        <div class="agenda-title">
          <span class="badge ${item.badgeClass}" style="margin-right: 8px;">${escapeHtml(item.badgeText)}</span>
          ${escapeHtml(item.title)}${item.timeLabel ? ` · ${item.timeLabel}` : ''}
          ${item.cancelled ? '<span class="badge badge-muted" style="margin-left:6px;">Cancelled</span>' : ''}
        </div>
        ${item.sub ? `<div class="agenda-sub">${escapeHtml(item.sub)}</div>` : ''}
      </div>
      <div class="agenda-countdown ${dr.soon && !item.cancelled ? 'soon' : ''}">${item.cancelled ? '' : dr.text}</div>
    </div>
  `;
}

function wireAgendaRowClicks(el) {
  el.querySelectorAll('.agenda-row[data-kind]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      if (row.dataset.kind === 'meeting') openEditMeetingModal(meetings.find(m => m.id === id));
      else if (row.dataset.kind === 'task') openEditTaskModal(tasks.find(t => t.id === id));
      else if (row.dataset.kind === 'milestone') openMilestoneModal({ milestone: milestones.find(m => m.id === id), onChange: reloadMilestonesAndRender });
    });
  });
}

function renderAgenda() {
  const el = document.getElementById('calendar-agenda');
  const items = buildAgendaItems();

  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><div class="em-title">Nothing scheduled</div><p>Add a meeting, a task with a due date, or a milestone to see it here.</p></div>`;
    return;
  }

  let html = '';
  let lastMonth = '';
  items.forEach(item => {
    const d = new Date(`${item.date}T00:00:00`);
    const monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (monthLabel !== lastMonth) {
      html += `<div class="agenda-month-label">${monthLabel}</div>`;
      lastMonth = monthLabel;
    }
    html += agendaRowHTML(item);
  });
  el.innerHTML = html;
  wireAgendaRowClicks(el);
}

// ---------------- Month view ----------------

function monthIndex() {
  const index = {};
  const push = (dateStr, entry) => {
    if (!dateStr) return;
    if (!index[dateStr]) index[dateStr] = [];
    index[dateStr].push(entry);
  };

  meetings.forEach(m => push(m.meeting_date, { dot: 'meeting', item: m }));
  tasks.filter(t => t.due_date).forEach(t => push(t.due_date, { dot: t.task_type === 'Deliverable' ? 'deliverable' : 'task', item: t }));
  milestones.forEach(m => {
    if (!m.date_from) return;
    const from = new Date(m.date_from + 'T00:00:00');
    const to = new Date((m.date_to || m.date_from) + 'T00:00:00');
    let guard = 0;
    for (let d = new Date(from); d <= to && guard < 60; d.setDate(d.getDate() + 1), guard++) {
      push(toDateStr(d), { dot: 'milestone', item: m });
    }
  });
  return index;
}

function renderMonthView() {
  const el = document.getElementById('calendar-month');
  const index = monthIndex();
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const atMin = monthCursor.getTime() <= MONTH_MIN.getTime();
  const atMax = monthCursor.getTime() >= MONTH_MAX.getTime();

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="month-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(year, month, day));
    const entries = index[dateStr] || [];
    const isToday = dateStr === toDateStr(new Date());
    const dots = entries.slice(0, 4).map(e => `<span class="month-dot month-dot-${e.dot}"></span>`).join('');
    cells += `
      <div class="month-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
        <div class="month-cell-num">${day}</div>
        <div class="month-cell-dots">${dots}</div>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="month-header">
      <button type="button" class="month-nav" id="month-prev" ${atMin ? 'disabled' : ''}>&larr;</button>
      <div class="month-label">${MONTH_NAMES[month]} ${year}</div>
      <button type="button" class="month-nav" id="month-next" ${atMax ? 'disabled' : ''}>&rarr;</button>
    </div>
    <div class="month-weekdays">${DAY_ABBR.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="month-grid">${cells}</div>
    <div id="month-day-detail"></div>
  `;

  document.getElementById('month-prev').addEventListener('click', () => {
    if (atMin) return;
    monthCursor = new Date(year, month - 1, 1);
    renderMonthView();
  });
  document.getElementById('month-next').addEventListener('click', () => {
    if (atMax) return;
    monthCursor = new Date(year, month + 1, 1);
    renderMonthView();
  });
  el.querySelectorAll('.month-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => renderMonthDayDetail(cell.dataset.date));
  });
}

function renderMonthDayDetail(dateStr) {
  const el = document.getElementById('month-day-detail');
  const items = buildAgendaItems().filter(i => {
    if (i.kind === 'milestone' && i.raw.date_to && i.raw.date_to !== i.raw.date_from) {
      return dateStr >= i.raw.date_from && dateStr <= i.raw.date_to;
    }
    return i.date === dateStr;
  });

  document.querySelectorAll('.month-cell.selected').forEach(c => c.classList.remove('selected'));
  const cell = document.querySelector(`.month-cell[data-date="${dateStr}"]`);
  if (cell) cell.classList.add('selected');

  if (!items.length) {
    el.innerHTML = `<div class="month-day-empty">Nothing on ${dateStr}.</div>`;
    return;
  }
  el.innerHTML = `<div class="month-day-label">${dateStr}</div>` + items.map(agendaRowHTML).join('');
  wireAgendaRowClicks(el);
}

function switchCalendarView(view) {
  calendarView = view;
  document.querySelectorAll('#calendar-view-toggle button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('calendar-agenda').hidden = view !== 'agenda';
  document.getElementById('calendar-month').hidden = view !== 'month';
  if (view === 'month') renderMonthView();
}

// ---------------- Meetings ----------------

async function loadMeetings() {
  const { data } = await supabase.from('meetings').select('*').order('meeting_date', { ascending: true });
  meetings = data || [];
}

function formatBlockHTML(format, location, onlineLink) {
  const formatOptions = getOptionList('meeting_format');
  return `
    <div class="form-field"><label>Format</label>
      <select name="format">
        <option value="" ${!format ? 'selected' : ''}>Not specified</option>
        ${formatOptions.map(o => `<option value="${o}" ${o === format ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
    <div class="form-field full" id="meeting-block-location" ${format !== 'In-person' ? 'hidden' : ''}>
      <label>Location</label><input type="text" name="location" value="${escapeHtml(location)}" />
    </div>
    <div class="form-field full" id="meeting-block-link" ${format !== 'Online' ? 'hidden' : ''}>
      <label>Online Link</label><input type="text" name="online_link" value="${escapeHtml(onlineLink)}" />
    </div>
  `;
}

function wireFormatToggle(form) {
  const sel = form.elements['format'];
  const locBlock = document.getElementById('meeting-block-location');
  const linkBlock = document.getElementById('meeting-block-link');
  function sync() {
    locBlock.hidden = sel.value !== 'In-person';
    linkBlock.hidden = sel.value !== 'Online';
  }
  sel.addEventListener('change', sync);
  sync();
}

function participantsHTML(selected = []) {
  return TEAM_MEMBERS.map(name => `
    <label class="checkbox-item"><input type="checkbox" name="participant" value="${name}" ${selected.includes(name) ? 'checked' : ''} /> ${name}</label>
  `).join('');
}

function openAddMeetingModal() {
  const root = document.getElementById('add-meeting-root');
  const fieldsHTML = MEETING_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Add Meeting</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">${fieldsHTML}${formatBlockHTML('', '', '')}${repeatFieldsHTML()}</div>
            <div class="form-section-label">Participants</div>
            <div class="checkbox-row">${participantsHTML()}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">Save Meeting</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  wireRepeatToggle(document.getElementById('form'));
  wireFormatToggle(document.getElementById('form'));

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;
    const data = readFormValues(e.target, MEETING_FIELDS);
    data.format = e.target.elements['format'].value || null;
    data.location = e.target.elements['location'].value.trim() || null;
    data.online_link = e.target.elements['online_link'].value.trim() || null;
    data.participants = [...e.target.querySelectorAll('input[name="participant"]:checked')].map(cb => cb.value);
    data.status = 'scheduled';
    data.created_by = identity;
    data.created_at = new Date().toISOString();

    const repeat = e.target.elements['repeat'].value;
    const repeatUntil = e.target.elements['repeat_until'].value || null;
    const occurrenceDates = generateOccurrenceDates(data.meeting_date, repeat, repeatUntil);
    const recurrenceId = occurrenceDates.length > 1 ? crypto.randomUUID() : null;
    const rows = occurrenceDates.map(date => ({ ...data, meeting_date: date, recurrence_id: recurrenceId }));

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { error } = await supabase.from('meetings').insert(rows);
    if (error) {
      errorEl.textContent = `Couldn't save meeting: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Meeting';
      return;
    }
    close();
    showToast(rows.length > 1 ? `${rows.length} meetings added.` : 'Meeting added.');
    await loadMeetings();
    renderAll();
  });
}

async function openEditMeetingModal(meeting) {
  let scope = 'occurrence';
  if (meeting.recurrence_id) {
    scope = await chooseScope('Edit recurring meeting', 'occurrence');
    if (!scope) return;
  }

  const root = document.getElementById('edit-meeting-root');
  const fieldsHTML = MEETING_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${f.key === 'meeting_date' && scope !== 'occurrence'
        ? `<input type="date" value="${meeting.meeting_date}" disabled />`
        : inputHTML(f, meeting[f.key])}
    </div>
  `).join('');
  const scopeNote = scope !== 'occurrence'
    ? `<p class="settings-hint" style="margin: -6px 0 14px;">Date can only be changed for a single occurrence — editing "${scope === 'series' ? 'entire series' : 'this and following'}" applies to time, format, location, link, notes and participants only.</p>`
    : '';

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Edit Meeting</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            ${scopeNote}
            <div class="form-grid">${fieldsHTML}${formatBlockHTML(meeting.format, meeting.location, meeting.online_link)}</div>
            <div class="form-section-label">Participants</div>
            <div class="checkbox-row">${participantsHTML(meeting.participants || [])}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-danger-text" id="cancel-meeting-btn" style="margin-right:auto;">Cancel meeting…</button>
            <button type="button" class="btn-text" id="cancel-btn">Close</button>
            <button type="submit" class="btn-primary" id="submit-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  wireFormatToggle(document.getElementById('form'));

  document.getElementById('cancel-meeting-btn').addEventListener('click', async () => {
    let cancelScope = 'occurrence';
    if (meeting.recurrence_id) {
      cancelScope = await chooseScope('Cancel meeting', 'occurrence');
      if (!cancelScope) return;
    }
    if (!confirm('Cancel this meeting? It will stay visible in the calendar, marked as cancelled.')) return;

    let query = supabase.from('meetings').update({ status: 'cancelled' });
    if (cancelScope === 'occurrence') query = query.eq('id', meeting.id);
    else if (cancelScope === 'following') query = query.eq('recurrence_id', meeting.recurrence_id).gte('meeting_date', meeting.meeting_date);
    else query = query.eq('recurrence_id', meeting.recurrence_id);
    const { error } = await query;

    if (error) { showToast(`Couldn't cancel meeting: ${error.message}`, true); return; }
    close();
    showToast('Meeting cancelled.');
    await loadMeetings();
    renderAll();
  });

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const payload = readFormValues(e.target, MEETING_FIELDS.filter(f => !(f.key === 'meeting_date' && scope !== 'occurrence')));
    payload.format = e.target.elements['format'].value || null;
    payload.location = e.target.elements['location'].value.trim() || null;
    payload.online_link = e.target.elements['online_link'].value.trim() || null;
    payload.participants = [...e.target.querySelectorAll('input[name="participant"]:checked')].map(cb => cb.value);

    let query = supabase.from('meetings').update(payload);
    if (scope === 'occurrence') query = query.eq('id', meeting.id);
    else if (scope === 'following') query = query.eq('recurrence_id', meeting.recurrence_id).gte('meeting_date', meeting.meeting_date);
    else query = query.eq('recurrence_id', meeting.recurrence_id);

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    const { error } = await query;

    if (error) {
      errorEl.textContent = `Couldn't save changes: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
      return;
    }
    close();
    showToast('Meeting updated.');
    await loadMeetings();
    renderAll();
  });
}

// ---------------- Meeting polls ----------------

function formatSlot(slot) {
  const d = new Date(`${slot.slot_date}T00:00:00`);
  const dateLabel = `${DAY_ABBR[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return slot.slot_time ? `${dateLabel} · ${formatTime(slot.slot_time)}` : dateLabel;
}

async function loadPolls() {
  const { data, error } = await supabase
    .from('meeting_polls')
    .select('*, poll_slots!poll_slots_poll_id_fkey(*, poll_responses(*))')
    .order('created_at', { ascending: false });

  if (error) {
    polls = [];
    return;
  }
  polls = (data || []).map(p => ({
    ...p,
    poll_slots: (p.poll_slots || []).sort((a, b) =>
      `${a.slot_date}${a.slot_time || ''}`.localeCompare(`${b.slot_date}${b.slot_time || ''}`)
    )
  }));
}

function renderPolls() {
  const el = document.getElementById('poll-list');
  if (!polls.length) {
    el.innerHTML = `<div class="empty-state"><div class="em-title">No polls yet</div><p>Start one to find a time that works for everyone.</p></div>`;
    return;
  }

  el.innerHTML = polls.map(poll => {
    const closed = poll.status === 'closed';
    const slotsHTML = poll.poll_slots.map(slot => {
      const responses = slot.poll_responses || [];
      const iVoted = responses.some(r => r.person === identity);
      const chosen = poll.chosen_slot_id === slot.id;
      return `
        <div class="poll-slot">
          <input type="checkbox" data-slot-id="${slot.id}" ${iVoted ? 'checked' : ''} ${closed ? 'disabled' : ''} />
          <span class="poll-slot-label">${formatSlot(slot)}${chosen ? ' — confirmed' : ''}</span>
          <span class="poll-slot-names">${escapeHtml(responses.map(r => r.person).join(', '))}</span>
          <span class="poll-slot-count">${responses.length} available</span>
          ${!closed ? `<button type="button" class="poll-slot-confirm" data-confirm-slot="${slot.id}">Confirm</button>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="poll-card ${closed ? 'closed' : ''}" data-poll-id="${poll.id}">
        <div class="poll-head">
          <div class="poll-title">${escapeHtml(poll.title)}</div>
          <span class="badge ${closed ? 'badge-muted' : 'badge-green'}">${closed ? 'Closed' : 'Open'}</span>
        </div>
        ${poll.description ? `<div class="poll-desc">${escapeHtml(poll.description)}</div>` : ''}
        <div class="poll-slots">${slotsHTML}</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('[data-slot-id]').forEach(cb => {
    cb.addEventListener('change', () => toggleResponse(cb.dataset.slotId));
  });
  el.querySelectorAll('[data-confirm-slot]').forEach(btn => {
    btn.addEventListener('click', () => confirmSlot(btn.closest('.poll-card').dataset.pollId, btn.dataset.confirmSlot));
  });
}

async function toggleResponse(slotId) {
  const { data: existing } = await supabase
    .from('poll_responses')
    .select('id')
    .eq('slot_id', slotId)
    .eq('person', identity)
    .maybeSingle();

  if (existing) {
    await supabase.from('poll_responses').delete().eq('id', existing.id);
  } else {
    await supabase.from('poll_responses').insert({ slot_id: slotId, person: identity, created_at: new Date().toISOString() });
  }
  await loadPolls();
  renderPolls();
}

async function confirmSlot(pollId, slotId) {
  const poll = polls.find(p => p.id === pollId);
  const slot = poll?.poll_slots.find(s => s.id === slotId);
  if (!poll || !slot) return;

  const { error: meetingError } = await supabase.from('meetings').insert({
    title: poll.title,
    meeting_type: 'Team',
    meeting_date: slot.slot_date,
    meeting_time: slot.slot_time,
    status: 'scheduled',
    notes: 'Scheduled via meeting poll',
    created_by: identity,
    created_at: new Date().toISOString()
  });
  if (meetingError) {
    showToast(`Couldn't add to calendar: ${meetingError.message}`, true);
    return;
  }

  await supabase.from('meeting_polls').update({ status: 'closed', chosen_slot_id: slotId }).eq('id', pollId);

  showToast('Meeting confirmed and added to the calendar.');
  await Promise.all([loadMeetings(), loadPolls()]);
  renderAll();
  renderPolls();
}

function openAddPollModal() {
  const root = document.getElementById('add-poll-root');
  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>New Meeting Poll</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">
              <div class="form-field full"><label>Poll Title *</label><input type="text" name="title" required /></div>
              <div class="form-field full"><label>Description</label><textarea name="description" rows="2"></textarea></div>
            </div>
            <div class="form-section-label">Candidate Slots</div>
            <div class="form-grid">
              <div class="form-field"><label>Start Date *</label><input type="date" name="start_date" required /></div>
              <div class="form-field"><label>End Date</label><input type="date" name="end_date" /></div>
              <div class="form-field"><label>From *</label><input type="time" name="from_time" value="09:00" required /></div>
              <div class="form-field"><label>To *</label><input type="time" name="to_time" value="18:00" required /></div>
              <div class="form-field"><label>Slot Length</label>
                <select name="slot_minutes">
                  <option value="15">15 min</option>
                  <option value="30" selected>30 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
            </div>
            <div class="settings-hint" id="slot-preview" style="margin: 8px 0 0;">Pick a date and time range to see how many candidate slots this creates.</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">Create Poll</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const form = document.getElementById('form');
  const preview = document.getElementById('slot-preview');

  function currentSlots() {
    return generateSlots(
      form.elements['start_date'].value,
      form.elements['end_date'].value,
      form.elements['from_time'].value,
      form.elements['to_time'].value,
      Number(form.elements['slot_minutes'].value)
    );
  }

  function updatePreview() {
    const count = currentSlots().length;
    preview.textContent = count
      ? `This will create ${count} candidate slot${count === 1 ? '' : 's'}.`
      : 'Pick a date and time range to see how many candidate slots this creates.';
  }
  ['start_date', 'end_date', 'from_time', 'to_time', 'slot_minutes'].forEach(name => {
    form.elements[name].addEventListener('input', updatePreview);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const title = form.elements['title'].value.trim();
    const description = form.elements['description'].value.trim() || null;
    const slots = currentSlots();

    if (!slots.length) {
      errorEl.textContent = 'No candidate slots in that range — check your dates and times.';
      errorEl.hidden = false;
      return;
    }
    if (slots.length > 300) {
      errorEl.textContent = `That range would create ${slots.length} slots — narrow the dates, hours, or use a longer slot length.`;
      errorEl.hidden = false;
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    const { data: poll, error } = await supabase
      .from('meeting_polls')
      .insert({ title, description, created_by: identity, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      errorEl.textContent = `Couldn't create poll: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Poll';
      return;
    }

    const { error: slotError } = await supabase.from('poll_slots').insert(
      slots.map(s => ({ ...s, poll_id: poll.id }))
    );
    if (slotError) showToast(`Poll created, but slots failed: ${slotError.message}`, true);

    close();
    showToast(`Poll created with ${slots.length} candidate slot${slots.length === 1 ? '' : 's'}.`);
    await loadPolls();
    renderPolls();
  });
}

// ---------------- Tasks ----------------

async function loadTasks() {
  const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
  tasks = data || [];
}

function assigneesHTML(selected = []) {
  return TEAM_MEMBERS.map(name => `
    <label class="checkbox-item"><input type="checkbox" name="assignee" value="${name}" ${selected.includes(name) ? 'checked' : ''} /> ${name}</label>
  `).join('');
}

function renderTasks() {
  const el = document.getElementById('task-list');
  if (!tasks.length) {
    el.innerHTML = `<div class="empty-state"><div class="em-title">No tasks yet</div><p>Add the first one to start tracking the team's workstream.</p></div>`;
    return;
  }

  el.innerHTML = tasks.map(t => {
    const dr = t.due_date ? daysRemaining(t.due_date) : null;
    const statusOptions = getOptionList('task_status').map(s => `<option value="${s.value}" ${s.value === t.status ? 'selected' : ''}>${s.label}</option>`).join('');
    const cancelled = t.status === 'cancelled';
    return `
      <div class="task-row ${cancelled ? 'cancelled' : ''}" data-task-id="${t.id}">
        <span class="badge ${t.task_type === 'Deliverable' ? 'badge-red' : 'badge-muted'}">${escapeHtml(t.task_type || 'Task')}</span>
        <div class="task-main" data-task-open="${t.id}">
          <div class="task-title">${escapeHtml(t.title)}${t.recurrence_id ? ' <span class="badge badge-muted" style="margin-left:6px;">Recurring</span>' : ''}</div>
          <div class="task-assignees">${(t.assignees && t.assignees.length) ? escapeHtml(t.assignees.join(', ')) : 'Unassigned'}</div>
        </div>
        <div class="task-due">${t.due_date ? `${t.due_date}${dr ? ` · ${dr.text}` : ''}` : 'No due date'}</div>
        <select class="task-status-select" data-task-status="${t.id}">${statusOptions}</select>
        <button type="button" class="task-remove" data-task-remove="${t.id}">&times;</button>
      </div>
    `;
  }).join('');

  el.querySelectorAll('[data-task-open]').forEach(main => {
    main.addEventListener('click', () => openEditTaskModal(tasks.find(t => t.id === main.dataset.taskOpen)));
  });
  el.querySelectorAll('[data-task-status]').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async () => {
      await supabase.from('tasks').update({ status: sel.value }).eq('id', sel.dataset.taskStatus);
      showToast('Status updated.');
      await loadTasks();
      renderTasks();
      renderAgenda();
    });
  });
  el.querySelectorAll('[data-task-remove]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this task?')) return;
      await supabase.from('tasks').delete().eq('id', btn.dataset.taskRemove);
      await loadTasks();
      renderTasks();
      renderAgenda();
    });
  });
}

function openAddTaskModal() {
  const root = document.getElementById('add-task-root');
  const fieldsHTML = TASK_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, f.key === 'status' ? 'todo' : (f.key === 'task_type' ? 'Task' : ''))}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Add Task</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">${fieldsHTML}${repeatFieldsHTML()}</div>
            <div class="form-section-label">Assignees</div>
            <div class="checkbox-row">${assigneesHTML()}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary" id="submit-btn">Save Task</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  wireRepeatToggle(document.getElementById('form'));

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const data = readFormValues(e.target, TASK_FIELDS);
    data.assignees = [...e.target.querySelectorAll('input[name="assignee"]:checked')].map(cb => cb.value);
    data.created_by = identity;
    data.created_at = new Date().toISOString();

    const repeat = e.target.elements['repeat'].value;
    const repeatUntil = e.target.elements['repeat_until'].value || null;

    if (repeat !== 'none' && !data.due_date) {
      errorEl.textContent = 'Set a due date to repeat this task.';
      errorEl.hidden = false;
      return;
    }

    const occurrenceDates = generateOccurrenceDates(data.due_date, repeat, repeatUntil);
    const recurrenceId = occurrenceDates.length > 1 ? crypto.randomUUID() : null;
    const rows = occurrenceDates.map(date => ({ ...data, due_date: date, recurrence_id: recurrenceId }));

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { error } = await supabase.from('tasks').insert(rows);
    if (error) {
      errorEl.textContent = `Couldn't save task: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Task';
      return;
    }
    close();
    showToast(rows.length > 1 ? `${rows.length} tasks added.` : 'Task added.');
    await loadTasks();
    renderTasks();
    renderAgenda();
  });
}

async function openEditTaskModal(task) {
  let scope = 'occurrence';
  if (task.recurrence_id) {
    scope = await chooseScope('Edit recurring task', 'occurrence');
    if (!scope) return;
  }

  const root = document.getElementById('edit-task-root');
  const fieldsHTML = TASK_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${f.key === 'due_date' && scope !== 'occurrence'
        ? `<input type="date" value="${task.due_date || ''}" disabled />`
        : inputHTML(f, task[f.key])}
    </div>
  `).join('');
  const scopeNote = scope !== 'occurrence'
    ? `<p class="settings-hint" style="margin: -6px 0 14px;">Due date can only be changed for a single occurrence — editing "${scope === 'series' ? 'entire series' : 'this and following'}" applies to title, description, status, task type and assignees only.</p>`
    : '';

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Edit Task</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            ${scopeNote}
            <div class="form-grid">${fieldsHTML}</div>
            <div class="form-section-label">Assignees</div>
            <div class="checkbox-row">${assigneesHTML(task.assignees || [])}</div>
          </div>
          <div class="form-modal-foot">
            <button type="button" class="btn-danger-text" id="delete-btn" style="margin-right:auto;">Delete</button>
            <button type="button" class="btn-text" id="cancel-btn">Close</button>
            <button type="submit" class="btn-primary" id="submit-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', task.id);
    close();
    showToast('Task deleted.');
    await loadTasks();
    renderTasks();
    renderAgenda();
  });

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const payload = readFormValues(e.target, TASK_FIELDS.filter(f => !(f.key === 'due_date' && scope !== 'occurrence')));
    payload.assignees = [...e.target.querySelectorAll('input[name="assignee"]:checked')].map(cb => cb.value);

    let query = supabase.from('tasks').update(payload);
    if (scope === 'occurrence') query = query.eq('id', task.id);
    else if (scope === 'following') query = query.eq('recurrence_id', task.recurrence_id).gte('due_date', task.due_date);
    else query = query.eq('recurrence_id', task.recurrence_id);

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    const { error } = await query;

    if (error) {
      errorEl.textContent = `Couldn't save changes: ${error.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
      return;
    }
    close();
    showToast('Task updated.');
    await loadTasks();
    renderTasks();
    renderAgenda();
  });
}

// ---------------- Milestones ----------------

async function reloadMilestonesAndRender() {
  milestones = await loadMilestones();
  renderMilestoneStripSection();
  renderAgenda();
  if (calendarView === 'month') renderMonthView();
}

function renderMilestoneStripSection() {
  renderMilestoneStrip(document.getElementById('milestone-strip'), milestones, {
    onEdit: (m) => openMilestoneModal({ milestone: m, onChange: reloadMilestonesAndRender }),
    onAdd: () => openMilestoneModal({ onChange: reloadMilestonesAndRender })
  });
}

// ---------------- Init ----------------

document.getElementById('btn-add-meeting').addEventListener('click', openAddMeetingModal);
document.getElementById('btn-add-poll').addEventListener('click', openAddPollModal);
document.getElementById('btn-add-task').addEventListener('click', openAddTaskModal);
document.querySelectorAll('#calendar-view-toggle button').forEach(btn => {
  btn.addEventListener('click', () => switchCalendarView(btn.dataset.view));
});

function renderAll() {
  renderMilestoneStripSection();
  renderAgenda();
  if (calendarView === 'month') renderMonthView();
}

async function init() {
  await Promise.all([loadMeetings(), loadTasks(), loadPolls()]);
  milestones = await loadMilestones();
  renderAll();
  renderPolls();
  renderTasks();
}

init();
