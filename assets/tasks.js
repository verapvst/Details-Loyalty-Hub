import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { MEETING_FIELDS, TASK_FIELDS } from './options.js';
import { loadTeamMembers, getActiveTeamMembers } from './teamMembers.js';
import { inputHTML, readFormValues, escapeHtml, checkboxRowWithAllHTML, wireSelectAllToggle } from './fields.js';
import { loadCustomOptions, getOptionList } from './customOptions.js';
import {
  loadMilestones, milestoneStatus, milestoneDateLabel, renderMilestoneStrip,
  openMilestoneModal, MILESTONE_BADGE_CLASS
} from './milestones.js';

await initNav('tasks');
await loadCustomOptions();
await loadTeamMembers();
const TEAM_MEMBERS = getActiveTeamMembers();

// Deliberately NOT cached in a module-level constant: getIdentity() is called fresh
// at every use site below so switching the active user (via the nav identity picker,
// which doesn't reload the page) takes effect immediately — otherwise every "is this
// my vote / my task" check would keep comparing against whoever was active on load.
let meetings = [];
let tasks = [];
let polls = [];
let milestones = [];

let calendarView = 'month'; // 'agenda' | 'month'
let monthCursor = new Date(2026, 8, 1); // September 2026 — start of the project period
const MONTH_MIN = new Date(2026, 8, 1);
const MONTH_MAX = new Date(2027, 0, 1); // January 2027 — last month occurrences run through

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // indexed by Date#getDay() — keep Sunday-first
const MONTH_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Month view's header row, week starting Monday

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

// This week (Mon-Sun) + next week — the window that gets full-weight task rows.
function nearTermRange() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  const nextSunday = new Date(monday); nextSunday.setDate(monday.getDate() + 13);
  return { start: toDateStr(monday), end: toDateStr(nextSunday) };
}

function isNearTerm(dateStr) {
  if (!dateStr) return true;
  const { start, end } = nearTermRange();
  return dateStr >= start && dateStr <= end;
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
    title: m.title, badgeText: m.meeting_type, badgeClass: 'badge-meeting',
    sub: meetingSubtitle(m), kind: 'meeting', cancelled: m.status === 'cancelled', raw: m
  }));

  // Plain Tasks deliberately don't appear on the Calendar (Agenda or Month) — only
  // Meetings and Deliverables do. Tasks stay visible in the Tasks list below.
  tasks.filter(t => t.due_date && t.task_type === 'Deliverable').forEach(t => items.push({
    date: t.due_date, time: null, timeLabel: '',
    title: t.title, badgeText: 'Deliverable', badgeClass: 'badge-yellow',
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

// Short label shown inside a month-view pill instead of a plain dot.
function monthPillLabel(kind, item) {
  if (kind === 'meeting') return item.meeting_type;
  if (kind === 'deliverable') return /PDS/i.test(item.title) ? 'PDS' : item.title.split(' ')[0];
  if (kind === 'milestone') return item.title;
  return item.title.split(' ')[0];
}

function monthIndex() {
  const index = {};
  const push = (dateStr, entry) => {
    if (!dateStr) return;
    if (!index[dateStr]) index[dateStr] = [];
    index[dateStr].push(entry);
  };

  meetings.forEach(m => push(m.meeting_date, { kind: 'meeting', item: m, cancelled: m.status === 'cancelled' }));
  // Only Deliverables show on the Calendar — plain Tasks stay in the Tasks list only.
  tasks.filter(t => t.due_date && t.task_type === 'Deliverable').forEach(t => push(t.due_date, {
    kind: 'deliverable', item: t, cancelled: t.status === 'cancelled'
  }));
  milestones.forEach(m => {
    if (!m.date_from) return;
    const from = new Date(m.date_from + 'T00:00:00');
    const to = new Date((m.date_to || m.date_from) + 'T00:00:00');
    let guard = 0;
    for (let d = new Date(from); d <= to && guard < 60; d.setDate(d.getDate() + 1), guard++) {
      push(toDateStr(d), { kind: 'milestone', item: m, cancelled: false });
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
  const startOffset = (firstDay.getDay() + 6) % 7; // Date#getDay() is Sunday-first; shift so Monday is column 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const atMin = monthCursor.getTime() <= MONTH_MIN.getTime();
  const atMax = monthCursor.getTime() >= MONTH_MAX.getTime();

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="month-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(year, month, day));
    const entries = index[dateStr] || [];
    const isToday = dateStr === toDateStr(new Date());
    const shown = entries.slice(0, 3);
    const overflow = entries.length - shown.length;
    const pills = shown.map(e => `
      <div class="month-pill month-pill-${e.kind} ${e.cancelled ? 'cancelled-pill' : ''}" title="${escapeHtml(e.item.title)}">
        ${escapeHtml(monthPillLabel(e.kind, e.item))}
      </div>
    `).join('') + (overflow > 0 ? `<div class="month-pill month-pill-more">+${overflow}</div>` : '');
    cells += `
      <div class="month-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
        <div class="month-cell-num">${day}</div>
        <div class="month-cell-pills">${pills}</div>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="month-header">
      <button type="button" class="month-nav" id="month-prev" ${atMin ? 'disabled' : ''}>&larr;</button>
      <div class="month-label">${MONTH_NAMES[month]} ${year}</div>
      <button type="button" class="month-nav" id="month-next" ${atMax ? 'disabled' : ''}>&rarr;</button>
    </div>
    <div class="month-weekdays">${MONTH_WEEKDAY_LABELS.map(d => `<div>${d}</div>`).join('')}</div>
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
  return checkboxRowWithAllHTML('participant', TEAM_MEMBERS, selected);
}

// `prefill` seeds the form (used by the poll's "Schedule Meeting" flow to suggest a
// starting date/time — the user can still change everything before saving).
// `onSaved(meetingRow)` fires after a successful insert, in addition to the normal
// toast/reload, so a caller can react to the newly created meeting.
function openAddMeetingModal(prefill = {}, onSaved = null) {
  const root = document.getElementById('add-meeting-root');
  const fieldsHTML = MEETING_FIELDS.map(f => `
    <div class="form-field ${f.full ? 'full' : ''}">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      ${inputHTML(f, prefill[f.key] ?? '')}
    </div>
  `).join('');

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Add Meeting</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            <div class="form-grid">${fieldsHTML}${formatBlockHTML(prefill.format || '', prefill.location || '', prefill.online_link || '')}${repeatFieldsHTML()}</div>
            <div class="form-section-label">Participants</div>
            ${participantsHTML(prefill.participants || [])}
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
  wireSelectAllToggle(document.getElementById('form'));

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
    data.created_by = getIdentity();
    data.created_at = new Date().toISOString();

    const repeat = e.target.elements['repeat'].value;
    const repeatUntil = e.target.elements['repeat_until'].value || null;
    const occurrenceDates = generateOccurrenceDates(data.meeting_date, repeat, repeatUntil);
    const recurrenceId = occurrenceDates.length > 1 ? crypto.randomUUID() : null;
    const rows = occurrenceDates.map(date => ({ ...data, meeting_date: date, recurrence_id: recurrenceId }));

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { data: inserted, error } = await supabase.from('meetings').insert(rows).select();
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
    if (onSaved && inserted && inserted[0]) await onSaved(inserted[0]);
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
    ? `<p class="settings-hint" style="margin: -6px 0 14px;">Date can only be changed for a single occurrence. Editing "${scope === 'series' ? 'entire series' : 'this and following'}" applies to time, format, location, link, notes and participants only.</p>`
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
            ${participantsHTML(meeting.participants || [])}
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
  wireSelectAllToggle(document.getElementById('form'));

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
// A poll is only a scheduling aid: it collects availability and never, by itself,
// creates a Meeting. "Schedule Meeting" is a separate, explicit step that opens the
// real Meeting form (pre-filled from the poll's strongest slot as a suggestion only).
// Once that Meeting is created, the poll is marked 'scheduled' and drops out of the
// active list — the Calendar only ever shows real Meetings, never poll grids.

function formatSlot(slot) {
  const d = new Date(`${slot.slot_date}T00:00:00`);
  const dateLabel = `${DAY_ABBR[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return slot.slot_time ? `${dateLabel} · ${formatTime(slot.slot_time)}` : dateLabel;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor((total / 60) % 24)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
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

// Slots with at least one response, ranked most-available first (ties broken chronologically).
function pollResults(poll) {
  return poll.poll_slots
    .map(slot => ({ slot, count: (slot.poll_responses || []).length, names: (slot.poll_responses || []).map(r => r.person) }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count || `${a.slot.slot_date}${a.slot.slot_time || ''}`.localeCompare(`${b.slot.slot_date}${b.slot.slot_time || ''}`));
}

function pollFieldsHTML(poll = {}) {
  return `
    <div class="form-grid">
      <div class="form-field full"><label>Poll / Meeting Name *</label><input type="text" name="title" required value="${escapeHtml(poll.title)}" /></div>
      <div class="form-field full"><label>Note</label><textarea name="description" rows="2">${escapeHtml(poll.description)}</textarea></div>
    </div>
    <div class="form-section-label">Candidate Slots</div>
    <div class="form-grid">
      <div class="form-field"><label>Start Date *</label><input type="date" name="start_date" required value="${poll.start_date || ''}" /></div>
      <div class="form-field"><label>End Date</label><input type="date" name="end_date" value="${poll.end_date || ''}" /></div>
      <div class="form-field"><label>From *</label><input type="time" name="from_time" required value="${poll.from_time || '09:00'}" /></div>
      <div class="form-field"><label>To *</label><input type="time" name="to_time" required value="${poll.to_time || '18:00'}" /></div>
      <div class="form-field"><label>Slot Length</label>
        <select name="slot_minutes">
          ${[15, 30, 60].map(m => `<option value="${m}" ${(poll.slot_minutes || 30) === m ? 'selected' : ''}>${m} min</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function readPollForm(form) {
  return {
    title: form.elements['title'].value.trim(),
    description: form.elements['description'].value.trim() || null,
    start_date: form.elements['start_date'].value,
    end_date: form.elements['end_date'].value || null,
    from_time: form.elements['from_time'].value,
    to_time: form.elements['to_time'].value,
    slot_minutes: Number(form.elements['slot_minutes'].value)
  };
}

function pollSlotsFor(params) {
  return generateSlots(params.start_date, params.end_date, params.from_time, params.to_time, params.slot_minutes);
}

// Renders the poll's availability as a When2Meet-style grid: one column per day,
// one row per candidate time. Cell shading intensity reflects how many people are
// available; a "Select all" toggle per day lets someone who's free most of the time
// mark the whole column at once and just uncheck the one slot they can't do.
function pollGridHTML(poll, closed) {
  const identity = getIdentity();
  const dates = [...new Set(poll.poll_slots.map(s => s.slot_date))].sort();
  const times = [...new Set(poll.poll_slots.map(s => s.slot_time))].sort();
  const byKey = {};
  poll.poll_slots.forEach(s => { byKey[`${s.slot_date}|${s.slot_time}`] = s; });

  const headerCells = dates.map(d => {
    const dd = new Date(`${d}T00:00:00`);
    const daySlots = poll.poll_slots.filter(s => s.slot_date === d);
    const allMine = daySlots.length > 0 && daySlots.every(s => (s.poll_responses || []).some(r => r.person === identity));
    return `
      <th class="poll-grid-daycol">
        <div class="poll-grid-day-label"><span>${DAY_ABBR[dd.getDay()]}</span><span>${dd.getDate()}</span></div>
        ${!closed ? `<button type="button" class="poll-grid-day-toggle" data-day-toggle="${d}">${allMine ? 'Clear' : 'Select all'}</button>` : ''}
      </th>
    `;
  }).join('');

  const bodyRows = times.map(t => {
    const cells = dates.map(d => {
      const slot = byKey[`${d}|${t}`];
      if (!slot) return `<td class="poll-grid-cell-wrap"></td>`;
      const responses = slot.poll_responses || [];
      const mine = responses.some(r => r.person === identity);
      const count = responses.length;
      // Only tint the cell once someone's responded — an inline background-color of
      // "transparent" would otherwise beat the class's neutral grey box entirely.
      const style = count > 0
        ? `style="background-color: rgba(var(--accent-rgb), ${Math.min(0.18 + 0.7 * (count / TEAM_MEMBERS.length), 0.88)});"`
        : '';
      const names = responses.map(r => r.person).join(', ') || 'No one yet';
      return `
        <td class="poll-grid-cell-wrap">
          <button type="button" class="poll-grid-cell ${mine ? 'mine' : ''}" data-slot-id="${slot.id}" ${closed ? 'disabled' : ''}
            ${style} title="${escapeHtml(names)}">${count > 0 ? count : ''}</button>
        </td>
      `;
    }).join('');
    return `<tr><td class="poll-grid-time">${formatTime(t)}</td>${cells}</tr>`;
  }).join('');

  return `
    <div class="poll-grid-wrap">
      <table class="poll-grid">
        <thead><tr><th class="poll-grid-corner"></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function renderPolls() {
  const el = document.getElementById('poll-list');
  // Scheduled polls already produced a real Meeting — they're historical, not active.
  const active = polls.filter(p => p.status !== 'scheduled');
  if (!active.length) {
    el.innerHTML = `<div class="empty-state"><div class="em-title">No polls yet</div><p>Start one to find a time that works for everyone.</p></div>`;
    return;
  }

  el.innerHTML = active.map(poll => {
    const closed = poll.status === 'closed';
    const top = pollResults(poll).slice(0, 3);

    return `
      <div class="poll-card ${closed ? 'closed' : ''}" data-poll-id="${poll.id}">
        <div class="poll-head">
          <div>
            <div class="poll-title">${escapeHtml(poll.title)}</div>
            ${poll.description ? `<div class="poll-desc">${escapeHtml(poll.description)}</div>` : ''}
          </div>
          <span class="badge ${closed ? 'badge-muted' : 'badge-green'}">${closed ? 'Closed' : 'Open'}</span>
        </div>
        ${top.length ? `
          <div class="poll-top">
            <span class="poll-top-label">Top availability</span>
            ${top.map(r => `<span class="poll-top-chip" title="${escapeHtml(r.names.join(', '))}">${escapeHtml(formatSlot(r.slot))} · ${r.count}/${TEAM_MEMBERS.length}</span>`).join('')}
          </div>
        ` : ''}
        ${pollGridHTML(poll, closed)}
        <div class="poll-actions">
          <button type="button" class="btn-text" data-poll-edit="${poll.id}">Edit</button>
          <button type="button" class="btn-text" data-poll-toggle-close="${poll.id}">${closed ? 'Reopen' : 'Close'}</button>
          <button type="button" class="btn-danger-text" data-poll-delete="${poll.id}">Delete</button>
          <button type="button" class="btn-primary" data-poll-schedule="${poll.id}">Schedule Meeting</button>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('[data-slot-id]').forEach(btn => {
    btn.addEventListener('click', () => toggleResponse(btn.dataset.slotId));
  });
  el.querySelectorAll('[data-day-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleWholeDay(btn.closest('.poll-card').dataset.pollId, btn.dataset.dayToggle));
  });
  el.querySelectorAll('[data-poll-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditPollModal(polls.find(p => p.id === btn.dataset.pollEdit)));
  });
  el.querySelectorAll('[data-poll-toggle-close]').forEach(btn => {
    btn.addEventListener('click', () => togglePollClosed(btn.dataset.pollToggleClose));
  });
  el.querySelectorAll('[data-poll-delete]').forEach(btn => {
    btn.addEventListener('click', () => deletePoll(btn.dataset.pollDelete));
  });
  el.querySelectorAll('[data-poll-schedule]').forEach(btn => {
    btn.addEventListener('click', () => openScheduleMeetingModal(polls.find(p => p.id === btn.dataset.pollSchedule)));
  });
}

async function toggleResponse(slotId) {
  const identity = getIdentity();
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

// Selects (or, if already fully selected, clears) every slot in one day for the
// current user in a single action — quicker than clicking each slot individually
// when someone is free most of the day and just needs to exclude one slot.
async function toggleWholeDay(pollId, dateStr) {
  const identity = getIdentity();
  const poll = polls.find(p => p.id === pollId);
  if (!poll) return;
  const daySlots = poll.poll_slots.filter(s => s.slot_date === dateStr);
  const mineIds = daySlots.filter(s => (s.poll_responses || []).some(r => r.person === identity)).map(s => s.id);
  const allMine = daySlots.length > 0 && mineIds.length === daySlots.length;

  if (allMine) {
    await supabase.from('poll_responses').delete().eq('person', identity).in('slot_id', daySlots.map(s => s.id));
  } else {
    const toInsert = daySlots.filter(s => !mineIds.includes(s.id)).map(s => ({ slot_id: s.id, person: identity, created_at: new Date().toISOString() }));
    if (toInsert.length) await supabase.from('poll_responses').insert(toInsert);
  }
  await loadPolls();
  renderPolls();
}

async function togglePollClosed(pollId) {
  const poll = polls.find(p => p.id === pollId);
  if (!poll) return;
  const newStatus = poll.status === 'closed' ? 'open' : 'closed';
  await supabase.from('meeting_polls').update({ status: newStatus }).eq('id', pollId);
  showToast(newStatus === 'closed' ? 'Poll closed.' : 'Poll reopened.');
  await loadPolls();
  renderPolls();
}

async function deletePoll(pollId) {
  if (!confirm('Delete this poll? Its availability responses will be lost. This cannot be undone.')) return;
  await supabase.from('meeting_polls').delete().eq('id', pollId);
  showToast('Poll deleted.');
  await loadPolls();
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
            ${pollFieldsHTML()}
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

  function updatePreview() {
    const count = pollSlotsFor(readPollForm(form)).length;
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

    const params = readPollForm(form);
    const slots = pollSlotsFor(params);

    if (!slots.length) {
      errorEl.textContent = 'No candidate slots in that range. Check your dates and times.';
      errorEl.hidden = false;
      return;
    }
    if (slots.length > 300) {
      errorEl.textContent = `That range would create ${slots.length} slots. Narrow the dates, hours, or use a longer slot length.`;
      errorEl.hidden = false;
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    const { data: poll, error } = await supabase
      .from('meeting_polls')
      .insert({ ...params, status: 'open', created_by: getIdentity(), created_at: new Date().toISOString() })
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

function openEditPollModal(poll) {
  const root = document.getElementById('edit-poll-root');
  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 560px;">
        <div class="form-modal-head"><h2>Edit Poll</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <form id="form">
          <div class="form-modal-body">
            <div class="form-error" id="form-error" hidden></div>
            ${pollFieldsHTML(poll)}
            <div class="settings-hint" id="slot-preview" style="margin: 8px 0 0;"></div>
          </div>
          <div class="form-modal-foot">
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

  const form = document.getElementById('form');
  const preview = document.getElementById('slot-preview');

  function diff() {
    const newSlots = pollSlotsFor(readPollForm(form));
    const newKeys = new Set(newSlots.map(s => `${s.slot_date}|${s.slot_time}`));
    const existingKeys = new Set(poll.poll_slots.map(s => `${s.slot_date}|${s.slot_time}`));
    const toAdd = newSlots.filter(s => !existingKeys.has(`${s.slot_date}|${s.slot_time}`));
    const toRemove = poll.poll_slots.filter(s => !newKeys.has(`${s.slot_date}|${s.slot_time}`));
    const responsesLost = toRemove.reduce((sum, s) => sum + (s.poll_responses || []).length, 0);
    return { toAdd, toRemove, responsesLost };
  }

  function updatePreview() {
    const { toAdd, toRemove, responsesLost } = diff();
    const parts = [];
    if (toAdd.length) parts.push(`+${toAdd.length} new slot${toAdd.length === 1 ? '' : 's'}`);
    if (toRemove.length) parts.push(`-${toRemove.length} slot${toRemove.length === 1 ? '' : 's'}${responsesLost ? ` (${responsesLost} response${responsesLost === 1 ? '' : 's'} lost)` : ''}`);
    preview.textContent = parts.length ? parts.join(' · ') : 'No change to candidate slots.';
  }
  updatePreview();
  ['start_date', 'end_date', 'from_time', 'to_time', 'slot_minutes'].forEach(name => {
    form.elements[name].addEventListener('input', updatePreview);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const params = readPollForm(form);
    const { toAdd, toRemove, responsesLost } = diff();

    if (toRemove.length) {
      const msg = responsesLost
        ? `This change removes ${toRemove.length} slot${toRemove.length === 1 ? '' : 's'} with ${responsesLost} response${responsesLost === 1 ? '' : 's'} already recorded. Those responses will be lost. Continue?`
        : `This change removes ${toRemove.length} candidate slot${toRemove.length === 1 ? '' : 's'}. Continue?`;
      if (!confirm(msg)) return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const { error: updateError } = await supabase.from('meeting_polls').update(params).eq('id', poll.id);
    if (updateError) {
      errorEl.textContent = `Couldn't save poll: ${updateError.message}`;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
      return;
    }

    if (toRemove.length) await supabase.from('poll_slots').delete().in('id', toRemove.map(s => s.id));
    if (toAdd.length) await supabase.from('poll_slots').insert(toAdd.map(s => ({ ...s, poll_id: poll.id })));

    close();
    showToast('Poll updated.');
    await loadPolls();
    renderPolls();
  });
}

function openScheduleMeetingModal(poll) {
  const root = document.getElementById('schedule-meeting-root');
  const top = pollResults(poll).slice(0, 5);

  root.innerHTML = `
    <div class="modal-overlay form-overlay" id="modal">
      <div class="form-modal" style="max-width: 480px;">
        <div class="form-modal-head"><h2>Schedule Meeting</h2><button type="button" class="form-modal-close" id="close-btn">&times;</button></div>
        <div class="form-modal-body">
          <p class="settings-hint" style="margin-bottom:16px;">These are only suggestions from the poll's availability. The date and time are confirmed on the next step.</p>
          ${top.length ? `
            <div class="form-section-label">Recommended times</div>
            <div class="schedule-suggestions">
              ${top.map((r, i) => `
                <button type="button" class="schedule-suggestion" data-slot-id="${r.slot.id}">
                  <span class="schedule-suggestion-rank">${i + 1}</span>
                  <span class="schedule-suggestion-main">
                    <span class="schedule-suggestion-label">${escapeHtml(formatSlot(r.slot))} <span class="schedule-suggestion-count">· ${r.count}/${TEAM_MEMBERS.length} available</span></span>
                    <span class="schedule-suggestion-names">${escapeHtml(r.names.join(', '))}</span>
                  </span>
                </button>
              `).join('')}
            </div>
          ` : `<p class="settings-hint">No one has submitted availability yet. You can still pick a custom time.</p>`}
        </div>
        <div class="form-modal-foot">
          <button type="button" class="btn-text" id="cancel-btn">Cancel</button>
          <button type="button" class="btn-outline" id="custom-time-btn">Choose a custom time</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal');
  const close = () => root.innerHTML = '';
  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const proceed = (slot) => {
    close();
    const prefill = slot ? {
      title: poll.title,
      meeting_date: slot.slot_date,
      meeting_time: slot.slot_time,
      end_time: poll.slot_minutes ? addMinutes(slot.slot_time, poll.slot_minutes) : '',
      notes: `Scheduled from poll: ${poll.title}`
    } : { title: poll.title, notes: `Scheduled from poll: ${poll.title}` };

    openAddMeetingModal(prefill, async (newMeeting) => {
      await supabase.from('meeting_polls').update({
        status: 'scheduled',
        scheduled_meeting_id: newMeeting.id,
        chosen_slot_id: slot ? slot.id : null
      }).eq('id', poll.id);
      await loadPolls();
      renderPolls();
    });
  };

  root.querySelectorAll('.schedule-suggestion').forEach(btn => {
    btn.addEventListener('click', () => proceed(top.find(r => r.slot.id === btn.dataset.slotId)?.slot));
  });
  document.getElementById('custom-time-btn').addEventListener('click', () => proceed(null));
}

// ---------------- Tasks ----------------

async function loadTasks() {
  const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
  tasks = data || [];
}

function assigneesHTML(selected = []) {
  return checkboxRowWithAllHTML('assignee', TEAM_MEMBERS, selected);
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
    const compact = !isNearTerm(t.due_date);
    // Color (status pill + type badge) only for this-week/next-week tasks — distant,
    // compact tasks stay neutral grey so it's obvious at a glance what's current.
    const statusClass = compact ? '' : `status-${t.status}`;
    const typeBadgeClass = (!compact && t.task_type === 'Deliverable') ? 'badge-yellow' : 'badge-muted';
    return `
      <div class="task-row ${cancelled ? 'cancelled' : ''} ${compact ? 'compact' : ''}" data-task-id="${t.id}">
        <span class="badge ${typeBadgeClass}">${escapeHtml(t.task_type || 'Task')}</span>
        <div class="task-main" data-task-open="${t.id}">
          <div class="task-title">${escapeHtml(t.title)}${t.recurrence_id ? ' <span class="badge badge-muted" style="margin-left:6px;">Recurring</span>' : ''}</div>
          <div class="task-assignees">${(t.assignees && t.assignees.length) ? escapeHtml(t.assignees.join(', ')) : 'Unassigned'}</div>
        </div>
        <div class="task-due">${t.due_date ? `${t.due_date}${dr ? ` · ${dr.text}` : ''}` : 'No due date'}</div>
        <select class="task-status-select ${statusClass}" data-task-status="${t.id}">${statusOptions}</select>
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
      await supabase.from('tasks').update({
        status: sel.value,
        completed_at: sel.value === 'done' ? new Date().toISOString() : null
      }).eq('id', sel.dataset.taskStatus);
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
            ${assigneesHTML()}
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
  wireSelectAllToggle(document.getElementById('form'));

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    const data = readFormValues(e.target, TASK_FIELDS);
    data.assignees = [...e.target.querySelectorAll('input[name="assignee"]:checked')].map(cb => cb.value);
    data.created_by = getIdentity();
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
    ? `<p class="settings-hint" style="margin: -6px 0 14px;">Due date can only be changed for a single occurrence. Editing "${scope === 'series' ? 'entire series' : 'this and following'}" applies to title, description, status, task type and assignees only.</p>`
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
            ${assigneesHTML(task.assignees || [])}
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
  wireSelectAllToggle(document.getElementById('form'));

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
    if ('status' in payload) payload.completed_at = payload.status === 'done' ? new Date().toISOString() : null;

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

document.getElementById('btn-add-meeting').addEventListener('click', () => openAddMeetingModal());
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
