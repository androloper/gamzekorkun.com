// Psikolojik destek sliderı: sürekli döngü, bir kartlık oklar ve durdurulabilir otomatik akış.
(() => {
  document.querySelectorAll('[data-services-carousel]').forEach(carousel => {
    if (carousel.dataset.carouselReady === 'true') return;
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = [...track.children].filter(slide => !slide.hasAttribute('data-carousel-clone'));
    const controls = carousel.querySelector('[data-carousel-controls]');
    const previous = controls?.querySelector('[data-carousel-prev]');
    const next = controls?.querySelector('[data-carousel-next]');
    const toggle = controls?.querySelector('[data-carousel-toggle]');
    const status = carousel.querySelector('[data-carousel-status]');
    if (slides.length < 2 || !previous || !next || !toggle) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const pauseIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
    const playIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg>';

    // Copies are visual only; the original links keep their accessible order.
    const copySlide = slide => {
      const copy = slide.cloneNode(true);
      copy.setAttribute('data-carousel-clone', '');
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      copy.querySelectorAll('a').forEach(link => {
        link.removeAttribute('aria-labelledby');
        link.setAttribute('aria-label', slide.querySelector('h3').textContent);
        link.tabIndex = -1;
      });
      return copy;
    };
    const leading = slides.map(copySlide), trailing = slides.map(copySlide);
    track.prepend(...leading);
    track.append(...trailing);
    carousel.dataset.carouselReady = 'true';
    previous.removeAttribute('aria-disabled');
    next.removeAttribute('aria-disabled');
    carousel.querySelector('[data-carousel-count]')?.remove();

    let step = 0, cycle = 0, base = 0, position = 0, lastWritten = 0;
    let frame = 0, lastTime = 0, animation = null;
    let hovering = false, keyboardFocus = false, touching = false;
    let inView = !('IntersectionObserver' in window);
    let autoEnabled = !reducedMotion.matches, userToggled = false;
    let cooldown = false, resumeTimer;
    const modulo = (value, size) => ((value % size) + size) % size;
    const currentIndex = () => step ? modulo(Math.round((position - base) / step), slides.length) : 0;
    const writePosition = value => {
      if (!cycle) return;
      position = base + modulo(value - base, cycle);
      lastWritten = position;
      track.scrollLeft = position;
      const index = String(currentIndex());
      if (carousel.dataset.carouselIndex !== index) carousel.dataset.carouselIndex = index;
    };
    const canFlow = () => autoEnabled && inView && !document.hidden && !hovering && !keyboardFocus && !touching && !cooldown;
    const updateState = () => {
      const state = !autoEnabled ? 'stopped' : canFlow() ? 'playing' : 'paused';
      if (carousel.dataset.carouselState !== state) carousel.dataset.carouselState = state;
    };
    const announce = () => {
      status.textContent = `${slides[currentIndex()].querySelector('h3').textContent}. ${slides.length} başlık arasında sürekli döngü.`;
    };
    const wake = () => {
      updateState();
      if ((animation || canFlow()) && !frame) frame = requestAnimationFrame(tick);
    };
    const holdAfterInteraction = () => {
      cooldown = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { cooldown = false; wake(); }, 1500);
    };
    function tick(time) {
      frame = 0;
      const elapsed = lastTime ? Math.min(50, time - lastTime) / 1000 : 0;
      lastTime = time;
      if (animation) {
        const fraction = Math.min(1, (time - animation.started) / animation.duration);
        const eased = 1 - Math.pow(1 - fraction, 3);
        const applied = animation.distance * eased;
        writePosition(position + applied - animation.applied);
        animation.applied = applied;
        if (fraction >= 1) { animation = null; announce(); }
      } else if (canFlow()) {
        // Fractional position avoids slow motion being rounded away by the browser.
        writePosition(position + elapsed * 24);
      }
      updateState();
      if (animation || canFlow()) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    }
    const refreshLayout = () => {
      const phase = step ? modulo((position - base) / step, slides.length) : 0;
      const first = slides[0].getBoundingClientRect();
      step = slides[1].getBoundingClientRect().left - first.left;
      base = first.left - leading[0].getBoundingClientRect().left;
      cycle = trailing[0].getBoundingClientRect().left - first.left;
      animation = null;
      writePosition(base + phase * step);
      wake();
    };
    const move = direction => {
      if (!step) return;
      holdAfterInteraction();
      const remainder = animation ? animation.distance - animation.applied : 0;
      const distance = remainder + direction * step;
      if (reducedMotion.matches) { animation = null; writePosition(position + distance); announce(); }
      else animation = { distance, applied: 0, started: performance.now(), duration: 450 };
      wake();
    };
    const updateToggle = () => {
      const label = autoEnabled ? 'Otomatik kaydırmayı durdur' : 'Otomatik kaydırmayı başlat';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      toggle.innerHTML = autoEnabled ? pauseIcon : playIcon;
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    toggle.addEventListener('click', () => {
      userToggled = true;
      autoEnabled = !autoEnabled;
      if (autoEnabled) keyboardFocus = false;
      updateToggle();
      status.textContent = autoEnabled ? 'Otomatik kaydırma açıldı.' : 'Otomatik kaydırma durduruldu.';
      wake();
    });
    carousel.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { hovering = true; wake(); }
    });
    carousel.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') { hovering = false; wake(); }
    });
    track.addEventListener('pointerdown', event => {
      animation = null;
      if (event.pointerType === 'touch' || event.pointerType === 'pen') touching = true;
      holdAfterInteraction();
      wake();
    });
    const releaseTouch = () => {
      if (!touching) return;
      touching = false;
      holdAfterInteraction();
      wake();
    };
    window.addEventListener('pointerup', releaseTouch, { passive: true });
    window.addEventListener('pointercancel', releaseTouch, { passive: true });
    track.addEventListener('wheel', () => { holdAfterInteraction(); wake(); }, { passive: true });
    track.addEventListener('scroll', () => {
      if (Math.abs(track.scrollLeft - lastWritten) > 1) {
        animation = null;
        holdAfterInteraction();
        writePosition(track.scrollLeft);
      }
      wake();
    }, { passive: true });
    carousel.addEventListener('focusin', event => {
      keyboardFocus = event.target.matches(':focus-visible');
      const slide = event.target.closest('.cp-service-slide');
      const index = slides.indexOf(slide);
      if (index >= 0) {
        const outer = track.getBoundingClientRect(), inner = slide.getBoundingClientRect();
        if (inner.left < outer.left || inner.right > outer.right) {
          animation = null;
          writePosition(base + index * step);
        }
      }
      wake();
    });
    carousel.addEventListener('focusout', () => {
      setTimeout(() => {
        keyboardFocus = carousel.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
        wake();
      }, 0);
    });
    track.addEventListener('keydown', event => {
      if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      keyboardFocus = true;
      if (event.key === 'Home' || event.key === 'End') {
        animation = null;
        writePosition(base + (event.key === 'End' ? slides.length - 1 : 0) * step);
        announce();
        wake();
      } else move(event.key === 'ArrowRight' ? 1 : -1);
    });
    document.addEventListener('visibilitychange', wake);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      wake();
    }, { threshold: 0.1 }).observe(carousel);
    reducedMotion.addEventListener('change', () => {
      if (!userToggled) autoEnabled = !reducedMotion.matches;
      updateToggle();
      wake();
    });
    controls.hidden = false;
    refreshLayout();
    updateToggle();
    if ('ResizeObserver' in window) new ResizeObserver(refreshLayout).observe(track);
    else window.addEventListener('resize', refreshLayout);
  });
})();
