(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = null;
  let animateNextRender = true;
  const originalRenderMap = renderMap;
  const originalSelectConcept = selectConcept;

  renderMap = function smoothRenderMap() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      originalRenderMap();
      const root = document.querySelector('#mapSvg > g');
      if (root) {
        root.classList.add('map-root');
        if (!animateNextRender || state.dragging || reduceMotion) {
          root.classList.add('no-transition');
        }
      }
      animateNextRender = true;
    });
  };

  function focusOnConcept(id) {
    const concept = conceptById(id);
    if (!concept) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const compact = width < 700;
    const targetScale = concept.parent === null ? (compact ? .72 : .9) : (compact ? .82 : 1.05);
    state.scale = Math.min(1.35, Math.max(.62, targetScale));
    state.offsetX = -concept.x * state.scale;
    state.offsetY = -concept.y * state.scale + (compact ? 8 : 12);
  }

  selectConcept = function smoothSelectConcept(id) {
    if (state.selectedId === id) {
      originalSelectConcept(id);
      return;
    }
    focusOnConcept(id);
    animateNextRender = true;
    originalSelectConcept(id);

    modeContent.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: reduceMotion ? 1 : 430, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  };

  viewport.addEventListener('pointerdown', () => {
    animateNextRender = false;
    viewport.classList.add('is-dragging');
  });

  const finishDragging = () => {
    viewport.classList.remove('is-dragging');
    animateNextRender = true;
  };

  viewport.addEventListener('pointerup', finishDragging);
  viewport.addEventListener('pointercancel', finishDragging);
  viewport.addEventListener('pointerleave', () => {
    if (!state.dragging) finishDragging();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modeContent.animate(
        [
          { opacity: .25, transform: 'translateY(5px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: reduceMotion ? 1 : 340, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
    });
  });

  document.addEventListener('keydown', event => {
    if ((event.key === '+' || event.key === '=') && !event.metaKey && !event.ctrlKey) zoomBy(1.12);
    if (event.key === '-' && !event.metaKey && !event.ctrlKey) zoomBy(.89);
    if (event.key === '0' && !event.metaKey && !event.ctrlKey) {
      state.scale = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      animateNextRender = true;
      renderMap();
    }
  });

  focusOnConcept(state.selectedId || 'graphics');
  renderMap();
})();
