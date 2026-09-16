import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { escapeHtml } from './fields.js';
import { fieldPlainText } from './richText.js';
import { loadQuestions, renderQuestionsSection, openQuestionModal, activeQuestions } from './questions.js';
import { loadNextSteps, renderNextStepsSection, openNextStepModal, activeNextSteps } from './next-steps.js';

await initNav('reports');

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PROJECT_START = new Date(2026, 8, 14); // Monday 14 Sep 2026 — used only to number weeks

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

function weekLabel(periodStart, periodEnd) {
  const start = new Date(periodStart + 'T00:00:00');
  const weekNum = Math.round((start - PROJECT_START) / (7 * 86400000)) + 1;
  const prefix = weekNum >= 1 ? `Week ${weekNum} — ` : '';
  return `${prefix}${shortDate(periodStart)} – ${shortDate(periodEnd)}`;
}

function currentWeek() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: toDateStr(monday), end: toDateStr(sunday) };
}

// ---------------- Section builders ----------------
// Progress reads straight from each table's own created_at/updated_at/completed_at —
// no separate activity-log table. Each bucket becomes one readable sentence, not a
// raw per-row dump, so the section stays copy-paste friendly.

function pluralize(n, noun) { return `${n} ${noun}${n === 1 ? '' : 's'}`; }

// Progress is a pulse check only — counts, no per-item detail. Meetings and Features
// are deliberately absent: Meetings get their own count+list below (not represented
// twice), and Features don't carry enough weekly-level signal to earn a line here.
function buildProgressSection(counts) {
  const lines = [];
  if (counts.programmesAdded) lines.push(`• ${pluralize(counts.programmesAdded, 'new loyalty programme')} added.`);
  if (counts.programmesUpdated) lines.push(`• ${pluralize(counts.programmesUpdated, 'programme')} updated with new information.`);
  if (counts.favouritesAdded) lines.push(`• ${pluralize(counts.favouritesAdded, 'favourite')} added to the team's benchmark of interesting mechanisms and benefits.`);
  if (counts.insightsAdded) lines.push(`• ${pluralize(counts.insightsAdded, 'insight')} added to Data & Insights.`);
  if (counts.tasksCompleted) lines.push(`• ${pluralize(counts.tasksCompleted, 'task/deliverable')} completed.`);
  return lines.length ? lines.join('\n') : '(No recorded activity this period.)';
}

function buildQuestionsSection(active) {
  const questions = active.filter(q => q.item_type === 'question');
  const support = active.filter(q => q.item_type === 'support');
  const lines = [];
  if (questions.length) {
    lines.push('Questions:');
    questions.forEach(q => lines.push(`• ${q.question_text}`));
  }
  if (support.length) {
    if (lines.length) lines.push('');
    lines.push('Support Needed:');
    support.forEach(q => lines.push(`• ${q.question_text}`));
  }
  return lines.length ? lines.join('\n') : '(Nothing open.)';
}

function buildNextStepsSection(steps) {
  return steps.length ? steps.map(s => `• ${s.text}`).join('\n') : '(Nothing planned yet.)';
}

// Favourites are the team's curated picks (not every liked row is a full mechanism —
// target_label says what specifically was liked), so the list carries real value for
// slide-building: what did we find worth highlighting, and why.
function buildFavouritesSection(likes) {
  const header = `${pluralize(likes.length, 'Favourite')}`;
  if (!likes.length) return `${header}\n\n(None added this period.)`;
  const lines = likes.map(l => {
    const programme = l.programmes?.programme_name || 'Unknown programme';
    const why = l.description ? ` — ${l.description}` : '';
    return `• ${programme} — ${l.target_label}${why}`;
  });
  return [header, '', ...lines].join('\n');
}

// Title + source only — enough to index what was found and where to look it up. The
// full insight body/detail stays in Data & Insights, not duplicated here.
function buildInsightsSection(figures) {
  const header = `${pluralize(figures.length, 'Insight')} Added`;
  if (!figures.length) return `${header}\n\n(None added this period.)`;
  const lines = figures.map(f => {
    const title = f.title || fieldPlainText(f.insight_text) || 'Untitled insight';
    const source = f.sources ? (f.sources.source_name || f.sources.citation_tag) : null;
    return `• ${title}${source ? ` — ${source}` : ''}`;
  });
  return [header, '', ...lines].join('\n');
}

function buildMeetingsSection(meetings) {
  const held = meetings.filter(m => m.status !== 'cancelled');
  const header = `${pluralize(held.length, 'Meeting')} Held`;
  if (!meetings.length) return `${header}\n\n(No meetings this period.)`;
  const lines = meetings.map(m => {
    const time = m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : '';
    const status = m.status === 'cancelled' ? ' [Cancelled]' : '';
    const notes = m.notes ? `\n  Notes: ${m.notes}` : '';
    return `• ${m.meeting_date}${time} — ${m.title} (${m.meeting_type})${status}${notes}`;
  });
  return [header, '', ...lines].join('\n');
}

// "In Process" is a snapshot of current status, not a period-bound event (tasks have
// no "started_at") — it's reported as a count only, alongside the completed list.
function buildTasksSection(doneTasks, inProgressCount) {
  const header = `${pluralize(doneTasks.length, 'Task')} Completed · ${pluralize(inProgressCount, 'Task')} in Process`;
  if (!doneTasks.length) return `${header}\n\n(Nothing completed this period.)`;
  const lines = doneTasks.map(t => `• ${t.title}`);
  return [header, '', ...lines].join('\n');
}

// ---------------- Generate ----------------

async function generateReport(periodStart, periodEnd) {
  const rangeEndExclusive = addDays(periodEnd, 1); // timestamptz columns: [start, end+1)

  const [
    { data: newProgrammes }, { data: updatedProgrammes },
    { data: newLikes }, { data: newInsights },
    { data: meetings },
    { data: doneTasks }, { count: inProgressCount },
    allQuestions, allNextSteps
  ] = await Promise.all([
    supabase.from('programmes').select('id, created_at').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('programmes').select('id, created_at, updated_at').gte('updated_at', periodStart).lt('updated_at', rangeEndExclusive),
    supabase.from('likes').select('*, programmes(programme_name)').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('figures').select('*, sources(source_name, citation_tag)').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('meetings').select('*').gte('meeting_date', periodStart).lte('meeting_date', periodEnd).order('meeting_date'),
    supabase.from('tasks').select('*').in('task_type', ['Task', 'Deliverable']).gte('completed_at', periodStart).lt('completed_at', rangeEndExclusive),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    loadQuestions(),
    loadNextSteps()
  ]);

  // A programme created this period will also carry an updated_at from that same save —
  // don't double-count it as "updated" too.
  const updatedExcludingNew = (updatedProgrammes || []).filter(p => p.updated_at !== p.created_at && !(newProgrammes || []).some(np => np.id === p.id));

  const counts = {
    programmesAdded: (newProgrammes || []).length,
    programmesUpdated: updatedExcludingNew.length,
    favouritesAdded: (newLikes || []).length,
    insightsAdded: (newInsights || []).length,
    tasksCompleted: (doneTasks || []).length
  };

  return {
    progress: buildProgressSection(counts),
    favourites: buildFavouritesSection(newLikes || []),
    insights: buildInsightsSection(newInsights || []),
    meetings: buildMeetingsSection(meetings || []),
    tasks: buildTasksSection(doneTasks || [], inProgressCount || 0),
    questions: buildQuestionsSection(activeQuestions(allQuestions)),
    next_steps: buildNextStepsSection(activeNextSteps(allNextSteps))
  };
}

// ---------------- UI wiring ----------------

const startInput = document.getElementById('period-start');
const endInput = document.getElementById('period-end');
const { start, end } = currentWeek();
startInput.value = start;
endInput.value = end;

const sectionEls = {
  progress: document.getElementById('section-progress'),
  favourites: document.getElementById('section-favourites'),
  insights: document.getElementById('section-insights'),
  meetings: document.getElementById('section-meetings'),
  tasks: document.getElementById('section-tasks'),
  questions: document.getElementById('section-questions'),
  next_steps: document.getElementById('section-next-steps')
};

let currentPeriod = null;

function fillSections(content) {
  Object.entries(sectionEls).forEach(([key, el]) => { el.value = content[key] || ''; });
}

document.getElementById('btn-generate').addEventListener('click', async () => {
  const periodStart = startInput.value;
  const periodEnd = endInput.value;
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    showToast('Pick a valid date range first.', true);
    return;
  }

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.textContent = 'Generating…';

  const content = await generateReport(periodStart, periodEnd);
  fillSections(content);
  currentPeriod = { start: periodStart, end: periodEnd };
  document.getElementById('report-period-label').textContent = weekLabel(periodStart, periodEnd);
  document.getElementById('report-sections').hidden = false;

  btn.disabled = false;
  btn.textContent = 'Generate Report';
});

document.getElementById('btn-save-report').addEventListener('click', async () => {
  if (!currentPeriod) return;
  const content = Object.fromEntries(Object.entries(sectionEls).map(([key, el]) => [key, el.value]));

  const { error } = await supabase.from('weekly_reports').upsert({
    period_start: currentPeriod.start,
    period_end: currentPeriod.end,
    content,
    created_by: getIdentity(),
    created_at: new Date().toISOString()
  }, { onConflict: 'period_start,period_end' });

  if (error) {
    showToast(`Couldn't save report: ${error.message}`, true);
    return;
  }
  showToast('Report saved.');
  loadSavedReports();
});

document.getElementById('btn-copy-report').addEventListener('click', async () => {
  if (!currentPeriod) return;
  const doc = [
    `WEEKLY REPORT`,
    weekLabel(currentPeriod.start, currentPeriod.end),
    '',
    '01 — Progress', sectionEls.progress.value,
    '',
    '02 — Favourites', sectionEls.favourites.value,
    '',
    '03 — Insights', sectionEls.insights.value,
    '',
    '04 — Meetings & Discussions', sectionEls.meetings.value,
    '',
    '05 — Tasks', sectionEls.tasks.value,
    '',
    '06 — Questions & Support Needed', sectionEls.questions.value,
    '',
    '07 — Next Steps', sectionEls.next_steps.value
  ].join('\n');

  try {
    await navigator.clipboard.writeText(doc);
    showToast('Report copied to clipboard.');
  } catch {
    showToast('Could not copy automatically — select the sections manually.', true);
  }
});

async function loadSavedReports() {
  const el = document.getElementById('saved-reports-list');
  const { data, error } = await supabase.from('weekly_reports').select('*').order('period_start', { ascending: false });

  if (error) {
    el.innerHTML = `<div class="error-state">Couldn't load saved reports: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!data || !data.length) {
    el.innerHTML = `<div class="empty-state"><div class="em-title">No saved reports yet</div><p>Generate one above, then Save Report to keep a copy of that week.</p></div>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="list-row" data-report-id="${r.id}" style="cursor:pointer;">
      <div class="list-row-top">
        <div class="list-row-title">${escapeHtml(weekLabel(r.period_start, r.period_end))}</div>
        ${r.created_by ? `<span class="badge badge-muted">Saved by ${escapeHtml(r.created_by)}</span>` : ''}
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-report-id]').forEach(row => {
    row.addEventListener('click', () => {
      const report = data.find(r => r.id === row.dataset.reportId);
      startInput.value = report.period_start;
      endInput.value = report.period_end;
      fillSections(report.content || {});
      currentPeriod = { start: report.period_start, end: report.period_end };
      document.getElementById('report-period-label').textContent = weekLabel(report.period_start, report.period_end);
      document.getElementById('report-sections').hidden = false;
      document.getElementById('report-sections').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ---------------- Questions & Support Needed (manual) ----------------

async function reloadQuestions() {
  const qs = await loadQuestions();
  renderQuestionsSection(document.getElementById('question-list'), qs, { onChange: reloadQuestions });
}

document.getElementById('btn-add-question').addEventListener('click', () => openQuestionModal({ onChange: reloadQuestions }));

// ---------------- Next Steps (manual, not Tasks) ----------------

async function reloadNextSteps() {
  const steps = await loadNextSteps();
  renderNextStepsSection(document.getElementById('next-steps-list'), steps, { onChange: reloadNextSteps });
}

document.getElementById('btn-add-next-step').addEventListener('click', () => openNextStepModal({ onChange: reloadNextSteps }));

reloadQuestions();
reloadNextSteps();
loadSavedReports();
