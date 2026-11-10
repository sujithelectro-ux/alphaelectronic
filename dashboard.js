'use strict';

/* =========================================================
   Alpha Electronic — shared dashboard shell
   Used by portal.html (customer) and admin.html (admin)
   ========================================================= */
window.AE_Dash = (function () {
  const UI = window.AE_UI;

  const icons = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/><path d="M9 13h6M9 16.5h4"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 17.5V19"/><circle cx="10.5" cy="8" r="3.2"/><path d="M19 19v-1.5a3.5 3.5 0 0 0-2.6-3.4"/><path d="M15.5 5.1a3.2 3.2 0 0 1 0 5.8"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 6.5 5h11L20 12.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 12.5h5l1.5 2.5h3l1.5-2.5h5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13.2 13.2 20a2 2 0 0 1-2.8 0L4 13.6V4h9.6l6.4 6.4a2 2 0 0 1 0 2.8z"/><circle cx="8.5" cy="8.5" r="1.4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9c.14.62.64 1.09 1.27 1.19H21a2 2 0 1 1 0 4h-.09c-.63.1-1.13.57-1.27 1.19z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 5 6v5.2c0 4.3 2.9 7.7 7 9.3 4.1-1.6 7-5 7-9.3V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 12h.01M17.5 12h.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 3.5 19h17z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 15"/><path d="M4 20v-5h5"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h2.4l1.4 3.6-1.8 1.3a12.5 12.5 0 0 0 5.6 5.6l1.3-1.8 3.6 1.4v2.4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.6a4.3 4.3 0 0 1 5.4 1.1l-2.6 2.6 2 2 2.6-2.6a4.3 4.3 0 0 1-5.4 5.4l-6 6a2.2 2.2 0 0 1-3.1-3.1l6-6a4.3 4.3 0 0 1 1.1-5.4z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m9 8-4 4 4 4"/><path d="M5 12h10"/></svg>'
  };

  function ico(name) {
    return icons[name] || '';
  }

  function hydrateIcons(root) {
    UI.$$('[data-icon]', root).forEach((el) => {
      const svg = icons[el.dataset.icon];
      if (svg) el.innerHTML = svg;
    });
  }

  /* ---------- Shell ---------- */
  function bindShell() {
    const menu = document.getElementById('dashMenu');
    if (menu) menu.addEventListener('click', () => document.body.classList.toggle('side-open'));
    const scrim = document.getElementById('dashScrim');
    if (scrim) scrim.addEventListener('click', closeSide);
    UI.$$('.dash-link').forEach((link) => link.addEventListener('click', closeSide));

    const out = document.getElementById('btnSignOut');
    if (out) {
      out.addEventListener('click', async () => {
        UI.setBusy(out, true, 'Signing out…');
        try { await window.AE_Cloud.signOut(); } catch (e) { /* ignore */ }
        location.href = 'index.html';
      });
    }
    hydrateIcons();
  }

  function closeSide() {
    document.body.classList.remove('side-open');
  }

  /* ---------- Tabs ---------- */
  let onTabChange = null;
  let activeTab = '';

  function initTabs(opts) {
    const options = opts || {};
    onTabChange = options.onTab;
    const buttons = UI.$$('.dash-link[data-tab]');
    const defaultTab = options.default || (buttons[0] && buttons[0].dataset.tab) || 'overview';

    function show(tab, silent) {
      const target = buttons.find((b) => b.dataset.tab === tab) || buttons[0];
      if (!target) return;
      const name = target.dataset.tab;
      buttons.forEach((b) => {
        const on = b === target;
        b.classList.toggle('active', on);
        b.setAttribute('aria-current', on ? 'page' : 'false');
      });
      UI.$$('.dash-view').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
      const title = document.getElementById('pageTitle');
      const sub = document.getElementById('pageSub');
      if (title && target.dataset.title) title.textContent = target.dataset.title;
      if (sub && target.dataset.sub !== undefined) sub.textContent = target.dataset.sub;
      activeTab = name;
      if (!silent) {
        try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ }
      }
      if (typeof onTabChange === 'function') onTabChange(name);
    }

    buttons.forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.tab)));
    window.addEventListener('hashchange', () => {
      const hash = String(location.hash || '').replace('#', '');
      if (buttons.some((b) => b.dataset.tab === hash)) show(hash, true);
    });
    const hash = String(location.hash || '').replace('#', '');
    show(buttons.some((b) => b.dataset.tab === hash) ? hash : defaultTab, true);
    return show;
  }

  function currentTab() {
    return activeTab;
  }

  /* ---------- Gate ---------- */
  function setGate(opts) {
    const o = opts || {};
    const icon = document.getElementById('gateIcon');
    const title = document.getElementById('gateTitle');
    const text = document.getElementById('gateText');
    const body = document.getElementById('gateBody');
    const actions = document.getElementById('gateActions');
    if (icon) icon.innerHTML = o.icon || ico('shield');
    if (title) title.textContent = o.title || '';
    if (text) text.textContent = o.text || '';
    if (body) body.innerHTML = o.body || '';
    if (actions) actions.innerHTML = o.actions || '';
    if (icon) icon.style.display = o.icon === false ? 'none' : '';
  }

  function lock() {
    document.body.classList.add('dash-locked');
  }

  function unlock() {
    document.body.classList.remove('dash-locked');
  }

  function paintUser(state, profile) {
    const user = (state && state.user) || {};
    const name = (profile && profile.name) || user.displayName || (user.email || '').split('@')[0] || user.phoneNumber || 'Account';
    const avatar = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const mailEl = document.getElementById('userMail');
    if (avatar) avatar.textContent = UI.initials(name);
    if (nameEl) nameEl.textContent = name;
    if (mailEl) mailEl.textContent = user.email || (profile && profile.email) || user.phoneNumber || '';
    UI.$$('.admin-only').forEach((el) => {
      if (el.classList.contains('dash-link')) el.style.display = state && state.admin ? '' : 'none';
      else el.hidden = !(state && state.admin);
    });
  }

  /* ---------- Alerts / toast ---------- */
  function setAlert(type, message, link) {
    const el = document.getElementById('dashAlert');
    if (!el) return;
    const safe = UI.escapeHtml(message);
    const extra = link && link.href
      ? ' <a href="' + UI.escapeHtml(link.href) + '">' + UI.escapeHtml(link.text || 'Learn more') + '</a>'
      : '';
    el.className = 'dash-alert show ' + (type || 'info');
    el.innerHTML = '<span class="da-ico">' + ico('alert') + '</span><span>' + safe + extra + '</span>';
    el.dataset.key = message;
  }

  function clearAlert() {
    const el = document.getElementById('dashAlert');
    if (!el) return;
    el.className = 'dash-alert';
    el.innerHTML = '';
    el.dataset.key = '';
  }

  /* ---------- Formatting helpers ---------- */
  function statusOf(inv) {
    if (inv && inv.status) return inv.status;
    if (window.AE_Cloud && window.AE_Cloud.invoiceStatus) return window.AE_Cloud.invoiceStatus(inv || {});
    return 'due';
  }

  function badge(status) {
    return '<span class="badge ' + UI.statusClass(status) + '">' + UI.escapeHtml(UI.statusLabel(status)) + '</span>';
  }

  function emptyState(icon, title, text) {
    return '<div class="dash-empty"><span class="empty-ico">' + ico(icon || 'file') + '</span>' +
      '<strong>' + UI.escapeHtml(title) + '</strong><p>' + (text || '') + '</p></div>';
  }

  function emptyRow(colspan, icon, title, text) {
    return '<tr><td colspan="' + colspan + '">' + emptyState(icon, title, text) + '</td></tr>';
  }

  function statCard(tone, icon, label, value, sub) {
    return '<article class="stat-card tone-' + (tone || 'gold') + '">' +
      '<span class="stat-ico">' + ico(icon) + '</span>' +
      '<p class="stat-label">' + UI.escapeHtml(label) + '</p>' +
      '<strong class="stat-value">' + value + '</strong>' +
      '<span class="stat-sub">' + UI.escapeHtml(sub || '') + '</span>' +
      '</article>';
  }

  function invoiceShare(inv) {
    return UI.shareUrl(inv || {});
  }

  function waInvoice(inv) {
    return UI.waLink('Hello Alpha Electronic, I would like to ask about invoice ' + ((inv && inv.no) || '') + '.');
  }

  function sortInvoices(list) {
    return (list || []).slice().sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.no || '').localeCompare(String(a.no || ''))
    );
  }

  /* ---------- Files ---------- */
  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function csvCell(value) {
    const s = String(value == null ? '' : value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(rows) {
    return (rows || []).map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  /* ---------- Shared action delegation ---------- */
  let actionsBound = false;

  function bindActions() {
    if (actionsBound) return;
    actionsBound = true;
    document.addEventListener('click', (e) => {
      const copyEl = e.target.closest('[data-copy]');
      if (copyEl) {
        e.preventDefault();
        UI.copyText(copyEl.getAttribute('data-copy') || '', copyEl.getAttribute('data-copy-msg') || 'Copied');
        return;
      }
      const copyLink = e.target.closest('[data-copy-link]');
      if (copyLink) {
        e.preventDefault();
        UI.copyText(copyLink.getAttribute('data-copy-link') || '', 'Invoice link copied');
        return;
      }
      const gateBtn = e.target.closest('[data-gate-action]');
      if (gateBtn) {
        const action = gateBtn.dataset.gateAction;
        if (action === 'copy-rules') { copyRules(gateBtn); return; }
        if (action === 'signout') {
          UI.setBusy(gateBtn, true, 'Signing out…');
          (window.AE_Cloud ? window.AE_Cloud.signOut() : Promise.resolve())
            .catch(() => {})
            .then(() => location.reload());
          return;
        }
        if (action === 'reload') { location.reload(); return; }
      }
      const closer = e.target.closest('[data-close]');
      if (closer) {
        const modal = document.getElementById(closer.dataset.close);
        if (modal) modal.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UI.$$('.modal.open').forEach((m) => m.classList.remove('open'));
        closeSide();
      }
    });
  }

  async function copyRules(btn) {
    if (btn) UI.setBusy(btn, true, 'Copying…');
    try {
      const res = await fetch('database.rules.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      JSON.parse(text);
      await UI.copyText(text, 'Database rules copied — paste them in Firebase Console');
    } catch (e) {
      UI.toast('Could not load the rules file — open database.rules.json and copy it manually');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  return {
    icons: icons,
    ico: ico,
    hydrateIcons: hydrateIcons,
    bindShell: bindShell,
    bindActions: bindActions,
    closeSide: closeSide,
    initTabs: initTabs,
    currentTab: currentTab,
    setGate: setGate,
    lock: lock,
    unlock: unlock,
    paintUser: paintUser,
    setAlert: setAlert,
    clearAlert: clearAlert,
    statusOf: statusOf,
    badge: badge,
    emptyState: emptyState,
    emptyRow: emptyRow,
    statCard: statCard,
    invoiceShare: invoiceShare,
    waInvoice: waInvoice,
    sortInvoices: sortInvoices,
    download: download,
    toCsv: toCsv,
    copyRules: copyRules,
    openModal: openModal,
    closeModal: closeModal
  };
})();
