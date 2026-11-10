'use strict';

/* =========================================================
   Alpha Electronic — website assistant
   Answers package/contact questions and saves quote requests
   to Firebase serviceRequests (admin dashboard → Requests).
   ========================================================= */
(function () {
  if (window.AE_Chat) return;

  const Cloud = window.AE_Cloud;
  const UI = window.AE_UI || {};
  const PHONE = '077 328 3588';
  const WA = 'https://wa.me/94773283588';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { open: false, topic: '', busy: false };

  const isHome = /\/$/.test(location.pathname) || /index\.html$/i.test(location.pathname);
  const siteLink = (hash) => (isHome ? hash : 'index.html' + hash);
  const waLink = (text) => (Cloud && Cloud.whatsappLink ? Cloud.whatsappLink(text) : WA + '?text=' + encodeURIComponent(text || ''));

  const DEFAULT_CHIPS = ['Solar packages', 'CCTV packages', 'Wiring packages', 'Book site visit', 'Talk to human'];

  /* ---------------- DOM ---------------- */
  const root = document.createElement('div');
  root.className = 'chat-root';
  root.innerHTML =
    '<button class="chat-launcher" id="chatLauncher" type="button" aria-label="Open Alpha Assistant" aria-expanded="false" aria-controls="chatPanel">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.4-.6L3 21l1.6-4.3A8.4 8.4 0 1 1 21 11.5Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>' +
      '<span class="chat-ping" aria-hidden="true"></span>' +
    '</button>' +
    '<section class="chat-panel" id="chatPanel" aria-label="Alpha Assistant" aria-hidden="true">' +
      '<header class="chat-head">' +
        '<span class="chat-avatar" aria-hidden="true">A</span>' +
        '<span class="chat-head-text"><strong>Alpha Assistant</strong><small>Solar · CCTV · Wiring</small></span>' +
        '<button class="chat-close" id="chatClose" type="button" aria-label="Close chat">&times;</button>' +
      '</header>' +
      '<div class="chat-body" id="chatBody">' +
        '<div class="chat-msg bot">Ayubowan! I can help with solar, CCTV and wiring packages, prices, site visits and invoices. What do you need?</div>' +
        '<div class="chat-chips" id="chatChips"></div>' +
      '</div>' +
      '<form class="chat-input" id="chatForm" autocomplete="off">' +
        '<input id="chatText" type="text" placeholder="Ask about solar, CCTV, wiring…" aria-label="Your message" maxlength="500">' +
        '<button type="submit" aria-label="Send message">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>' +
        '</button>' +
      '</form>' +
      '<p class="chat-foot">Alpha Electronic · Reg. No 11/2622 · <a href="tel:+94773283588">' + PHONE + '</a></p>' +
    '</section>';
  document.body.appendChild(root);

  const launcher = root.querySelector('#chatLauncher');
  const panel = root.querySelector('#chatPanel');
  const body = root.querySelector('#chatBody');
  const chips = root.querySelector('#chatChips');
  const form = root.querySelector('#chatForm');
  const input = root.querySelector('#chatText');
  const closeBtn = root.querySelector('#chatClose');

  /* ---------------- Helpers ---------------- */
  function scrollDown() {
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function openChat() {
    if (state.open) return;
    state.open = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    const ping = launcher.querySelector('.chat-ping');
    if (ping) ping.remove();
    setTimeout(() => input.focus(), 220);
    scrollDown();
  }

  function closeChat() {
    state.open = false;
    panel.classList.remove('open');
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
  }

  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    bubble.textContent = text;
    body.appendChild(bubble);
    scrollDown();
    return bubble;
  }

  function addActions(actions) {
    if (!actions || !actions.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    actions.forEach((item) => {
      let node;
      if (item.href) {
        node = document.createElement('a');
        node.href = item.href;
        if (/^https?:/i.test(item.href)) {
          node.target = '_blank';
          node.rel = 'noopener';
        }
      } else {
        node = document.createElement('button');
        node.type = 'button';
        node.addEventListener('click', () => item.onClick());
      }
      node.className = 'chat-act' + (item.primary ? ' primary' : '');
      node.textContent = item.label;
      wrap.appendChild(node);
    });
    body.appendChild(wrap);
    scrollDown();
  }

  function setChips(list) {
    chips.innerHTML = '';
    (list || DEFAULT_CHIPS).forEach((label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.textContent = label;
      b.addEventListener('click', () => send(label));
      chips.appendChild(b);
    });
    scrollDown();
  }

  function addTyping() {
    const t = document.createElement('div');
    t.className = 'chat-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(t);
    scrollDown();
    return t;
  }

  function openQuote(service, pkg) {
    const btn = Array.from(document.querySelectorAll('[data-quote]')).find((b) => {
      if (pkg && b.dataset.package && b.dataset.package.toLowerCase().includes(pkg.toLowerCase())) return true;
      return !pkg && service && String(b.dataset.service || '').toLowerCase() === service.toLowerCase();
    });
    if (btn) {
      closeChat();
      btn.click();
      return;
    }
    location.href = siteLink('#contact');
  }

  function leadTopic(topic) {
    if (topic === 'cctv') return 'CCTV / security installation';
    if (topic === 'wiring') return 'House / industrial wiring';
    if (topic === 'service') return 'Service or repair';
    if (topic === 'invoice') return 'Invoice / payment question';
    return 'Solar / electrical quote';
  }

  function showLead(topic) {
    if (document.getElementById('chatLead')) return;
    state.topic = topic || 'quote';
    const wrap = document.createElement('form');
    wrap.className = 'chat-lead';
    wrap.id = 'chatLead';
    wrap.innerHTML =
      '<p class="chat-lead-title">Send a request to Alpha Electronic</p>' +
      '<p class="chat-lead-sub">Leave your name and phone — we will reply with the next step.</p>' +
      '<label>Name<input name="name" type="text" autocomplete="name" placeholder="Your name" required></label>' +
      '<label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" placeholder="07X XXX XXXX" required></label>' +
      '<label>Message<textarea name="message" rows="2" placeholder="Location and what you need"></textarea></label>' +
      '<button class="chat-lead-submit" type="submit">Send request</button>' +
      '<div class="chat-lead-status" role="status"></div>';
    const msg = wrap.querySelector('[name="message"]');
    msg.value = leadTopic(state.topic);
    body.appendChild(wrap);
    scrollDown();
    setTimeout(() => { const n = wrap.querySelector('[name="name"]'); if (n) n.focus(); }, 80);

    wrap.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.busy) return;
      const name = wrap.querySelector('[name="name"]').value.trim();
      const phone = wrap.querySelector('[name="phone"]').value.trim();
      const message = wrap.querySelector('[name="message"]').value.trim();
      const status = wrap.querySelector('.chat-lead-status');
      const submit = wrap.querySelector('.chat-lead-submit');

      if (!name) { setLeadStatus(status, 'bad', 'Please enter your name.'); return; }
      if (phone.replace(/\D/g, '').length < 6) { setLeadStatus(status, 'bad', 'Please enter a valid phone number.'); return; }
      if (!Cloud) {
        setLeadStatus(status, 'bad', 'The form could not connect. Please WhatsApp ' + PHONE + '.');
        return;
      }

      state.busy = true;
      submit.disabled = true;
      submit.textContent = 'Sending…';
      setLeadStatus(status, '', '');
      try {
        await Cloud.submitServiceRequest({
          name: name,
          phone: phone,
          email: '',
          message: message || leadTopic(state.topic),
          type: 'chatbot',
          package: '',
          source: 'chatbot'
        });
        wrap.innerHTML =
          '<p class="chat-lead-title">Request sent ✓</p>' +
          '<p class="chat-lead-sub">Thank you ' + escapeText(name) + '. Alpha Electronic will contact you on ' + escapeText(phone) + '.</p>' +
          '<div class="chat-lead-actions">' +
            '<a class="chat-act primary" href="' + waLink('Hello Alpha Electronic, I sent a request from the website chat.') + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' +
            '<a class="chat-act" href="tel:+94773283588">Call ' + PHONE + '</a>' +
          '</div>';
        scrollDown();
        setChips(['Solar packages', 'CCTV packages', 'Wiring packages', 'Talk to human']);
        addMessage('bot', 'Your request is saved. Is there anything else I can explain while you wait?');
      } catch (err) {
        const msgText = String((err && err.message) || '');
        setLeadStatus(
          status,
          'bad',
          /permission|rules/i.test(msgText)
            ? 'Messaging is not live yet. Please WhatsApp or call ' + PHONE + '.'
            : 'Could not send right now. Please WhatsApp or call ' + PHONE + '.'
        );
        submit.disabled = false;
        submit.textContent = 'Try again';
      } finally {
        state.busy = false;
      }
    });
    scrollDown();
  }

  function setLeadStatus(node, mode, text) {
    if (!node) return;
    node.className = 'chat-lead-status' + (mode ? ' ' + mode : '');
    node.textContent = text || '';
  }

  function escapeText(value) {
    if (UI.escapeHtml) return UI.escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------- Answers ---------------- */
  function answerSolar(t) {
    const match = t.match(/\b(5|10|20|40)\s*kv\b/);
    if (match) {
      const size = match[1] + 'kV';
      const map = {
        '5kV': 'The 5kV package is Rs 850,000 after incentives: 3.5kW system, 10 panels, 5kW hybrid inverter, basic monitoring and a 5-year workmanship warranty. It suits a small home.',
        '10kV': 'The 10kV package is Rs 1,500,000 after incentives: 6.6kW system, 18 panels, 6kW hybrid inverter, smart monitoring, battery-ready and a 10-year workmanship warranty. It is our most popular family-home package.',
        '20kV': 'The 20kV package is Rs 2,250,000 after incentives: 10kW system, 28 panels, 8kW hybrid inverter, 15-year workmanship warranty and an optional battery.',
        '40kV': 'The 40kV package is Rs 4,250,000 after incentives: commercial-grade solar, high-efficiency panels, three-phase inverter, CEB / LECO approval support and priority after-sales service.'
      };
      return {
        text: map[size] + ' Final price is confirmed after a site inspection.',
        links: [
          { label: 'Order ' + size + ' package', onClick: () => openQuote('Solar systems', size + ' Solar Package'), primary: true },
          { label: 'See all solar packages', href: siteLink('#solar-grid') }
        ],
        chips: ['Book site visit', 'CCTV packages', 'Talk to human']
      };
    }
    return {
      text: 'Solar packages:\n• 5kV — Rs 850,000 (small home)\n• 10kV — Rs 1,500,000 (family home, most popular)\n• 20kV — Rs 2,250,000 (large home or shop)\n• 40kV — Rs 4,250,000 (business / industry)\n\nThese are indicative prices after government incentives. A site inspection confirms panels, inverter, roof work and the final quotation.',
      links: [
        { label: 'See solar packages', href: siteLink('#solar-grid'), primary: true },
        { label: 'Book a site visit', onClick: () => showLead('solar') }
      ],
      chips: ['5kV package', '10kV package', '20kV package', 'Book site visit']
    };
  }

  function answerCctv() {
    return {
      text: 'CCTV packages (starting prices, confirmed after inspection):\n• 4 cameras — Rs 95,000 for a home or small shop\n• 8 cameras — Rs 185,000 for a shop or office (best value)\n• 16 cameras — Rs 365,000 for a factory or commercial site\n\nEach includes cameras, recorder, hard disk, cabling, mobile viewing and installation.',
      links: [
        { label: 'See CCTV packages', href: siteLink('#cctv-packages'), primary: true },
        { label: 'Request CCTV quote', onClick: () => showLead('cctv') }
      ],
      chips: ['Book site visit', 'Solar packages', 'Wiring packages']
    };
  }

  function answerWiring() {
    return {
      text: 'Wiring packages:\n• Home (1–3 bedroom) — from Rs 185,000\n• Shop / office — from Rs 250,000\n• Industrial — custom quote after a site survey\n\nWe handle concealed wiring, distribution boards, MCBs, lighting, three-phase lines, earthing and testing. Alpha Electronic is a registered contractor (Reg. No 11/2622).',
      links: [
        { label: 'See wiring packages', href: siteLink('#wiring-packages'), primary: true },
        { label: 'Book a survey', onClick: () => showLead('wiring') }
      ],
      chips: ['Book site visit', 'CCTV packages', 'Solar packages']
    };
  }

  function answerQuote() {
    return {
      text: 'Every quote starts with a short site inspection so the price is accurate. Send your details here and we will contact you to arrange a visit — no payment is needed to get a quote.',
      links: [
        { label: 'Send request in chat', onClick: () => showLead('quote'), primary: true },
        { label: 'Open quote form', href: siteLink('#contact') },
        { label: 'WhatsApp ' + PHONE, href: waLink('Hello Alpha Electronic, I would like a site visit / quotation.') }
      ],
      chips: ['Solar packages', 'CCTV packages', 'Wiring packages']
    };
  }

  function answerInvoice() {
    return {
      text: 'Every job gets an itemized invoice with Qty, Item, Description, Price, discount, advance and balance due — plus a signature and company seal. You can print or save it as an A4 PDF.\n\nA share link opens a read-only online preview. Customers can sign in to the portal to see invoices assigned to their account.',
      links: [
        { label: 'Customer portal', href: 'portal.html', primary: true },
        { label: 'Sign in', href: 'login.html' },
        { label: 'Ask about an invoice', onClick: () => showLead('invoice') }
      ],
      chips: ['Book site visit', 'Talk to human']
    };
  }

  function answerContact() {
    return {
      text: 'Alpha Electronic\nRanthati Kanda, Panagamuwa, Kurunegala\nMobile / WhatsApp: ' + PHONE + '\nReg. No 11/2622\n\nWe reply to WhatsApp same day and schedule site visits on weekdays and Saturdays.',
      links: [
        { label: 'WhatsApp us', href: waLink('Hello Alpha Electronic, I found you on the website.'), primary: true },
        { label: 'Call ' + PHONE, href: 'tel:+94773283588' },
        { label: 'Contact page', href: siteLink('#contact') }
      ],
      chips: ['Solar packages', 'CCTV packages', 'Book site visit']
    };
  }

  function answerWarranty() {
    return {
      text: 'Workmanship warranty is written on your quotation, along with the manufacturer warranty for panels, inverters, cameras and recorders. If something stops working, message us with the invoice number and we will arrange service.',
      links: [
        { label: 'Request service', onClick: () => showLead('service'), primary: true },
        { label: 'WhatsApp us', href: waLink('Hello Alpha Electronic, I need service for an installation.') }
      ],
      chips: ['Talk to human', 'Book site visit']
    };
  }

  function answerPayment() {
    return {
      text: 'Your invoice shows the subtotal, discount, advance paid and balance due. We accept cash and bank transfer; the balance is due on completion of installation unless your quotation says otherwise. Send us the invoice number if you need a payment confirmation.',
      links: [
        { label: 'Ask about payment', onClick: () => showLead('invoice'), primary: true },
        { label: 'WhatsApp us', href: waLink('Hello Alpha Electronic, I have a question about an invoice payment.') }
      ],
      chips: ['Customer portal', 'Talk to human']
    };
  }

  function answer(text) {
    const t = String(text || '').toLowerCase();

    if (/^(hi|hello|hey|ayubowan|good morning|good afternoon|good evening)\b/.test(t)) {
      return {
        text: 'Hello! I can explain our solar, CCTV and wiring packages, starting prices, site visits and invoices. What are you planning?',
        chips: DEFAULT_CHIPS
      };
    }
    if (/(human|agent|person|talk to|speak to|whatsapp|call me)/.test(t)) {
      return {
        text: 'You can reach the team directly on WhatsApp or by phone. We usually reply the same day.',
        links: [
          { label: 'WhatsApp ' + PHONE, href: waLink('Hello Alpha Electronic, I would like to talk to someone.'), primary: true },
          { label: 'Call ' + PHONE, href: 'tel:+94773283588' }
        ],
        chips: ['Solar packages', 'CCTV packages', 'Wiring packages']
      };
    }
    if (/(invoice|bill|receipt|pdf|share|portal|payment|advance|balance|bank)/.test(t)) {
      return answerPaymentOrInvoice(t);
    }
    if (/(solar|panel|inverter|battery|net meter|kv\b|electricity bill)/.test(t)) return answerSolar(t);
    if (/(cctv|camera|dvr|nvr|security|alarm|surveillance)/.test(t)) return answerCctv();
    if (/(wir|electric|mcb|distribution|three.?phase|socket|light|switch)/.test(t)) return answerWiring();
    if (/(price|cost|rate|how much|charge|cheap|budget)/.test(t)) {
      return {
        text: 'Guide prices:\n• Solar: Rs 850,000 – Rs 4,250,000 depending on system size\n• CCTV: Rs 95,000 – Rs 365,000 depending on camera count\n• Wiring: from Rs 185,000 for a home; shop and industrial priced after survey\n\nEvery price is confirmed with a written quotation after inspection.',
        links: [
          { label: 'Solar packages', href: siteLink('#solar-grid'), primary: true },
          { label: 'CCTV packages', href: siteLink('#cctv-packages') },
          { label: 'Wiring packages', href: siteLink('#wiring-packages') }
        ],
        chips: ['Book site visit', 'Talk to human']
      };
    }
    if (/(quote|quotation|order|buy|site visit|visit|inspection|survey|book|appointment)/.test(t)) return answerQuote();
    if (/(warranty|guarantee|service|repair|problem|fault|not working)/.test(t)) return answerWarranty();
    if (/(address|location|where|contact|phone|number|email|open|hour|time)/.test(t)) return answerContact();
    if (/(gate|motor|control panel|power control)/.test(t)) {
      return {
        text: 'We build and install automatic gate motors, security alarm systems, power control panels and motor starters. These are quoted after we check the gate, motor load and site wiring.',
        links: [
          { label: 'Request a survey', onClick: () => showLead('quote'), primary: true },
          { label: 'WhatsApp us', href: waLink('Hello Alpha Electronic, I need a gate / control panel quotation.') }
        ],
        chips: ['Wiring packages', 'Talk to human']
      };
    }

    return {
      text: 'I can help with solar packages, CCTV packages, house and industrial wiring, starting prices, site visits, invoices and service. Choose one below or type your question.',
      links: [
        { label: 'Solar packages', href: siteLink('#solar-grid') },
        { label: 'CCTV packages', href: siteLink('#cctv-packages') },
        { label: 'Wiring packages', href: siteLink('#wiring-packages') }
      ],
      chips: DEFAULT_CHIPS
    };
  }

  function answerPaymentOrInvoice(t) {
    if (/(portal|share|pdf|bill)/.test(t)) return answerInvoice();
    if (/(payment|advance|balance|bank|card|cash)/.test(t)) return answerPayment();
    return answerInvoice();
  }

  function send(text) {
    const value = String(text || '').trim();
    if (!value || state.busy) return;
    addMessage('user', value);
    input.value = '';
    const typing = addTyping();
    state.busy = true;
    const delay = reducedMotion ? 60 : 420;
    setTimeout(() => {
      typing.remove();
      const reply = answer(value);
      addMessage('bot', reply.text);
      addActions(reply.links);
      setChips(reply.chips);
      state.busy = false;
    }, delay);
  }

  /* ---------------- Bind ---------------- */
  launcher.addEventListener('click', () => (state.open ? closeChat() : openChat()));
  closeBtn.addEventListener('click', closeChat);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closeChat();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) closeChat();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
  });

  setChips(DEFAULT_CHIPS);

  window.AE_Chat = { open: openChat, close: closeChat, send: send };
})();
