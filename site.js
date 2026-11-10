'use strict';

/* =========================================================
   Alpha Electronic — public website behaviour
   ========================================================= */
(function () {
  const UI = window.AE_UI;

  function init() {
    const { $, $$, toast } = UI;

    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* Header + nav */
    const header = $('#siteHeader');
    const navToggle = $('#navToggle');
    const nav = $('#siteNav');

    const onScroll = () => {
      if (header) header.classList.toggle('scrolled', window.scrollY > 12);
      const top = $('#toTop');
      if (top) top.classList.toggle('show', window.scrollY > 640);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (navToggle && nav && header) {
      navToggle.addEventListener('click', () => {
        const open = header.classList.toggle('nav-open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          header.classList.remove('nav-open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) header.classList.remove('nav-open');
      });
    }

    const toTop = $('#toTop');
    if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    /* Package category tabs */
    const pkgTabs = $$('.pkg-tabs a');
    const pkgIds = pkgTabs.map((tab) => (tab.getAttribute('href') || '').replace('#', ''));
    const syncPkgTab = () => {
      const id = location.hash.replace('#', '');
      if (!pkgIds.includes(id)) return;
      pkgTabs.forEach((tab) => {
        tab.classList.toggle('active', (tab.getAttribute('href') || '') === '#' + id);
      });
    };
    pkgTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        pkgTabs.forEach((other) => other.classList.toggle('active', other === tab));
      });
    });
    window.addEventListener('hashchange', syncPkgTab);
    syncPkgTab();

    /* Reveal on scroll */
    const revealEls = $$('[data-reveal]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    }

    /* Gallery lightbox */
    const lightbox = $('#lightbox');
    const lightboxImg = $('#lightboxImg');
    if (lightbox && lightboxImg) {
      const closeLb = () => {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
      };
      $$('.gallery-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          lightboxImg.src = btn.dataset.full;
          lightbox.classList.add('open');
          lightbox.setAttribute('aria-hidden', 'false');
        });
      });
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.closest('[data-close-lightbox]')) closeLb();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLb();
      });
    }

    /* Quote modal */
    const quoteModal = $('#quoteModal');
    const quoteForm = $('#quoteForm');
    const quoteBadge = $('#quotePackageBadge');

    const setQuoteService = (service) => {
      const select = $('#qService');
      if (!select || !service) return;
      const wanted = service.replace(/&amp;/g, '&').toLowerCase();
      const match = Array.from(select.options).find((o) => o.textContent.trim().toLowerCase() === wanted);
      select.value = match ? match.value : select.options[select.options.length - 1].value;
    };

    let quoteTrigger = null;
    const openQuote = (service, pkg, trigger) => {
      if (!quoteModal) return;
      quoteTrigger = trigger || null;
      setQuoteService(service);
      if (quoteForm) quoteForm.dataset.package = pkg || '';
      if (quoteBadge) {
        if (pkg) {
          quoteBadge.hidden = false;
          quoteBadge.textContent = pkg;
        } else {
          quoteBadge.hidden = true;
          quoteBadge.textContent = '';
        }
      }
      quoteModal.classList.add('open');
      quoteModal.setAttribute('aria-hidden', 'false');
      const name = $('#qName');
      if (name) setTimeout(() => name.focus(), 60);
    };

    const closeQuote = () => {
      if (!quoteModal) return;
      quoteModal.classList.remove('open');
      if (quoteModal.contains(document.activeElement)) {
        if (quoteTrigger && document.contains(quoteTrigger)) quoteTrigger.focus();
        else document.activeElement.blur();
      }
      quoteModal.setAttribute('aria-hidden', 'true');
    };

    $$('[data-quote]').forEach((btn) => {
      btn.addEventListener('click', () => openQuote(btn.dataset.service, btn.dataset.package, btn));
    });

    if (quoteModal) {
      quoteModal.addEventListener('click', (e) => {
        if (e.target === quoteModal || e.target.closest('[data-close-modal]')) closeQuote();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeQuote();
      });
    }

    /* Forms */
    async function sendForm(form, statusEl, type, packageName) {
      const formData = new FormData(form);
      if (String(formData.get('company') || '').trim()) return;

      const name = String(formData.get('name') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      const message = String(formData.get('message') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const service = String(formData.get('service') || '').trim();
      const submit = form.querySelector('[type="submit"]');

      UI.clearFormStatus(statusEl);
      if (!name || !phone || !message) {
        UI.setFormStatus(statusEl, 'bad', 'Please fill in your name, phone and message.');
        return;
      }
      if (phone.replace(/\D/g, '').length < 6) {
        UI.setFormStatus(statusEl, 'bad', 'Please enter a valid phone number.');
        return;
      }
      if (!window.AE_Cloud) {
        UI.setFormStatus(statusEl, 'bad', 'The form could not connect. Please call or WhatsApp 077 328 3588.');
        return;
      }

      UI.setBusy(submit, true, 'Sending…');
      try {
        await window.AE_Cloud.submitServiceRequest({
          name: name,
          phone: phone,
          email: email,
          message: message,
          type: type,
          package: packageName || '',
          source: 'website'
        });
        form.reset();
        if (quoteForm) quoteForm.dataset.package = '';
        if (quoteBadge) quoteBadge.hidden = true;
        UI.setFormStatus(statusEl, 'ok', 'Thank you — your request has been sent. We will contact you soon.');
        toast('Request sent — we will be in touch');
        if (quoteModal && form === quoteForm) setTimeout(closeQuote, 2400);
      } catch (err) {
        console.error(err);
        const msg = String(err && err.message ? err.message : '');
        UI.setFormStatus(statusEl, 'bad', /rules|permission/i.test(msg)
          ? 'Messaging is not set up yet. Please call or WhatsApp 077 328 3588.'
          : 'Could not send right now. Please call or WhatsApp 077 328 3588.');
      } finally {
        UI.setBusy(submit, false);
      }
    }

    const contactForm = $('#contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendForm(contactForm, $('#contactStatus'), 'quote');
      });
    }

    if (quoteForm) {
      quoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendForm(quoteForm, $('#quoteStatus'), 'order', quoteForm.dataset.package || '');
      });
    }

    /* Login state in the header */
    if (window.AE_Cloud) {
      window.AE_Cloud.onAuth((state) => {
        $$('.js-login-link').forEach((link) => {
          if (state.user) {
            link.textContent = state.admin ? 'Admin panel' : 'My account';
            link.href = state.admin ? 'admin.html' : 'portal.html';
          } else {
            link.textContent = 'Login';
            link.href = 'login.html';
          }
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
