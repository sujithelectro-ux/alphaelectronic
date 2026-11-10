'use strict';

/* =========================================================
   Alpha Electronic — Invoice Maker
   ========================================================= */

const BUSINESS = {
  name: 'Alpha Electronic',
  address: 'Ranthati kanda, Panagamuwa, Kurunegala',
  reg: 'Reg: No 11/2622',
  mobile: '0773283588'
};

const INSTALL_ITEM = (window.AE_INSTALL && window.AE_INSTALL.item) || 'Installation & Service Charge';
const INSTALL_DESC = (window.AE_INSTALL && window.AE_INSTALL.desc) || 'Installation, wiring and service charge';

const DEFAULT_NOTES =
  'Warranty as per manufacturer terms. Goods once sold are not returnable.\n' +
  'Balance payment due on completion of installation.';

const CATALOG_BASE = Array.isArray(window.AE_CATALOG) ? window.AE_CATALOG : [];

const GROUPS = Array.isArray(window.AE_GROUPS) ? window.AE_GROUPS : ['All', 'My Items', 'CCTV', 'Solar', 'Wiring', 'Power & Control', 'Labour', 'Charges'];

const LS = {
  draft: 'ae_draft_v1',
  history: 'ae_history_v1',
  settings: 'ae_settings_v1',
  myItems: 'ae_my_items_v1',
  prices: 'ae_prices_v1',
  cloudKeys: 'ae_cloud_keys_v1'
};

const SETTINGS_DEFAULTS = {
  signatureName: 'Alpha Electronic',
  signatureImage: '',
  showSeal: true,
  installAmount: 2500,
  autoInstall: true
};

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);

const els = {
  paper: $('paper'),
  itemsBody: $('itemsBody'),
  catalog: $('catalog'),
  chips: $('chips'),
  search: $('search'),
  invNo: $('invNo'),
  invDate: $('invDate'),
  invType: $('invType'),
  custTitle: $('custTitle'),
  custName: $('custName'),
  custAddress: $('custAddress'),
  custPhone: $('custPhone'),
  notes: $('notes'),
  discount: $('discount'),
  advance: $('advance'),
  tSub: $('tSub'),
  tNet: $('tNet'),
  tBal: $('tBal'),
  amountWords: $('amountWords'),
  statusPill: $('statusPill'),
  saveState: $('saveState'),
  signImg: $('signImg'),
  sealImg: $('sealImg'),
  signNameLabel: $('signNameLabel'),
  sigName: $('sigName'),
  sigUpload: $('sigUpload'),
  btnSigClear: $('btnSigClear'),
  sealToggle: $('sealToggle'),
  installAmount: $('installAmount'),
  autoInstall: $('autoInstall'),
  btnAddInstall: $('btnAddInstall'),
  btnQuickInstall: $('btnQuickInstall'),
  quickInstallAmt: $('quickInstallAmt'),
  btnClearItems: $('btnClearItems'),
  btnPdf: $('btnPdf'),
  btnShare: $('btnShare'),
  shareModal: $('shareModal'),
  shareLink: $('shareLink'),
  btnCopyLink: $('btnCopyLink'),
  btnShareNative: $('btnShareNative'),
  btnCopyMsg: $('btnCopyMsg'),
  btnCloseShare: $('btnCloseShare'),
  viewBanner: $('viewBanner'),
  btnViewPdf: $('btnViewPdf'),
  btnViewEdit: $('btnViewEdit'),
  btnBackup: $('btnBackup'),
  btnRestore: $('btnRestore'),
  backupFile: $('backupFile'),
  histCount: $('histCount'),
  historyModal: $('historyModal'),
  historyList: $('historyList'),
  toast: $('toast')
};

/* ---------------- State ---------------- */
let rows = [];
let rowUid = 0;
let activeGroup = 'All';
let searchTerm = '';
let saveTimer = null;
let settingsTimer = null;
let pdfBusy = false;

/* ---------------- Helpers ---------------- */
const fmt = (n) => {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-Rs. ' : 'Rs. ') + abs;
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeXml = escapeHtml;

/* ---------------- State ---------------- */
let settings = Object.assign({}, SETTINGS_DEFAULTS, readJSON(LS.settings, {}));
let myItems = normalizeItems(readJSON(LS.myItems, []));
let priceBook = readJSON(LS.prices, {});
if (!priceBook || typeof priceBook !== 'object' || Array.isArray(priceBook)) priceBook = {};
let viewOnly = false;
let suppressDraftSave = false;
let cloudUser = null;
let cloudAdmin = false;
let cloudKey = '';
let cloudTimer = null;
let cloudSaving = false;
let cloudPending = false;

const todayISO = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const prettyDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const timeNow = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function normalizeItems(list) {
  if (!Array.isArray(list)) return [];  return list
    .filter((x) => x && typeof x.item === 'string' && x.item.trim())
    .map((x) => ({
      item: x.item.trim(),
      desc: typeof x.desc === 'string' ? x.desc : '',
      price: num(x.price)
    }));
}

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

const nextFrame = () => new Promise((resolve) => {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    resolve();
  };
  requestAnimationFrame(() => requestAnimationFrame(finish));
  setTimeout(finish, 150);
});

/* ---------------- Number to words ---------------- */
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

/* ---------------- Invoice numbering ---------------- */
const yearKey = () => 'ae_counter_' + new Date().getFullYear();
const counter = () => parseInt(localStorage.getItem(yearKey()) || '0', 10) || 0;
const bumpCounter = () => localStorage.setItem(yearKey(), String(counter() + 1));

function nextInvoiceNo() {
  const y = new Date().getFullYear();
  return `AE/${y}/${String(counter() + 1).padStart(3, '0')}`;
}

/* ---------------- Brand marks ---------------- */
function signatureDataUrl() {
  if (settings.signatureImage) return settings.signatureImage;
  const name = (settings.signatureName || BUSINESS.name).trim() || BUSINESS.name;
  const size = Math.max(16, Math.min(30, 620 / Math.max(8, name.length)));
  const fit = name.length >= 14 ? ' textLength="286" lengthAdjust="spacingAndGlyphs"' : '';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110">' +
    `<text x="20" y="66" font-family="Segoe Script, Brush Script MT, Lucida Handwriting, cursive" font-size="${size}" fill="#1e3a8a" transform="rotate(-3 160 55)"${fit}>${escapeXml(name)}</text>` +
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

function renderBrandMarks() {
  els.signImg.src = signatureDataUrl();
  els.sealImg.src = sealDataUrl();
  els.sealImg.style.display = settings.showSeal ? '' : 'none';
  els.signNameLabel.textContent = (settings.signatureName || BUSINESS.name).trim() || BUSINESS.name;
}

function saveSettings() {
  writeJSON(LS.settings, settings);
}

function scheduleSettingsSave() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(saveSettings, 350);
}

/* ---------------- Rows ---------------- */
function makeRow(data) {
  return {
    id: ++rowUid,
    qty: data && data.qty != null ? num(data.qty) : 1,
    item: data && data.item ? String(data.item) : '',
    desc: data && data.desc ? String(data.desc) : '',
    price: data && data.price != null ? num(data.price) : 0
  };
}

function addRow(data, opts) {
  const row = makeRow(data);
  const isInstall = data && String(data.item || '').trim().toLowerCase() === INSTALL_ITEM.toLowerCase();
  const installIdx = rows.findIndex((r) => r.item.trim().toLowerCase() === INSTALL_ITEM.toLowerCase());
  if (!isInstall && installIdx >= 0) rows.splice(installIdx, 0, row);
  else rows.push(row);
  renderRows();
  if (!opts || !opts.silent) {
    const input = els.itemsBody.querySelector(`tr[data-id="${row.id}"] .in.item`);
    if (input) input.focus();
    scheduleAutoSave();
  }
  return row;
}

function removeRow(id) {
  rows = rows.filter((r) => r.id !== id);
  if (!rows.length) rows.push(makeRow({ qty: 1 }));
  renderRows();
  scheduleAutoSave();
}

function rowIsEmpty(r) {
  return !r.item.trim() && !r.desc.trim() && num(r.price) === 0;
}

function renderRows() {
  els.paper.classList.toggle('dense', rows.length > 8);
  els.paper.classList.toggle('dense2', rows.length > 13);
  els.itemsBody.innerHTML = rows
    .map((r, i) => `
      <tr data-id="${r.id}" class="${rowIsEmpty(r) ? 'row-empty' : ''}">
        <td class="idx">${i + 1}</td>
        <td><input class="in qty" data-field="qty" type="number" min="0" step="any" value="${r.qty}" aria-label="Quantity"></td>
        <td><textarea class="in item" data-field="item" rows="1" placeholder="Item name" aria-label="Item">${escapeHtml(r.item)}</textarea></td>
        <td><textarea class="in desc" data-field="desc" rows="1" placeholder="Description" aria-label="Description">${escapeHtml(r.desc)}</textarea></td>
        <td><input class="in price" data-field="price" type="number" min="0" step="0.01" value="${r.price}" aria-label="Unit price"></td>
        <td class="amt">${fmt(num(r.qty) * num(r.price))}</td>
        <td class="no-print"><button class="del" type="button" data-del="${r.id}" aria-label="Remove item">&times;</button></td>
      </tr>`)
    .join('');
  autosizeAll();
  updateTotals();
}

function autosize(el) {
  el.style.height = 'auto';
  const chrome = el.offsetHeight - el.clientHeight;
  el.style.height = el.scrollHeight + chrome + 'px';
}

function autosizeAll() {
  els.itemsBody.querySelectorAll('textarea.in').forEach(autosize);
}

function totals() {
  const sub = rows.reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  const disc = Math.max(0, num(els.discount.value));
  const net = Math.max(0, sub - disc);
  const adv = Math.max(0, num(els.advance.value));
  return { sub, disc, net, adv, bal: net - adv };
}

function currentStatus(t) {
  const hasItems = rows.some((r) => r.item.trim() || num(r.price) > 0);
  const hasCustomer = els.custName.value.trim().length > 0;
  if (!hasItems && !hasCustomer) return { key: 'draft', label: 'Draft' };
  if (els.invType.value === 'Quotation') return { key: 'quote', label: 'Quotation' };
  if (t.net > 0 && t.bal <= 0) return { key: 'paid', label: 'Paid' };
  return { key: 'due', label: 'Balance Due' };
}

function updateTotals() {
  const t = totals();
  els.tSub.textContent = fmt(t.sub);
  els.tNet.textContent = fmt(t.net);
  els.tBal.textContent = fmt(t.bal);
  els.tBal.style.color = t.bal < 0 ? '#fca5a5' : '';
  els.amountWords.textContent = amountInWords(t.net);

  els.itemsBody.querySelectorAll('tr').forEach((tr) => {
    const r = rows.find((x) => x.id === Number(tr.dataset.id));
    if (r) tr.querySelector('.amt').textContent = fmt(num(r.qty) * num(r.price));
  });

  const status = currentStatus(t);
  els.statusPill.className = 'status-pill ' + status.key;
  els.statusPill.textContent = status.label;
}

/* ---------------- Catalog ---------------- */
function priceFor(name, basePrice) {
  const key = String(name || '').trim().toLowerCase();
  const saved = priceBook[key];
  return saved != null && Number.isFinite(Number(saved)) ? Number(saved) : basePrice;
}

function fullCatalog() {
  return [
    ...myItems.map((x) => ({ ...x, group: 'My Items' })),
    ...CATALOG_BASE.map((c) => ({ ...c, price: priceFor(c.item, c.price) }))
  ];
}

function setMyItems(list) {
  myItems = normalizeItems(list);
  writeJSON(LS.myItems, myItems);
}

function rememberItemPrice(name, price) {
  if (viewOnly) return;
  const key = String(name || '').trim().toLowerCase();
  const value = num(price);
  if (!key || value <= 0) return;

  const savedItem = myItems.find((x) => x.item.trim().toLowerCase() === key);
  if (savedItem) {
    if (num(savedItem.price) === value) return;
    savedItem.price = value;
    setMyItems(myItems);
  } else if (CATALOG_BASE.some((c) => c.item.trim().toLowerCase() === key)) {
    if (num(priceBook[key]) === value) return;
    priceBook[key] = value;
    writeJSON(LS.prices, priceBook);
  } else {
    return;
  }

  if (key === INSTALL_ITEM.toLowerCase()) {
    settings.installAmount = value;
    els.installAmount.value = value;
    saveSettings();
    renderInstallAmount();
  }
  renderCatalog();

  if (cloudAdmin && window.AE_Cloud) {
    window.AE_Cloud.savePrice(key, value).catch(() => { /* saved locally */ });
  }
}

function renderChips() {
  const groups = GROUPS.filter((g) => g !== 'My Items' || myItems.length > 0);
  if (!groups.includes(activeGroup)) activeGroup = 'All';
  els.chips.innerHTML = groups
    .map((g) => `<button type="button" class="chip${g === activeGroup ? ' active' : ''}" data-group="${escapeHtml(g)}">${escapeHtml(g)}</button>`)
    .join('');
}

function renderCatalog() {
  const q = searchTerm.trim().toLowerCase();
  const list = fullCatalog().filter((c) => {
    const groupOk = activeGroup === 'All' || c.group === activeGroup;
    const textOk = !q || (c.item + ' ' + c.desc + ' ' + c.group).toLowerCase().includes(q);
    return groupOk && textOk;
  });

  if (!list.length) {
    els.catalog.innerHTML = activeGroup === 'My Items'
      ? '<div class="cat-empty">No saved items yet. Type a new item on the bill — it is saved here automatically.</div>'
      : '<div class="cat-empty">No items match your search.</div>';
    return;
  }

  let html = '';
  let last = '';
  list.forEach((c) => {
    if (c.group !== last) {
      html += `<div class="cat-group-title">${escapeHtml(c.group)}</div>`;
      last = c.group;
    }
    html += `
      <button type="button" class="cat-item" data-item="${escapeHtml(c.item)}">
        <span>
          <span class="cat-item-name">${escapeHtml(c.item)}</span>
          <span class="cat-item-desc">${escapeHtml(c.desc)}</span>
        </span>
        <span class="cat-item-price">${fmt(c.price)}</span>
      </button>`;
  });
  els.catalog.innerHTML = html;
}

function catalogAdd(itemName) {
  const c = fullCatalog().find((x) => x.item === itemName);
  if (!c) return;

  const blank = rows.find((r) => rowIsEmpty(r));
  if (blank) {
    blank.item = c.item;
    blank.desc = c.desc;
    blank.price = c.price;
    if (!blank.qty) blank.qty = 1;
    renderRows();
    const input = els.itemsBody.querySelector(`tr[data-id="${blank.id}"] .in.qty`);
    if (input) input.select();
  } else {
    addRow({ qty: 1, item: c.item, desc: c.desc, price: c.price });
  }
  scheduleAutoSave();
  toast(c.item + ' added');
}

function addInstallCharge() {
  const amount = num(els.installAmount.value);
  const existing = rows.find((r) => r.item.trim().toLowerCase() === INSTALL_ITEM.toLowerCase());
  if (existing) {
    existing.qty = 1;
    existing.price = amount;
  } else {
    const blank = rows.find((r) => rowIsEmpty(r));
    if (blank) {
      blank.item = INSTALL_ITEM;
      blank.desc = INSTALL_DESC;
      blank.price = amount;
      blank.qty = 1;
    } else {
      addRow({ qty: 1, item: INSTALL_ITEM, desc: INSTALL_DESC, price: amount }, { silent: true });
    }
  }
  renderRows();
  scheduleAutoSave();
  toast('Installation charge added');
}

function renderInstallAmount() {
  const amount = num(settings.installAmount);
  els.quickInstallAmt.textContent = amount > 0 ? 'Rs. ' + amount.toLocaleString('en-US') : 'Set amount';
}

function ensureInstallCharge() {
  if (!settings.autoInstall || num(settings.installAmount) <= 0) return false;
  if (rows.some((r) => r.item.trim().toLowerCase() === INSTALL_ITEM.toLowerCase())) return false;
  rows.push(makeRow({ qty: 1, item: INSTALL_ITEM, desc: INSTALL_DESC, price: num(settings.installAmount) }));
  renderRows();
  return true;
}

function harvestCustomItems(items) {
  if (!Array.isArray(items) || !items.length) return;
  const known = new Set(fullCatalog().map((x) => x.item.trim().toLowerCase()));
  let added = 0;
  items.forEach((it) => {
    const name = String(it.item || '').trim();
    const price = num(it.price);
    if (!name || price <= 0) return;
    if (known.has(name.toLowerCase())) return;
    myItems.push({ item: name, desc: String(it.desc || '').trim(), price });
    known.add(name.toLowerCase());
    added++;
  });
  if (added) {
    setMyItems(myItems);
    renderChips();
    renderCatalog();
  }
}

/* ---------------- Draft + autosave ---------------- */
function collect() {
  const t = totals();
  return {
    no: els.invNo.value.trim(),
    date: els.invDate.value,
    type: els.invType.value,
    title: els.custTitle.value,
    customer: els.custName.value.trim(),
    address: els.custAddress.value.trim(),
    phone: els.custPhone.value.trim(),
    items: rows.map((r) => ({ qty: num(r.qty), item: r.item, desc: r.desc, price: num(r.price) })),
    discount: t.disc,
    advance: t.adv,
    notes: els.notes.value,
    subtotal: t.sub,
    total: t.net,
    balance: t.bal,
    signatureName: settings.signatureName || '',
    showSeal: settings.showSeal !== false,
    savedAt: new Date().toISOString()
  };
}

function applyInvoice(inv) {
  els.invNo.value = inv.no || nextInvoiceNo();
  els.invDate.value = inv.date || todayISO();
  els.invType.value = inv.type || 'Cash Invoice';
  els.custTitle.value = inv.title || 'Mr.';
  els.custName.value = inv.customer || '';
  els.custAddress.value = inv.address || '';
  els.custPhone.value = inv.phone || '';
  els.discount.value = inv.discount || 0;
  els.advance.value = inv.advance || 0;
  els.notes.value = inv.notes != null ? inv.notes : DEFAULT_NOTES;

  rows = (inv.items || []).map((it) => makeRow(it));
  if (!rows.length) rows.push(makeRow({ qty: 1 }));
  renderRows();
}

function isBillable() {
  const hasItems = rows.some((r) => r.item.trim() || num(r.price) > 0);
  return els.custName.value.trim().length > 0 && hasItems;
}

function setSaveState(text, mode) {
  els.saveState.textContent = text;
  els.saveState.dataset.mode = mode || '';
}

function scheduleAutoSave() {
  if (viewOnly || suppressDraftSave) return;
  setSaveState('Saving…', 'saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushAutoSave, 1200);
}

function flushAutoSave() {
  if (viewOnly || suppressDraftSave) return;
  clearTimeout(saveTimer);
  if (!isBillable()) {
    writeJSON(LS.draft, collect());
    setSaveState('Draft — auto-save on');
    return false;
  }
  const inv = collect();
  if (!inv.no) inv.no = nextInvoiceNo();
  els.invNo.value = inv.no;
  upsertHistory(inv);
  writeJSON(LS.draft, inv);
  setSaveState('Saved ' + timeNow(), 'saved');
  scheduleCloudSave(inv);
  return true;
}

function resetInvoice() {
  els.custTitle.value = 'Mr.';
  els.custName.value = '';
  els.custAddress.value = '';
  els.custPhone.value = '';
  els.discount.value = 0;
  els.advance.value = 0;
  els.notes.value = DEFAULT_NOTES;
  els.invDate.value = todayISO();
  els.invNo.value = nextInvoiceNo();
  els.invType.value = 'Cash Invoice';

  rows = [makeRow({ qty: 1 })];
  if (settings.autoInstall && num(settings.installAmount) > 0) {
    rows.push(makeRow({ qty: 1, item: INSTALL_ITEM, desc: INSTALL_DESC, price: num(settings.installAmount) }));
  }
  renderRows();
  writeJSON(LS.draft, collect());
  setSaveState('Auto-save on');
}

/* ---------------- History ---------------- */
function getHistory() {
  const list = readJSON(LS.history, []);
  return Array.isArray(list) ? list : [];
}

function setHistory(list) {
  writeJSON(LS.history, list);
  renderHistoryCount();
}

function renderHistoryCount() {
  els.histCount.textContent = String(getHistory().length);
}

function upsertHistory(inv) {
  const list = getHistory();
  const idx = list.findIndex((x) => x.no === inv.no);
  let isNew = false;
  if (idx >= 0) {
    list[idx] = inv;
  } else {
    list.unshift(inv);
    bumpCounter();
    isNew = true;
  }
  if (!setHistorySafe(list)) return false;
  renderHistoryList();
  return isNew;
}

function setHistorySafe(list) {
  if (writeJSON(LS.history, list)) {
    renderHistoryCount();
    return true;
  }
  toast('Storage full — couldn’t save invoice');
  return false;
}

function manualSave() {
  if (viewOnly) {
    toast('Shared view is read-only');
    return;
  }
  harvestCustomItems(collect().items);
  const inv = collect();
  const hasItem = inv.items.some((i) => (i.item || '').trim() || num(i.price) > 0);
  if (!hasItem) {
    toast('Add at least one item before saving');
    return;
  }
  if (!inv.customer) {
    toast('Please enter the customer name');
    els.custName.focus();
    return;
  }
  if (!inv.no) {
    inv.no = nextInvoiceNo();
    els.invNo.value = inv.no;
  }
  const isNew = upsertHistory(inv);
  writeJSON(LS.draft, inv);
  setSaveState('Saved ' + timeNow(), 'saved');
  toast(isNew ? 'Invoice ' + inv.no + ' saved' : 'Invoice ' + inv.no + ' updated');
  if (cloudAdmin) pushCloudNow(inv);
}

function renderHistoryList() {
  const list = getHistory();
  if (!list.length) {
    els.historyList.innerHTML = '<div class="h-empty">No saved invoices yet.<br>Bills save automatically once a customer and items are added.</div>';
    return;
  }
  els.historyList.innerHTML = list
    .map(
      (inv) => `
      <div class="h-item" data-no="${escapeHtml(inv.no)}">
        <div class="h-main">
          <div class="h-no">${escapeHtml(inv.no)}<span class="h-type">${escapeHtml(inv.type || 'Invoice')}</span></div>
          <div class="h-sub">${escapeHtml((inv.title ? inv.title + ' ' : '') + (inv.customer || 'No customer'))} · ${escapeHtml(prettyDate(inv.date))} · <strong>${fmt(inv.total)}</strong></div>
        </div>
        <div class="h-actions">
          <button type="button" data-load="${escapeHtml(inv.no)}">Load</button>
          <button type="button" data-del="${escapeHtml(inv.no)}">Delete</button>
        </div>
      </div>`
    )
    .join('');
}

function openHistory() {
  renderHistoryList();
  els.historyModal.classList.add('open');
  els.historyModal.setAttribute('aria-hidden', 'false');
}

function closeHistory() {
  els.historyModal.classList.remove('open');
  els.historyModal.setAttribute('aria-hidden', 'true');
}

/* ---------------- PDF ---------------- */
function pdfFileName() {
  const no = (els.invNo.value.trim() || 'invoice').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-');
  return 'Alpha-Electronic_Invoice_' + no + '.pdf';
}

async function downloadPdf() {
  if (pdfBusy) return;
  const hasContent = els.custName.value.trim() || rows.some((r) => r.item.trim() || num(r.price) > 0);
  if (!hasContent) {
    toast('Add a customer and items first');
    return;
  }
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDFCtor || !window.htmlToImage) {
    window.print();
    toast('Choose “Save as PDF” in the print window');
    return;
  }

  pdfBusy = true;
  const oldLabel = els.btnPdf.textContent;
  els.btnPdf.disabled = true;
  els.btnPdf.textContent = 'Preparing…';

  if (!viewOnly) {
    harvestCustomItems(collect().items);
    flushAutoSave();
  }

  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  els.paper.classList.add('pdf-mode');
  try {
    await nextFrame();
    const canvas = await window.htmlToImage.toCanvas(els.paper, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true
    });

    const doc = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = 210;
    const pageH = 297;
    let imgH = canvas.height * (pageW / canvas.width);
    let drawW = pageW;
    let drawX = 0;
    if (imgH > pageH) {
      const fit = pageH / imgH;
      if (fit >= 0.72) {
        drawW = pageW * fit;
        drawX = (pageW - drawW) / 2;
        imgH = pageH;
      }
    }
    const pages = Math.max(1, Math.ceil((imgH - 0.5) / pageH));

    let data = '';
    let type = 'JPEG';
    try {
      data = canvas.toDataURL('image/jpeg', 0.95);
    } catch (e) {
      data = canvas.toDataURL('image/png');
      type = 'PNG';
    }

    for (let p = 0; p < pages; p++) {
      if (p) doc.addPage();
      doc.addImage(data, type, drawX, -p * pageH, drawW, imgH, undefined, 'FAST');
    }
    doc.save(pdfFileName());
    toast('PDF saved to your device');
  } catch (err) {
    console.error(err);
    toast('PDF failed — opening print dialog');
    window.print();
  } finally {
    els.paper.classList.remove('pdf-mode');
    els.btnPdf.disabled = false;
    els.btnPdf.textContent = oldLabel;
    pdfBusy = false;
  }
}

/* ---------------- Share / online view ---------------- */
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function sharePayload(inv) {
  const d = inv || collect();
  const body = [
    1, d.no, d.date, d.type, d.title, d.customer, d.address, d.phone,
    d.discount, d.advance, d.notes,
    (d.items || []).map((i) => [i.qty, i.item, i.desc, i.price]),
    settings.signatureName || '',
    settings.showSeal ? 1 : 0
  ];
  return toBase64Url(JSON.stringify(body));
}

function parseSharePayload(raw) {
  const arr = JSON.parse(fromBase64Url(raw));
  if (!Array.isArray(arr) || arr[0] !== 1) return null;
  return {
    no: arr[1] || '',
    date: arr[2] || todayISO(),
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
    sigName: arr[12] != null ? String(arr[12]) : '',
    showSeal: arr[13] == null ? true : !!Number(arr[13])
  };
}

function readSharedFromHash() {
  const hash = location.hash || '';
  if (!hash.startsWith('#view=')) return null;
  try {
    return parseSharePayload(hash.slice(6));
  } catch (e) {
    return null;
  }
}

function applySharedBrand(shared) {
  if (shared.sigName) settings.signatureName = shared.sigName;
  settings.showSeal = shared.showSeal !== false;
  renderBrandMarks();
}

function buildShareLink() {
  return new URL('view.html', location.href).href + '#v=' + sharePayload();
}

function shareMessage() {
  const inv = collect();
  const t = totals();
  return [
    BUSINESS.name,
    'Invoice: ' + (inv.no || '-'),
    'Date: ' + (inv.date || '-'),
    'Customer: ' + (inv.customer || '-'),
    'Total: ' + fmt(t.net),
    'Balance due: ' + fmt(t.bal),
    'Mobile: ' + BUSINESS.mobile
  ].join('\n');
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg || 'Copied');
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    toast(ok ? (okMsg || 'Copied') : 'Copy failed — select the link and copy');
    return ok;
  }
}

function openShare() {
  if (!els.custName.value.trim() && !rows.some((r) => r.item.trim() || num(r.price) > 0)) {
    toast('Add a customer and items first');
    return;
  }
  harvestCustomItems(collect().items);
  flushAutoSave();
  els.shareLink.value = buildShareLink();
  els.btnShareNative.hidden = !navigator.share;
  els.shareModal.classList.add('open');
  els.shareModal.setAttribute('aria-hidden', 'false');
  els.shareLink.focus();
  els.shareLink.select();
}

function closeShare() {
  els.shareModal.classList.remove('open');
  els.shareModal.setAttribute('aria-hidden', 'true');
}

function enterViewMode() {
  viewOnly = true;
  document.body.classList.add('view-mode');
  els.viewBanner.hidden = false;
  document.querySelectorAll('#paper input, #paper select, #paper textarea').forEach((el) => {
    el.setAttribute('tabindex', '-1');
  });
  document.title = 'Invoice ' + (els.invNo.value.trim() || '') + ' — ' + BUSINESS.name;
}

function leaveViewMode() {
  viewOnly = false;
  suppressDraftSave = false;
  document.body.classList.remove('view-mode');
  els.viewBanner.hidden = true;
  document.querySelectorAll('#paper [tabindex="-1"]').forEach((el) => el.removeAttribute('tabindex'));
  try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* file:// */ }
  document.title = 'Alpha Electronic — Invoice Maker';
  writeJSON(LS.draft, collect());
  setSaveState('Auto-save on');
}

/* ---------------- Backup / restore ---------------- */
function downloadBackup() {
  const data = {
    app: 'alpha-electronic-invoice-maker',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings,
    myItems: myItems,
    prices: priceBook,
    history: getHistory(),
    draft: collect()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Alpha-Electronic_Backup_' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Backup downloaded');
}

async function restoreBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'alpha-electronic-invoice-maker') {
      toast('Not an Alpha Electronic backup file');
      return;
    }
    if (!confirm('Restore this backup? Bills, items and settings on this device will be replaced.')) return;
    if (data.settings && typeof data.settings === 'object') writeJSON(LS.settings, data.settings);
    if (Array.isArray(data.myItems)) writeJSON(LS.myItems, normalizeItems(data.myItems));
    if (data.prices && typeof data.prices === 'object' && !Array.isArray(data.prices)) writeJSON(LS.prices, data.prices);
    if (Array.isArray(data.history)) writeJSON(LS.history, data.history);
    if (data.draft && typeof data.draft === 'object') writeJSON(LS.draft, data.draft);
    suppressDraftSave = true;
    toast('Backup restored — reloading…');
    setTimeout(() => location.reload(), 700);
  } catch (e) {
    toast('Could not read that backup file');
  }
}

/* ---------------- Cloud sync (Firebase) ---------------- */
let cloudPricesLoaded = false;

function cloudEnabled() {
  return !!(window.AE_Cloud && window.AE_Cloud.init && window.AE_Cloud.init());
}

function setCloudUI(text, mode) {
  const textEl = document.getElementById('cloudText');
  const dot = document.getElementById('cloudDot');
  if (textEl) textEl.textContent = text;
  if (dot) dot.dataset.mode = mode || '';
}

function updateCloudUI() {
  if (viewOnly) return;
  const signIn = document.getElementById('cloudSignIn');
  const syncBtn = document.getElementById('btnCloudSync');
  const adminLink = document.getElementById('cloudAdmin');

  if (!cloudEnabled()) {
    setCloudUI('Working offline — invoices save on this device', 'offline');
    if (signIn) signIn.hidden = false;
    if (syncBtn) syncBtn.hidden = true;
    if (adminLink) adminLink.hidden = true;
    return;
  }
  if (!cloudUser) {
    setCloudUI('Local mode — sign in as admin to save invoices online', 'local');
    if (signIn) { signIn.hidden = false; signIn.textContent = 'Sign in'; signIn.href = 'login.html?next=invoice.html'; }
    if (syncBtn) syncBtn.hidden = true;
    if (adminLink) adminLink.hidden = true;
    return;
  }
  if (cloudAdmin) {
    setCloudUI('Cloud sync on — ' + (cloudUser.email || 'admin'), 'on');
    if (signIn) signIn.hidden = true;
    if (syncBtn) syncBtn.hidden = false;
    if (adminLink) adminLink.hidden = false;
  } else {
    setCloudUI('Signed in as ' + (cloudUser.email || 'customer') + ' — admin access needed for cloud sync', 'warn');
    if (signIn) { signIn.hidden = false; signIn.textContent = 'Switch account'; signIn.href = 'login.html?next=invoice.html'; }
    if (syncBtn) syncBtn.hidden = true;
    if (adminLink) adminLink.hidden = true;
  }
}

function cloudKeysMap() {
  const map = readJSON(LS.cloudKeys, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function rememberCloudKey(no, key) {
  const map = cloudKeysMap();
  map[String(no || '').trim()] = key;
  writeJSON(LS.cloudKeys, map);
}

function scheduleCloudSave() {
  if (!cloudAdmin || viewOnly || suppressDraftSave) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    if (cloudAdmin && !viewOnly && isBillable()) pushCloudNow();
  }, 700);
}

async function pushCloudNow(inv) {
  if (!cloudAdmin || viewOnly || !window.AE_Cloud) return false;
  if (cloudSaving) {
    cloudPending = true;
    return false;
  }
  const data = inv || collect();
  if (!data.no || !isBillable()) return false;

  const map = cloudKeysMap();
  let key = cloudKey || map[data.no] || '';
  const isNew = !key;
  if (!key) key = window.AE_Cloud.invoiceKey(data.no);

  cloudSaving = true;
  try {
    await window.AE_Cloud.saveInvoice(data, { key: key, isNew: isNew });
    cloudKey = key;
    rememberCloudKey(data.no, key);
    setCloudUI('Cloud saved ' + timeNow() + ' — ' + (cloudUser.email || 'admin'), 'on');
    return true;
  } catch (e) {
    console.warn('Cloud save failed', e);
    setCloudUI('Cloud save failed — your local copy is saved', 'warn');
    return false;
  } finally {
    cloudSaving = false;
    if (cloudPending) {
      cloudPending = false;
      setTimeout(() => pushCloudNow(), 350);
    }
  }
}

async function mergeCloudPrices() {
  if (!cloudAdmin || viewOnly || !window.AE_Cloud) return;
  try {
    const prices = await window.AE_Cloud.fetchPrices();
    cloudPricesLoaded = true;
    let changed = false;
    Object.keys(prices || {}).forEach((k) => {
      const v = num(prices[k]);
      if (v > 0 && num(priceBook[k]) !== v) {
        priceBook[k] = v;
        changed = true;
      }
    });
    const instKey = INSTALL_ITEM.toLowerCase();
    const cloudInstall = num(prices && prices[instKey]);
    if (cloudInstall > 0 && num(settings.installAmount) !== cloudInstall) {
      settings.installAmount = cloudInstall;
      els.installAmount.value = cloudInstall;
      saveSettings();
      renderInstallAmount();
    }
    if (changed) {
      writeJSON(LS.prices, priceBook);
      renderCatalog();
    }
    if (prices && Object.keys(prices).length) {
      setCloudUI('Cloud prices loaded — ' + (cloudUser.email || 'admin'), 'on');
    }
  } catch (e) {
    console.warn('Cloud price sync failed', e);
  }
}

async function loadCloudInvoice(key) {
  if (!window.AE_Cloud) return false;
  try {
    await window.AE_Cloud.waitReady();
    if (!window.AE_Cloud.currentUser()) {
      location.href = 'login.html?next=' + encodeURIComponent('invoice.html?id=' + key);
      return false;
    }
    if (!window.AE_Cloud.isAdmin()) {
      toast('This cloud invoice belongs to the admin account');
      return false;
    }
    const inv = await window.AE_Cloud.readInvoice(key);
    if (!inv) {
      toast('Invoice not found in the cloud');
      return false;
    }
    cloudUser = window.AE_Cloud.currentUser();
    cloudAdmin = true;
    applyInvoice(inv);
    cloudKey = inv._key || key;
    rememberCloudKey(inv.no, cloudKey);
    writeJSON(LS.draft, collect());
    setSaveState('Cloud invoice loaded');
    setCloudUI('Editing cloud invoice ' + (inv.no || '') + ' — auto-saves to cloud', 'on');
    document.title = 'Edit Invoice ' + (inv.no || '') + ' — ' + BUSINESS.name;
    updateCloudUI();
    return true;
  } catch (e) {
    console.warn('Cloud load failed', e);
    toast('Could not open that cloud invoice');
    return false;
  }
}

function restoreLocalInvoice() {
  const draft = readJSON(LS.draft, null);
  if (draft && Array.isArray(draft.items)) {
    applyInvoice(draft);
    if (ensureInstallCharge()) {
      writeJSON(LS.draft, collect());
      setSaveState('Draft restored — charge added');
    } else {
      setSaveState('Draft restored — auto-save on');
    }
  } else {
    resetInvoice();
  }
}

function queryParam(name) {
  try {
    return new URLSearchParams(location.search).get(name) || '';
  } catch (e) {
    return '';
  }
}

/* ---------------- Images ---------------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxSide) {
  const src = await readFileAsDataUrl(file);
  const img = await loadImage(src);
  const largest = Math.max(img.width, img.height);
  const scale = Math.min(1, maxSide / largest);
  if (scale === 1 && src.length < 450000) return src;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function handleSignatureUpload(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    toast('Please choose an image file');
    return;
  }
  try {
    const dataUrl = await compressImage(file, 700);
    if (dataUrl.length > 900000) {
      toast('Image too large — use a smaller picture');
      return;
    }
    settings.signatureImage = dataUrl;
    saveSettings();
    renderBrandMarks();
    toast('Signature image added');
  } catch (e) {
    toast('Could not read that image');
  }
}

/* ---------------- Boot ---------------- */
function init() {
  els.sigName.value = settings.signatureName || '';
  els.sealToggle.checked = !!settings.showSeal;
  els.installAmount.value = settings.installAmount != null ? settings.installAmount : 2500;
  els.autoInstall.checked = settings.autoInstall !== false;
  renderInstallAmount();

  renderBrandMarks();
  renderChips();
  renderCatalog();
  renderHistoryCount();
  renderHistoryList();

  updateCloudUI();
  if (window.AE_Cloud) {
    window.AE_Cloud.onAuth((state) => {
      cloudUser = state.user || null;
      cloudAdmin = !!state.admin;
      if (!cloudAdmin) cloudPricesLoaded = false;
      updateCloudUI();
      if (cloudAdmin) mergeCloudPrices();
    });
  }

  const shared = readSharedFromHash();
  if (shared) {
    applyInvoice(shared);
    applySharedBrand(shared);
    enterViewMode();
  } else {
    const cloudId = queryParam('id');
    if (cloudId) {
      setSaveState('Loading cloud invoice…');
      loadCloudInvoice(cloudId).then((ok) => {
        if (!ok) restoreLocalInvoice();
      });
    } else {
      restoreLocalInvoice();
    }
  }

  /* Paper inputs */
  els.paper.addEventListener('input', (e) => {
    if (e.target.closest('#itemsBody') || e.target === els.discount || e.target === els.advance) {
      updateTotals();
    }
    scheduleAutoSave();
  });

  els.paper.addEventListener('change', scheduleAutoSave);

  /* Items body */
  els.itemsBody.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    const field = e.target.dataset.field;
    if (!tr || !field) return;
    const row = rows.find((r) => r.id === Number(tr.dataset.id));
    if (!row) return;
    row[field] = field === 'qty' || field === 'price' ? num(e.target.value) : e.target.value;
    tr.classList.toggle('row-empty', rowIsEmpty(row));
    if (e.target.tagName === 'TEXTAREA') autosize(e.target);
    updateTotals();
  });

  els.itemsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    removeRow(Number(btn.dataset.del));
  });

  els.itemsBody.addEventListener('change', (e) => {
    const tr = e.target.closest('tr');
    const field = e.target.dataset.field;
    if (!tr || (field !== 'price' && field !== 'item')) return;
    const row = rows.find((r) => r.id === Number(tr.dataset.id));
    if (!row) return;
    rememberItemPrice(row.item, row.price);
  });

  els.itemsBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const tr = e.target.closest('tr');
    if (!tr) return;
    const inputs = [...tr.querySelectorAll('.in')];
    const i = inputs.indexOf(e.target);
    e.preventDefault();
    if (i > -1 && i < inputs.length - 1) {
      inputs[i + 1].focus();
      inputs[i + 1].select();
    } else {
      addRow();
    }
  });

  $('btnAddRow').addEventListener('click', () => addRow());

  /* Catalog */
  els.chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-group]');
    if (!chip) return;
    activeGroup = chip.dataset.group;
    renderChips();
    renderCatalog();
  });

  els.search.addEventListener('input', () => {
    searchTerm = els.search.value;
    renderCatalog();
  });

  els.catalog.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-item]');
    if (!btn) return;
    catalogAdd(btn.dataset.item);
  });

  /* Settings */
  els.sigName.addEventListener('input', () => {
    settings.signatureName = els.sigName.value;
    renderBrandMarks();
    scheduleSettingsSave();
  });

  els.sigUpload.addEventListener('change', () => {
    const file = els.sigUpload.files && els.sigUpload.files[0];
    handleSignatureUpload(file).finally(() => { els.sigUpload.value = ''; });
  });

  els.btnSigClear.addEventListener('click', () => {
    settings.signatureImage = '';
    saveSettings();
    renderBrandMarks();
    toast('Signature image removed');
  });

  els.sealToggle.addEventListener('change', () => {
    settings.showSeal = els.sealToggle.checked;
    saveSettings();
    renderBrandMarks();
  });

  els.installAmount.addEventListener('input', () => {
    settings.installAmount = Math.max(0, num(els.installAmount.value));
    renderInstallAmount();
    scheduleSettingsSave();
  });

  els.installAmount.addEventListener('change', () => {
    const amount = num(els.installAmount.value);
    if (cloudAdmin && amount > 0 && window.AE_Cloud) {
      window.AE_Cloud.savePrice(INSTALL_ITEM, amount).catch(() => { /* local only */ });
    }
  });

  const btnCloudSync = document.getElementById('btnCloudSync');
  if (btnCloudSync) {
    btnCloudSync.addEventListener('click', async () => {
      if (!cloudAdmin) {
        toast('Sign in as admin first');
        return;
      }
      harvestCustomItems(collect().items);
      flushAutoSave();
      const ok = await pushCloudNow(collect());
      toast(ok ? 'Invoice synced to cloud' : 'Could not sync — check your connection');
    });
  }

  els.autoInstall.addEventListener('change', () => {
    settings.autoInstall = els.autoInstall.checked;
    saveSettings();
    if (settings.autoInstall && ensureInstallCharge()) scheduleAutoSave();
  });

  els.btnAddInstall.addEventListener('click', addInstallCharge);
  els.btnQuickInstall.addEventListener('click', addInstallCharge);

  els.btnClearItems.addEventListener('click', () => {
    if (!myItems.length) {
      toast('No saved items to clear');
      return;
    }
    if (!confirm('Clear all saved “My Items”? Bills already saved are not affected.')) return;
    setMyItems([]);
    renderChips();
    renderCatalog();
    toast('Saved items cleared');
  });

  /* Toolbar */
  $('btnNew').addEventListener('click', () => {
    harvestCustomItems(collect().items);
    flushAutoSave();
    resetInvoice();
    toast('New invoice started');
  });

  $('btnSave').addEventListener('click', manualSave);
  $('btnHistory').addEventListener('click', openHistory);
  $('btnCloseHist').addEventListener('click', closeHistory);
  $('btnPdf').addEventListener('click', downloadPdf);

  /* Share + view mode */
  els.btnShare.addEventListener('click', openShare);
  els.btnCloseShare.addEventListener('click', closeShare);
  els.shareModal.addEventListener('click', (e) => {
    if (e.target === els.shareModal) closeShare();
  });
  els.btnCopyLink.addEventListener('click', () => {
    els.shareLink.select();
    copyText(els.shareLink.value, 'Invoice link copied');
  });
  els.btnCopyMsg.addEventListener('click', () => copyText(shareMessage(), 'Message copied'));
  els.btnShareNative.addEventListener('click', async () => {
    try {
      await navigator.share({
        title: 'Invoice ' + els.invNo.value.trim(),
        text: shareMessage(),
        url: els.shareLink.value
      });
    } catch (e) { /* cancelled */ }
  });
  els.btnViewPdf.addEventListener('click', downloadPdf);
  els.btnViewEdit.addEventListener('click', leaveViewMode);

  /* Backup / restore */
  els.btnBackup.addEventListener('click', downloadBackup);
  els.btnRestore.addEventListener('click', () => els.backupFile.click());
  els.backupFile.addEventListener('change', () => {
    const file = els.backupFile.files && els.backupFile.files[0];
    restoreBackup(file).finally(() => { els.backupFile.value = ''; });
  });

  $('btnPrint').addEventListener('click', () => {
    harvestCustomItems(collect().items);
    flushAutoSave();
    renderRows();
    window.print();
  });

  els.historyModal.addEventListener('click', (e) => {
    if (e.target === els.historyModal) closeHistory();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHistory();
      closeShare();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      manualSave();
    }
  });

  els.historyList.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('[data-load]');
    const delBtn = e.target.closest('[data-del]');
    if (loadBtn) {
      const no = loadBtn.dataset.load;
      const inv = getHistory().find((x) => x.no === no);
      if (!inv) return;
      applyInvoice(inv);
      writeJSON(LS.draft, collect());
      closeHistory();
      setSaveState('Loaded — auto-save on');
      toast('Loaded ' + no);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (delBtn) {
      const no = delBtn.dataset.del;
      if (!confirm('Delete invoice ' + no + '? This cannot be undone.')) return;
      setHistory(getHistory().filter((x) => x.no !== no));
      renderHistoryList();
      toast('Deleted ' + no);
    }
  });

  /* Print + page lifecycle */
  window.addEventListener('beforeprint', () => {
    autosizeAll();
    if (!viewOnly) {
      harvestCustomItems(collect().items);
      flushAutoSave();
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const no = els.invNo.value.trim().replace(/\//g, '-') || 'invoice';
    document.title = 'Invoice ' + no;
  });
  window.addEventListener('afterprint', () => {
    document.title = 'Alpha Electronic — Invoice Maker';
  });
  window.addEventListener('hashchange', () => {
    const shared = readSharedFromHash();
    if (!shared) return;
    applyInvoice(shared);
    applySharedBrand(shared);
    enterViewMode();
    closeShare();
    window.scrollTo({ top: 0 });
  });
  window.addEventListener('resize', autosizeAll);
  window.addEventListener('beforeunload', () => {
    if (!viewOnly && !suppressDraftSave) writeJSON(LS.draft, collect());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !viewOnly && !suppressDraftSave) flushAutoSave();
  });
}

document.addEventListener('DOMContentLoaded', init);
