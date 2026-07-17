(() => {
  const map = document.getElementById('mapSvg');
  if (!map) return;

  map.setAttribute('viewBox', '-650 -550 1300 1100');
  map.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  if (typeof mapRoot !== 'undefined' && mapRoot) {
    mapRoot.removeAttribute('transform');
  }

  updateMapTransform = function updateCompositedMapTransform() {
    const x = state.offsetX;
    const y = state.offsetY;
    map.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${state.scale})`;
  };

  updateMapTransform();
})();
