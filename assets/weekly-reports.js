import { supabase } from './supabase.js';
import { initNav, showToast, getIdentity } from './app.js';
import { escapeHtml } from './fields.js';
import { loadQuestions } from './questions.js';

initNav('reports');

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

function daysBetween(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  return Math.round((end - start) / 86400000) + 1;
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

function bullets(lines) {
  return lines.length ? lines.join('\n') : '(Nothing to report this period.)';
}

// ---------------- Section builders ----------------

function buildResearchSection(programmes, features, sources) {
  const lines = [];
  if (programmes.length) {
    lines.push('New programmes added:');
    programmes.forEach(p => lines.push(`• ${p.programme_name}`));
  }
  if (features.length) {
    if (lines.length) lines.push('');
    lines.push('New features added:');
    features.forEach(f => lines.push(`• ${f.feature_name}${f.programmes?.programme_name ? ` (${f.programmes.programme_name})` : ''}`));
  }
  if (sources.length) {
    if (lines.length) lines.push('');
    lines.push('Research / sources added:');
    sources.forEach(s => lines.push(`• ${s.citation_tag}`));
  }
  return bullets(lines);
}

function buildAnalysisSection(likes, figures) {
  const lines = [];
  if (likes.length) {
    lines.push('Team insights (Favorites):');
    likes.forEach(l => {
      const who = l.programmes?.programme_name ? `${l.programmes.programme_name} — ${l.target_label}` : l.target_label;
      const desc = l.description ? `: ${l.description}` : '';
      const why = l.psychological_effect_notes ? ` (${l.psychological_effect_notes})` : '';
      lines.push(`• ${who}${desc}${why} — ${l.liked_by}`);
    });
  }
  if (figures.length) {
    if (lines.length) lines.push('');
    lines.push('Figures & Data added:');
    figures.forEach(f => lines.push(`• ${f.market ? f.market + ': ' : ''}${f.statistic} (${f.value})`));
  }
  return bullets(lines);
}

function buildMeetingsSection(meetings) {
  return bullets(meetings.map(m => {
    const time = m.meeting_time ? ` · ${m.meeting_time.slice(0, 5)}` : '';
    const status = m.status === 'cancelled' ? ' [Cancelled]' : '';
    const notes = m.notes ? `\n  Notes: ${m.notes}` : '';
    return `• ${m.meeting_date}${time} — ${m.title} (${m.meeting_type})${status}${notes}`;
  }));
}

function buildDeliverablesSection(tasks) {
  return bullets(tasks.map(t => `• ${t.title}${t.assignees?.length ? ` — ${t.assignees.join(', ')}` : ''} (due ${t.due_date})`));
}

function buildQuestionsSection(openQuestions) {
  return bullets(openQuestions.map(q => `• ${q.question_text}${q.asked_by ? ` — asked by ${q.asked_by}` : ''}`));
}

function buildNextStepsSection(tasks) {
  return bullets(tasks.map(t => `• ${t.title}${t.assignees?.length ? ` — ${t.assignees.join(', ')}` : ''} (due ${t.due_date})`));
}

// ---------------- Generate ----------------

async function generateReport(periodStart, periodEnd) {
  const rangeEndExclusive = addDays(periodEnd, 1); // timestamptz columns: [start, end+1)
  const nextStart = addDays(periodEnd, 1);
  const nextEnd = addDays(periodEnd, daysBetween(periodStart, periodEnd));

  const [
    { data: newProgrammes }, { data: newFeatures }, { data: newSources },
    { data: likes }, { data: figures },
    { data: meetings },
    { data: doneDeliverables },
    { data: nextTasks },
    allQuestions
  ] = await Promise.all([
    supabase.from('programmes').select('programme_name, created_at').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('programme_features').select('feature_name, created_at, programmes(programme_name)').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('sources').select('citation_tag, created_at').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('likes').select('target_label, description, psychological_effect_notes, liked_by, created_at, programmes(programme_name)').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('figures').select('statistic, value, market, created_at').gte('created_at', periodStart).lt('created_at', rangeEndExclusive),
    supabase.from('meetings').select('*').gte('meeting_date', periodStart).lte('meeting_date', periodEnd).order('meeting_date'),
    supabase.from('tasks').select('*').eq('task_type', 'Deliverable').eq('status', 'done').gte('due_date', periodStart).lte('due_date', periodEnd),
    supabase.from('tasks').select('*').gte('due_date', nextStart).lte('due_date', nextEnd).order('due_date'),
    loadQuestions()
  ]);

  return {
    research: buildResearchSection(newProgrammes || [], newFeatures || [], newSources || []),
    analysis: buildAnalysisSection(likes || [], figures || []),
    meetings: buildMeetingsSection(meetings || []),
    deliverables: buildDeliverablesSection(doneDeliverables || []),
    questions: buildQuestionsSection(allQuestions.filter(q => q.status === 'open')),
    next_steps: buildNextStepsSection(nextTasks || [])
  };
}

// ---------------- UI wiring ----------------

const startInput = document.getElementById('period-start');
const endInput = document.getElementById('period-end');
const { start, end } = currentWeek();
startInput.value = start;
endInput.value = end;

const sectionEls = {
  research: document.getElementById('section-research'),
  analysis: document.getElementById('section-analysis'),
  meetings: document.getElementById('section-meetings'),
  deliverables: document.getElementById('section-deliverables'),
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

loadSavedReports();
