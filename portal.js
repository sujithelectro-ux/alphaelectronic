'use strict';

/* =========================================================
   Alpha Electronic — customer portal
   ========================================================= */
(function () {
  const UI = window.AE_UI;
  const Dash = window.AE_Dash;
  const Cloud = window.AE_Cloud;

  const state = {
    user: null,
    admin: false,
    profile: null,
    invoices: [],
    keys: [],
    subs: [],
    rulesError: false
  };

  let showTab = function () {};

  function init() {
    Dash.bindActions();
    Dash.bindShell();
    showTab = Dash.initTabs({ default: 'overview', onTab: onTab });
    bindStatic();

    if (!Cloud) {
      gateOffline();
      return;
    }

    Cloud.onAuth(handleAuth);
    Cloud.waitReady().then(() => {
      if (!Cloud.init()) {
        gateOffline();
        return;
      }
      if (!Cloud.currentUser()) gateSignIn();
    });
  }

  function onTab(name) {
    if (name === 'request') prefillRequest();
  }

  /* ---------------- Gate ---------------- */
  function gateSignIn() {
    const denied = UI.param('denied');
    Dash.setGate({
      icon: Dash.ico('shield'),
      title: 'Sign in to your portal',
      text: 'View your Alpha Electronic invoices, outstanding balance and service history from any device.',
      body: denied
        ? '<div class="gate-note">Administrator pages are restricted. Sign in with your customer account to continue, or ask Alpha Electronic for help.</div>'
        : '',
      actions:
        '<a class="btn btn-navy" href="login.html?next=' + encodeURIComponent('portal.html') + '">Sign in</a>' +
        '<a class="btn btn-outline" href="login.html?mode=register&amp;next=portal.html">Create account</a>' +
        '<a class="btn btn-outline" href="index.html">Back to website</a>'
    });
    Dash.lock();
  }

  function gateOffline() {
    Dash.setGate({
      icon: Dash.ico('alert'),
      title: 'Cloud is unavailable',
      text: 'The portal could not connect to Firebase. Check your internet connection and try again. Your invoices are safe in the cloud.',
      body: '<p class="gate-note">You can still use the <a href="invoice.html">offline invoice maker</a> on this device.</p>',
      actions:
        '<button class="btn btn-navy" type="button" data-gate-action="reload">Reload portal</button>' +
        '<a class="btn btn-outline" href="index.html">Back to website</a>'
    });
    Dash.lock();
  }

  /* ---------------- Auth ---------------- */
  function handleAuth(snap) {
    state.rulesError = !!snap.rulesError;

    if (!snap.user) {
      teardown();
      state.user = null;
      state.admin = false;
      if (window.AE_Sec) window.AE_Sec.stopIdle();
      Dash.lock();
      gateSignIn();
      return;
    }

    if (window.AE_Sec) window.AE_Sec.startIdle({ minutes: 30, url: 'login.html?timeout=1' });
    const prevUid = state.user ? state.user.uid : '';
    state.user = snap.user;
    state.admin = !!snap.admin;

    if (prevUid !== snap.user.uid) {
      teardown();
      bootUser(snap);
    } else {
      if (state.profile) Dash.paintUser({ user: state.user, admin: state.admin }, state.profile);
      fillAccount();
    }
  }

  async function bootUser(snap) {
    const user = snap.user;
    Dash.unlock();
    fillAccount();

    let profile = null;
    try { profile = await Cloud.getProfile(user.uid); } catch (e) { /* rules may block */ }

    state.profile = profile || {
      name: user.displayName || '',
      email: user.email || '',
      phone: ''
    };

    Dash.paintUser({ user: state.user, admin: state.admin }, state.profile);
    fillProfile();
    prefillRequest();
    fillAccount();
    Dash.clearAlert();

    if (UI.param('denied')) {
      Dash.setAlert('info', 'That page is for Alpha Electronic administrators. You are in the customer portal.');
    } else if (snap.rulesError) {
      Dash.setAlert('warn', 'The cloud database rules are not published yet, so some data may not load. Please contact Alpha Electronic.');
    }

    loadInvoices(user.uid);
  }

  function teardown() {
    state.subs.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    state.subs = [];
    state.invoices = [];
    state.keys = [];
    state.profile = null;
    renderAll();
  }

  /* ---------------- Data ---------------- */
  function loadInvoices(uid) {
    const unsub = Cloud.watchCustomerInvoiceKeys(uid, (keys) => {
      state.keys = keys || [];
      refreshFromKeys();
    });
    state.subs.push(unsub);
  }

  async function refreshFromKeys() {
    const uid = state.user ? state.user.uid : '';
    if (!uid) return;
    const list = [];
    for (const key of state.keys) {
      try {
        const inv = await Cloud.readInvoice(key);
        if (inv) list.push(inv);
      } catch (e) { /* skip unreadable key */ }
    }
    if (!state.user || state.user.uid !== uid) return;
    state.invoices = Dash.sortInvoices(list);
    renderAll();
  }

  /* ---------------- Render ---------------- */
  function renderAll() {
    renderStats();
    renderRecent();
    renderInvoices();
  }

  function renderStats() {
    const el = document.getElementById('portalStats');
    if (!el) return;
    const list = state.invoices;
    const due = list.filter((inv) => Dash.statusOf(inv) === 'due');
    const outstanding = due.reduce((sum, inv) => sum + Math.max(0, UI.num(inv.balance)), 0);
    const paid = list.filter((inv) => Dash.statusOf(inv) === 'paid').length;
    const quotes = list.filter((inv) => Dash.statusOf(inv) === 'quote').length;

    el.innerHTML = [
      Dash.statCard('gold', 'file', 'Documents', String(list.length), 'Assigned to your account'),
      Dash.statCard('red', 'cash', 'Outstanding', UI.fmtRsShort(outstanding), due.length + (due.length === 1 ? ' invoice' : ' invoices') + ' with a balance'),
      Dash.statCard('green', 'check', 'Paid', String(paid), 'Settled invoices'),
      Dash.statCard('blue', 'tag', 'Quotations', String(quotes), 'Estimates you can review')
    ].join('');
  }

  function invoiceRow(inv) {
    const status = Dash.statusOf(inv);
    const shareUrl = Dash.invoiceShare(inv);
    const previewUrl = 'view.html?id=' + encodeURIComponent(inv._key || '');
    const count = (inv.items || []).length;
    const balance = UI.num(inv.balance);
    return '<tr>' +
      '<td><span class="cell-main">' + UI.fmtDate(inv.date) + '</span><span class="cell-sub">' + UI.escapeHtml(inv.type || 'Invoice') + '</span></td>' +
      '<td><a class="cell-main" href="' + UI.escapeHtml(previewUrl) + '" target="_blank" rel="noopener">' + UI.escapeHtml(inv.no || '—') + '</a><span class="cell-sub">' + count + ' item' + (count === 1 ? '' : 's') + '</span></td>' +
      '<td class="num">' + UI.fmtRs(inv.total) + '</td>' +
      '<td class="num' + (balance > 0 ? ' cell-warn' : '') + '">' + UI.fmtRs(inv.balance) + '</td>' +
      '<td>' + Dash.badge(status) + '</td>' +
      '<td><div class="row-actions">' +
        '<a class="mini-act gold" href="' + UI.escapeHtml(previewUrl) + '" target="_blank" rel="noopener">Open / PDF</a>' +
        '<button class="mini-act" type="button" data-copy-link="' + UI.escapeHtml(shareUrl) + '">Share link</button>' +
        '<a class="mini-act" href="' + UI.escapeHtml(Dash.waInvoice(inv)) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '</div></td>' +
      '</tr>';
  }

  function emptyInvoiceRow() {
    const msg = state.user
      ? 'When Alpha Electronic assigns an invoice to your account, it will appear here. <a href="index.html#contact">Contact us</a> if a document is missing.'
      : 'Sign in to see your invoices.';
    return Dash.emptyRow(6, 'file', 'No invoices yet', msg);
  }

  function renderRecent() {
    const body = document.getElementById('portalRecentBody');
    if (!body) return;
    const rows = state.invoices.slice(0, 5).map(invoiceRow);
    body.innerHTML = rows.length ? rows.join('') : emptyInvoiceRow();
  }

  function renderInvoices() {
    const body = document.getElementById('portalInvBody');
    if (!body) return;
    const count = document.getElementById('portalInvCount');
    if (count) count.textContent = String(state.invoices.length);
    body.innerHTML = state.invoices.length ? state.invoices.map(invoiceRow).join('') : emptyInvoiceRow();
  }

  /* ---------------- Forms ---------------- */
  function fillProfile() {
    const name = (state.profile && state.profile.name) || '';
    const phone = (state.profile && state.profile.phone) || '';
    const email = (state.user && state.user.email) || '';
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('pfName', name);
    set('pfPhone', phone);
    set('pfEmail', email);
  }

  function fillAccount() {
    const email = (state.user && (state.user.email || state.user.phoneNumber)) || '—';
    const acctEmail = document.getElementById('acctEmail');
    if (acctEmail) acctEmail.textContent = email;
    const role = document.getElementById('acctRole');
    if (role) role.textContent = state.admin ? 'Administrator' : 'Customer';
    const uid = document.getElementById('acctUid');
    if (uid) uid.textContent = state.user ? state.user.uid : '—';
    const copy = document.getElementById('btnCopyUid');
    if (copy) copy.setAttribute('data-copy', state.user ? state.user.uid : '');
    const cloud = document.getElementById('acctCloud');
    if (cloud) cloud.textContent = state.rulesError ? 'Setup pending' : 'Connected';
  }

  function prefillRequest() {
    if (!state.profile) return;
    const setIfEmpty = (id, value) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = value || '';
    };
    setIfEmpty('rqName', state.profile.name);
    setIfEmpty('rqPhone', state.profile.phone);
    setIfEmpty('rqEmail', (state.user && state.user.email) || state.profile.email);
  }

  function bindStatic() {
    UI.$$('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => showTab(el.dataset.goto));
    });

    const refresh = document.getElementById('btnRefreshInv');
    if (refresh) {
      refresh.addEventListener('click', async () => {
        if (!state.user) return;
        if (!state.keys.length) { UI.toast('No invoices to refresh yet'); return; }
        UI.setBusy(refresh, true, 'Refreshing…');
        try {
          await refreshFromKeys();
          UI.toast('Invoices refreshed');
        } finally {
          UI.setBusy(refresh, false);
        }
      });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.user) return;
        const status = document.getElementById('pfStatus');
        const name = document.getElementById('pfName').value.trim();
        const phone = document.getElementById('pfPhone').value.trim();
        if (!name) {
          UI.setFormStatus(status, 'bad', 'Please enter your name.');
          return;
        }
        const btn = document.getElementById('pfSubmit');
        UI.setBusy(btn, true, 'Saving…');
        UI.clearFormStatus(status);
        try {
          const saved = await Cloud.updateProfile({ name: name, phone: phone });
          state.profile = Object.assign({}, state.profile, saved, { email: state.user.email || '' });
          Dash.paintUser({ user: state.user, admin: state.admin }, state.profile);
          prefillRequest();
          UI.setFormStatus(status, 'ok', 'Your details are saved.');
          UI.toast('Profile updated');
        } catch (err) {
          UI.setFormStatus(status, 'bad', Cloud.friendlyAuthError(err));
        } finally {
          UI.setBusy(btn, false);
        }
      });
    }

    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
      requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.user) return;
        const status = document.getElementById('rqStatus');
        const payload = {
          name: document.getElementById('rqName').value.trim(),
          phone: document.getElementById('rqPhone').value.trim(),
          email: document.getElementById('rqEmail').value.trim(),
          type: document.getElementById('rqType').value,
          message: document.getElementById('rqMessage').value.trim(),
          source: 'customer portal'
        };
        if (!payload.name || !payload.phone || !payload.message) {
          UI.setFormStatus(status, 'bad', 'Please fill your name, phone and message.');
          return;
        }
        const btn = document.getElementById('rqSubmit');
        UI.setBusy(btn, true, 'Sending…');
        UI.clearFormStatus(status);
        try {
          await Cloud.submitServiceRequest(payload);
          document.getElementById('rqMessage').value = '';
          UI.setFormStatus(status, 'ok', 'Request sent. Alpha Electronic will contact you on WhatsApp.');
          UI.toast('Request sent');
        } catch (err) {
          UI.setFormStatus(status, 'bad', Cloud.friendlyAuthError(err));
        } finally {
          UI.setBusy(btn, false);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
