(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  if (!submit || !status) return;

  const emailService = window.emailjs;
  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;

    submit.disabled = true;
    showStatus('Mesajınız gönderiliyor…', 'pending');
    try {
      await emailService.sendForm('service_bb98jq8', 'template_uwamon9', form, {
        publicKey: '6JXz-O9lJsbtA6ivO',
      });
      form.reset();
      showStatus('Mesajınız gönderildi. Teşekkür ederiz.', 'success');
    } catch (error) {
      const message = error?.status === 429
        ? 'Lütfen kısa bir süre bekleyip tekrar deneyin.'
        : 'Mesajınız gönderilemedi. Lütfen tekrar deneyin veya telefon ya da e-posta ile iletişime geçin.';
      showStatus(message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  if (typeof emailService?.sendForm !== 'function') {
    showStatus('Form şu anda kullanılamıyor. Telefon veya e-posta ile iletişime geçebilirsiniz.', 'error');
    return;
  }

  submit.disabled = false;
})();
