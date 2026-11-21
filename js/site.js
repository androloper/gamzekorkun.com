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