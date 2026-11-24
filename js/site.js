// The site uses a single-level menu; no general-purpose theme runtime is needed.
(() => {
  const header = document.querySelector('#header');
  const wrap = header?.querySelector('#header-wrap');
  const trigger = header?.querySelector('.primary-menu-trigger');
  const button = trigger?.querySelector('button');
  const nav = header?.querySelector('.primary-menu');
  const menu = nav?.querySelector('.menu-container');
  if (!header || !wrap || !button || !nav || !menu) return;
  const body = document.body;
  const desktop = matchMedia(`(min-width: ${Number(body.dataset.menuBreakpoint) || 1200}px)`);
  const darkAtTop = header.classList.contains('dark') && !header.classList.contains('not-dark');
  const included = document.querySelector('.include-header');
  let open = false;
  let scheduled = false;

  const setOpen = value => {
    open = value && !desktop.matches;
    trigger.classList.toggle('primary-menu-trigger-active', open);
    nav.classList.toggle('primary-menu-active', open);
    menu.classList.toggle('d-block', open);
    body.classList.toggle('primary-menu-open', open);
    body.classList.toggle('primary-menu-open-all', open);
    button.setAttribute('aria-expanded', String(open));
    const label = open ? 'Menüyü kapat' : 'Menüyü aç';
    button.setAttribute('aria-label', label);
    button.title = label;
    // Keep closed mobile links out of keyboard navigation and the accessibility tree.
    nav.inert = !desktop.matches && !open;
  };
  nav.id = 'primary-navigation';
  button.setAttribute('aria-controls', nav.id);
  wrap.dataset.bsTheme = 'light';

  const updateHeader = () => {
    scheduled = false;
    const sticky = desktop.matches && scrollY > header.offsetTop;
    header.classList.toggle('sticky-header', sticky);
    header.classList.toggle('sticky-header-shrink', sticky && scrollY - header.offsetTop > 300);
    header.classList.toggle('dark', darkAtTop && desktop.matches && !sticky);
    wrap.classList.toggle('not-dark', !desktop.matches || sticky);
  };
  const layout = () => {
    body.classList.toggle('is-expanded-menu', desktop.matches);
    setOpen(false);
    updateHeader();
    // Match the existing transparent desktop header without changing mobile flow.
    if (included) included.style.marginTop = desktop.matches ? `${-header.offsetHeight}px` : '';
  };
  button.addEventListener('click', () => setOpen(!open));
  nav.addEventListener('click', event => {
    if (event.target.closest('a') && open) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (open && !event.target.closest('.primary-menu, .primary-menu-trigger')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { setOpen(false); button.focus(); }
  });
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateHeader); }
  }, {passive:true});
  desktop.addEventListener('change', layout);
  layout();
})();
