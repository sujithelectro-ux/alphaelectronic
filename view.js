'use strict';

/* =========================================================
   Alpha Electronic — public read-only invoice preview
   Supports:
     view.html#v=<payload>   shared invoice (no sign-in)
     view.html?id=<key>      cloud invoice (customer/admin sign-in)
   ========================================================= */
(function () {
  const UI = window.AE_UI || {};
  const Cloud = window.AE_Cloud;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const cloudKey = params.get('id') || '';

  const el = {
    state: $('viewState'),
    stateTitle: $('vStateTitle'),
    stateText: $('vStateText'),
    stateActions: $('vStateActions'),
    layout: $('viewLayout'),
    paper: $('viewPaper'),
    print: $('vPrint'),
    copy: $('vCopy'),
    wa: $('vWa'),
    account: $('vAccount')
  };

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = (v) => (UI.escapeHtml ? UI.escapeHtml(v) : String(v == null ? '' : v));
  const money = (v) => (UI.fmtRs ? UI.fmtRs(v) : 'Rs. ' + num(v).toFixed(2));

  let invoice = null;
  let attemptedUid = '';
  let loadToken = 0;

  const DEFAULT_NOTES =
    'Warranty as per manufacturer terms. Goods once sold are not returnable.\n' +
    'Balance payment due on completion of installation.';

  const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function under1000(n) {
    const out = [];
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h) out.push(ONES[h] + ' Hundred');
    if (r) {
      if (r < 20) out.push(ONES[r]);
      else out.push(TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : ''));
    }
    return out.join(' ');
  }

  function words(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    const parts = [];
    const scales = [[1000000000, 'Billion'], [1000000, 'Million'], [1000, 'Thousand']];
    for (const [value, name] of scales) {
      if (n >= value) {
        parts.push(words(Math.floor(n / value)) + ' ' + name);
        n %= value;
      }
    }
    if (n) parts.push(under1000(n));
    return parts.join(' ');
  }

  function amountInWords(n) {
    const v = Math.max(0, num(n));
    const rupees = Math.floor(v);
    const cents = Math.round((v - rupees) * 100);
    let s = 'Rupees ' + words(rupees);
    if (cents) s += ' and ' + words(cents) + ' Cents';
    return s + ' Only';
  }

  function signatureDataUrl(name) {
    const label = String(name || 'Alpha Electronic').trim() || 'Alpha Electronic';
    const size = Math.max(16, Math.min(30, 620 / Math.max(8, label.length)));
    const fit = label.length >= 14 ? ' textLength="286" lengthAdjust="spacingAndGlyphs"' : '';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110">' +
      `<text x="20" y="66" font-family="Segoe Script, Brush Script MT, Lucida Handwriting, cursive" font-size="${size}" fill="#1e3a8a" transform="rotate(-3 160 55)"${fit}>${esc(label)}</text>` +
      '<path d="M22 86 C 90 74, 180 96, 300 76" fill="none" stroke="#1e3a8a" stroke-width="1.4" opacity="0.5" stroke-linecap="round"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function sealDataUrl() {
    const c = '#2646a8';
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">' +
      `<g transform="rotate(-11 120 120)" fill="none" stroke="${c}">` +
      '<circle cx="120" cy="120" r="112" stroke-width="5"/>' +
      '<circle cx="120" cy="120" r="102" stroke-width="1.4"/>' +
      '<circle cx="120" cy="120" r="74" stroke-width="1" stroke-dasharray="2 5"/>' +
      '</g>' +
      `<g transform="rotate(-11 120 120)" fill="${c}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">` +
      '<text x="120" y="94" font-family="Georgia, serif" font-style="italic" font-size="27">Alpha</text>' +
      '<text x="120" y="119" font-size="17" font-weight="700" letter-spacing="2">ELECTRONIC</text>' +
      '<text x="120" y="141" font-size="10.5" letter-spacing="0.4">RANTHATI KANDA, PANAGAMUWA</text>' +
      '<text x="120" y="155" font-size="10.5" letter-spacing="0.4">KURUNEGALA</text>' +
      '<text x="120" y="175" font-size="9.5" letter-spacing="1">REG NO 11/2622</text>' +
      '<text x="120" y="189" font-size="9.5" letter-spacing="1">077 328 3588</text>' +
      '</g>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function setToolsEnabled(on) {
    ['print', 'copy', 'wa'].forEach((key) => {
      if (el[key]) el[key].disabled = !on;
    });
  }

  function actionLink(label, href, primary) {
    const a = document.createElement('a');
    a.className = 'vs-btn' + (primary ? ' primary' : '');
    a.textContent = label;
    a.href = href;
    return a;
  }

  function actionButton(label, onClick, primary) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vs-btn' + (primary ? ' primary' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function showState(kind, title, text, actions) {
    if (!el.state) return;
    el.state.className = 'view-state' + (kind ? ' ' + kind : '');
    el.state.hidden = false;
    if (el.layout) el.layout.hidden = true;
    if (el.stateTitle) el.stateTitle.textContent = title;
    if (el.stateText) el.stateText.textContent = text;
    if (el.stateActions) {
      el.stateActions.innerHTML = '';
      (actions || []).forEach((node) => el.stateActions.appendChild(node));
    }
    setToolsEnabled(false);
  }

  function loginHref(key) {
    return 'login.html?next=' + encodeURIComponent('view.html?id=' + encodeURIComponent(key));
  }

  function showSignIn(key) {
    showState(
      'ok',
      'Sign in to view this invoice',
      'This invoice is linked to a customer account. Sign in with the email Alpha Electronic has on file for you.',
      [
        actionLink('Sign in', loginHref(key), true),
        actionLink('Back to website', 'index.html')
      ]
    );
  }

  function showNotAssigned(key) {
    showState(
      'error',
      'Invoice not available',
      'This invoice is not assigned to the signed-in account. Sign in with the correct customer account, or contact Alpha Electronic.',
      [
        actionLink('My invoices', 'portal.html', true),
        actionLink('Switch account', loginHref(key)),
        actionLink('WhatsApp us', 'https://wa.me/94773283588')
      ]
    );
  }

  /* ---------------- Share payload ---------------- */
  function fromBase64Url(raw) {
    let b64 = String(raw || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function parseSharePayload(raw) {
    const arr = JSON.parse(fromBase64Url(raw));
    if (!Array.isArray(arr) || arr[0] !== 1) return null;
    return {
      no: arr[1] || '',
      date: arr[2] || '',
      type: arr[3] || 'Cash Invoice',
      title: arr[4] || 'Mr.',
      customer: arr[5] || '',
      address: arr[6] || '',
      phone: arr[7] || '',
      discount: num(arr[8]),
      advance: num(arr[9]),
      notes: arr[10] != null ? String(arr[10]) : DEFAULT_NOTES,
      items: Array.isArray(arr[11])
        ? arr[11].map((r) => ({ qty: num(r[0]), item: String(r[1] || ''), desc: String(r[2] || ''), price: num(r[3]) }))
        : [],
      signatureName: arr[12] != null ? String(arr[12]) : 'Alpha Electronic',
      showSeal: arr[13] == null ? true : !!Number(arr[13])
    };
  }

  function readHashInvoice() {
    const hash = location.hash || '';
    if (hash.indexOf('#v=') === 0) return parseSharePayload(hash.slice(3));
    if (hash.indexOf('#view=') === 0) return parseSharePayload(hash.slice(6));
    return null;
  }

  /* ---------------- Rendering ---------------- */
  function normalize(inv) {
    const items = Array.isArray(inv.items)
      ? inv.items
          .filter((x) => x && String(x.item || '').trim())
          .map((x) => ({
            qty: num(x.qty),
            item: String(x.item).trim(),
            desc: String(x.desc || ''),
            price: num(x.price)
          }))
      : [];
    const subtotal = items.reduce((sum, x) => sum + x.qty * x.price, 0);
    const discount = Math.max(0, num(inv.discount));
    const net = Math.max(0, subtotal - discount);
    const advance = Math.max(0, num(inv.advance));
    return { items, subtotal, discount, net, advance, balance: net - advance };
  }

  function statusOf(inv, t) {
    if (/quotation/i.test(String(inv.type || ''))) return { cls: 'quote', label: 'Quotation' };
    if (t.net > 0 && t.balance <= 0) return { cls: 'paid', label: 'Paid' };
    return { cls: 'due', label: 'Balance Due' };
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function render(inv) {
    const t = normalize(inv);
    invoice = inv;

    setText('vNo', inv.no || '—');
    setText('vDate', UI.fmtDate ? UI.fmtDate(inv.date) : (inv.date || '—'));
    setText('vType', inv.type || 'Cash Invoice');
    setText('vCustTitle', inv.title || 'Mr.');
    setText('vCustName', inv.customer || 'Walk-in customer');
    setText('vCustAddress', inv.address || '');
    setText('vCustPhone', inv.phone || '');

    const docTitle = /quotation/i.test(String(inv.type || '')) ? 'QUOTATION' : 'INVOICE';
    setText('vDocTitle', docTitle);

    const status = statusOf(inv, t);
    const pill = $('vStatus');
    if (pill) {
      pill.className = 'status-pill ' + status.cls;
      pill.textContent = status.label;
    }

    const body = $('vItems');
    if (body) {
      body.innerHTML = t.items.length
        ? t.items.map((item, i) => {
            const amount = item.qty * item.price;
            return '<tr>' +
              '<td class="idx">' + (i + 1) + '</td>' +
              '<td class="ta-r">' + esc(item.qty) + '</td>' +
              '<td><span class="v-item">' + esc(item.item) + '</span></td>' +
              '<td><span class="v-desc">' + esc(item.desc || '') + '</span></td>' +
              '<td class="ta-r">' + money(item.price) + '</td>' +
              '<td class="amt v-amount">' + money(amount) + '</td>' +
              '</tr>';
          }).join('')
        : '<tr><td colspan="6" class="vs-muted">No items on this document.</td></tr>';
    }

    const notes = $('vNotes');
    if (notes) notes.textContent = String(inv.notes != null ? inv.notes : DEFAULT_NOTES).trim() || DEFAULT_NOTES;

    setText('vWords', amountInWords(t.net));
    setText('vSub', money(t.subtotal));
    setText('vDiscount', money(t.discount));
    setText('vNet', money(t.net));
    setText('vAdvance', money(t.advance));
    setText('vBal', money(t.balance));

    const signName = String(inv.signatureName || inv.sigName || 'Alpha Electronic').trim() || 'Alpha Electronic';
    setText('vSignName', signName);
    const sign = $('vSign');
    if (sign) sign.src = signatureDataUrl(signName);
    const seal = $('vSeal');
    if (seal) {
      seal.src = sealDataUrl();
      seal.style.display = inv.showSeal === false ? 'none' : '';
    }

    const count = t.items.length;
    if (el.paper) {
      el.paper.classList.toggle('dense', count > 12);
      el.paper.classList.toggle('dense2', count > 19);
    }

    if (el.layout) el.layout.hidden = false;
    if (el.state) el.state.hidden = true;
    setToolsEnabled(true);

    const no = inv.no || 'Invoice';
    document.title = no + ' — Alpha Electronic';
    document.body.classList.add('has-invoice');
  }

  /* ---------------- Cloud invoice ---------------- */
  function permissionError(err) {
    const code = String((err && (err.code || err.message)) || '').toLowerCase();
    return code.includes('permission') || code.includes('denied');
  }

  async function loadCloud(key, user) {
    const token = ++loadToken;
    attemptedUid = user.uid;
    showState('loading', 'Opening invoice…', 'Loading the latest copy from Alpha Electronic.');
    try {
      const inv = await Cloud.readInvoice(key);
      if (token !== loadToken) return;
      if (!inv) {
        showState('error', 'Invoice not found', 'This invoice may have been removed or the link is incomplete.', [
          actionLink('Back to website', 'index.html', true)
        ]);
        return;
      }
      render(inv);
    } catch (err) {
      if (token !== loadToken) return;
      console.warn('Invoice preview failed', err);
      if (permissionError(err)) {
        showNotAssigned(key);
      } else {
        showState('error', 'Could not load this invoice', 'Please check your connection and try again, or contact Alpha Electronic on 077 328 3588.', [
          actionButton('Try again', () => loadCloud(key, user), true),
          actionLink('WhatsApp us', 'https://wa.me/94773283588')
        ]);
      }
    }
  }

  function paintAccount(state) {
    if (!el.account) return;
    if (state && state.user) {
      el.account.textContent = state.admin ? 'Admin panel' : 'My account';
      el.account.href = state.admin ? 'admin.html' : 'portal.html';
    } else {
      el.account.textContent = 'Sign in';
      el.account.href = cloudKey
        ? loginHref(cloudKey)
        : 'login.html';
    }
  }

  function bindTools() {
    if (el.print) el.print.addEventListener('click', () => window.print());
    if (el.copy) {
      el.copy.addEventListener('click', () => {
        if (UI.copyText) UI.copyText(location.href, 'Invoice link copied');
        else {
          navigator.clipboard.writeText(location.href).catch(() => {});
        }
      });
    }
    if (el.wa) {
      el.wa.addEventListener('click', () => {
        const no = (invoice && invoice.no) || 'my invoice';
        const text = 'Hello Alpha Electronic, I am viewing invoice ' + no + '. I would like to ask about it.';
        const base = Cloud ? Cloud.whatsappLink(text) : 'https://wa.me/94773283588?text=' + encodeURIComponent(text);
        window.open(base, '_blank', 'noopener');
      });
    }
  }

  function init() {
    bindTools();

    let shared = null;
    try {
      shared = readHashInvoice();
    } catch (e) {
      shared = null;
    }

    if (shared) {
      render(shared);
    }

    if (!Cloud) {
      if (!shared) {
        showState('error', 'Online preview unavailable', 'Firebase did not load. Open this page from the website or contact Alpha Electronic.', [
          actionLink('Back to website', 'index.html', true)
        ]);
      }
      return;
    }

    Cloud.onAuth((state) => {
      paintAccount(state);
      if (shared || !cloudKey) return;
      if (!state.user) {
        if (!invoice) showSignIn(cloudKey);
        return;
      }
      if (attemptedUid === state.user.uid && invoice) return;
      loadCloud(cloudKey, state.user);
    });

    if (!shared && !cloudKey) {
      showState('error', 'Nothing to preview', 'Open an invoice link from WhatsApp, email or your customer portal.', [
        actionLink('Open customer portal', 'portal.html', true),
        actionLink('Back to website', 'index.html')
      ]);
    }
  }

  window.addEventListener('hashchange', () => location.reload());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
