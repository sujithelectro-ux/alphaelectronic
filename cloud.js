'use strict';

/* =========================================================
   Alpha Electronic — shared Firebase layer
   Works with the Firebase compat SDK loaded before this file.
   ========================================================= */
window.AE_Cloud = (function () {
  const cfg = window.AE_FIREBASE_CONFIG || {};
  const OWNER_EMAIL = String(window.AE_ADMIN_EMAIL || 'sujithelectro@gmail.com').trim().toLowerCase();
  const state = {
    ok: false,
    started: false,
    resolved: false,
    app: null,
    auth: null,
    db: null,
    user: null,
    admin: false,
    adminEmail: '',
    rulesError: false,
    error: ''
  };

  const listeners = new Set();
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  let resolving = null;
  let profileCheckedFor = '';
  let redirectError = '';

  function init() {
    if (state.started) return state.ok;
    state.started = true;

    if (!window.firebase) {
      state.error = 'Firebase SDK could not load. Check your internet connection.';
      resolveReady(false);
      return false;
    }
    if (!cfg.apiKey || !cfg.databaseURL) {
      state.error = 'Firebase settings are missing in firebase-config.js.';
      resolveReady(false);
      return false;
    }

    try {
      state.app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      state.auth = firebase.auth();
      state.db = firebase.database();
      state.ok = true;
    } catch (e) {
      state.error = e && e.message ? e.message : 'Firebase could not start.';
      resolveReady(false);
      return false;
    }

    state.auth.onAuthStateChanged((user) => {
      resolveUser(user).catch(() => {
        state.user = user || null;
        state.admin = false;
        finishResolve();
      });
    });

    if (state.auth.getRedirectResult) {
      state.auth.getRedirectResult().catch((e) => {
        redirectError = friendlyAuthError(e);
        emit();
      });
    }

    return true;
  }

  async function resolveUser(user) {
    state.user = user || null;
    state.admin = false;
    if (!user) {
      finishResolve();
      return;
    }
    if (resolving) return resolving;
    const uid = user.uid;
    resolving = (async () => {
      try {
        if (profileCheckedFor !== uid) {
          await ensureProfile(user, authProvider(user));
        }
        const admin = await resolveAdmin(user);
        if (state.user && state.user.uid === uid) state.admin = admin;
      } catch (e) {
        if (state.user && state.user.uid === uid) state.admin = false;
      } finally {
        resolving = null;
        finishResolve();
      }
    })();
    return resolving;
  }

  function authProvider(user) {
    const ids = ((user && user.providerData) || []).map((p) => p && p.providerId);
    if (ids.indexOf('google.com') > -1) return 'google';
    if (ids.indexOf('phone') > -1) return 'phone';
    return 'password';
  }

  async function resolveAdmin(user) {
    const email = String(user.email || '').trim().toLowerCase();
    if (email && email === OWNER_EMAIL) {
      try {
        const snap = await state.db.ref('config/adminEmail').get();
        const current = String(snap.val() || '').trim().toLowerCase();
        state.adminEmail = current || OWNER_EMAIL;
        if (!current) await state.db.ref('config/adminEmail').set(OWNER_EMAIL);
      } catch (e) {
        state.adminEmail = OWNER_EMAIL;
        if (isPermissionError(e)) state.rulesError = true;
      }
      return true;
    }
    try {
      const snap = await state.db.ref('admins/' + user.uid).get();
      if (snap.exists() && snap.val() === true) return true;
    } catch (e) {
      if (isPermissionError(e)) state.rulesError = true;
    }
    try {
      const snap = await state.db.ref('config/adminEmail').get();
      const configured = String(snap.val() || '').trim().toLowerCase();
      state.adminEmail = configured;
      if (configured && email && configured === email) return true;
    } catch (e) {
      if (isPermissionError(e)) state.rulesError = true;
    }
    return false;
  }

  function finishResolve() {
    if (!state.resolved) {
      state.resolved = true;
      resolveReady(true);
    }
    emit();
  }

  function isPermissionError(e) {
    const code = String((e && (e.code || e.message)) || '').toLowerCase();
    return code.includes('permission') || code.includes('denied');
  }

  function snapshot() {
    return {
      ok: state.ok,
      user: state.user,
      admin: state.admin,
      adminEmail: state.adminEmail,
      rulesError: state.rulesError,
      error: state.error
    };
  }

  function emit() {
    const s = snapshot();
    listeners.forEach((fn) => {
      try { fn(s); } catch (e) { console.error(e); }
    });
  }

  function onAuth(fn) {
    init();
    listeners.add(fn);
    if (state.resolved) fn(snapshot());
    return () => listeners.delete(fn);
  }

  function waitReady() {
    init();
    return ready;
  }

  function currentUser() {
    return state.user;
  }

  function isAdmin() {
    return !!state.user && state.admin;
  }

  /* ---------------- Auth ---------------- */
  async function signIn(email, password) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    const cred = await state.auth.signInWithEmailAndPassword(String(email).trim(), String(password));
    await resolveUser(cred.user);
    return cred.user;
  }

  async function signUp(data) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    const email = String(data.email || '').trim();
    const cred = await state.auth.createUserWithEmailAndPassword(email, String(data.password));
    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').trim();
    try {
      await cred.user.updateProfile({ displayName: name });
    } catch (e) { /* non-fatal */ }
    let profileError = '';
    try {
      await state.db.ref('users/' + cred.user.uid).set({
        name: name,
        email: email,
        phone: phone,
        role: 'customer',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (e) {
      profileError = isPermissionError(e)
        ? 'Account created, but the database rules are not published yet.'
        : 'Account created, but the profile could not be saved.';
    }
    await resolveUser(cred.user);
    return { user: cred.user, profileError: profileError };
  }

  async function signOut() {
    if (state.auth) await state.auth.signOut();
    state.admin = false;
    emit();
  }

  async function resetPassword(email) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    await state.auth.sendPasswordResetEmail(String(email).trim());
  }

  function errorCode(err) {
    return String((err && (err.code || err.message)) || '').toLowerCase();
  }

  async function ensureProfile(user, provider) {
    if (!user) return '';
    profileCheckedFor = user.uid;
    try {
      const ref = state.db.ref('users/' + user.uid);
      const snap = await ref.get();
      if (snap.exists()) {
        const current = snap.val() || {};
        const updates = {};
        if (!current.name && String(user.displayName || '').trim()) updates.name = String(user.displayName).trim();
        if (!current.email && user.email) updates.email = user.email;
        if (!current.phone && user.phoneNumber) updates.phone = user.phoneNumber;
        if (!current.role) updates.role = 'customer';
        if (!current.provider) updates.provider = provider || 'password';
        if (!current.createdAt) updates.createdAt = firebase.database.ServerValue.TIMESTAMP;
        if (Object.keys(updates).length) await ref.update(updates);
        return '';
      }
      await ref.set({
        name: String(user.displayName || '').trim() || 'Customer',
        email: String(user.email || '').trim(),
        phone: String(user.phoneNumber || '').trim(),
        role: 'customer',
        provider: provider || 'password',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      return '';
    } catch (e) {
      return isPermissionError(e)
        ? 'Signed in, but the database rules are not published yet.'
        : 'Signed in, but your profile could not be saved.';
    }
  }

  async function signInWithGoogle() {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    let cred;
    try {
      cred = await state.auth.signInWithPopup(provider);
    } catch (e) {
      const code = errorCode(e);
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
        await state.auth.signInWithRedirect(provider);
        return { user: null, redirecting: true, profileError: '' };
      }
      throw e;
    }
    const profileError = await ensureProfile(cred.user, 'google');
    await resolveUser(cred.user);
    return { user: cred.user, redirecting: false, profileError: profileError };
  }

  let phoneVerifier = null;
  let phoneConfirmation = null;

  async function startPhoneSignIn(phoneNumber, containerId) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    if (!firebase.auth.RecaptchaVerifier) {
      throw new Error('Phone sign-in is not available. Check your internet connection.');
    }
    const id = containerId || 'recaptchaContainer';
    if (!document.getElementById(id)) throw new Error('Phone sign-in is not ready. Reload the page.');
    if (!phoneVerifier) {
      phoneVerifier = new firebase.auth.RecaptchaVerifier(id, { size: 'invisible' }, state.auth);
    }
    phoneConfirmation = await state.auth.signInWithPhoneNumber(String(phoneNumber), phoneVerifier);
    return true;
  }

  async function confirmPhoneCode(code) {
    if (!phoneConfirmation) throw new Error('Request an SMS code first.');
    const cred = await phoneConfirmation.confirm(String(code || '').trim());
    phoneConfirmation = null;
    const profileError = await ensureProfile(cred.user, 'phone');
    await resolveUser(cred.user);
    return { user: cred.user, profileError: profileError };
  }

  function cancelPhoneSignIn() {
    phoneConfirmation = null;
    if (phoneVerifier) {
      try { phoneVerifier.clear(); } catch (e) { /* ignore */ }
      phoneVerifier = null;
    }
  }

  function takeRedirectError() {
    const message = redirectError;
    redirectError = '';
    return message;
  }

  async function updateProfile(data) {
    const user = state.user;
    if (!user) throw new Error('Sign in required');
    const payload = {
      name: String(data.name || '').trim(),
      email: user.email || '',
      phone: String(data.phone || '').trim(),
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    await state.db.ref('users/' + user.uid).update(payload);
    try { await user.updateProfile({ displayName: payload.name }); } catch (e) { /* non-fatal */ }
    return payload;
  }

  async function getProfile(uid) {
    if (!init()) return null;
    try {
      const snap = await state.db.ref('users/' + uid).get();
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      if (isPermissionError(e)) state.rulesError = true;
      return null;
    }
  }

  function friendlyAuthError(err) {
    const code = String((err && (err.code || err.message)) || '').toLowerCase();
    if (code.includes('invalid-email')) return 'That email address is not valid.';
    if (code.includes('user-not-found')) return 'Email or password is incorrect.';
    if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Email or password is incorrect.';
    if (code.includes('email-already-in-use')) return 'Could not create an account with this email. Try signing in or resetting your password.';
    if (code.includes('weak-password')) return 'Password must be at least 10 characters with upper case, lower case and a number.';
    if (code.includes('account-exists-with-different-credential')) return 'This email already uses a different sign-in method. Sign in the same way you created the account.';
    if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Sign-in was cancelled.';
    if (code.includes('popup-blocked')) return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    if (code.includes('unauthorized-domain')) return 'This website address is not authorised in Firebase yet. Use the deployed website or add the domain in Firebase Authentication settings.';
    if (code.includes('invalid-phone-number') || code.includes('missing-phone-number')) return 'That phone number is not valid. Check the country code and try again.';
    if (code.includes('invalid-verification-code')) return 'The SMS code is not correct. Check the message and try again.';
    if (code.includes('code-expired') || code.includes('session-expired')) return 'That SMS code has expired. Send a new code.';
    if (code.includes('quota-exceeded') || code.includes('sms-quota')) return 'The SMS limit has been reached. Try again later or sign in with email.';
    if (code.includes('captcha-check-failed') || code.includes('invalid-app-credential') || code.includes('missing-app-credential')) return 'The security check failed. Reload the page and try again.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
    if (code.includes('network-request-failed')) return 'No internet connection. Please try again.';
    if (code.includes('operation-not-allowed')) return 'This sign-in method is not enabled in Firebase yet. Check the setup guide.';
    if (code.includes('permission') || code.includes('denied')) return 'Firebase rules are not set up yet. Open the setup guide.';
    return (err && err.message) || 'Something went wrong. Please try again.';
  }

  /* ---------------- Invoice helpers ---------------- */
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  function invoiceStatus(inv) {
    if (String(inv.type || '').toLowerCase().includes('quotation')) return 'quote';
    const total = num(inv.total);
    const bal = num(inv.balance);
    if (total > 0 && bal <= 0) return 'paid';
    return 'due';
  }

  function invoiceKey(no) {
    const key = String(no || '')
      .trim()
      .replace(/[.#$\[\]\/\s]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return key || 'invoice_' + Date.now();
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items
      .filter((x) => x && String(x.item || '').trim())
      .map((x) => ({
        qty: num(x.qty),
        item: String(x.item).trim(),
        desc: String(x.desc || ''),
        price: num(x.price)
      }));
  }

  function cloudRecord(inv) {
    const items = normalizeItems(inv.items);
    const record = {
      no: String(inv.no || '').trim(),
      date: inv.date || '',
      type: inv.type || 'Cash Invoice',
      title: inv.title || 'Mr.',
      customer: String(inv.customer || '').trim(),
      address: String(inv.address || '').trim(),
      phone: String(inv.phone || '').trim(),
      items: items,
      discount: num(inv.discount),
      advance: num(inv.advance),
      notes: String(inv.notes || ''),
      subtotal: num(inv.subtotal),
      total: num(inv.total),
      balance: num(inv.balance),
      status: invoiceStatus(inv),
      signatureName: String(inv.signatureName || 'Alpha Electronic'),
      showSeal: inv.showSeal !== false,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
      updatedBy: state.user ? state.user.uid : ''
    };
    return record;
  }

  async function saveInvoice(inv, opts) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    if (!state.user || !state.admin) throw new Error('Administrator sign-in required');
    const options = opts || {};
    const key = options.key || invoiceKey(inv.no);
    const record = cloudRecord(inv);
    if (options.isNew !== false) {
      record.createdAt = firebase.database.ServerValue.TIMESTAMP;
      record.createdBy = state.user.uid;
      record.createdByEmail = state.user.email || '';
    }
    await state.db.ref('invoices/' + key).update(record);
    return key;
  }

  function readInvoice(key) {
    return new Promise((resolve, reject) => {
      if (!init()) return reject(new Error('Firebase not available'));
      state.db.ref('invoices/' + key).get()
        .then((snap) => resolve(snap.exists() ? Object.assign({ _key: key }, normalizeCloudInv(snap.val())) : null))
        .catch(reject);
    });
  }

  function normalizeCloudInv(v) {
    const inv = Object.assign({}, v);
    ['discount', 'advance', 'subtotal', 'total', 'balance'].forEach((k) => { inv[k] = num(inv[k]); });
    inv.items = normalizeItems(inv.items);
    return inv;
  }

  function watchInvoices(cb) {
    if (!init()) return () => {};
    const ref = state.db.ref('invoices');
    const handler = (snap) => {
      const list = [];
      snap.forEach((child) => {
        list.push(Object.assign({ _key: child.key }, normalizeCloudInv(child.val())));
      });
      list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.no || '').localeCompare(String(a.no || '')));
      cb(list);
    };
    ref.on('value', handler, (err) => console.warn('invoices read', err));
    return () => ref.off('value', handler);
  }

  async function fetchInvoices() {
    if (!init()) throw new Error('Firebase not available');
    const snap = await state.db.ref('invoices').get();
    const list = [];
    snap.forEach((child) => list.push(Object.assign({ _key: child.key }, normalizeCloudInv(child.val()))));
    return list;
  }

  async function deleteInvoice(key) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('invoices/' + key).remove();
  }

  async function assignCustomer(key, inv, customer) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('invoices/' + key).update({
      customerUid: customer.uid,
      customerEmail: customer.email || '',
      customerName: customer.name || ''
    });
    await state.db.ref('customerInvoices/' + customer.uid + '/' + key).set(true);
    if (inv && inv.customerUid && inv.customerUid !== customer.uid) {
      await state.db.ref('customerInvoices/' + inv.customerUid + '/' + key).remove();
    }
  }

  async function clearInvoiceCustomer(key, inv) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('invoices/' + key).update({ customerUid: null, customerEmail: null, customerName: null });
    if (inv && inv.customerUid) {
      await state.db.ref('customerInvoices/' + inv.customerUid + '/' + key).remove();
    }
  }

  function watchCustomerInvoiceKeys(uid, cb) {
    if (!init() || !uid) return () => {};
    const ref = state.db.ref('customerInvoices/' + uid);
    const handler = (snap) => {
      const keys = [];
      snap.forEach((child) => { if (child.val() === true) keys.push(child.key); });
      cb(keys);
    };
    ref.on('value', handler, (err) => console.warn('customer invoices read', err));
    return () => ref.off('value', handler);
  }

  /* ---------------- Users ---------------- */
  function watchUsers(cb) {
    if (!init() || !state.admin) return () => {};
    const ref = state.db.ref('users');
    const handler = (snap) => {
      const list = [];
      snap.forEach((child) => list.push(Object.assign({ uid: child.key }, child.val())));
      list.sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')));
      cb(list);
    };
    ref.on('value', handler, (err) => console.warn('users read', err));
    return () => ref.off('value', handler);
  }

  function requireAdmin() {
    if (!state.user) throw new Error('Sign in required');
    if (!state.admin) throw new Error('Administrator sign-in required');
  }

  async function updateCustomer(uid, data) {
    requireAdmin();
    const id = String(uid || '').trim();
    if (!id) throw new Error('Customer is missing');
    const payload = {
      name: String((data && data.name) || '').trim(),
      email: String((data && data.email) || '').trim(),
      phone: String((data && data.phone) || '').trim(),
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    if (!payload.name) throw new Error('Customer name is required');
    await state.db.ref('users/' + id).update(payload);
    return payload;
  }

  async function deleteCustomer(uid) {
    requireAdmin();
    const id = String(uid || '').trim();
    if (!id) throw new Error('Customer is missing');
    await state.db.ref('customerInvoices/' + id).remove();
    await state.db.ref('users/' + id).remove();
  }

  /* ---------------- Admins ---------------- */
  function watchAdmins(cb) {
    if (!init() || !state.admin) return () => {};
    const ref = state.db.ref('admins');
    const handler = (snap) => {
      const list = [];
      snap.forEach((child) => { if (child.val() === true) list.push(child.key); });
      list.sort();
      cb(list);
    };
    ref.on('value', handler, (err) => console.warn('admins read', err));
    return () => ref.off('value', handler);
  }

  async function addAdmin(uid) {
    requireAdmin();
    const id = String(uid || '').trim();
    if (!id || id.length < 6 || /[.#$\[\]\/\s]/.test(id)) {
      throw new Error('Paste a valid Firebase user UID');
    }
    if (id === state.user.uid) throw new Error('Your account is already an administrator');
    await state.db.ref('admins/' + id).set(true);
    return id;
  }

  async function removeAdmin(uid) {
    requireAdmin();
    const id = String(uid || '').trim();
    if (!id) throw new Error('Administrator is missing');
    if (id === state.user.uid) throw new Error('You cannot remove your own admin access');
    await state.db.ref('admins/' + id).remove();
  }

  async function setAdminEmail(email) {
    requireAdmin();
    const value = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address');
    await state.db.ref('config/adminEmail').set(value);
    state.adminEmail = value;
    return value;
  }

  /* ---------------- Service requests ---------------- */
  async function submitServiceRequest(data) {
    if (!init()) throw new Error(state.error || 'Firebase not available');
    const payload = {
      name: String(data.name || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      type: String(data.type || 'quote'),
      package: String(data.package || ''),
      message: String(data.message || '').trim(),
      status: 'new',
      source: String(data.source || 'website'),
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    if (!payload.name || !payload.phone || !payload.message) {
      throw new Error('Please fill your name, phone and message.');
    }
    if (state.user) payload.uid = state.user.uid;
    const ref = state.db.ref('serviceRequests').push();
    await ref.set(payload);
    return ref.key;
  }

  function watchRequests(cb) {
    if (!init() || !state.admin) return () => {};
    const ref = state.db.ref('serviceRequests');
    const handler = (snap) => {
      const list = [];
      snap.forEach((child) => list.push(Object.assign({ _key: child.key }, child.val())));
      list.sort((a, b) => num(b.createdAt) - num(a.createdAt));
      cb(list);
    };
    ref.on('value', handler, (err) => console.warn('requests read', err));
    return () => ref.off('value', handler);
  }

  async function setRequestStatus(key, status) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('serviceRequests/' + key).update({ status: status });
  }

  async function setRequestNote(key, note) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('serviceRequests/' + key).update({
      adminNote: String(note || '').trim().slice(0, 2000),
      noteUpdatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function deleteRequest(key) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('serviceRequests/' + key).remove();
  }

  /* ---------------- Prices ---------------- */
  const priceKey = (name) => String(name || '').trim().toLowerCase();

  async function fetchPrices() {
    if (!init()) return {};
    try {
      const snap = await state.db.ref('config/prices').get();
      const val = snap.val();
      return val && typeof val === 'object' ? val : {};
    } catch (e) {
      if (isPermissionError(e)) state.rulesError = true;
      return {};
    }
  }

  function watchPrices(cb) {
    if (!init()) return () => {};
    const ref = state.db.ref('config/prices');
    const handler = (snap) => cb(snap.val() && typeof snap.val() === 'object' ? snap.val() : {});
    ref.on('value', handler, (err) => console.warn('prices read', err));
    return () => ref.off('value', handler);
  }

  async function savePrice(name, price) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    const key = priceKey(name);
    const value = num(price);
    if (!key || value <= 0) return false;
    await state.db.ref('config/prices/' + key).set(value);
    return true;
  }

  async function clearPrice(name) {
    if (!state.admin) throw new Error('Administrator sign-in required');
    await state.db.ref('config/prices/' + priceKey(name)).remove();
  }

  /* ---------------- Setup + local recovery ---------------- */
  async function adminSetupInfo() {
    await waitReady();
    const info = {
      uid: state.user ? state.user.uid : '',
      email: state.user ? state.user.email || '' : '',
      adminEmail: state.adminEmail || '',
      rulesError: state.rulesError,
      isAdmin: state.admin
    };
    if (state.user) {
      try {
        const snap = await state.db.ref('config/adminEmail').get();
        info.adminEmail = String(snap.val() || '');
      } catch (e) {
        if (isPermissionError(e)) info.rulesError = true;
      }
      if (!info.isAdmin) info.isAdmin = await resolveAdmin(state.user);
    }
    return info;
  }

  async function diagnoseRules() {
    if (!init()) return [];
    const checks = [
      ['config/adminEmail', 'Owner email'],
      ['config/prices', 'Shared prices'],
      ['invoices', 'Invoices'],
      ['users', 'Customer accounts'],
      ['serviceRequests', 'Messages / requests'],
      ['admins', 'Administrators']
    ];
    const out = [];
    for (const [path, label] of checks) {
      try {
        await state.db.ref(path).get();
        out.push({ path: path, label: label, ok: true, error: '' });
      } catch (e) {
        out.push({
          path: path,
          label: label,
          ok: false,
          error: isPermissionError(e) ? 'Permission denied' : (e && e.message ? e.message : 'Read failed')
        });
      }
    }
    return out;
  }

  async function syncLocalInvoices() {
    if (!state.admin) throw new Error('Administrator sign-in required');
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem('ae_history_v1') || '[]');
    } catch (e) {
      history = [];
    }
    if (!Array.isArray(history) || !history.length) return { count: 0, skipped: 0 };
    let map = {};
    try { map = JSON.parse(localStorage.getItem('ae_cloud_keys_v1') || '{}'); } catch (e) { map = {}; }

    let count = 0;
    let skipped = 0;
    for (const inv of history) {
      if (!inv || !inv.no || !Array.isArray(inv.items)) { skipped++; continue; }
      const key = invoiceKey(inv.no);
      const isNew = !map[key];
      try {
        await saveInvoice(inv, { key: key, isNew: isNew });
        map[key] = true;
        count++;
      } catch (e) {
        skipped++;
      }
    }
    try { localStorage.setItem('ae_cloud_keys_v1', JSON.stringify(map)); } catch (e) { /* full */ }
    return { count: count, skipped: skipped };
  }

  function buildShareLink(inv, baseHref) {
    const body = [
      1,
      inv.no || '',
      inv.date || '',
      inv.type || 'Cash Invoice',
      inv.title || 'Mr.',
      inv.customer || '',
      inv.address || '',
      inv.phone || '',
      num(inv.discount),
      num(inv.advance),
      inv.notes != null ? String(inv.notes) : '',
      (inv.items || []).map((i) => [num(i.qty), i.item || '', i.desc || '', num(i.price)]),
      inv.signatureName || 'Alpha Electronic',
      inv.showSeal === false ? 0 : 1
    ];
    const json = JSON.stringify(body);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const base = baseHref || new URL('view.html', location.href).href;
    return base + '#v=' + b64;
  }

  function whatsappLink(text) {
    const base = 'https://wa.me/94773283588';
    return text ? base + '?text=' + encodeURIComponent(text) : base;
  }

  return {
    init: init,
    waitReady: waitReady,
    onAuth: onAuth,
    currentUser: currentUser,
    isAdmin: isAdmin,
    signIn: signIn,
    signUp: signUp,
    signInWithGoogle: signInWithGoogle,
    startPhoneSignIn: startPhoneSignIn,
    confirmPhoneCode: confirmPhoneCode,
    cancelPhoneSignIn: cancelPhoneSignIn,
    takeRedirectError: takeRedirectError,
    signOut: signOut,
    resetPassword: resetPassword,
    updateProfile: updateProfile,
    getProfile: getProfile,
    updateCustomer: updateCustomer,
    deleteCustomer: deleteCustomer,
    watchAdmins: watchAdmins,
    addAdmin: addAdmin,
    removeAdmin: removeAdmin,
    setAdminEmail: setAdminEmail,
    friendlyAuthError: friendlyAuthError,
    invoiceKey: invoiceKey,
    invoiceStatus: invoiceStatus,
    saveInvoice: saveInvoice,
    readInvoice: readInvoice,
    watchInvoices: watchInvoices,
    fetchInvoices: fetchInvoices,
    deleteInvoice: deleteInvoice,
    assignCustomer: assignCustomer,
    clearInvoiceCustomer: clearInvoiceCustomer,
    watchCustomerInvoiceKeys: watchCustomerInvoiceKeys,
    watchUsers: watchUsers,
    submitServiceRequest: submitServiceRequest,
    watchRequests: watchRequests,
    setRequestStatus: setRequestStatus,
    setRequestNote: setRequestNote,
    deleteRequest: deleteRequest,
    fetchPrices: fetchPrices,
    watchPrices: watchPrices,
    savePrice: savePrice,
    clearPrice: clearPrice,
    adminSetupInfo: adminSetupInfo,
    diagnoseRules: diagnoseRules,
    syncLocalInvoices: syncLocalInvoices,
    buildShareLink: buildShareLink,
    whatsappLink: whatsappLink
  };
})();
