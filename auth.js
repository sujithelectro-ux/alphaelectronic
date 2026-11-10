'use strict';

/* =========================================================
   Alpha Electronic — login / registration
   ========================================================= */
(function () {
  const UI = window.AE_UI;
  const Sec = window.AE_Sec;

  function init() {
    const { $, $$ } = UI;
    const alertEl = $('#authAlert');
    const formsWrap = $('#authForms');
    const sessionPanel = $('#authSession');
    const sessionEmail = $('#sessionEmail');
    const sessionRole = $('#sessionRole');

    let submitting = false;
    let currentUser = null;
    let currentAdmin = false;
    let loginAs = 'customer';

    const roleNote = $('#loginRoleNote');
    const signinSubmit = $('#signinSubmit');

    function showAlert(type, message) {
      if (!alertEl) return;
      alertEl.className = 'auth-alert show ' + type;
      alertEl.textContent = message;
    }
    function clearAlert() {
      if (!alertEl) return;
      alertEl.className = 'auth-alert';
      alertEl.textContent = '';
    }

    function setRole(role) {
      loginAs = role === 'admin' ? 'admin' : 'customer';
      $$('.login-role-btn').forEach((btn) => {
        const active = btn.dataset.role === loginAs;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (roleNote) {
        roleNote.textContent = loginAs === 'admin'
          ? 'For Alpha Electronic staff — opens the admin dashboard. Only administrator accounts can continue.'
          : 'View invoices assigned to you and send service requests.';
      }
      if (signinSubmit) signinSubmit.textContent = loginAs === 'admin' ? 'Sign in to admin panel' : 'Sign in';
    }

    function setTab(name) {
      $$('.auth-tab').forEach((tab) => {
        const active = tab.dataset.tab === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const signin = $('#signinForm');
      const register = $('#registerForm');
      const alt = $('#signinAlt');
      if (signin) signin.classList.toggle('active', name === 'signin');
      if (register) register.classList.toggle('active', name === 'register');
      if (alt) alt.hidden = name !== 'signin';
      if (name !== 'signin') resetPhone();
      if (name === 'register') setRole('customer');
      clearAlert();
    }

    function safeNext() {
      const next = Sec ? Sec.safeNext(UI.param('next'), '') : '';
      return next;
    }

    function go(admin, destAdmin) {
      if (destAdmin === undefined) destAdmin = admin;
      const next = safeNext();
      if (next) {
        if (!admin && /admin\.html/i.test(next)) {
          location.href = 'portal.html';
          return;
        }
        if (!admin && /invoice\.html/i.test(next)) {
          location.href = 'portal.html?denied=1';
          return;
        }
        location.href = next;
        return;
      }
      location.href = destAdmin ? 'admin.html' : 'portal.html';
    }

    async function finishSignIn(btn, message) {
      const admin = window.AE_Cloud.isAdmin();
      if (loginAs === 'admin' && !admin) {
        submitting = false;
        UI.setBusy(btn, false);
        showAlert('bad', 'This account is not an administrator. Sign in with the Alpha Electronic admin account or choose “Customer login”.');
        try { await window.AE_Cloud.signOut(); } catch (e) { /* ignore */ }
        showForms();
        return;
      }
      if (message) UI.toast(message);
      go(admin, loginAs === 'admin');
    }

    function showSession(state) {
      currentUser = state.user;
      currentAdmin = !!state.admin;
      if (!sessionPanel || !formsWrap) return;
      sessionPanel.classList.add('show');
      formsWrap.style.display = 'none';
      if (sessionEmail) sessionEmail.textContent = state.user.email || state.user.phoneNumber || state.user.displayName || 'Signed in';
      if (sessionRole) sessionRole.textContent = state.admin ? 'Administrator' : 'Customer';
      if (state.rulesError) {
        alertEl.className = 'auth-alert show info';
        alertEl.textContent = 'Database rules are not published yet. Sign-in works, but cloud saving and admin access need the setup guide.';
      } else {
        clearAlert();
      }
    }

    function showForms() {
      currentUser = null;
      currentAdmin = false;
      if (!sessionPanel || !formsWrap) return;
      sessionPanel.classList.remove('show');
      formsWrap.style.display = '';
    }

    /* Tabs */
    $$('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => setTab(tab.dataset.tab));
    });

    /* Customer / administrator role */
    $$('.login-role-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setRole(btn.dataset.role);
        clearAlert();
      });
    });
    if (/admin\.html/i.test(safeNext())) setRole('admin');

    /* Password visibility */
    $$('[data-pw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.pw);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
      });
    });

    /* Password strength meter */
    const regPassword = $('#regPassword');
    const pwMeter = $('#pwMeter');
    const pwBar = $('#pwBar');
    const pwLabel = $('#pwLabel');
    if (regPassword && pwMeter && Sec) {
      regPassword.addEventListener('input', () => {
        const check = Sec.checkPassword(regPassword.value);
        pwMeter.classList.add('show');
        pwMeter.dataset.score = String(check.score);
        if (pwBar) pwBar.style.width = ((check.score + 1) * 20) + '%';
        if (pwLabel) pwLabel.textContent = regPassword.value ? check.label + (check.ok ? '' : ' — ' + check.message) : 'Use at least 10 characters';
      });
    }

    /* Sign in */
    const signinForm = $('#signinForm');
    if (signinForm) {
      signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitting) return;
        const email = $('#signinEmail').value.trim();
        const password = $('#signinPassword').value;
        if (!email || !password) {
          showAlert('bad', 'Enter your email and password.');
          return;
        }
        const guard = Sec ? Sec.guardStatus() : { locked: false };
        if (guard.locked) {
          showAlert('bad', 'Too many failed attempts. Try again in ' + guard.seconds + ' seconds.');
          return;
        }
        const btn = $('#signinSubmit');
        submitting = true;
        clearAlert();
        UI.setBusy(btn, true, 'Signing in…');
        try {
          await window.AE_Cloud.signIn(email, password);
          await window.AE_Cloud.waitReady();
          if (Sec) Sec.clearFailures();
          await finishSignIn(btn, 'Welcome back');
        } catch (err) {
          const nextGuard = Sec ? Sec.recordFailure() : { locked: false };
          if (nextGuard.locked) {
            showAlert('bad', 'Too many failed attempts. Sign-in is locked for ' + nextGuard.seconds + ' seconds.');
          } else {
            showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
          }
          submitting = false;
          UI.setBusy(btn, false);
        }
      });
    }

    /* Register */
    const registerForm = $('#registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitting) return;
        const name = $('#regName').value.trim();
        const phone = $('#regPhone').value.trim();
        const email = $('#regEmail').value.trim();
        const password = $('#regPassword').value;
        const confirm = $('#regPassword2') ? $('#regPassword2').value : password;

        if (!name) { showAlert('bad', 'Please enter your name.'); return; }
        if (phone.replace(/\D/g, '').length < 6) { showAlert('bad', 'Please enter a valid phone number.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('bad', 'Please enter a valid email address.'); return; }
        if (Sec) {
          const check = Sec.checkPassword(password);
          if (!check.ok) { showAlert('bad', check.message); return; }
        } else if (password.length < 10) {
          showAlert('bad', 'Password must be at least 10 characters.');
          return;
        }
        if (password !== confirm) { showAlert('bad', 'The two passwords do not match.'); return; }

        const btn = $('#registerSubmit');
        submitting = true;
        clearAlert();
        UI.setBusy(btn, true, 'Creating account…');
        try {
          const result = await window.AE_Cloud.signUp({ name: name, email: email, phone: phone, password: password });
          await window.AE_Cloud.waitReady();
          if (result.profileError) {
            showAlert('info', result.profileError);
            setTimeout(() => go(window.AE_Cloud.isAdmin()), 900);
          } else {
            UI.toast('Account created');
            go(window.AE_Cloud.isAdmin());
          }
        } catch (err) {
          showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
          submitting = false;
          UI.setBusy(btn, false);
        }
      });
    }

    /* Google + phone sign-in */
    const googleBtn = $('#btnGoogle');
    const phoneBtn = $('#btnPhone');
    const phonePanel = $('#phonePanel');
    const phoneStep1 = $('#phoneStep1');
    const phoneStep2 = $('#phoneStep2');
    const phoneCodeInput = $('#phoneCode');
    const sendCodeBtn = $('#btnSendCode');
    const verifyBtn = $('#btnVerifyCode');
    const resendBtn = $('#btnResendCode');
    const phoneBackBtn = $('#btnPhoneBack');
    let phoneTimer = null;
    let phoneCooldown = 0;
    let pendingPhone = '';

    function stopCooldown() {
      if (phoneTimer) { clearInterval(phoneTimer); phoneTimer = null; }
      phoneCooldown = 0;
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend code';
      }
    }

    function startCooldown(seconds) {
      if (!resendBtn) return;
      phoneCooldown = seconds;
      resendBtn.disabled = true;
      const tick = () => {
        if (phoneCooldown <= 0) {
          stopCooldown();
          return;
        }
        resendBtn.textContent = 'Resend in ' + phoneCooldown + 's';
        phoneCooldown--;
      };
      if (phoneTimer) clearInterval(phoneTimer);
      tick();
      phoneTimer = setInterval(tick, 1000);
    }

    function backToNumber() {
      if (window.AE_Cloud && window.AE_Cloud.cancelPhoneSignIn) window.AE_Cloud.cancelPhoneSignIn();
      stopCooldown();
      pendingPhone = '';
      if (phoneStep1) phoneStep1.hidden = false;
      if (phoneStep2) phoneStep2.hidden = true;
      if (phoneCodeInput) phoneCodeInput.value = '';
      clearAlert();
    }

    function resetPhone() {
      backToNumber();
      if (phonePanel) phonePanel.hidden = true;
      if (phoneBtn) phoneBtn.setAttribute('aria-expanded', 'false');
    }

    function phoneE164() {
      const ccEl = $('#phoneCC');
      const numberEl = $('#phoneNumber');
      if (!numberEl) return '';
      let digits = numberEl.value.replace(/\D/g, '');
      if (digits.charAt(0) === '0') digits = digits.slice(1);
      if (digits.length < 6 || digits.length > 14) return '';
      const full = (ccEl ? ccEl.value : '+94') + digits;
      return full.replace(/\D/g, '').length > 15 ? '' : full;
    }

    async function sendPhoneCode(isResend) {
      const btn = isResend ? resendBtn : sendCodeBtn;
      if (!btn || submitting) return;
      const number = phoneE164();
      if (!number) {
        showAlert('bad', 'Enter a valid phone number including the country code.');
        return;
      }
      clearAlert();
      UI.setBusy(btn, true, 'Sending…');
      try {
        await window.AE_Cloud.startPhoneSignIn(number, 'recaptchaContainer');
      } catch (err) {
        UI.setBusy(btn, false);
        showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
        return;
      }
      UI.setBusy(btn, false);
      pendingPhone = number;
      const sentTo = $('#phoneSentTo');
      if (sentTo) sentTo.textContent = 'Enter the 6-digit code sent by SMS to ' + number + '.';
      if (phoneStep1) phoneStep1.hidden = true;
      if (phoneStep2) phoneStep2.hidden = false;
      if (phoneCodeInput) {
        phoneCodeInput.value = '';
        setTimeout(() => phoneCodeInput.focus(), 0);
      }
      startCooldown(45);
      UI.toast('SMS code sent');
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        if (submitting) return;
        submitting = true;
        clearAlert();
        UI.setBusy(googleBtn, true, 'Opening Google…');
        try {
          const result = await window.AE_Cloud.signInWithGoogle();
          if (result && result.redirecting) {
            showAlert('info', 'Taking you to Google to finish signing in…');
            return;
          }
          await window.AE_Cloud.waitReady();
          if (result.profileError) {
            showAlert('info', result.profileError);
            setTimeout(() => { finishSignIn(googleBtn, ''); }, 900);
          } else {
            await finishSignIn(googleBtn, 'Signed in with Google');
          }
        } catch (err) {
          showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
          submitting = false;
          UI.setBusy(googleBtn, false);
        }
      });
    }

    if (phoneBtn) {
      phoneBtn.addEventListener('click', () => {
        if (!phonePanel) return;
        const open = phonePanel.hidden;
        phonePanel.hidden = !open;
        phoneBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          clearAlert();
          const input = $('#phoneNumber');
          if (input) setTimeout(() => input.focus(), 0);
        } else {
          resetPhone();
        }
      });
    }

    if (sendCodeBtn) sendCodeBtn.addEventListener('click', () => sendPhoneCode(false));
    if (resendBtn) resendBtn.addEventListener('click', () => {
      if (resendBtn.disabled) return;
      sendPhoneCode(true);
    });
    if (phoneBackBtn) phoneBackBtn.addEventListener('click', backToNumber);

    if (phoneCodeInput) {
      phoneCodeInput.addEventListener('input', () => {
        phoneCodeInput.value = phoneCodeInput.value.replace(/\D/g, '').slice(0, 6);
      });
      phoneCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (verifyBtn) verifyBtn.click();
        }
      });
    }

    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        if (submitting) return;
        const code = (phoneCodeInput ? phoneCodeInput.value : '').replace(/\D/g, '');
        if (code.length !== 6) {
          showAlert('bad', 'Enter the 6-digit code from the SMS.');
          return;
        }
        submitting = true;
        clearAlert();
        UI.setBusy(verifyBtn, true, 'Verifying…');
        try {
          const result = await window.AE_Cloud.confirmPhoneCode(code);
          await window.AE_Cloud.waitReady();
          if (result.profileError) {
            showAlert('info', result.profileError);
            setTimeout(() => { finishSignIn(verifyBtn, ''); }, 900);
          } else {
            await finishSignIn(verifyBtn, 'Signed in');
          }
        } catch (err) {
          showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
          submitting = false;
          UI.setBusy(verifyBtn, false);
        }
      });
    }

    /* Forgot password */
    const forgotBtn = $('#btnForgot');
    const resetRow = $('#resetRow');
    if (forgotBtn && resetRow) {
      forgotBtn.addEventListener('click', () => {
        const isHidden = resetRow.hidden;
        resetRow.hidden = !isHidden;
        if (isHidden) {
          $('#resetEmail').value = $('#signinEmail').value.trim();
          $('#resetEmail').focus();
        }
      });
    }
    const sendReset = $('#btnSendReset');
    if (sendReset) {
      sendReset.addEventListener('click', async () => {
        const email = $('#resetEmail').value.trim();
        if (!email) { showAlert('bad', 'Enter your email address first.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('bad', 'Please enter a valid email address.'); return; }
        const gate = Sec ? Sec.resetStatus() : { allowed: true };
        if (!gate.allowed) {
          showAlert('bad', 'Please wait ' + gate.seconds + ' seconds before requesting another reset email.');
          return;
        }
        if (Sec) Sec.markReset();
        UI.setBusy(sendReset, true, 'Sending…');
        try {
          await window.AE_Cloud.resetPassword(email);
        } catch (err) {
          const code = String((err && (err.code || err.message)) || '').toLowerCase();
          if (code.includes('network') || code.includes('operation-not-allowed') || code.includes('too-many-requests')) {
            showAlert('bad', window.AE_Cloud.friendlyAuthError(err));
            UI.setBusy(sendReset, false);
            return;
          }
          /* Do not reveal whether the email address is registered. */
        }
        showAlert('ok', 'If an account exists for ' + email + ', a reset link has been sent. Check your inbox and spam folder.');
        UI.setBusy(sendReset, false);
      });
    }

    /* Session actions */
    const continueBtn = $('#btnContinue');
    if (continueBtn) continueBtn.addEventListener('click', () => go(currentAdmin));

    const switchBtn = $('#btnSwitch');
    if (switchBtn) {
      switchBtn.addEventListener('click', async () => {
        UI.setBusy(switchBtn, true, 'Signing out…');
        try { await window.AE_Cloud.signOut(); } catch (e) { /* ignore */ }
        UI.setBusy(switchBtn, false);
        showForms();
        UI.toast('Signed out');
      });
    }

    /* Cloud state */
    if (!window.AE_Cloud) {
      showAlert('bad', 'Online sign-in is unavailable. Check your internet connection and reload the page.');
      return;
    }

    window.AE_Cloud.onAuth((state) => {
      currentUser = state.user;
      currentAdmin = !!state.admin;
      if (!state.user) {
        const redirectMessage = window.AE_Cloud.takeRedirectError ? window.AE_Cloud.takeRedirectError() : '';
        if (!submitting) showForms();
        if (redirectMessage) showAlert('bad', redirectMessage);
        return;
      }
      if (!submitting) showSession(state);
    });

    window.AE_Cloud.waitReady().then(() => {
      const user = window.AE_Cloud.currentUser();
      if (user) {
        showSession({
          user: user,
          admin: window.AE_Cloud.isAdmin(),
          rulesError: false
        });
      } else {
        showForms();
        if (UI.param('timeout')) {
          showAlert('info', 'You were signed out after 30 minutes of inactivity. Sign in again to continue.');
        }
      }
      if (UI.param('mode') === 'register') setTab('register');
      if (!window.AE_Cloud.init()) {
        showAlert('bad', 'Could not connect to Firebase. Check your internet connection.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
