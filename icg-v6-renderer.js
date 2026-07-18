(() => {
    "use strict";
    const tree = { title: window.ICG_ROOT_TITLE, children: window.ICG_BRANCHES };
    const canvas = document.getElementById("map");
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR_CAP = 2;
    const DEPTH_RATIO = 0.215;
    const ROOT_RING = 455;
    const CHILD_RING = 150;
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
      node.children.forEach((child, index) => assignRuntimeIds(child, `${path}/${index}`));
    }
    assignRuntimeIds(tree);

    function nodeWorldRadius(node) {
      if (node.depth === 0) return 104;
      if (node.depth === 1) return 70;
      return 70 * Math.pow(DEPTH_RATIO, node.depth - 1);
    }

    function place(node, depth, x, y, angleSeed = -Math.PI / 2) {
      node.depth = depth;
      node.x = x;
      node.y = y;
      node.phase = hash(node.id) * Math.PI * 2;
      nodes.push(node);
      const count = node.children.length;
      if (!count) return;

      const ring = depth === 0 ? ROOT_RING : CHILD_RING * Math.pow(DEPTH_RATIO, depth - 1);
      const offset = angleSeed + (depth % 2 ? Math.PI / Math.max(8, count * 2.2) : 0);
      node.children.forEach((child, index) => {
        const angle = offset + index * Math.PI * 2 / count;
        const radialJitter = count > 10 ? 1 + ((index % 2) * 0.12) : 1;
        child.x = x + Math.cos(angle) * ring * radialJitter;
        child.y = y + Math.sin(angle) * ring * radialJitter;
        edges.push({ a: node, b: child });
        place(child, depth + 1, child.x, child.y, angle + Math.PI * 0.37);
      });
    }
    place(tree, 0, 0, 0);

    const camera = { scale: 1, x: 0, y: 0, targetScale: 1, targetX: 0, targetY: 0 };
    let width = 1, height = 1, dpr = 1;
    let dragging = false, pointerId = null, lastX = 0, lastY = 0, animationFrame = 0;

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
      const screenDrift = reduceMotion ? 0 : 0.75;
      const driftWorld = screenDrift / Math.max(camera.scale, 0.000001);
      return {
        x: width / 2 + (node.x + Math.cos(now * 0.0002 + node.phase) * driftWorld - camera.x) * camera.scale,
        y: height / 2 + (node.y + Math.sin(now * 0.00017 + node.phase * 1.17) * driftWorld - camera.y) * camera.scale
      };
    }

    function smoothstep(a, b, value) {
      const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    function visibilityFor(projectedRadius) {
      const appear = smoothstep(5.5, 21, projectedRadius);
      const disappear = 1 - smoothstep(300, 820, projectedRadius);
      return Math.max(0, Math.min(1, appear * disappear));
    }

    function inExtendedView(point, radius = 0) {
      const margin = Math.min(1200, Math.max(220, radius * 1.6));
      return point.x + radius > -margin && point.x - radius < width + margin && point.y + radius > -margin && point.y - radius < height + margin;
    }

    function wrapText(text, maxWidth, maxLines) {
      const tokens = text.split(/\s+/);
      const lines = [];
      let line = "";
      for (const token of tokens) {
        const next = line ? `${line} ${token}` : token;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = token;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      if (lines.length <= maxLines) return lines;
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[.,;:]?$/, "") + "…";
      return clipped;
    }

    function fitText(node, radius) {
      const maxLines = radius > 70 ? 5 : radius > 38 ? 4 : 3;
      let fontSize = Math.max(7.5, Math.min(19, radius * 0.235));
      let lines = [];
      while (fontSize >= 7.5) {
        ctx.font = `650 ${fontSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
        lines = wrapText(node.title, radius * 1.58, maxLines);
        const tooWide = lines.some(line => ctx.measureText(line).width > radius * 1.62);
        if (!tooWide && lines.length <= maxLines) break;
        fontSize -= 0.75;
      }
      return { fontSize, lines };
    }

    function drawNode({ node, point, radius, alpha }) {
      const r = Math.max(1, radius);
      const isRoot = node.depth === 0;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isRoot ? "#1d1d1f" : "rgba(255,255,255,0.975)";
      ctx.fill();
      ctx.lineWidth = Math.max(0.75, Math.min(2.3, r * 0.028));
      ctx.strokeStyle = isRoot ? "#1d1d1f" : "rgba(29,29,31,0.13)";
      ctx.stroke();

      if (r > 11.5) {
        const { fontSize, lines } = fitText(node, r);
        ctx.fillStyle = isRoot ? "#ffffff" : "#1d1d1f";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `650 ${fontSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
        const lineHeight = fontSize * 1.08;
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
      glow.addColorStop(0, "rgba(0,113,227,0.05)");
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
        if (alpha < 0.006 || (!inExtendedView(a) && !inExtendedView(b))) continue;
        ctx.strokeStyle = `rgba(29,29,31,${alpha})`;
        ctx.lineWidth = Math.max(0.55, Math.min(2.1, radius * 0.035));
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
        if (alpha < 0.008 || !inExtendedView(point, radius)) continue;
        visible.push({ node, point, radius, alpha });
      }
      visible.sort((a, b) => a.radius - b.radius);
      visible.forEach(drawNode);

      if (!dragging && (!reduceMotion || Math.abs(camera.targetScale - camera.scale) > 0.000001 || Math.abs(camera.targetX - camera.x) > 0.0001 || Math.abs(camera.targetY - camera.y) > 0.0001)) scheduleDraw();
    }

    function scheduleDraw() {
      if (!animationFrame) animationFrame = requestAnimationFrame(draw);
    }

    function zoomAt(clientX, clientY, deltaY) {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left - width / 2;
      const py = clientY - rect.top - height / 2;
      const oldScale = camera.targetScale;
      const factor = Math.exp(-deltaY * 0.0036);
      const newScale = Math.max(0.12, Math.min(1e15, oldScale * factor));
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
      canvas.setPointerCapture(pointerId);
      scheduleDraw();
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
      sourcePages: 51,
      coveredPages: Array.from({length: 51}, (_, index) => index + 1)
    };

    resize();
    scheduleDraw();
  })();
