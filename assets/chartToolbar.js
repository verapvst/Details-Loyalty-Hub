// My Laboratory — shared chart chrome: the Save + More toolbar every workspace uses,
// the View Data / Expand / Save modals, the programme-list drill-through modal, and a
// tiny "show once" tip helper. One implementation, reused by Explore/Relate/Tiers so
// the interaction is identical everywhere.
import { escapeHtml } from './fields.js';
import { showToast } from './app.js';
import { svgToPngBlob, downloadBlob, copyTableToClipboard, downloadCSV, downloadXLSX } from './charts.js';

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'chart';
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
          <button type="button" class="btn-text" id="data-copy">Copy</button>
          <button type="button" class="btn-text" id="data-csv">Download CSV</button>
          <button type="button" class="btn-outline" id="data-close2">Close</button>
        </div>
      </div>
    </div>`;
  const overlay = document.getElementById('data-modal-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('data-modal-close').addEventListener('click', closeModal);
  document.getElementById('data-close2').addEventListener('click', closeModal);
  document.getElementById('data-copy').addEventListener('click', async () => {
    const ok = await copyTableToClipboard(headers, rows);
    showToast(ok ? 'Data copied — paste into Excel.' : 'Could not copy to clipboard.', !ok);
  });
  document.getElementById('data-csv').addEventListener('click', () => downloadCSV(headers, rows, `${slug(title)}.csv`));
  wireTableSort(root, headers, rows);
}

// The click-through "which programmes is this?" modal — every clickable mark on the
// page (a bar, a heatmap cell, a launch-trend point, an orientation number) opens this
// with the exact subset of programmes behind that number.
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

// Save captures a title (editable, pre-filled from the analysis) and an optional
// one-line takeaway in one step — no separate standing notes form.
function openSaveModal({ defaultTitle, onSave }) {
  const root = getModalRoot();
  root.innerHTML = `
    <div class="modal-overlay" id="save-modal-overlay">
      <div class="save-modal">
        <h2>Save analysis</h2>
        <label class="save-modal-label">Title</label>
        <input type="text" id="save-name-input" value="${escapeHtml(defaultTitle || '')}" />
        <label class="save-modal-label">Takeaway <span class="save-modal-optional">(optional)</span></label>
        <textarea id="save-takeaway-input" rows="2" placeholder="What did you find?"></textarea>
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
  const takeawayInput = document.getElementById('save-takeaway-input');
  input.focus();
  input.select();
  const confirm = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const btn = document.getElementById('save-confirm');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await onSave(name, takeawayInput.value.trim());
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

// opts: { title, subtitle, note, buildChart(container,{large}) => svgEl,
//         getTableData() => {headers,rows}, filename, saveTitle, onSave(name,takeaway)? }
export function mountChartCard(container, opts) {
  const { title, subtitle, note, buildChart, getTableData, filename, saveTitle, onSave } = opts;
  container.innerHTML = `
    <div class="chart-card">
      <div class="chart-card-head">
        <div class="chart-card-titles">
          <div class="chart-card-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="chart-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div class="chart-actions">
          ${onSave ? `<button type="button" class="btn-save" data-action="save"><span class="btn-save-icon">☆</span>Save</button>` : ''}
          <div class="more-menu-wrap">
            <button type="button" class="btn-more" data-action="more-toggle" aria-label="More actions">•••</button>
            <div class="more-menu" id="more-menu" hidden>
              <button type="button" data-action="view-data">View Data</button>
              <button type="button" data-action="expand">Expand</button>
              <button type="button" data-action="png">Download PNG</button>
              <button type="button" data-action="xlsx">Download XLSX</button>
              <button type="button" data-action="copy">Copy Excel Data</button>
            </div>
          </div>
        </div>
      </div>
      <div class="chart-card-body"></div>
      ${note ? `<div class="chart-card-note">${escapeHtml(note)}</div>` : ''}
    </div>
  `;
  const body = container.querySelector('.chart-card-body');
  const svg = buildChart(body, { large: false });

  const moreBtn = container.querySelector('[data-action="more-toggle"]');
  const moreMenu = container.querySelector('#more-menu');
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.more-menu').forEach(m => { if (m !== moreMenu) m.hidden = true; });
    moreMenu.hidden = !moreMenu.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!moreMenu.hidden && !e.target.closest('.more-menu-wrap')) moreMenu.hidden = true;
  });

  container.querySelector('[data-action="view-data"]').addEventListener('click', () => {
    moreMenu.hidden = true;
    const { headers, rows } = getTableData();
    openDataModal({ title, headers, rows });
  });
  container.querySelector('[data-action="expand"]').addEventListener('click', () => {
    moreMenu.hidden = true;
    openExpandModal({ title, subtitle, buildChart });
  });
  container.querySelector('[data-action="png"]').addEventListener('click', async () => {
    moreMenu.hidden = true;
    try {
      const blob = await svgToPngBlob(svg);
      downloadBlob(blob, `${slug(filename || title)}.png`);
    } catch {
      showToast('Could not export this chart as PNG.', true);
    }
  });
  container.querySelector('[data-action="xlsx"]').addEventListener('click', async () => {
    moreMenu.hidden = true;
    const { headers, rows } = getTableData();
    try { await downloadXLSX(headers, rows, `${slug(filename || title)}.xlsx`); }
    catch (e) { showToast(e.message || 'Could not export XLSX.', true); }
  });
  container.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    moreMenu.hidden = true;
    const { headers, rows } = getTableData();
    const ok = await copyTableToClipboard(headers, rows);
    showToast(ok ? 'Data copied — paste into Excel.' : 'Could not copy to clipboard.', !ok);
  });
  const saveBtn = container.querySelector('[data-action="save"]');
  if (saveBtn) saveBtn.addEventListener('click', () => openSaveModal({ defaultTitle: saveTitle || title, onSave }));

  return svg;
}

export function showEmptyChartState(container, message) {
  container.innerHTML = `<div class="empty-state chart-empty-state"><div class="em-title">Nothing to show</div><p>${escapeHtml(message)}</p></div>`;
}

// ---------------- First-use tips ----------------
// Shown once ever (tracked in localStorage), then never again — used for the
// click-through hint and the Mechanism-as-a-dimension hints. Not a permanent panel.
const TIP_SEEN_PREFIX = 'lab_tip_seen_';

export function showTipOnce(container, key, text) {
  const seenKey = TIP_SEEN_PREFIX + key;
  let alreadySeen = false;
  try { alreadySeen = !!localStorage.getItem(seenKey); } catch { alreadySeen = false; }
  if (alreadySeen) return;
  try { localStorage.setItem(seenKey, '1'); } catch { /* private mode etc. — fine to just not persist */ }
  const el = document.createElement('div');
  el.className = 'tip-banner';
  el.innerHTML = `<span>${escapeHtml(text)}</span><button type="button" class="tip-dismiss" aria-label="Dismiss">&times;</button>`;
  el.querySelector('.tip-dismiss').addEventListener('click', () => el.remove());
  container.appendChild(el);
}
