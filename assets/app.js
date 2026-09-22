import { loadTeamMembers, getActiveTeamMembers, getTeamMemberByName, teamAvatarUrl } from './teamMembers.js';
import { loadAppSettings, getAppSetting } from './appSettings.js';
import { escapeHtml } from './fields.js';

const IDENTITY_KEY = 'dlh_identity';

// `key` is the stable technical identifier (never changes, never shown) and `href` is
// the route (never changes either) — only `label` can be overridden from Settings
// (Navigation), via app_settings key `nav_label:<key>`. See navLabel() below.
//
// A group with `children` collapses related pages under one nav item — Analysis is a
// view over the Database, Favorites is a personal cut of it; Sources backs Data &
// Insights — so the list stays short while the pages themselves are one click away,
// shown indented right under their parent (see navLinksListHTML() below). Every leaf
// keeps its own stable `key`/`href` — Settings' "Tab display names" editor and every
// page's own `initNav(activeKey)` call are unaffected by how pages are grouped.
const NAV_GROUPS = [
  { key: 'database', label: 'Database', href: 'index.html', children: [
      { key: 'database', label: 'Database', href: 'index.html' },
      { key: 'analysis', label: 'Analysis', href: 'analysis.html' },
      { key: 'favorites', label: 'Favorites', href: 'favorites.html' }
    ] },
  { key: 'tasks', label: 'Schedules & Tasks', href: 'tasks.html' },
  { key: 'reports', label: 'Weekly Reports', href: 'weekly-reports.html' },
  { key: 'brainstorm', label: 'Brainstorm', href: 'brainstorm.html' },
  { key: 'figures', label: 'Data & Insights', href: 'figures.html', children: [
      { key: 'figures', label: 'Insights', href: 'figures.html' },
      { key: 'sources', label: 'Sources', href: 'sources.html' }
    ] },
  { key: 'settings', label: 'Settings', href: 'settings.html' }
];

const NAV_LEAVES = NAV_GROUPS.flatMap(g => g.children || [g]);

export function navLabel(key) {
  const link = NAV_LEAVES.find(l => l.key === key);
  return getAppSetting(`nav_label:${key}`, link ? link.label : key);
}

// One flattened, vertical link list — a group's own link immediately followed by its
// (indented) children — used for both the always-visible desktop sidebar and the
// mobile drawer, so the two stay identical by construction rather than by convention.
function navLinksListHTML(activeKey) {
  return NAV_GROUPS.map(g => {
    const headerHTML = `<a href="${g.href}" class="${!g.children && g.key === activeKey ? 'active' : ''}">${escapeHtml(navLabel(g.key))}</a>`;
    if (!g.children) return headerHTML;
    const childrenHTML = g.children.map(c =>
      `<a href="${c.href}" class="nav-link-child ${c.key === activeKey ? 'active' : ''}">${escapeHtml(navLabel(c.key))}</a>`
    ).join('');
    return headerHTML + childrenHTML;
  }).join('');
}

export function getIdentity() {
  return localStorage.getItem(IDENTITY_KEY) || '';
}

function setIdentity(name) {
  localStorage.setItem(IDENTITY_KEY, name);
}

// Settings' rename cascade calls this so a rename of "yourself" is reflected on this
// same device right away, instead of silently going stale until the picker is reopened
// (a rename elsewhere on the team can't reach other people's browsers — each of their
// devices keeps the old name in its own localStorage until they re-pick it there).
export function renameIdentityIfMatches(oldName, newName) {
  if (getIdentity() === oldName) {
    setIdentity(newName);
    updateIdentityDisplay();
  }
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// Shows the member's uploaded photo when they have one, initials otherwise — used by
// both the nav identity button and the "Who's this?" picker so a rename/photo change
// in Settings shows up in both places without further wiring.
function avatarInnerHTML(name) {
  const member = name ? getTeamMemberByName(name) : null;
  const url = member?.avatar_path ? teamAvatarUrl(member.avatar_path) : null;
  return url ? `<img src="${escapeHtml(url)}" alt="" />` : escapeHtml(initials(name));
}

const MOBILE_QUERY = '(max-width: 860px)';

// The identity button appears twice in the DOM (compact mobile top bar, foot of the
// desktop sidebar) — only one is ever visible at a time (CSS), so both are wired and
// updated together rather than picking "the" one by id.
function identityButtonHTML() {
  return `
    <button class="identity-btn" type="button">
      <span class="identity-avatar">?</span>
      <span class="identity-name">Select name</span>
    </button>
  `;
}

function renderNav(activeKey) {
  const root = document.getElementById('nav-root');
  if (!root) return;
  const linksHTML = navLinksListHTML(activeKey);

  root.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <a href="index.html" class="nav-logo" id="nav-logo">
          Details <span>Loyalty Hub</span>
          <span class="nav-logo-icon" aria-hidden="true"><i></i><i></i><i></i></span>
        </a>
        <div class="nav-right">${identityButtonHTML()}</div>
      </div>
    </nav>
    <aside class="sidebar-nav">
      <a href="index.html" class="nav-logo">Details <span>Loyalty Hub</span></a>
      <nav class="sidebar-links">${linksHTML}</nav>
      <div class="sidebar-foot">${identityButtonHTML()}</div>
    </aside>
  `;

  renderMobileDrawer(activeKey);

  document.getElementById('nav-logo').addEventListener('click', (e) => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      e.preventDefault();
      openMobileDrawer();
    }
  });
}

function renderMobileDrawer(activeKey) {
  let root = document.getElementById('mobile-drawer-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'mobile-drawer-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="mobile-drawer-overlay" id="mobile-drawer-overlay" hidden>
      <div class="mobile-drawer">
        <div class="mobile-drawer-head">
          <span class="nav-logo">Details <span>Loyalty Hub</span></span>
          <button class="mobile-drawer-close" id="mobile-drawer-close" type="button" aria-label="Close menu">&times;</button>
        </div>
        <nav class="mobile-drawer-links">${navLinksListHTML(activeKey)}</nav>
      </div>
    </div>
  `;

  const overlay = document.getElementById('mobile-drawer-overlay');
  document.getElementById('mobile-drawer-close').addEventListener('click', closeMobileDrawer);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMobileDrawer(); });
}

function openMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  document.addEventListener('keydown', handleDrawerEscape);
}

function closeMobileDrawer() {
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (!overlay) return;
  overlay.hidden = true;
  document.removeEventListener('keydown', handleDrawerEscape);
}

function handleDrawerEscape(e) {
  if (e.key === 'Escape') closeMobileDrawer();
}

async function renderIdentityModal({ forceChoice }) {
  let root = document.getElementById('identity-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'identity-modal-root';
    document.body.appendChild(root);
  }

  await loadTeamMembers();
  const picks = getActiveTeamMembers().map(name =>
    `<button class="identity-pick" data-name="${escapeHtml(name)}" type="button">
       <span class="identity-avatar">${avatarInnerHTML(name)}</span>
       <span>${escapeHtml(name)}</span>
     </button>`
  ).join('');

  root.innerHTML = `
    <div class="modal-overlay" id="identity-overlay">
      <div class="identity-modal">
        <h2>Who's this?</h2>
        <p>Pick your name, it's used to tag what you add or edit.</p>
        <div class="identity-grid">${picks}</div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('identity-overlay');
  overlay.querySelectorAll('.identity-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      setIdentity(btn.dataset.name);
      updateIdentityDisplay();
      overlay.remove();
    });
  });

  if (!forceChoice) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}

function updateIdentityDisplay() {
  const name = getIdentity();
  document.querySelectorAll('.identity-name').forEach(el => { el.textContent = name || 'Select name'; });
  document.querySelectorAll('.identity-avatar').forEach(el => { el.innerHTML = name ? avatarInnerHTML(name) : '?'; });
}

export async function initNav(activeKey) {
  await Promise.all([loadAppSettings(), loadTeamMembers()]);
  renderNav(activeKey);
  updateIdentityDisplay();

  document.querySelectorAll('.identity-btn').forEach(btn => {
    btn.addEventListener('click', () => renderIdentityModal({ forceChoice: false }));
  });

  if (!getIdentity()) {
    renderIdentityModal({ forceChoice: true });
  }
}

export function showToast(message, isError = false) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}
