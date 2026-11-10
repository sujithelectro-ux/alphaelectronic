'use strict';

/* =========================================================
   Alpha Electronic — browser security helpers
   Safe redirects, password strength, login throttling,
   idle sign-out and link hardening.
   ========================================================= */
window.AE_Sec = (function () {
  const UI = window.AE_UI;
  const GUARD_KEY = 'ae.sec.guard.v1';
  const RESET_KEY = 'ae.sec.reset.v1';
  const ALLOWED_PAGES = ['index.html', 'login.html', 'portal.html', 'admin.html', 'invoice.html', 'view.html'];

  const COMMON_PASSWORDS = [
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyuiop', 'abc12345', 'admin123', 'letmein', 'welcome1',
    'iloveyou', 'monkey123', 'dragon123', 'football', 'baseball', 'sunshine'
  ];

  /* ---------------- Safe redirects ---------------- */
  function safeNext(raw, fallback) {
    const value = String(raw == null ? '' : raw).trim();
    const fail = fallback == null ? '' : fallback;
    if (!value) return fail;
    if (/[\u0000-\u001f\u007f\\]/.test(value)) return fail;
    if (!/^[A-Za-z0-9._~!$&'()*+,;=:@%\/?#-]+$/.test(value)) return fail;
    if (value.indexOf('//') >= 0 || value.charAt(0) === '/') return fail;

    let url;
    try {
      url = new URL(value, location.href);
    } catch (e) {
      return fail;
    }
    if (url.origin !== location.origin) return fail;
    const page = url.pathname.split('/').pop().toLowerCase();
    if (ALLOWED_PAGES.indexOf(page) < 0) return fail;
    return page + url.search + url.hash;
  }

  /* ---------------- Password strength ---------------- */
  function checkPassword(password) {
    const p = String(password == null ? '' : password);
    const lower = /[a-z]/.test(p);
    const upper = /[A-Z]/.test(p);
    const digit = /\d/.test(p);
    const symbol = /[^A-Za-z0-9]/.test(p);
    const classes = (lower ? 1 : 0) + (upper ? 1 : 0) + (digit ? 1 : 0) + (symbol ? 1 : 0);
    const unique = new Set(p).size;
    const common = COMMON_PASSWORDS.indexOf(p.toLowerCase()) >= 0;
    const repeated = /(.)\1{2,}/.test(p);

    let score = 0;
    if (p.length >= 10) score += 1;
    if (p.length >= 12) score += 1;
    if (classes >= 3) score += 1;
    if (symbol && digit) score += 1;
    if (common || repeated || unique < 5) score = Math.min(score, 1);
    score = Math.max(0, Math.min(4, score));

    const ok = p.length >= 10 && lower && upper && digit && !common && !repeated && unique >= 5;

    let message = '';
    if (!p) message = 'Enter a password.';
    else if (p.length < 10) message = 'Use at least 10 characters.';
    else if (!lower || !upper || !digit) message = 'Include upper case, lower case and a number.';
    else if (common) message = 'That password is too common. Choose another.';
    else if (repeated) message = 'Avoid repeating the same character three times.';
    else if (unique < 5) message = 'Use more different characters.';

    const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return { ok: ok, score: score, label: labels[score], message: message };
  }

  /* ---------------- Login attempt guard ---------------- */
  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage may be blocked */ }
  }

  function guardStatus() {
    const now = Date.now();
    const g = readStore(GUARD_KEY) || { fails: 0, until: 0, last: 0 };
    if (g.until && now < g.until) {
      return { locked: true, seconds: Math.ceil((g.until - now) / 1000), fails: g.fails || 0 };
    }
    if (g.until && now >= g.until) {
      writeStore(GUARD_KEY, { fails: 0, until: 0, last: 0 });
      return { locked: false, seconds: 0, fails: 0 };
    }
    if (g.last && now - g.last > 30 * 60 * 1000) g.fails = 0;
    return { locked: false, seconds: 0, fails: g.fails || 0 };
  }

  function recordFailure() {
    const g = readStore(GUARD_KEY) || { fails: 0, until: 0, last: 0 };
    g.fails = (g.fails || 0) + 1;
    g.last = Date.now();
    if (g.fails >= 5) {
      const step = Math.min(g.fails - 5, 5);
      const seconds = Math.min(15 * 60, 60 * Math.pow(2, step));
      g.until = Date.now() + seconds * 1000;
    }
    writeStore(GUARD_KEY, g);
    return guardStatus();
  }

  function clearFailures() {
    writeStore(GUARD_KEY, { fails: 0, until: 0, last: 0 });
  }

  /* ---------------- Reset email throttle ---------------- */
  function resetStatus() {
    const last = Number(readStore(RESET_KEY)) || 0;
    const wait = Math.ceil((last + 60 * 1000 - Date.now()) / 1000);
    return { allowed: wait <= 0, seconds: Math.max(0, wait) };
  }

  function markReset() {
    writeStore(RESET_KEY, Date.now());
  }

  /* ---------------- Idle sign-out ---------------- */
  const idle = {
    active: false,
    minutes: 30,
    url: 'login.html?timeout=1',
    timer: null,
    warn: null,
    last: 0,
    handler: null
  };

  function resetIdle() {
    if (!idle.active) return;
    clearTimeout(idle.timer);
    clearTimeout(idle.warn);
    const total = idle.minutes * 60 * 1000;
    idle.timer = setTimeout(function () {
      try {
        if (window.AE_Cloud && window.AE_Cloud.signOut) window.AE_Cloud.signOut();
      } catch (e) { /* ignore */ }
      location.href = idle.url;
    }, total);
    idle.warn = setTimeout(function () {
      if (UI && UI.toast) UI.toast('Security: you will be signed out in 1 minute');
    }, Math.max(1000, total - 60 * 1000));
  }

  function startIdle(opts) {
    const o = opts || {};
    idle.minutes = Math.max(1, Number(o.minutes) || 30);
    idle.url = o.url || 'login.html?timeout=1';
    if (idle.active) return;
    idle.active = true;
    idle.handler = function () {
      const now = Date.now();
      if (now - idle.last < 5000) return;
      idle.last = now;
      resetIdle();
    };
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (name) {
      window.addEventListener(name, idle.handler, { passive: true });
    });
    document.addEventListener('visibilitychange', idle.handler);
    resetIdle();
  }

  function stopIdle() {
    if (!idle.active) return;
    idle.active = false;
    clearTimeout(idle.timer);
    clearTimeout(idle.warn);
    if (idle.handler) {
      ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (name) {
        window.removeEventListener(name, idle.handler);
      });
      document.removeEventListener('visibilitychange', idle.handler);
    }
    idle.handler = null;
  }

  /* ---------------- Context protection ---------------- */
  function showWarning(message) {
    if (!document.body || document.getElementById('aeSecWarning')) return;
    const el = document.createElement('div');
    el.id = 'aeSecWarning';
    el.className = 'sec-warning';
    el.setAttribute('role', 'alert');
    el.textContent = message;
    el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#7a1d14;color:#ffe9e5;' +
      'font:700 12.5px/1.45 Manrope, Arial, sans-serif;padding:10px 16px;text-align:center;';
    document.body.insertBefore(el, document.body.firstChild);
  }

  function isLocalHost() {
    const host = String(location.hostname || '').toLowerCase();
    return location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }

  function checkContext() {
    if (window.top !== window.self) {
      try {
        window.top.location = window.self.location.href;
        return;
      } catch (e) {
        document.documentElement.style.display = 'none';
        showWarning('This page is framed by another website. Close this window and open Alpha Electronic directly.');
        return;
      }
    }
    if (location.protocol !== 'https:' && !isLocalHost()) {
      showWarning('Not secure: this page is not using HTTPS. Do not enter your password or payment details.');
    }
  }

  function hardenLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const links = scope.querySelectorAll('a[href]');
    Array.prototype.forEach.call(links, function (a) {
      const href = a.getAttribute('href') || '';
      if (/^\s*(javascript|data|vbscript):/i.test(href)) {
        a.removeAttribute('href');
        return;
      }
      let external = false;
      try {
        external = a.origin && a.origin !== location.origin;
      } catch (e) {
        external = false;
      }
      if (a.target === '_blank' || external) {
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function watchLinks() {
    hardenLinks(document);
    if (!window.MutationObserver || !document.body) return;
    const observer = new MutationObserver(function (records) {
      for (let i = 0; i < records.length; i += 1) {
        const nodes = records[i].addedNodes;
        for (let j = 0; j < nodes.length; j += 1) {
          const node = nodes[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'A') hardenLinks(node.parentNode || document);
          else if (node.querySelectorAll) hardenLinks(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function status() {
    const robots = document.querySelector('meta[name="robots"]');
    return {
      https: location.protocol === 'https:',
      local: isLocalHost(),
      framed: window.top !== window.self,
      idleActive: idle.active,
      idleMinutes: idle.minutes,
      guard: true,
      noindex: !!robots && /noindex/i.test(robots.getAttribute('content') || '')
    };
  }

  function init() {
    checkContext();
    watchLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    safeNext: safeNext,
    checkPassword: checkPassword,
    guardStatus: guardStatus,
    recordFailure: recordFailure,
    clearFailures: clearFailures,
    resetStatus: resetStatus,
    markReset: markReset,
    startIdle: startIdle,
    stopIdle: stopIdle,
    status: status,
    showWarning: showWarning
  };
})();
