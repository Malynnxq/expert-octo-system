(() => {
  "use strict";
  const tree = { title: window.ICG_ROOT_TITLE, children: window.ICG_BRANCHES };
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR_CAP = 2;
  const DEPTH_RATIO = 0.32;
  const nodes = [];
  const edges = [];

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0) / 4294967295;
  }

  function assignRuntimeIds(node, path = "root") {
    node.id = path;
    node.children = node.children || [];
    node.children.forEach((child, index) => assignRuntimeIds(child, `${path}/${index}`));
  }
  assignRuntimeIds(tree);

  function nodeWorldRadiusAtDepth(depth) {
    if (depth === 0) return 112;
    if (depth === 1) return 78;
    return 78 * Math.pow(DEPTH_RATIO, depth - 1);
  }

  function ringFor(depth, count) {
    if (depth === 0) return 620;
    const childRadius = nodeWorldRadiusAtDepth(depth + 1);
    const needed = count * childRadius * 2.8 / (Math.PI * 2);
    const base = depth === 1 ? 245
      : depth === 2 ? 132
      : depth === 3 ? 45
      : 15 * Math.pow(0.42, depth - 4);
    return Math.max(base, needed);
  }

  function place(node, depth, x, y, angleSeed = -Math.PI / 2) {
    node.depth = depth;
    node.x = x;
    node.y = y;
    node.phase = hash(node.id) * Math.PI * 2;
    nodes.push(node);
    const count = node.children.length;
    if (!count) return;

    const ring = ringFor(depth, count);
    const offset = angleSeed + (depth % 2 ? Math.PI / Math.max(7, count * 2) : 0);
    node.children.forEach((child, index) => {
      const angle = offset + index * Math.PI * 2 / count;
      child.x = x + Math.cos(angle) * ring;
      child.y = y + Math.sin(angle) * ring;
      edges.push({ a: node, b: child });
      place(child, depth + 1, child.x, child.y, angle + Math.PI * 0.37);
    });
  }
  place(tree, 0, 0, 0);

  const camera = { scale: 0.78, x: 0, y: 0, targetScale: 0.78, targetX: 0, targetY: 0 };
  let width = 1, height = 1, dpr = 1;
  let dragging = false, pointerId = null, lastX = 0, lastY = 0;
  let animationFrame = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scheduleDraw();
  }

  function worldToScreen(node, now) {
    const driftScale = Math.min(1, 1 / Math.max(camera.scale, 0.001));
    const amplitude = reduceMotion ? 0 : 0.8 * driftScale;
    return {
      x: width / 2 + (node.x + Math.cos(now * 0.00016 + node.phase) * amplitude - camera.x) * camera.scale,
      y: height / 2 + (node.y + Math.sin(now * 0.00014 + node.phase * 1.13) * amplitude - camera.y) * camera.scale
    };
  }

  function nodeWorldRadius(node) {
    return nodeWorldRadiusAtDepth(node.depth);
  }

  function smoothstep(a, b, value) {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function visibilityFor(projectedRadius) {
    const appear = smoothstep(5, 17, projectedRadius);
    const disappear = 1 - smoothstep(300, 900, projectedRadius);
    return Math.max(0, Math.min(1, appear * disappear));
  }

  function inExtendedView(point, radius = 0) {
    const margin = Math.min(1200, Math.max(180, radius * 1.4));
    return point.x + radius > -margin && point.x - radius < width + margin &&
           point.y + radius > -margin && point.y - radius < height + margin;
  }

  function wrapText(text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawNode({ node, point, radius, alpha }) {
    const r = Math.max(1, radius);
    const isRoot = node.depth === 0;
    const isChapter = node.depth === 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isRoot ? "#1d1d1f" : isChapter ? "rgba(240,248,255,0.98)" : "rgba(255,255,255,0.97)";
    ctx.fill();
    ctx.lineWidth = Math.max(0.65, Math.min(2.4, r * 0.03));
    ctx.strokeStyle = isRoot ? "#1d1d1f" : isChapter ? "rgba(0,113,227,0.42)" : "rgba(29,29,31,0.12)";
    ctx.stroke();

    if (r > 10) {
      const fontSize = Math.max(8, Math.min(isRoot ? 20 : 17, r * 0.235));
      ctx.fillStyle = isRoot ? "#ffffff" : "#1d1d1f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${isRoot || isChapter ? 700 : 640} ${fontSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
      const lines = wrapText(node.title, r * 1.58).slice(0, r > 65 ? 6 : 5);
      const lineHeight = fontSize * 1.07;
      const startY = point.y - (lines.length - 1) * lineHeight / 2;
      lines.forEach((line, index) => ctx.fillText(line, point.x, startY + index * lineHeight));
    }
    ctx.restore();
  }

  function draw() {
    animationFrame = 0;
    const now = performance.now();
    const easing = dragging ? 1 : 0.25;
    camera.scale += (camera.targetScale - camera.scale) * easing;
    camera.x += (camera.targetX - camera.x) * easing;
    camera.y += (camera.targetY - camera.y) * easing;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f5f5f7";
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.58);
    glow.addColorStop(0, "rgba(0,113,227,0.052)");
    glow.addColorStop(1, "rgba(0,113,227,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const screen = new Map();
    for (const node of nodes) screen.set(node, worldToScreen(node, now));

    ctx.lineCap = "round";
    for (const edge of edges) {
      const a = screen.get(edge.a), b = screen.get(edge.b);
      const radius = nodeWorldRadius(edge.b) * camera.scale;
      const alpha = visibilityFor(radius) * 0.17;
      if (alpha < 0.007 || (!inExtendedView(a) && !inExtendedView(b))) continue;
      ctx.strokeStyle = `rgba(29,29,31,${alpha})`;
      ctx.lineWidth = Math.max(0.55, Math.min(2.2, radius * 0.036));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const visible = [];
    for (const node of nodes) {
      const point = screen.get(node);
      const radius = nodeWorldRadius(node) * camera.scale;
      const alpha = visibilityFor(radius);
      if (alpha < 0.009 || !inExtendedView(point, radius)) continue;
      visible.push({ node, point, radius, alpha });
    }
    visible.sort((a, b) => a.radius - b.radius);
    visible.forEach(drawNode);

    const moving = Math.abs(camera.targetScale - camera.scale) > 0.0001 ||
      Math.abs(camera.targetX - camera.x) > 0.0001 ||
      Math.abs(camera.targetY - camera.y) > 0.0001;
    if (!reduceMotion || moving) scheduleDraw();
  }

  function scheduleDraw() {
    if (!animationFrame) animationFrame = requestAnimationFrame(draw);
  }

  function zoomAt(clientX, clientY, deltaY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left - width / 2;
    const py = clientY - rect.top - height / 2;
    const oldScale = camera.targetScale;
    const factor = Math.exp(-deltaY * 0.0034);
    const newScale = Math.max(0.025, Math.min(1e14, oldScale * factor));
    const worldX = camera.targetX + px / oldScale;
    const worldY = camera.targetY + py / oldScale;
    camera.targetScale = newScale;
    camera.targetX = worldX - px / newScale;
    camera.targetY = worldY - py / newScale;
    scheduleDraw();
  }

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY);
  }, { passive: false });

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.classList.add("dragging");
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    camera.targetX -= dx / camera.targetScale;
    camera.targetY -= dy / camera.targetScale;
    camera.x = camera.targetX;
    camera.y = camera.targetY;
    scheduleDraw();
  });

  function stopDrag(event) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerId = null;
    scheduleDraw();
  }
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  window.addEventListener("resize", resize);

  window.__ICG_MAP_STATS__ = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    maxDepth: Math.max(...nodes.map(node => node.depth)),
    chapters: {
      introduction: { sourcePages: 51, coveredPages: 51 },
      renderingPipeline: { sourcePages: 94, coveredPages: 94 }
    }
  };

  resize();
  scheduleDraw();
})();
