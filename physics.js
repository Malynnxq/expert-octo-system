(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const nodeState = new Map();
  const treeEdges = [];
  const crossEdgesState = [];
  let lastTime = performance.now();
  let running = true;

  const allLines = [...document.querySelectorAll('#mapSvg .edge')];
  let lineIndex = 0;

  for (const concept of concepts) {
    nodeState.set(concept.id, {
      x: concept.x,
      y: concept.y,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.28 + Math.random() * 0.18,
      radius: concept.parent === null ? 88 : 68
    });

    if (concept.parent) {
      treeEdges.push({
        line: allLines[lineIndex++],
        a: concept.parent,
        b: concept.id
      });
    }
  }

  for (const [a, b] of crossLinks) {
    crossEdgesState.push({
      line: allLines[lineIndex++],
      a,
      b
    });
  }

  function applySpring(a, b, restLength, strength) {
    const first = nodeState.get(a);
    const second = nodeState.get(b);
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const force = (distance - restLength) * strength;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;

    if (a !== 'graphics') {
      first.vx += fx;
      first.vy += fy;
    }
    if (b !== 'graphics') {
      second.vx -= fx;
      second.vy -= fy;
    }
  }

  function simulate(dt, time) {
    const entries = [...nodeState.entries()];

    for (let i = 0; i < entries.length; i++) {
      const [id, node] = entries[i];
      const concept = conceptById(id);

      if (id === 'graphics') {
        node.x = concept.x;
        node.y = concept.y;
        node.vx = 0;
        node.vy = 0;
        continue;
      }

      const anchorStrength = 0.0018;
      node.vx += (concept.x - node.x) * anchorStrength;
      node.vy += (concept.y - node.y) * anchorStrength;

      const drift = 0.0024;
      node.vx += Math.cos(time * 0.001 * node.speed + node.phase) * drift;
      node.vy += Math.sin(time * 0.001 * node.speed * 0.83 + node.phase) * drift;
    }

    for (const concept of concepts) {
      if (!concept.parent) continue;
      const child = nodeState.get(concept.id);
      const parent = nodeState.get(concept.parent);
      const rest = Math.hypot(concept.x - conceptById(concept.parent).x, concept.y - conceptById(concept.parent).y);
      applySpring(concept.parent, concept.id, rest, 0.00055);
    }

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [idA, a] = entries[i];
        const [idB, b] = entries[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const minimum = a.radius + b.radius + 30;
        if (distance >= minimum) continue;

        const force = (minimum - distance) * 0.0018;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        if (idA !== 'graphics') {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (idB !== 'graphics') {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    const damping = Math.pow(0.91, dt * 60);
    for (const [id, node] of entries) {
      if (id === 'graphics') continue;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx * dt * 60;
      node.y += node.vy * dt * 60;
    }
  }

  function renderPhysics() {
    for (const concept of concepts) {
      const node = nodeState.get(concept.id);
      const element = nodeElements.get(concept.id);
      if (element) element.setAttribute('transform', `translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`);
    }

    for (const edge of [...treeEdges, ...crossEdgesState]) {
      if (!edge.line) continue;
      const first = nodeState.get(edge.a);
      const second = nodeState.get(edge.b);
      edge.line.setAttribute('x1', first.x.toFixed(2));
      edge.line.setAttribute('y1', first.y.toFixed(2));
      edge.line.setAttribute('x2', second.x.toFixed(2));
      edge.line.setAttribute('y2', second.y.toFixed(2));
    }
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - lastTime) / 1000);
    lastTime = now;

    if (!state.dragging && document.visibilityState === 'visible') {
      simulate(dt, now);
      renderPhysics();
    }

    if (running) requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    lastTime = performance.now();
  });

  window.addEventListener('beforeunload', () => {
    running = false;
  });

  requestAnimationFrame(frame);
})();
