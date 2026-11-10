'use strict';

/* Shared UI helpers for the website, portal and admin */
window.AE_UI = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  function fmtRs(value) {
    const v = num(value);
    const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-Rs. ' : 'Rs. ') + abs;
  }

  function fmtRsShort(value) {
    const v = Math.round(num(value));
    return 'Rs. ' + v.toLocaleString('en-US');
  }

  function fmtDate(value) {
    if (value == null || value === '') return '—';
    let d;
    if (typeof value === 'number') d = new Date(value);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) d = new Date(value + 'T00:00:00');
    else d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function timeAgo(value) {
    const n = num(value);
    if (!n) return '';
    const secs = Math.max(1, Math.round((Date.now() - n) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return mins + (mins === 1 ? ' min ago' : ' mins ago');
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.round(hours / 24);
    if (days < 31) return days + (days === 1 ? ' day ago' : ' days ago');
    return fmtDate(n);
  }

  function statusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'paid') return 'Paid';
    if (s === 'quote' || s === 'quotation') return 'Quotation';
    if (s === 'draft') return 'Draft';
    if (s === 'new') return 'New';
    if (s === 'done') return 'Done';
    return 'Balance due';
  }

  function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'paid' || s === 'done') return 'ok';
    if (s === 'quote' || s === 'quotation' || s === 'new') return 'info';
    if (s === 'draft') return 'muted';
    return 'warn';
  }

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('aeToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aeToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function copyText(text, okMsg) {
    const value = String(text == null ? '' : text);
    try {
      await navigator.clipboard.writeText(value);
      toast(okMsg || 'Copied');
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      toast(ok ? (okMsg || 'Copied') : 'Copy failed — please select and copy');
      return ok;
    }
  }

  function param(name) {
    try {
      return new URLSearchParams(location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || '?';
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      if (busyText) btn.textContent = busyText;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  function debounce(fn, wait) {
    let t = null;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait);
    };
  }

  function shareUrl(inv) {
    if (!window.AE_Cloud) return '';
    const base = new URL('view.html', location.href).href;
    return window.AE_Cloud.buildShareLink(inv, base);
  }

  function waLink(text) {
    const base = 'https://wa.me/94773283588';
    return text ? base + '?text=' + encodeURIComponent(text) : base;
  }

  function setFormStatus(el, type, message) {
    if (!el) return;
    el.className = 'form-status show ' + type;
    el.textContent = message;
  }

  function clearFormStatus(el) {
    if (!el) return;
    el.className = 'form-status';
    el.textContent = '';
  }

  return {
    $: $,
    $$: $$,
    escapeHtml: escapeHtml,
    num: num,
    fmtRs: fmtRs,
    fmtRsShort: fmtRsShort,
    fmtDate: fmtDate,
    timeAgo: timeAgo,
    statusLabel: statusLabel,
    statusClass: statusClass,
    toast: toast,
    copyText: copyText,
    param: param,
    initials: initials,
    setBusy: setBusy,
    debounce: debounce,
    shareUrl: shareUrl,
    waLink: waLink,
    setFormStatus: setFormStatus,
    clearFormStatus: clearFormStatus
  };
})();
