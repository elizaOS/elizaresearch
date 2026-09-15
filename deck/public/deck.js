(() => {
  'use strict';
  const slides = [...document.querySelectorAll('.slide')];
  const previous = document.querySelector('[data-deck-action="previous"]');
  const next = document.querySelector('[data-deck-action="next"]');
  const picker = document.querySelector('#slide-picker');
  const status = document.querySelector('#slide-status');
  const progress = document.querySelector('#progress');
  let index = 0;
  let touchStart = null;
  const interactive = target => target instanceof Element && !!target.closest('a, button, select, input, textarea, label, [contenteditable="true"]');
  const fromHash = () => {
    try { return slides.findIndex(slide => slide.id === decodeURIComponent(location.hash.slice(1))); }
    catch { return -1; }
  };
  function go(target, {syncHash = true} = {}) {
    const previousSlide = slides[index];
    const nextIndex = Math.max(0, Math.min(slides.length - 1, target));
    const changed = nextIndex !== index;
    const restoreFocus = previousSlide.contains(document.activeElement);
    index = nextIndex;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i + 1} of ${slides.length}: ${slide.dataset.title}`);
    });
    if (changed) slides[index].scrollTop = 0;
    if (restoreFocus) slides[index].focus({preventScroll: true});
    picker.value = String(index);
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    status.textContent = `${index + 1} / ${slides.length}: ${slides[index].dataset.title}`;
    progress.style.width = `${(index + 1) / slides.length * 100}%`;
    document.title = `${slides[index].dataset.title} — Eliza Research`;
    if (syncHash && location.hash !== `#${slides[index].id}`) history.replaceState(null, '', `#${slides[index].id}`);
  }
  previous.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  picker.addEventListener('change', () => go(Number(picker.value)));
  window.addEventListener('keydown', event => {
    const control = event.target instanceof Element && event.target.closest('.deck-control');
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || (interactive(event.target) && !control) || (control && (event.key === ' ' || event.key === 'Enter'))) return;
    const actions = {ArrowRight: index + 1, ArrowLeft: index - 1, PageDown: index + 1, PageUp: index - 1, ' ': index + 1, Home: 0, End: slides.length - 1};
    if (Object.hasOwn(actions, event.key)) { event.preventDefault(); go(actions[event.key]); }
  });
  const deck = document.querySelector('#deck');
  deck.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    touchStart = !interactive(event.target) && event.touches.length === 1 && touch ? {x: touch.clientX, y: touch.clientY} : null;
  }, {passive: true});
  deck.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    if (!touchStart || !touch) return;
    const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
  }, {passive: true});
  deck.addEventListener('touchcancel', () => { touchStart = null; }, {passive: true});
  deck.addEventListener('click', event => {
    // Touch taps remain available for reading and selecting text; swipes handle navigation.
    if (event.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches || interactive(event.target) || getSelection()?.toString()) return;
    if (event.clientX > innerWidth * .75) go(index + 1);
    else if (event.clientX < innerWidth * .15) go(index - 1);
  });
  window.addEventListener('hashchange', () => { const target = fromHash(); go(target >= 0 ? target : 0); });
  go(Math.max(0, fromHash()));
  document.body.dataset.deckReady = 'true';
})();
