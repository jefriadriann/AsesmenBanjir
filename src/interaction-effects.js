import './interaction-effects.css';

export function mountInteractionEffects(root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  document.body.append(spotlight);

  // Cursor spotlight adapted for vanilla DOM from the 21st.dev ibelick Spotlight pattern.
  let frame = 0;
  let x, y;
  const hideSpotlight = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    spotlight.classList.remove('is-visible');
  };
  root.addEventListener('pointermove', event => {
    if (reduced.matches || event.pointerType !== 'mouse' || event.buttons) return;
    x = event.clientX;
    y = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      spotlight.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      spotlight.classList.add('is-visible');
    });
  }, {passive: true});
  root.addEventListener('pointerleave', hideSpotlight);
  root.addEventListener('pointerdown', hideSpotlight, {passive: true});
  window.addEventListener('blur', hideSpotlight);
  reduced.addEventListener('change', hideSpotlight);

  root.addEventListener('click', event => {
    if (reduced.matches || !event.isTrusted) return;
    const control = event.target.closest('button, a[href], summary, .monev-option label, .marker-container, .news-city-marker');
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
    // Clicking a label also dispatches a click to the input.
    if (event.target.matches('.monev-option input') && event.detail === 0 && document.activeElement !== event.target) return;
    const rect = control.getBoundingClientRect();
    const keyboard = event.detail === 0;
    const pulse = document.createElement('span');
    pulse.className = 'interaction-pulse';
    pulse.setAttribute('aria-hidden', 'true');
    pulse.style.left = (keyboard ? rect.left + rect.width / 2 : event.clientX) + 'px';
    pulse.style.top = (keyboard ? rect.top + rect.height / 2 : event.clientY) + 'px';
    document.body.append(pulse);
    pulse.addEventListener('animationend', () => pulse.remove(), {once: true});
    setTimeout(() => pulse.remove(), 600);
  }, {capture: true});
}
