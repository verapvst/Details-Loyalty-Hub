// Analysis tab — the one chart "card" (title + toolbar + body) every Lab uses, so
// Expand / Download PNG / Copy Excel Data / Download XLSX / View Data / Save Analysis
// behave identically everywhere (see assets/charts.js for the actual export logic).
import { escapeHtml } from './fields.js';
import { showToast } from './app.js';
import { svgToPngBlob, downloadBlob, copyTableToClipboard, downloadCSV, downloadXLSX } from './charts.js';

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'chart';
}

// Every toolbar/footer action button is icon + a short label (never an icon alone) —
// easier to scan at a glance than a row of bare glyphs.
function tbBtnHTML(action, icon, label, extraClass = '') {
  return `<button type="button" class="chart-tb-btn ${extraClass}" data-action="${action}"><span class="chart-tb-icon">${icon}</span>${escapeHtml(label)}</button>`;
}

function getModalRoot() {
  let root = document.getElementById('analysis-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'analysis-modal-root';
    document.body.appendChild(root);
  }
  return root;
}
function closeModal() { getModalRoot().innerHTML = ''; }

function renderDataTable(headers, rows) {
  return `
    <table class="data-table">
      <thead><tr>${headers.map((h, i) => `<th data-col="${i}">${escapeHtml(String(h))}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v === null || v === undefined ? '' : String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function wireTableSort(root, headers, rows) {
  let sortState = { col: null, dir: 1 };
  root.querySelectorAll('.data-table th').forEach((th) => {
    th.addEventListener('click', () => {
      const ci = Number(th.dataset.col);
      sortState = sortState.col === ci ? { col: ci, dir: -sortState.dir } : { col: ci, dir: 1 };
      const sorted = [...rows].sort((a, b) => {
        const av = a[ci], bv = b[ci];
        const an = Number(av), bn = Number(bv);
        const bothNumeric = av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn);
        if (bothNumeric) return (an - bn) * sortState.dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * sortState.dir;
      });
      const tbody = root.querySelector('.data-table tbody');
      tbody.innerHTML = sorted.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v === null || v === undefined ? '' : String(v))}</td>`).join('')}</tr>`).join('');
    });
  });
}

function openDataModal({ title, headers, rows }) {
  const root = getModalRoot();
  root.innerHTML = `
    <div class="modal-overlay" id="data-modal-overlay">
      <div class="data-modal">
        <div class="data-modal-head">
          <h2>${escapeHtml(title)} — Data</h2>
          <button type="button" class="form-modal-close" id="data-modal-close">&times;</button>
        </div>
        <div class="data-modal-body">${renderDataTable(headers, rows)}</div>
        <div class="data-modal-foot">
          <span class="data-modal-hint">Click a column header to sort.</span>
          ${tbBtnHTML('copy', '⧉', 'Copy')}
          ${tbBtnHTML('csv', '⭳', 'CSV')}
          <button type="button" class="btn-outline" id="data-close2">Close</button>
        </div>
      </div>
    </div>`;
  const overlay = document.getElementById('data-modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('data-modal-close').addEventListener('click', closeModal);
  document.getElementById('data-close2').addEventListener('click', closeModal);
  root.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    const ok = await copyTableToClipboard(headers, rows);
    showToast(ok ? 'Data copied — paste into Excel.' : 'Could not copy to clipboard.', !ok);
  });
  root.querySelector('[data-action="csv"]').addEventListener('click', () => downloadCSV(headers, rows, `${slug(title)}.csv`));
  wireTableSort(root, headers, rows);
}

// The click-through "which programmes is this?" modal — every clickable mark on the
// page (a KPI card, a bar, a heatmap cell, a launch-trend point) opens this with the
// exact subset of programmes behind that number, so where a number comes from is
// never more than one click away.
export function openProgrammeListModal({ title, subtitle, programmes }) {
  const root = getModalRoot();
  const rows = [...programmes].sort((a, b) => (a.programme_name || '').localeCompare(b.programme_name || ''));
  root.innerHTML = `
    <div class="modal-overlay" id="prog-list-overlay">
      <div class="data-modal">
        <div class="data-modal-head">
          <div>
            <h2>${escapeHtml(title)}</h2>
            ${subtitle ? `<div class="chart-modal-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          </div>
          <button type="button" class="form-modal-close" id="prog-list-close">&times;</button>
        </div>
        <div class="data-modal-body">
          <div class="prog-list-count">${rows.length} programme(s)</div>
          <div class="prog-list">
            ${rows.length ? rows.map(p => `
              <a class="prog-list-row" href="programme.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">
                <span class="prog-list-name">${escapeHtml(p.programme_name || 'Untitled programme')}</span>
                <span class="prog-list-company">${escapeHtml(p.company || '')}</span>
              </a>
            `).join('') : '<div class="drilldown-empty">No programmes match.</div>'}
          </div>
        </div>
        <div class="data-modal-foot">
          <button type="button" class="btn-outline" id="prog-list-close2">Close</button>
        </div>
      </div>
    </div>`;
  const overlay = document.getElementById('prog-list-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('prog-list-close').addEventListener('click', closeModal);
  document.getElementById('prog-list-close2').addEventListener('click', closeModal);
}

function openExpandModal({ title, subtitle, buildChart }) {
  const root = getModalRoot();
  root.innerHTML = `
    <div class="modal-overlay chart-modal-overlay" id="chart-modal-overlay">
      <div class="chart-modal">
        <div class="chart-modal-head">
          <div>
            <div class="chart-modal-title">${escapeHtml(title)}</div>
            ${subtitle ? `<div class="chart-modal-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          </div>
          <button type="button" class="form-modal-close" id="chart-modal-close">&times;</button>
        </div>
        <div class="chart-modal-body" id="chart-modal-body"></div>
      </div>
    </div>`;
  const overlay = document.getElementById('chart-modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('chart-modal-close').addEventListener('click', closeModal);
  buildChart(document.getElementById('chart-modal-body'), { large: true });
}

function openSaveModal(onSave) {
  const root = getModalRoot();
  root.innerHTML = `
    <div class="modal-overlay" id="save-modal-overlay">
      <div class="save-modal">
        <h2>Save Analysis</h2>
        <p>Give this configuration a name so you can reopen it exactly as it is now.</p>
        <input type="text" id="save-name-input" placeholder="e.g. Launch Trends — Positioning Evolution" />
        <div class="save-modal-foot">
          <button type="button" class="btn-text" id="save-cancel">Cancel</button>
          <button type="button" class="btn-primary" id="save-confirm">Save</button>
        </div>
      </div>
    </div>`;
  const overlay = document.getElementById('save-modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('save-cancel').addEventListener('click', closeModal);
  const input = document.getElementById('save-name-input');
  input.focus();
  const confirm = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const btn = document.getElementById('save-confirm');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await onSave(name);
      closeModal();
      showToast('Analysis saved.');
    } catch (e) {
      showToast(e.message || 'Could not save this analysis.', true);
      btn.disabled = false; btn.textContent = 'Save';
    }
  };
  document.getElementById('save-confirm').addEventListener('click', confirm);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
}

// opts: { title, subtitle, note, buildChart(container,{large}) => svgEl, getTableData() => {headers,rows}, filename, onSave? }
export function mountChartCard(container, opts) {
  const { title, subtitle, note, buildChart, getTableData, filename, onSave } = opts;
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-card-head">
        <div class="chart-card-titles">
          <div class="chart-card-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="chart-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div class="chart-toolbar">
          ${tbBtnHTML('view-data', '▤', 'Data')}
          ${tbBtnHTML('expand', '⤢', 'Expand')}
          ${tbBtnHTML('png', '⭳', 'PNG')}
          ${tbBtnHTML('xlsx', '▦', 'XLSX')}
          ${tbBtnHTML('copy', '⧉', 'Copy')}
          ${onSave ? tbBtnHTML('save', '☆', 'Save', 'chart-tb-save') : ''}
        </div>
      </div>
      <div class="chart-card-body"></div>
      ${note ? `<div class="chart-card-note">${escapeHtml(note)}</div>` : ''}
    </div>
  `;
  const body = container.querySelector('.chart-card-body');
  const svg = buildChart(body, { large: false });

  container.querySelector('[data-action="view-data"]').addEventListener('click', () => {
    const { headers, rows } = getTableData();
    openDataModal({ title, headers, rows });
  });
  container.querySelector('[data-action="expand"]').addEventListener('click', () => {
    openExpandModal({ title, subtitle, buildChart });
  });
  container.querySelector('[data-action="png"]').addEventListener('click', async () => {
    try {
      const blob = await svgToPngBlob(svg);
      downloadBlob(blob, `${slug(filename || title)}.png`);
    } catch {
      showToast('Could not export this chart as PNG.', true);
    }
  });
  container.querySelector('[data-action="xlsx"]').addEventListener('click', async () => {
    const { headers, rows } = getTableData();
    try { await downloadXLSX(headers, rows, `${slug(filename || title)}.xlsx`); }
    catch (e) { showToast(e.message || 'Could not export XLSX.', true); }
  });
  container.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    const { headers, rows } = getTableData();
    const ok = await copyTableToClipboard(headers, rows);
    showToast(ok ? 'Data copied — paste into Excel.' : 'Could not copy to clipboard.', !ok);
  });
  const saveBtn = container.querySelector('[data-action="save"]');
  if (saveBtn) saveBtn.addEventListener('click', () => openSaveModal(onSave));

  return svg;
}

export function showEmptyChartState(container, message) {
  container.innerHTML = `<div class="empty-state chart-empty-state"><div class="em-title">Nothing to show</div><p>${escapeHtml(message)}</p></div>`;
}
