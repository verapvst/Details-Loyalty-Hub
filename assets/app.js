import { TEAM_MEMBERS } from './options.js';

const IDENTITY_KEY = 'dlh_identity';

const NAV_LINKS = [
  { key: 'database', label: 'Database', href: 'index.html' },
  { key: 'analysis', label: 'Analysis', href: 'analysis.html' },
  { key: 'favorites', label: 'Favorites', href: 'favorites.html' },
  { key: 'tasks', label: 'Schedules & Tasks', href: 'tasks.html' },
  { key: 'figures', label: 'Figures & Data', href: 'figures.html' },
  { key: 'sources', label: 'Sources', href: 'sources.html' },
  { key: 'settings', label: 'Settings', href: 'settings.html' }
];

export function getIdentity() {
  return localStorage.getItem(IDENTITY_KEY) || '';
}

function setIdentity(name) {
  localStorage.setItem(IDENTITY_KEY, name);
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

const MOBILE_QUERY = '(max-width: 860px)';

function renderNav(activeKey) {
  const root = document.getElementById('nav-root');
  if (!root) return;

  const links = NAV_LINKS.map(l =>
    `<a href="${l.href}" class="${l.key === activeKey ? 'active' : ''}">${l.label}</a>`
  ).join('');

  root.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <a href="index.html" class="nav-logo" id="nav-logo">
          Details <span>Loyalty Hub</span>
          <span class="nav-logo-icon" aria-hidden="true"><i></i><i></i><i></i></span>
        </a>
        <div class="nav-links">${links}</div>
        <div class="nav-right">
          <button class="identity-btn" id="identity-btn" type="button">
            <span class="identity-avatar" id="identity-avatar">?</span>
            <span class="identity-name" id="identity-name">Select name</span>
          </button>
        </div>
      </div>
    </nav>
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

  const links = NAV_LINKS.map(l =>
    `<a href="${l.href}" class="${l.key === activeKey ? 'active' : ''}">${l.label}</a>`
  ).join('');

  root.innerHTML = `
    <div class="mobile-drawer-overlay" id="mobile-drawer-overlay" hidden>
      <div class="mobile-drawer">
        <div class="mobile-drawer-head">
          <span class="nav-logo">Details <span>Loyalty Hub</span></span>
          <button class="mobile-drawer-close" id="mobile-drawer-close" type="button" aria-label="Close menu">&times;</button>
        </div>
        <nav class="mobile-drawer-links">${links}</nav>
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

function renderIdentityModal({ forceChoice }) {
  let root = document.getElementById('identity-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'identity-modal-root';
    document.body.appendChild(root);
  }

  const picks = TEAM_MEMBERS.map(name =>
    `<button class="identity-pick" data-name="${name}" type="button">
       <span class="identity-avatar">${initials(name)}</span>
       <span>${name}</span>
     </button>`
  ).join('');

  root.innerHTML = `
    <div class="modal-overlay" id="identity-overlay">
      <div class="identity-modal">
        <h2>Who's this?</h2>
        <p>Pick your name — it's used to tag what you add or edit.</p>
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
  const nameEl = document.getElementById('identity-name');
  const avatarEl = document.getElementById('identity-avatar');
  if (nameEl) nameEl.textContent = name || 'Select name';
  if (avatarEl) avatarEl.textContent = name ? initials(name) : '?';
}

export function initNav(activeKey) {
  renderNav(activeKey);
  updateIdentityDisplay();

  document.getElementById('identity-btn').addEventListener('click', () => {
    renderIdentityModal({ forceChoice: false });
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
