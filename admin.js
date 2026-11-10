'use strict';

/* =========================================================
   Alpha Electronic — admin control panel
   ========================================================= */
(function () {
  const UI = window.AE_UI;
  const Dash = window.AE_Dash;
  const Cloud = window.AE_Cloud;

  const state = {
    user: null,
    admin: false,
    profile: null,
    setup: null,
    bootedUid: '',
    invoices: [],
    customers: [],
    admins: [],
    requests: [],
    prices: {},
    subs: [],
    rulesError: false,
    rulesCheck: [],
    invQuery: '',
    invFilter: 'all',
    custQuery: '',
    reqQuery: '',
    reqFilter: 'all',
    priceQuery: '',
    priceGroup: 'All',
    assignKey: '',
    custUid: '',
    noteKey: '',
    confirmFn: null
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
    if (name === 'invoices') renderInvoices();
    else if (name === 'customers') renderCustomers();
    else if (name === 'admins') renderAdmins();
    else if (name === 'requests') renderRequests();
    else if (name === 'prices') renderPrices();
    else if (name === 'setup') { renderSetupCounts(); fillSetup(); renderRulesCheck(); renderSecurity(); }
  }

  /* ---------------- Gates ---------------- */
  function gateSignIn() {
    Dash.setGate({
      icon: Dash.ico('shield'),
      title: 'Administrator sign in',
      text: 'Sign in with the Alpha Electronic admin account to manage invoices, customers, prices and service requests.',
      body: '<p class="gate-note">Customer? <a href="portal.html">Open the customer portal</a> instead.</p>',
      actions:
        '<a class="btn btn-navy" href="login.html?next=' + encodeURIComponent('admin.html') + '">Sign in</a>' +
        '<a class="btn btn-outline" href="index.html">Back to website</a>'
    });
    Dash.lock();
  }

  function gateAdminSetup(snap) {
    const email = snap.user.email || '';
    const uid = snap.user.uid || '';
    const safeEmail = UI.escapeHtml(email);
    const safeUid = UI.escapeHtml(uid);
    const rulesNote = snap.rulesError
      ? '<p class="gate-note">Firebase returned “permission denied”. Publish <code>database.rules.json</code> first, then reload this page.</p>'
      : '';

    Dash.setGate({
      icon: Dash.ico('shield'),
      title: 'Admin access only',
      text: 'You are signed in, but this account is not an Alpha Electronic administrator yet. Complete these steps to unlock the control panel.',
      body:
        '<div class="gate-code"><span>Signed in as</span><strong>' + safeEmail + '</strong></div>' +
        '<div class="gate-code"><span>Your user ID (UID)</span><div class="gc-row"><strong>' + safeUid + '</strong>' +
          '<button class="mini-act" type="button" data-copy="' + safeUid + '" data-copy-msg="UID copied">Copy</button></div></div>' +
        rulesNote +
        '<ol class="gate-steps">' +
          '<li>Open <strong>Firebase Console → Realtime Database → Rules</strong>, paste <code>database.rules.json</code> and publish.</li>' +
          '<li>In <strong>Realtime Database → Data</strong>, create <code>admins/' + safeUid + '</code> = <code>true</code> (boolean) for this account.</li>' +
          '<li>Reload this page — you will land in the admin dashboard.</li>' +
        '</ol>',
      actions:
        '<button class="btn btn-outline btn-sm" type="button" data-gate-action="copy-rules">Copy database rules</button>' +
        '<a class="btn btn-outline btn-sm" href="FIREBASE-SETUP.md" target="_blank" rel="noopener">Setup guide</a>' +
        '<a class="btn btn-outline btn-sm" href="portal.html">Customer portal</a>' +
        '<button class="btn btn-navy btn-sm" type="button" data-gate-action="signout">Switch account</button>'
    });
    Dash.lock();
  }

  function gateOffline() {
    Dash.setGate({
      icon: Dash.ico('alert'),
      title: 'Cloud is unavailable',
      text: 'The admin panel could not connect to Firebase. Check your internet connection and try again.',
      body: '<p class="gate-note">Offline invoicing still works in the <a href="invoice.html">invoice maker</a>.</p>',
      actions:
        '<button class="btn btn-navy" type="button" data-gate-action="reload">Reload admin panel</button>' +
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
    state.user = snap.user;
    state.admin = !!snap.admin;

    if (!snap.admin) {
      if (state.bootedUid !== snap.user.uid) teardown();
      Dash.lock();
      gateAdminSetup(snap);
      return;
    }

    if (state.bootedUid !== snap.user.uid) {
      teardown();
      bootAdmin(snap);
    } else {
      fillSetup();
    }
  }

  async function bootAdmin(snap) {
    state.bootedUid = snap.user.uid;
    Dash.unlock();
    Dash.clearAlert();

    let profile = null;
    try { profile = await Cloud.getProfile(snap.user.uid); } catch (e) { /* optional */ }
    state.profile = profile || {
      name: snap.user.displayName || '',
      email: snap.user.email || '',
      phone: ''
    };
    Dash.paintUser({ user: state.user, admin: true }, state.profile);
    fillSetup();

    if (snap.rulesError) {
      Dash.setAlert('warn', 'The database rules are not published yet, so invoices, customers and prices may not load. Copy the rules from the Setup tab into Firebase Console.', {
        href: 'FIREBASE-SETUP.md',
        text: 'Setup guide'
      });
    }

    state.subs.push(Cloud.watchInvoices((list) => {
      state.invoices = list || [];
      renderStats();
      renderOverviewRecent();
      renderInvoices();
      renderCustomers();
      renderSetupCounts();
    }));

    state.subs.push(Cloud.watchUsers((list) => {
      state.customers = list || [];
      renderStats();
      renderCustomers();
      renderAdmins();
      renderSetupCounts();
    }));

    state.subs.push(Cloud.watchAdmins((list) => {
      state.admins = list || [];
      renderAdmins();
      renderSetupCounts();
    }));

    state.subs.push(Cloud.watchRequests((list) => {
      state.requests = list || [];
      renderStats();
      renderRequests();
      renderRecentRequests();
      renderSetupCounts();
    }));

    state.subs.push(Cloud.watchPrices((prices) => {
      state.prices = prices || {};
      renderPrices();
      renderSetupCounts();
    }));

    try {
      state.setup = await Cloud.adminSetupInfo();
    } catch (e) {
      state.setup = null;
    }
    fillSetup();
    renderAdmins();
    renderRulesCheck();
    renderSecurity();
  }

  function teardown() {
    state.subs.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    state.subs = [];
    state.invoices = [];
    state.customers = [];
    state.admins = [];
    state.requests = [];
    state.prices = {};
    state.rulesCheck = [];
    state.setup = null;
    state.bootedUid = '';
    renderAll();
  }

  /* ---------------- Render: stats + overview ---------------- */
  function renderAll() {
    renderStats();
    renderOverviewRecent();
    renderInvoices();
    renderCustomers();
    renderAdmins();
    renderRequests();
    renderRecentRequests();
    renderPrices();
    renderSetupCounts();
    renderRulesCheck();
  }

  function updateNavBadge() {
    const badge = document.getElementById('navReqBadge');
    if (!badge) return;
    const count = state.requests.filter((r) => (r.status || 'new') === 'new').length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function renderStats() {
    const el = document.getElementById('adminStats');
    if (!el) return;

    const invoices = state.invoices;
    const billed = invoices.reduce((sum, inv) => sum + UI.num(inv.total), 0);
    const due = invoices.filter((inv) => Dash.statusOf(inv) === 'due');
    const outstanding = due.reduce((sum, inv) => sum + Math.max(0, UI.num(inv.balance)), 0);
    const fresh = state.requests.filter((r) => (r.status || 'new') === 'new').length;

    el.innerHTML = [
      Dash.statCard('gold', 'file', 'Invoices', String(invoices.length), 'Documents in the cloud'),
      Dash.statCard('blue', 'cash', 'Total billed', UI.fmtRsShort(billed), 'Across all documents'),
      Dash.statCard('red', 'cash', 'Outstanding', UI.fmtRsShort(outstanding), due.length + (due.length === 1 ? ' invoice' : ' invoices') + ' with a balance'),
      Dash.statCard('green', 'users', 'Customers', String(state.customers.length), 'Registered portal accounts'),
      Dash.statCard('grey', 'inbox', 'New requests', String(fresh), 'Waiting for a reply')
    ].join('');

    updateNavBadge();
  }

  function renderOverviewRecent() {
    const body = document.getElementById('adminRecentBody');
    if (!body) return;
    const list = state.invoices.slice(0, 6);
    body.innerHTML = list.length
      ? list.map(invoiceRow).join('')
      : Dash.emptyRow(8, 'file', 'No invoices yet', 'Open the <a href="invoice.html">invoice maker</a> to create your first document. It syncs automatically.');
  }

  /* ---------------- Invoices ---------------- */
  function filteredInvoices() {
    const q = state.invQuery.trim().toLowerCase();
    const filter = state.invFilter;
    return state.invoices.filter((inv) => {
      const status = Dash.statusOf(inv);
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      const hay = [
        inv.no, inv.customer, inv.phone, inv.address,
        inv.customerName, inv.customerEmail, inv.type
      ].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function invoiceRow(inv) {
    const status = Dash.statusOf(inv);
    const key = inv._key || '';
    const url = Dash.invoiceShare(inv);
    const count = (inv.items || []).length;
    const linked = !!inv.customerUid;
    const portalName = inv.customerName || inv.customerEmail || 'Customer';
    const customerSub = inv.phone || inv.address || '—';

    return '<tr>' +
      '<td><span class="cell-main">' + UI.fmtDate(inv.date) + '</span><span class="cell-sub">' + UI.escapeHtml(inv.type || 'Invoice') + '</span></td>' +
      '<td><a class="cell-main" href="invoice.html?id=' + encodeURIComponent(key) + '" target="_blank" rel="noopener">' + UI.escapeHtml(inv.no || '—') + '</a><span class="cell-sub">' + count + ' item' + (count === 1 ? '' : 's') + '</span></td>' +
      '<td><span class="cell-main">' + UI.escapeHtml(inv.customer || 'Walk-in customer') + '</span><span class="cell-sub">' + UI.escapeHtml(customerSub) + '</span></td>' +
      '<td class="num">' + UI.fmtRs(inv.total) + '</td>' +
      '<td class="num' + (UI.num(inv.balance) > 0 ? ' cell-warn' : '') + '">' + UI.fmtRs(inv.balance) + '</td>' +
      '<td>' + Dash.badge(status) + '</td>' +
      '<td>' + (linked
        ? '<span class="badge info portal-badge">' + UI.escapeHtml(portalName) + '</span>'
        : '<span class="badge muted">Not linked</span>') + '</td>' +
      '<td><div class="row-actions">' +
        '<a class="mini-act" href="invoice.html?id=' + encodeURIComponent(key) + '" target="_blank" rel="noopener">Open</a>' +
        '<button class="mini-act" type="button" data-copy-link="' + UI.escapeHtml(url) + '">Share link</button>' +
        '<button class="mini-act' + (linked ? '' : ' gold') + '" type="button" data-assign="' + UI.escapeHtml(key) + '">' + (linked ? 'Reassign' : 'Assign') + '</button>' +
        '<button class="mini-act danger" type="button" data-del-inv="' + UI.escapeHtml(key) + '">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }

  function renderInvoices() {
    const body = document.getElementById('adminInvBody');
    if (!body) return;
    const list = filteredInvoices();
    const count = document.getElementById('invCount');
    if (count) count.textContent = list.length + ' shown';
    body.innerHTML = list.length
      ? list.map(invoiceRow).join('')
      : Dash.emptyRow(8, 'file', 'No matching invoices', state.invoices.length
        ? 'Try a different search or status filter.'
        : 'Create an invoice in the <a href="invoice.html">invoice maker</a> — it appears here automatically.');
  }

  /* ---------------- Customers ---------------- */
  function renderCustomers() {
    const body = document.getElementById('adminCustBody');
    if (!body) return;
    const total = document.getElementById('custCount');
    if (total) total.textContent = String(state.customers.length);

    const q = state.custQuery.trim().toLowerCase();
    const list = state.customers.filter((c) => {
      if (!q) return true;
      return [c.name, c.email, c.phone].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    const shown = document.getElementById('custShown');
    if (shown) shown.textContent = list.length + ' shown';

    body.innerHTML = list.length
      ? list.map((c) => {
          const count = state.invoices.filter((inv) => inv.customerUid === c.uid).length;
          const waText = 'Hello ' + (c.name || '') + ', this is Alpha Electronic.';
          const isAdmin = isAdminAccount(c);
          return '<tr>' +
            '<td><span class="cell-main">' + UI.escapeHtml(c.name || 'Customer') + '</span><span class="cell-sub">' + UI.escapeHtml(c.email || '—') + '</span>' +
              (isAdmin ? '<span class="badge ok" style="margin-top:4px">Admin</span>' : '') + '</td>' +
            '<td>' + (c.phone
              ? '<a class="cell-main" href="tel:' + UI.escapeHtml(String(c.phone).replace(/[^\d+]/g, '')) + '">' + UI.escapeHtml(c.phone) + '</a>'
              : '<span class="cell-sub">No phone</span>') + '</td>' +
            '<td><span class="badge ' + (count ? 'info' : 'muted') + '">' + count + ' invoice' + (count === 1 ? '' : 's') + '</span></td>' +
            '<td><span class="cell-sub">' + UI.fmtDate(c.createdAt) + '</span></td>' +
            '<td><div class="row-actions">' +
              '<button class="mini-act" type="button" data-cust-inv="' + UI.escapeHtml(c.uid) + '">Invoices</button>' +
              '<button class="mini-act" type="button" data-cust-edit="' + UI.escapeHtml(c.uid) + '">Edit</button>' +
              (isAdmin ? '' : '<button class="mini-act gold" type="button" data-cust-admin="' + UI.escapeHtml(c.uid) + '">Make admin</button>') +
              (c.phone
                ? '<a class="mini-act" href="' + UI.escapeHtml(UI.waLink(waText)) + '" target="_blank" rel="noopener">WhatsApp</a>'
                : '') +
              '<button class="mini-act danger" type="button" data-cust-del="' + UI.escapeHtml(c.uid) + '">Delete</button>' +
            '</div></td>' +
            '</tr>';
        }).join('')
      : Dash.emptyRow(5, 'users', 'No customer accounts yet',
          'Customers create their own account at <a href="login.html?mode=register&amp;next=portal.html">login.html</a>. Ask them to use the email you have on file.');
  }

  /* ---------------- Admins ---------------- */
  function ownerEmail() {
    return state.setup && state.setup.adminEmail ? String(state.setup.adminEmail) : '';
  }

  function isAdminAccount(customer) {
    if (!customer) return false;
    if (state.admins.indexOf(customer.uid) >= 0) return true;
    const owner = ownerEmail().toLowerCase();
    return !!owner && String(customer.email || '').toLowerCase() === owner;
  }

  function adminRowHtml(row) {
    return '<tr>' +
      '<td><span class="cell-main">' + UI.escapeHtml(row.name || 'Admin account') + '</span>' +
        '<span class="cell-sub">' + UI.escapeHtml(row.email || row.uid || '—') + '</span></td>' +
      '<td><span class="badge ' + (row.access === 'Owner email' ? 'warn' : 'ok') + '">' + UI.escapeHtml(row.access) + '</span></td>' +
      '<td><div class="row-actions">' +
        (row.uid ? '<button class="mini-act" type="button" data-copy="' + UI.escapeHtml(row.uid) + '" data-copy-msg="Admin UID copied">Copy UID</button>' : '') +
        (row.removable && row.uid ? '<button class="mini-act danger" type="button" data-admin-del="' + UI.escapeHtml(row.uid) + '">Remove</button>' : '') +
      '</div></td>' +
      '</tr>';
  }

  function renderAdmins() {
    const body = document.getElementById('adminAdminsBody');
    if (!body) return;

    const me = state.user || {};
    const owner = ownerEmail();
    const ownerLower = owner.toLowerCase();
    const rows = [];
    state.admins.forEach((uid) => {
      const c = state.customers.find((item) => item.uid === uid);
      rows.push({
        uid: uid,
        name: c ? (c.name || c.email || 'Admin') : 'Admin account',
        email: c ? (c.email || '') : '',
        access: uid === me.uid ? 'You · admin' : 'Admin UID',
        removable: uid !== me.uid
      });
    });

    if (me.uid && !state.admins.includes(me.uid)) {
      const viaOwner = !!ownerLower && String(me.email || '').toLowerCase() === ownerLower;
      rows.push({
        uid: me.uid,
        name: (state.profile && state.profile.name) || me.displayName || 'You',
        email: me.email || '',
        access: viaOwner ? 'Owner email' : 'Admin UID',
        removable: false
      });
    }

    if (owner && !rows.some((r) => String(r.email || '').toLowerCase() === ownerLower)) {
      rows.push({ uid: '', name: 'Owner email (login)', email: owner, access: 'Owner email', removable: false });
    }

    body.innerHTML = rows.length
      ? rows.map(adminRowHtml).join('')
      : Dash.emptyRow(3, 'shield', 'No administrators listed', 'Add your owner email or paste an admin UID below.');

    const count = document.getElementById('adminsCount');
    if (count) count.textContent = String(rows.length);

    const emailInput = document.getElementById('adminEmailInput');
    if (emailInput && document.activeElement !== emailInput) emailInput.value = owner;
  }

  /* ---------------- Requests ---------------- */
  function renderRequests() {
    const grid = document.getElementById('adminReqGrid');
    if (!grid) return;

    const q = state.reqQuery.trim().toLowerCase();
    const filter = state.reqFilter;
    const list = state.requests.filter((r) => {
      const status = r.status || 'new';
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return [r.name, r.phone, r.email, r.message, r.type, r.package, r.source].join(' ').toLowerCase().indexOf(q) >= 0;
    });

    const count = document.getElementById('reqCount');
    if (count) count.textContent = list.length + ' shown';
    updateNavBadge();

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1">' + Dash.emptyState('inbox', 'No service requests',
        state.requests.length ? 'Try a different search or filter.' : 'Enquiries from the website quote form and customer portal will appear here.') + '</div>';
      return;
    }
    grid.innerHTML = list.map(requestCard).join('');
  }

  function requestCard(r) {
    const status = r.status || 'new';
    const key = r._key || '';
    const phoneDigits = String(r.phone || '').replace(/[^\d+]/g, '');
    const waText = 'Hello ' + (r.name || '') + ', this is Alpha Electronic about your ' + (r.type || 'request') + '.';

    return '<article class="req-card">' +
      '<header>' +
        '<div><strong>' + UI.escapeHtml(r.name || 'Unknown') + '</strong><span class="req-date">' + UI.timeAgo(r.createdAt) + '</span></div>' +
        Dash.badge(status) +
      '</header>' +
      '<span class="req-tag">' + UI.escapeHtml(r.type || 'quote') +
        (r.package ? ' · ' + UI.escapeHtml(r.package) : '') +
        (r.source ? ' · ' + UI.escapeHtml(r.source) : '') + '</span>' +
      '<p class="req-msg">' + UI.escapeHtml(r.message || 'No message') + '</p>' +
      (r.adminNote ? '<p class="req-note"><strong>Note:</strong> ' + UI.escapeHtml(r.adminNote) + '</p>' : '') +
      '<div class="req-contact">' +
        (r.phone ? '<a href="tel:' + UI.escapeHtml(phoneDigits) + '">' + UI.escapeHtml(r.phone) + '</a>' : '') +
        (r.email ? '<a href="mailto:' + UI.escapeHtml(r.email) + '">' + UI.escapeHtml(r.email) + '</a>' : '') +
      '</div>' +
      '<div class="req-actions">' +
        (r.phone ? '<a class="mini-act" href="' + UI.escapeHtml(UI.waLink(waText)) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
        '<button class="mini-act gold" type="button" data-req-note="' + UI.escapeHtml(key) + '">' + (r.adminNote ? 'Edit note' : 'Add note') + '</button>' +
        '<button class="mini-act" type="button" data-req-status="' + UI.escapeHtml(key) + '" data-status="' + (status === 'done' ? 'new' : 'done') + '">' +
          (status === 'done' ? 'Reopen' : 'Mark done') + '</button>' +
        '<button class="mini-act danger" type="button" data-req-del="' + UI.escapeHtml(key) + '">Delete</button>' +
      '</div>' +
      '</article>';
  }

  function renderRecentRequests() {
    const el = document.getElementById('adminRecentReq');
    if (!el) return;
    const list = state.requests.slice(0, 4);
    if (!list.length) {
      el.innerHTML = '<li style="border:0;padding:0">' + Dash.emptyState('inbox', 'No requests yet', 'Website and portal enquiries will appear here.') + '</li>';
      return;
    }
    el.innerHTML = list.map((r) => {
      return '<li>' +
        '<span class="k"><strong class="cell-main">' + UI.escapeHtml(r.name || 'Unknown') + '</strong>' +
        '<span class="cell-sub">' + UI.escapeHtml(r.type || 'quote') + ' · ' + UI.timeAgo(r.createdAt) + '</span></span>' +
        '<span class="v">' + Dash.badge(r.status || 'new') + '</span>' +
        '</li>';
    }).join('');
  }

  /* ---------------- Prices ---------------- */
  function prettyKey(key) {
    return String(key || '').split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function isCustomKey(key) {
    return !(window.AE_CATALOG || []).some((item) => item.item.toLowerCase() === key);
  }

  function renderPrices() {
    const body = document.getElementById('priceBody');
    if (!body) return;

    const q = state.priceQuery.trim().toLowerCase();
    const group = state.priceGroup;
    const catalog = window.AE_CATALOG || [];
    const rows = catalog.filter((item) => {
      if (group && group !== 'All' && item.group !== group) return false;
      if (!q) return true;
      return (item.item + ' ' + item.desc + ' ' + item.group).toLowerCase().indexOf(q) >= 0;
    });

    const count = document.getElementById('priceCount');
    if (count) count.textContent = rows.length + ' shown';

    body.innerHTML = rows.length
      ? rows.map((item) => {
          const key = item.item.toLowerCase();
          const hasOverride = state.prices[key] != null && state.prices[key] !== '';
          const price = hasOverride ? UI.num(state.prices[key]) : item.price;
          return '<tr>' +
            '<td><span class="price-group">' + UI.escapeHtml(item.group) + '</span></td>' +
            '<td><span class="cell-main">' + UI.escapeHtml(item.item) + '</span><span class="cell-sub">' + UI.escapeHtml(item.desc) + '</span></td>' +
            '<td class="num price-default">' + UI.fmtRsShort(item.price) + '</td>' +
            '<td class="num"><input class="dash-input price-input" type="number" min="0" step="50" value="' + price + '" data-price-input="' + UI.escapeHtml(item.item) + '" aria-label="Price for ' + UI.escapeHtml(item.item) + '"></td>' +
            '<td>' + (hasOverride ? '<span class="price-flag custom">Custom</span>' : '<span class="price-flag">Default</span>') + '</td>' +
            '<td><div class="row-actions">' +
              '<button class="mini-act gold" type="button" data-price-save="' + UI.escapeHtml(item.item) + '">Save</button>' +
              '<button class="mini-act" type="button" data-price-reset="' + UI.escapeHtml(item.item) + '"' + (hasOverride ? '' : ' disabled') + '>Reset</button>' +
            '</div></td>' +
            '</tr>';
        }).join('')
      : Dash.emptyRow(6, 'tag', 'No items match', 'Try a different search or category.');

    const customBody = document.getElementById('customPriceBody');
    if (!customBody) return;
    const keys = Object.keys(state.prices)
      .filter((k) => isCustomKey(k) && UI.num(state.prices[k]) > 0)
      .sort();
    customBody.innerHTML = keys.length
      ? keys.map((key) => {
          return '<tr>' +
            '<td><span class="cell-main">' + UI.escapeHtml(prettyKey(key)) + '</span><span class="cell-sub">' + UI.escapeHtml(key) + '</span></td>' +
            '<td class="num"><input class="dash-input price-input" type="number" min="0" step="50" value="' + UI.num(state.prices[key]) + '" data-custom-input="' + UI.escapeHtml(key) + '" aria-label="Price for ' + UI.escapeHtml(key) + '"></td>' +
            '<td><div class="row-actions">' +
              '<button class="mini-act gold" type="button" data-custom-save="' + UI.escapeHtml(key) + '">Save</button>' +
              '<button class="mini-act danger" type="button" data-custom-del="' + UI.escapeHtml(key) + '">Remove</button>' +
            '</div></td>' +
            '</tr>';
        }).join('')
      : Dash.emptyRow(3, 'tag', 'No custom prices yet', 'Use the form above to add a custom item price.');
  }

  /* ---------------- Setup ---------------- */
  function fillSetup() {
    const user = state.user;
    if (!user) return;
    const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    text('setupEmail', user.email || '—');
    text('setupRole', 'Administrator');
    text('setupUid', user.uid);

    const copy = document.getElementById('btnCopyUid');
    if (copy) copy.setAttribute('data-copy', user.uid);

    let adminEmail = 'Checking…';
    if (state.setup) {
      if (state.setup.adminEmail) adminEmail = state.setup.adminEmail;
      else if (state.setup.isAdmin) adminEmail = 'Access via admins/UID';
      else adminEmail = 'Not set';
    } else if (state.rulesError) {
      adminEmail = 'Unavailable — publish the rules first';
    }
    text('setupAdminEmail', adminEmail);

    const emailInput = document.getElementById('adminEmailInput');
    if (emailInput && document.activeElement !== emailInput) emailInput.value = state.setup && state.setup.adminEmail ? state.setup.adminEmail : '';

    const rules = document.getElementById('setupRulesState');
    if (rules) {
      rules.innerHTML = state.rulesError
        ? '<span class="badge warn">Permission denied</span>'
        : '<span class="badge ok">Rules reachable</span>';
    }
  }

  function renderSetupCounts() {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    set('setupInvCount', state.invoices.length);
    set('setupCustCount', state.customers.length);
    set('setupAdminCount', state.admins.length);
    set('setupReqCount', state.requests.length);
    set('setupPriceCount', Object.keys(state.prices).length);
  }

  function renderRulesCheck() {
    const body = document.getElementById('rulesCheckBody');
    if (!body) return;
    if (!state.rulesCheck.length) {
      body.innerHTML = Dash.emptyRow(3, 'shield', 'Access check not run yet', 'Press “Run access check” to test the published Firebase rules.');
      return;
    }
    body.innerHTML = state.rulesCheck.map((row) => {
      return '<tr>' +
        '<td><span class="cell-main mono">' + UI.escapeHtml(row.path) + '</span></td>' +
        '<td><span class="cell-sub">' + UI.escapeHtml(row.label) + '</span></td>' +
        '<td>' + (row.ok
          ? '<span class="badge ok">Allowed</span>'
          : '<span class="badge warn">' + UI.escapeHtml(row.error || 'Denied') + '</span>') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderSecurity() {
    const sec = window.AE_Sec;
    if (!sec) return;
    const st = sec.status();
    const set = (id, text, good) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.style.color = good ? '#146c43' : '#9a5b00';
    };
    set('secHttps', st.https ? 'HTTPS' : (st.local ? 'Local HTTP (allowed)' : 'Not secure'), st.https || st.local);
    set('secFrame', st.framed ? 'Framed — blocked' : 'Blocked', !st.framed);
    set('secIdle', st.idleActive ? st.idleMinutes + ' minutes' : 'Waiting for sign-in', st.idleActive);
    set('secGuard', 'Active', true);
    set('secRobots', st.noindex ? 'No-index' : 'Not set', st.noindex);
  }

  async function runRulesCheck(btn) {
    if (btn) UI.setBusy(btn, true, 'Checking…');
    try {
      state.rulesCheck = await Cloud.diagnoseRules();
      renderRulesCheck();
      const bad = state.rulesCheck.filter((row) => !row.ok).length;
      UI.toast(bad ? bad + ' path' + (bad === 1 ? '' : 's') + ' denied — publish the latest rules' : 'All admin paths are readable');
    } catch (e) {
      UI.toast('Could not run the access check');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  /* ---------------- Modals ---------------- */
  function openAssign(key) {
    const inv = state.invoices.find((item) => item._key === key);
    if (!inv) return;
    state.assignKey = key;

    const sub = document.getElementById('assignSub');
    if (sub) sub.textContent = 'Invoice ' + (inv.no || '') + ' · ' + (inv.customer || 'Walk-in customer');

    const sel = document.getElementById('assignCustomer');
    if (!sel) return;
    const options = [];
    if (!state.customers.length) {
      options.push('<option value="">No customer accounts yet — ask the customer to register</option>');
    } else {
      options.push('<option value="">Not assigned — no portal access</option>');
      state.customers.forEach((c) => {
        options.push('<option value="' + UI.escapeHtml(c.uid) + '"' + (c.uid === inv.customerUid ? ' selected' : '') + '>' +
          UI.escapeHtml((c.name || 'Customer') + ' · ' + (c.email || '')) + '</option>');
      });
    }
    sel.innerHTML = options.join('');
    Dash.openModal('assignModal');
  }

  function openConfirm(title, text, label, fn) {
    state.confirmFn = fn;
    const titleEl = document.getElementById('confirmTitle');
    const textEl = document.getElementById('confirmText');
    const go = document.getElementById('confirmGo');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (go) go.textContent = label || 'Delete';
    Dash.openModal('confirmModal');
  }

  /* ---------------- Actions ---------------- */
  async function saveCatalogPrice(name, row) {
    const input = row ? row.querySelector('[data-price-input]') : null;
    if (!input) return;
    const value = UI.num(input.value);
    if (!(value > 0)) {
      UI.toast('Enter a price above zero');
      input.focus();
      return;
    }
    const btn = row.querySelector('[data-price-save]');
    if (btn) UI.setBusy(btn, true, 'Saving…');
    try {
      await Cloud.savePrice(name, value);
      UI.toast(name + ' price updated');
    } catch (e) {
      UI.toast('Could not save the price — check database rules');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  async function resetCatalogPrice(name, btn) {
    if (btn) UI.setBusy(btn, true, 'Resetting…');
    try {
      await Cloud.clearPrice(name);
      UI.toast('Using the default price for ' + name);
    } catch (e) {
      UI.toast('Could not reset the price');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  async function saveCustomPrice(key, row) {
    const input = row ? row.querySelector('[data-custom-input]') : null;
    if (!input) return;
    const value = UI.num(input.value);
    if (!(value > 0)) {
      UI.toast('Enter a price above zero');
      input.focus();
      return;
    }
    const btn = row.querySelector('[data-custom-save]');
    if (btn) UI.setBusy(btn, true, 'Saving…');
    try {
      await Cloud.savePrice(key, value);
      UI.toast('Custom price updated');
    } catch (e) {
      UI.toast('Could not save the price');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  async function syncLocal(btn) {
    if (!state.user || !state.admin) return;
    if (btn) btn.disabled = true;
    UI.toast('Syncing device invoices…');
    try {
      const result = await Cloud.syncLocalInvoices();
      const parts = [];
      parts.push(result.count ? 'Synced ' + result.count + ' invoice' + (result.count === 1 ? '' : 's') : 'No local invoices found on this device');
      if (result.skipped) parts.push(result.skipped + ' skipped');
      UI.toast(parts.join(' · '));
    } catch (e) {
      UI.toast('Sync failed — check the database rules and try again');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      business: 'Alpha Electronic',
      ownerEmail: ownerEmail(),
      admins: state.admins,
      invoices: state.invoices,
      customers: state.customers,
      messages: state.requests,
      prices: state.prices
    };
    Dash.download('alpha-electronic-all-' + stamp() + '.json', JSON.stringify(payload, null, 2));
    UI.toast('Full Firebase backup downloaded');
  }

  function exportCsv() {
    const rows = [[
      'Invoice No', 'Date', 'Type', 'Customer', 'Phone', 'Address', 'Items',
      'Subtotal', 'Discount', 'Advance', 'Total', 'Balance', 'Status',
      'Portal customer', 'Signature'
    ]];
    state.invoices.forEach((inv) => {
      rows.push([
        inv.no || '', inv.date || '', inv.type || '', inv.customer || '', inv.phone || '',
        inv.address || '', (inv.items || []).length, inv.subtotal || 0, inv.discount || 0,
        inv.advance || 0, inv.total || 0, inv.balance || 0, Dash.statusOf(inv),
        inv.customerEmail || '', inv.signatureName || ''
      ]);
    });
    Dash.download('alpha-invoices-' + stamp() + '.csv', '\uFEFF' + Dash.toCsv(rows), 'text/csv;charset=utf-8');
    UI.toast('Invoice CSV downloaded');
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function filterByCustomer(uid) {
    const c = state.customers.find((item) => item.uid === uid);
    if (!c) return;
    state.invQuery = c.email || c.name || '';
    state.invFilter = 'all';
    const search = document.getElementById('invSearch');
    if (search) search.value = state.invQuery;
    const filter = document.getElementById('invFilter');
    if (filter) filter.value = 'all';
    showTab('invoices');
    renderInvoices();
  }

  /* ---------------- Customer / admin actions ---------------- */
  function openCustomer(uid) {
    const c = state.customers.find((item) => item.uid === uid);
    if (!c) return;
    state.custUid = uid;
    const name = document.getElementById('custEditName');
    const phone = document.getElementById('custEditPhone');
    const email = document.getElementById('custEditEmail');
    const sub = document.getElementById('customerSub');
    if (name) name.value = c.name || '';
    if (phone) phone.value = c.phone || '';
    if (email) email.value = c.email || '';
    if (sub) sub.textContent = 'Update ' + (c.name || c.email || 'this customer') + ' in Firebase.';
    Dash.openModal('customerModal');
    if (name) setTimeout(() => name.focus(), 80);
  }

  async function saveCustomer(btn) {
    const uid = state.custUid;
    const c = state.customers.find((item) => item.uid === uid);
    if (!uid || !c) { Dash.closeModal('customerModal'); return; }
    const nameEl = document.getElementById('custEditName');
    const phoneEl = document.getElementById('custEditPhone');
    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    if (!name) { UI.toast('Enter the customer name'); if (nameEl) nameEl.focus(); return; }
    if (btn) UI.setBusy(btn, true, 'Saving…');
    try {
      await Cloud.updateCustomer(uid, { name: name, email: c.email || '', phone: phone });
      UI.toast('Customer details saved');
      Dash.closeModal('customerModal');
    } catch (e) {
      UI.toast('Could not save the customer — check database rules');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  function confirmDeleteCustomer(uid) {
    const c = state.customers.find((item) => item.uid === uid);
    if (!c) return;
    const label = c.name || c.email || 'this customer';
    openConfirm(
      'Delete customer data',
      'The profile and portal invoice access for ' + label + ' will be removed. Every assigned invoice will be unassigned. The Firebase login account itself must be deleted in Firebase Console.',
      'Delete data',
      async () => {
        for (const inv of state.invoices) {
          if (inv.customerUid === uid) await Cloud.clearInvoiceCustomer(inv._key, inv);
        }
        await Cloud.deleteCustomer(uid);
        UI.toast('Customer data removed');
      }
    );
  }

  function confirmMakeAdmin(uid) {
    const c = state.customers.find((item) => item.uid === uid);
    if (!c) return;
    openConfirm(
      'Make administrator',
      (c.name || c.email || 'This customer') + ' will get full access to invoices, customers, messages, admins and prices. Continue?',
      'Make admin',
      async () => {
        await Cloud.addAdmin(uid);
        UI.toast('Administrator added');
      }
    );
  }

  function confirmRemoveAdmin(uid) {
    const c = state.customers.find((item) => item.uid === uid);
    const label = c ? (c.name || c.email || uid) : uid;
    openConfirm(
      'Remove administrator',
      label + ' will lose admin access immediately and will only see their own customer portal.',
      'Remove admin',
      async () => {
        await Cloud.removeAdmin(uid);
        UI.toast('Admin access removed');
      }
    );
  }

  function openNote(key) {
    const r = state.requests.find((item) => item._key === key);
    if (!r) return;
    state.noteKey = key;
    const text = document.getElementById('noteText');
    const sub = document.getElementById('noteSub');
    if (text) text.value = r.adminNote || '';
    if (sub) {
      sub.textContent = 'From ' + (r.name || 'unknown') + (r.phone ? ' · ' + r.phone : '') + ' — only administrators can read this.';
    }
    Dash.openModal('noteModal');
    if (text) setTimeout(() => text.focus(), 80);
  }

  async function saveNote(btn) {
    const key = state.noteKey;
    if (!key) { Dash.closeModal('noteModal'); return; }
    const text = document.getElementById('noteText');
    const note = text ? text.value.trim() : '';
    if (btn) UI.setBusy(btn, true, 'Saving…');
    try {
      await Cloud.setRequestNote(key, note);
      UI.toast(note ? 'Note saved to Firebase' : 'Note cleared');
      state.noteKey = '';
      Dash.closeModal('noteModal');
    } catch (e) {
      UI.toast('Could not save the note — check database rules');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  async function addAdminByUid(btn) {
    const input = document.getElementById('adminUidInput');
    const uid = input ? input.value.trim() : '';
    if (!uid) { UI.toast('Paste the Firebase user UID'); if (input) input.focus(); return; }
    if (btn) UI.setBusy(btn, true, 'Adding…');
    try {
      await Cloud.addAdmin(uid);
      if (input) input.value = '';
      UI.toast('Administrator added');
    } catch (e) {
      UI.toast((e && e.message) || 'Could not add the administrator');
    } finally {
      if (btn) UI.setBusy(btn, false);
    }
  }

  function saveAdminEmail() {
    const input = document.getElementById('adminEmailInput');
    const email = input ? input.value.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      UI.toast('Enter a valid admin email');
      if (input) input.focus();
      return;
    }
    openConfirm(
      'Change owner email',
      'Admin access by email will move to ' + email + '. Make sure your account UID is listed in Administrators first, or you may lose access after signing in again.',
      'Save email',
      async () => {
        await Cloud.setAdminEmail(email);
        if (state.setup) state.setup.adminEmail = email;
        else state.setup = { adminEmail: email, isAdmin: true };
        fillSetup();
        renderAdmins();
        UI.toast('Owner email updated');
      }
    );
  }

  /* ---------------- Bindings ---------------- */
  function bindStatic() {
    UI.$$('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => showTab(el.dataset.goto));
    });

    const invSearch = document.getElementById('invSearch');
    if (invSearch) invSearch.addEventListener('input', () => {
      state.invQuery = invSearch.value;
      renderInvoices();
    });
    const invFilter = document.getElementById('invFilter');
    if (invFilter) invFilter.addEventListener('change', () => {
      state.invFilter = invFilter.value;
      renderInvoices();
    });
    const invExport = document.getElementById('btnInvExport');
    if (invExport) invExport.addEventListener('click', exportCsv);

    const custSearch = document.getElementById('custSearch');
    if (custSearch) custSearch.addEventListener('input', () => {
      state.custQuery = custSearch.value;
      renderCustomers();
    });

    const reqSearch = document.getElementById('reqSearch');
    if (reqSearch) reqSearch.addEventListener('input', () => {
      state.reqQuery = reqSearch.value;
      renderRequests();
    });
    const reqFilter = document.getElementById('reqFilter');
    if (reqFilter) reqFilter.addEventListener('change', () => {
      state.reqFilter = reqFilter.value;
      renderRequests();
    });

    const priceSearch = document.getElementById('priceSearch');
    if (priceSearch) priceSearch.addEventListener('input', () => {
      state.priceQuery = priceSearch.value;
      renderPrices();
    });
    const priceGroup = document.getElementById('priceGroup');
    if (priceGroup) priceGroup.addEventListener('change', () => {
      state.priceGroup = priceGroup.value;
      renderPrices();
    });

    const customForm = document.getElementById('customPriceForm');
    if (customForm) {
      customForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameEl = document.getElementById('cpName');
        const priceEl = document.getElementById('cpPrice');
        const name = nameEl.value.trim();
        const price = UI.num(priceEl.value);
        if (!name) { UI.toast('Enter an item name'); nameEl.focus(); return; }
        if (/[.#$\[\]\/]/.test(name)) { UI.toast('Item names cannot contain . # $ [ ] /'); nameEl.focus(); return; }
        if (!(price > 0)) { UI.toast('Enter a price above zero'); priceEl.focus(); return; }
        const btn = document.getElementById('cpSubmit');
        UI.setBusy(btn, true, 'Adding…');
        try {
          await Cloud.savePrice(name, price);
          nameEl.value = '';
          priceEl.value = '';
          UI.toast('Custom price added');
        } catch (err) {
          UI.toast('Could not save the price — check database rules');
        } finally {
          UI.setBusy(btn, false);
        }
      });
    }

    const assignSave = document.getElementById('assignSave');
    if (assignSave) {
      assignSave.addEventListener('click', async () => {
        const key = state.assignKey;
        const inv = state.invoices.find((item) => item._key === key);
        if (!key || !inv) { Dash.closeModal('assignModal'); return; }

        const sel = document.getElementById('assignCustomer');
        const uid = sel ? sel.value : '';
        UI.setBusy(assignSave, true, 'Saving…');
        try {
          if (!uid) {
            if (!inv.customerUid) {
              UI.toast('Choose a customer account');
              return;
            }
            await Cloud.clearInvoiceCustomer(key, inv);
            UI.toast('Customer access removed');
          } else {
            const customer = state.customers.find((item) => item.uid === uid);
            if (!customer) { UI.toast('Customer not found'); return; }
            await Cloud.assignCustomer(key, inv, customer);
            UI.toast('Invoice assigned to ' + (customer.name || customer.email || 'customer'));
          }
          Dash.closeModal('assignModal');
        } catch (err) {
          UI.toast('Could not update access — check database rules');
        } finally {
          UI.setBusy(assignSave, false);
        }
      });
    }

    const confirmGo = document.getElementById('confirmGo');
    if (confirmGo) {
      confirmGo.addEventListener('click', async () => {
        const fn = state.confirmFn;
        if (!fn) return;
        state.confirmFn = null;
        Dash.closeModal('confirmModal');
        UI.setBusy(confirmGo, true, 'Working…');
        try {
          await fn();
        } catch (e) {
          UI.toast('Could not complete the action — check your access');
        } finally {
          UI.setBusy(confirmGo, false);
        }
      });
    }

    UI.$$('[data-sync-local]').forEach((btn) => {
      btn.addEventListener('click', () => syncLocal(btn));
    });
    const syncBtn = document.getElementById('btnSyncLocal');
    if (syncBtn) syncBtn.addEventListener('click', () => syncLocal(syncBtn));

    const exportJsonBtn = document.getElementById('btnExportJson');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJson);
    const exportCsvBtn = document.getElementById('btnExportCsv');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

    const copyRules = document.getElementById('btnCopyRules');
    if (copyRules) copyRules.addEventListener('click', () => Dash.copyRules(copyRules));

    bindInvoiceRows('adminInvBody');
    bindInvoiceRows('adminRecentBody');

    const custBody = document.getElementById('adminCustBody');
    if (custBody) {
      custBody.addEventListener('click', (e) => {
        const invBtn = e.target.closest('[data-cust-inv]');
        if (invBtn) { filterByCustomer(invBtn.dataset.custInv); return; }
        const editBtn = e.target.closest('[data-cust-edit]');
        if (editBtn) { openCustomer(editBtn.dataset.custEdit); return; }
        const adminBtn = e.target.closest('[data-cust-admin]');
        if (adminBtn) { confirmMakeAdmin(adminBtn.dataset.custAdmin); return; }
        const delBtn = e.target.closest('[data-cust-del]');
        if (delBtn) { confirmDeleteCustomer(delBtn.dataset.custDel); }
      });
    }

    const adminsBody = document.getElementById('adminAdminsBody');
    if (adminsBody) {
      adminsBody.addEventListener('click', (e) => {
        const del = e.target.closest('[data-admin-del]');
        if (del) confirmRemoveAdmin(del.dataset.adminDel);
      });
    }

    const adminAddForm = document.getElementById('adminAddForm');
    if (adminAddForm) {
      adminAddForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addAdminByUid(document.getElementById('adminAddBtn'));
      });
    }

    const adminEmailForm = document.getElementById('adminEmailForm');
    if (adminEmailForm) {
      adminEmailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdminEmail();
      });
    }

    const custEditSave = document.getElementById('custEditSave');
    if (custEditSave) custEditSave.addEventListener('click', () => saveCustomer(custEditSave));

    const noteSave = document.getElementById('noteSave');
    if (noteSave) noteSave.addEventListener('click', () => saveNote(noteSave));

    const rulesCheck = document.getElementById('btnRulesCheck');
    if (rulesCheck) rulesCheck.addEventListener('click', () => runRulesCheck(rulesCheck));
    const copyRules2 = document.getElementById('btnCopyRules2');
    if (copyRules2) copyRules2.addEventListener('click', () => Dash.copyRules(copyRules2));

    const reqGrid = document.getElementById('adminReqGrid');
    if (reqGrid) {
      reqGrid.addEventListener('click', async (e) => {
        const noteBtn = e.target.closest('[data-req-note]');
        if (noteBtn) { openNote(noteBtn.dataset.reqNote); return; }
        const statusBtn = e.target.closest('[data-req-status]');
        if (statusBtn) {
          const key = statusBtn.dataset.reqStatus;
          const status = statusBtn.dataset.status;
          UI.setBusy(statusBtn, true, 'Saving…');
          try {
            await Cloud.setRequestStatus(key, status);
            UI.toast(status === 'done' ? 'Marked as done' : 'Request reopened');
          } catch (err) {
            UI.toast('Could not update the request');
          } finally {
            UI.setBusy(statusBtn, false);
          }
          return;
        }
        const delBtn = e.target.closest('[data-req-del]');
        if (delBtn) {
          const req = state.requests.find((item) => item._key === delBtn.dataset.reqDel);
          if (!req) return;
          openConfirm(
            'Delete request',
            'The service request from ' + (req.name || 'this customer') + ' will be permanently removed.',
            'Delete',
            async () => {
              await Cloud.deleteRequest(req._key);
              UI.toast('Request deleted');
            }
          );
        }
      });
    }

    const priceBody = document.getElementById('priceBody');
    if (priceBody) {
      priceBody.addEventListener('click', (e) => {
        const save = e.target.closest('[data-price-save]');
        if (save) { saveCatalogPrice(save.dataset.priceSave, save.closest('tr')); return; }
        const reset = e.target.closest('[data-price-reset]');
        if (reset) { resetCatalogPrice(reset.dataset.priceReset, reset); }
      });
    }

    const customBody = document.getElementById('customPriceBody');
    if (customBody) {
      customBody.addEventListener('click', (e) => {
        const save = e.target.closest('[data-custom-save]');
        if (save) { saveCustomPrice(save.dataset.customSave, save.closest('tr')); return; }
        const del = e.target.closest('[data-custom-del]');
        if (del) {
          const key = del.dataset.customDel;
          openConfirm(
            'Remove custom price',
            '“' + prettyKey(key) + '” will no longer appear in the invoice maker.',
            'Remove',
            async () => {
              await Cloud.clearPrice(key);
              UI.toast('Custom price removed');
            }
          );
        }
      });
    }
  }

  function bindInvoiceRows(id) {
    const body = document.getElementById(id);
    if (!body) return;
    body.addEventListener('click', (e) => {
      const assign = e.target.closest('[data-assign]');
      if (assign) { openAssign(assign.dataset.assign); return; }
      const del = e.target.closest('[data-del-inv]');
      if (del) {
        const inv = state.invoices.find((item) => item._key === del.dataset.delInv);
        if (!inv) return;
        openConfirm(
          'Delete invoice',
          'Invoice ' + (inv.no || '') + ' will be removed from the cloud for everyone. Local copies on devices are not affected.',
          'Delete',
          async () => {
            await Cloud.deleteInvoice(inv._key);
            UI.toast('Invoice deleted');
          }
        );
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
