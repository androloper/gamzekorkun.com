(() => {
  const trigger = document.querySelector('.primary-menu-trigger');
  const button = trigger?.querySelector('button');
  const nav = document.querySelector('#header .primary-menu');
  if (!button || !nav) return;
  nav.id = 'primary-navigation';
  button.setAttribute('aria-controls', nav.id);
  const isOpen = () => trigger.classList.contains('primary-menu-trigger-active');
  const sync = () => {
    button.setAttribute('aria-expanded', String(isOpen()));
    button.setAttribute('aria-label', isOpen() ? 'Menüyü kapat' : 'Menüyü aç');
    button.title = isOpen() ? 'Menüyü kapat' : 'Menüyü aç';
  };
  new MutationObserver(sync).observe(trigger, { attributes: true, attributeFilter: ['class'] });
  sync();
  nav.addEventListener('click', event => {
    if (event.target.closest('a') && isOpen() && !document.body.classList.contains('is-expanded-menu')) {
      button.click();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) {
      button.click();
      button.focus();
    }
  });
})();

(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const endpoint = form.getAttribute('action');
  const tokenInput = form.querySelector('[name="csrf_token"]');
  let tokenPromise;
  let sending = false;
  const localPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const formError = (code, userMessage) => Object.assign(new Error(code), { code, userMessage });
  const unknownResult = 'Gönderim sonucu doğrulanamadı. Tekrar göndermeden önce biraz bekleyin; telefon/e-posta ile de iletişime geçebilirsiniz.';
  const failureMessage = (error, postStarted) => {
    if (typeof error.userMessage === 'string' && error.userMessage) return error.userMessage;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return postStarted ? unknownResult : 'Form gönderim hizmetine zamanında ulaşılamadı. Lütfen biraz sonra tekrar deneyin.';
    }
    if (localPreview && (error.code === 'local-preview' || (!postStarted && (error.code === 'invalid-response' || error.name === 'TypeError')))) {
      return 'Bu yerel önizlemede formun PHP servisi çalışmıyor. Live Server e-posta gönderimini desteklemez; sayfayı PHP destekli bir sunucudan açın.';
    }
    if (postStarted) return unknownResult;
    return 'Form gönderim hizmetine ulaşılamadı. Lütfen daha sonra tekrar deneyin veya telefon/e-posta ile iletişime geçin.';
  };

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const readResponse = async response => {
    const type = (response.headers.get('Content-Type') || '').toLowerCase();
    if (!type.includes('application/json')) throw formError('invalid-response');
    let data;
    try { data = await response.json(); }
    catch { throw formError('invalid-response'); }
    if (!data || typeof data.ok !== 'boolean') throw formError('invalid-response');
    return data;
  };
  const getToken = () => {
    if (location.protocol === 'file:') return Promise.reject(formError('local-preview'));
    if (!tokenPromise) {
      tokenPromise = (async () => {
        const response = await fetch(endpoint, {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000)
        });
        const data = await readResponse(response);
        if (!response.ok || !data.ok) throw formError('token-unavailable', data.message);
        if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/i.test(data.token)) throw formError('invalid-response');
        tokenInput.value = data.token;
        return data.token;
      })().catch(error => { tokenPromise = undefined; throw error; });
    }
    return tokenPromise;
  };
  // Fetch on first interaction, not for every page view or crawler visit.
  form.addEventListener('focusin', () => { getToken().catch(() => {}); }, { once: true });
  form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true;
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = 'GÖNDERİLİYOR…';
    form.setAttribute('aria-busy', 'true');
    showStatus('Mesajınız gönderiliyor…', 'pending');
    let postStarted = false;
    try {
      await getToken();
      postStarted = true;
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json' }, body: new FormData(form),
        signal: AbortSignal.timeout(25000)
      });
      const data = await readResponse(response);
      if (response.ok && data.ok) {
        form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
        form.reset();
        tokenInput.value = '';
        tokenPromise = undefined;
        showStatus(data.message || 'Mesajınız e-posta sunucusuna iletildi. Teşekkür ederiz.', 'success');
      } else {
        if (response.status === 403) { tokenInput.value = ''; tokenPromise = undefined; }
        showStatus(data.message || 'Mesajınız gönderilemedi. Lütfen tekrar deneyin.', 'error');
        const field = ['ad-soyad', 'telefon', 'mesaj'].includes(data.field) ? form.elements.namedItem(data.field) : null;
        if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
      }
    } catch (error) {
      showStatus(failureMessage(error, postStarted), 'error');
    } finally {
      sending = false;
      button.disabled = false;
      button.innerHTML = originalLabel;
      form.removeAttribute('aria-busy');
    }
  });
})();
