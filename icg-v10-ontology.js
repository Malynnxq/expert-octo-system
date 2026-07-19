(() => {
  "use strict";

  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const DPR_CAP = 2;
  const TWO_PI = Math.PI * 2;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DOMAINS = [
    { id: "foundations", title: "Mathematical Foundations", keys: ["vector", "matrix", "inverse", "identity", "orthogonal", "cross product", "normaliz", "coordinate", "basis", "real number", "column vector", "homogeneous"] },
    { id: "geometry", title: "Geometry & Models", keys: ["geometry", "model", "mesh", "vertex", "vertices", "polygon", "primitive", "triangle", "line", "point cloud", "surface", "quadric", "volume", "topology", "normal", "attribute"] },
    { id: "transformations", title: "Transformations", keys: ["transform", "translation", "rotation", "scaling", "mirror", "reflect", "shear", "composition", "reference point", "model matrix", "world matrix", "scene graph", "hierarch"] },
    { id: "pipeline", title: "Rendering Pipeline", keys: ["pipeline", "geometry stage", "rasterization stage", "vertex processing", "fragment processing", "clipping", "tessellation", "shader", "programmable", "fixed function", "rendering process"] },
    { id: "gpu", title: "GPU Data & OpenGL", keys: ["opengl", "glfw", "vulkan", "vao", "vbo", "buffer", "glbuffer", "gldraw", "glvertex", "context", "glsl", "uniform", "attribute index", "gpu", "cpu", "driver", "glm"] },
    { id: "rasterization", title: "Rasterization & Sampling", keys: ["raster", "fragment", "pixel", "sample", "coverage", "discret", "scan conversion", "anti-alias", "interpolation", "barycentric"] },
    { id: "visibility", title: "Visibility & Fragment Tests", keys: ["depth", "stencil", "scissor", "alpha test", "mask", "culling", "occlusion", "visibility", "z-buffer", "fragment test", "discard"] },
    { id: "framebuffer", title: "Framebuffer & Compositing", keys: ["framebuffer", "attachment", "blending", "double buffer", "front buffer", "back buffer", "color buffer", "pixel transfer", "read pixels", "draw pixels"] },
    { id: "appearance", title: "Appearance & Rendering", keys: ["lighting", "shading", "material", "texture", "color", "photoreal", "non-photoreal", "reflection", "shadow", "phong", "normal mapping"] },
    { id: "applications", title: "Applications & Systems", keys: ["application", "interaction", "animation", "collision", "contest", "visualization", "simulation", "game", "medical", "cad", "virtual reality", "augmented reality"] },
    { id: "other", title: "Related Concepts", keys: [] }
  ];

  const structural = /^(chapter|slide|page|section|outline|references?|visual computing group|institute of media informatics|summer term|interactive computer graphics|course organization|chapter \d+|\d+\.\d+\s)/i;
  const noisy = /^(example|takeaway|reminder|step \d+|approach \d+|result \d+|source|image|video|http|www\.)/i;

  function cleanTitle(value) {
    return String(value || "")
      .replace(/[•]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[-–—:\s]+|[-–—:\s]+$/g, "")
      .trim();
  }

  function keyFor(title) {
    return title.toLowerCase()
      .replace(/[“”"'`]/g, "")
      .replace(/\b(1\/2|2\/2|\d+\/\d+)\b/g, "")
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/[^a-z0-9+×\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function useful(title) {
    if (!title || title.length < 2 || title.length > 180) return false;
    if (structural.test(title)) return false;
    if (/^\d+[\/.]?\d*$/.test(title)) return false;
    return true;
  }

  function domainFor(title) {
    const lower = title.toLowerCase();
    let winner = DOMAINS[DOMAINS.length - 1];
    let best = 0;
    for (const domain of DOMAINS.slice(0, -1)) {
      let score = 0;
      for (const keyword of domain.keys) if (lower.includes(keyword)) score += keyword.length;
      if (score > best) { best = score; winner = domain; }
    }
    return winner;
  }

  const conceptMap = new Map();
  const sourceParentPairs = [];

  function addConcept(title, source, parentTitle) {
    title = cleanTitle(title);
    if (!useful(title)) return null;
    const normalized = keyFor(title);
    if (!normalized) return null;
    let node = conceptMap.get(normalized);
    if (!node) {
      node = { id: `c${conceptMap.size}`, key: normalized, title, sources: [], domain: domainFor(title).id, degree: 0 };
      conceptMap.set(normalized, node);
    } else if (title.length < node.title.length && !noisy.test(title)) {
      node.title = title;
    }
    node.sources.push(source);
    if (parentTitle) sourceParentPairs.push([parentTitle, title]);
    return node;
  }

  function walk(node, source, nearestConceptTitle = null) {
    const title = cleanTitle(node.title);
    const concept = addConcept(title, source, nearestConceptTitle);
    const nextParent = concept ? concept.title : nearestConceptTitle;
    (node.children || []).forEach(child => walk(child, source, nextParent));
  }

  for (const lecture of window.ICG_SOURCE_LECTURES) {
    lecture.children.forEach((node, index) => walk(node, { chapter: lecture.chapter, section: index + 1, lecture: lecture.title }));
  }

  const domains = DOMAINS.map((domain, index) => ({ ...domain, index, type: "domain", concepts: [], x: 0, y: 0, radius: 82 }));
  const domainById = new Map(domains.map(domain => [domain.id, domain]));
  const concepts = Array.from(conceptMap.values());
  concepts.forEach(node => domainById.get(node.domain).concepts.push(node));

  const edges = [];
  const edgeKeys = new Set();
  function edge(a, b, type = "related", strength = 1) {
    if (!a || !b || a === b) return;
    const key = a.id < b.id ? `${a.id}|${b.id}|${type}` : `${b.id}|${a.id}|${type}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ a, b, type, strength });
    a.degree = (a.degree || 0) + 1;
    b.degree = (b.degree || 0) + 1;
  }

  domains.forEach(domain => domain.concepts.forEach(concept => edge(domain, concept, "contains", 0.42)));
  for (const [parentTitle, childTitle] of sourceParentPairs) {
    const a = conceptMap.get(keyFor(parentTitle));
    const b = conceptMap.get(keyFor(childTitle));
    if (a && b && a.domain === b.domain) edge(a, b, "source relation", 0.55);
  }

  function find(...names) {
    for (const name of names) {
      const exact = conceptMap.get(keyFor(name));
      if (exact) return exact;
      const target = keyFor(name);
      for (const node of concepts) if (node.key.includes(target) || target.includes(node.key)) return node;
    }
    return null;
  }

  const curated = [
    ["Vectors", "Matrix Vector Multiplication", "requires"],
    ["Matrices", "Matrix Vector Multiplication", "requires"],
    ["Matrix Vector Multiplication", "Transformations", "implements"],
    ["Homogeneous Coordinates", "Translations", "enables"],
    ["Translation", "Composition of Transformations", "composes"],
    ["Scaling", "Composition of Transformations", "composes"],
    ["Rotation", "Composition of Transformations", "composes"],
    ["Composition of Transformations", "Coordinate System Change", "enables"],
    ["Coordinate System Change", "Model Coordinate System", "maps"],
    ["Model Coordinate System", "World Coordinate System", "maps"],
    ["World Coordinate System", "View Coordinate System", "maps"],
    ["View Coordinate System", "Projection", "maps"],
    ["Projection", "Clipping", "precedes"],
    ["Clipping", "Rasterization", "precedes"],
    ["Rasterization", "Fragments", "produces"],
    ["Fragments", "Fragment Processing", "processed by"],
    ["Fragment Processing", "Fragment Tests and Operations", "precedes"],
    ["Depth Test", "Framebuffer", "controls"],
    ["Blending", "Framebuffer", "writes"],
    ["Vertex Buffer Object", "Vertex Array Object", "described by"],
    ["Vertex Array Object", "Vertex Processing", "feeds"],
    ["Vertex Attributes", "Vertex Shader", "inputs"],
    ["Normals", "Lighting", "used by"],
    ["Mirroring", "Polygon Orientation", "changes"],
    ["Polygon Orientation", "Back-Face Culling", "controls"],
    ["OpenGL Context", "Rendering Pipeline", "configures"],
    ["GLSL", "Shader Programming", "language for"],
    ["Framebuffer", "Pixels", "stores"],
    ["Scene Graph", "Hierarchical Coordinate Systems", "represents"],
    ["Model Transformation", "Vertex Processing", "performed in"],
    ["OpenGL", "GPU", "uses"],
    ["OpenGL", "Vulkan", "compared with"]
  ];
  curated.forEach(([a, b, type]) => edge(find(a), find(b), type, 1.4));

  // Add cross-domain semantic links based on shared meaningful words.
  const tokenIndex = new Map();
  const stop = new Set(["with","from","into","using","used","through","between","around","different","additional","properties","application","rendering","graphics","computer","model","models","object","objects"]);
  concepts.forEach(node => {
    const tokens = node.key.split(" ").filter(token => token.length > 4 && !stop.has(token));
    for (const token of new Set(tokens)) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, []);
      tokenIndex.get(token).push(node);
    }
  });
  for (const list of tokenIndex.values()) {
    if (list.length < 2 || list.length > 10) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].domain !== list[j].domain) edge(list[i], list[j], "semantic", 0.34);
      }
    }
  }

  // Planetary placement: domains orbit the root; concepts orbit their semantic domain in expanding rings.
  const root = { id: "root", title: "Interactive Computer Graphics", type: "root", x: 0, y: 0, radius: 112, degree: domains.length };
  const domainOrbit = 760;
  domains.forEach((domain, index) => {
    const angle = -Math.PI / 2 + index * TWO_PI / domains.length;
    domain.x = Math.cos(angle) * domainOrbit;
    domain.y = Math.sin(angle) * domainOrbit;
    edge(root, domain, "domain", 2);

    const sorted = domain.concepts.sort((a, b) => b.degree - a.degree || a.title.localeCompare(b.title));
    let cursor = 0;
    let ring = 1;
    while (cursor < sorted.length) {
      const capacity = Math.max(8, Math.floor(10 + ring * 8));
      const take = Math.min(capacity, sorted.length - cursor);
      const radius = 150 + ring * 92;
      for (let i = 0; i < take; i++) {
        const node = sorted[cursor + i];
        const angle2 = (i / take) * TWO_PI + ring * 0.71 + domain.index * 0.37;
        node.x = domain.x + Math.cos(angle2) * radius;
        node.y = domain.y + Math.sin(angle2) * radius;
        node.radius = Math.max(18, Math.min(46, 20 + Math.sqrt(node.degree || 1) * 3.6));
        node.phase = (Math.sin((cursor + i + 1) * 999) + 1) * Math.PI;
      }
      cursor += take;
      ring++;
    }
    domain.layoutRadius = 150 + ring * 92;
  });

  const allNodes = [root, ...domains, ...concepts];
  root.phase = 0;
  domains.forEach((node, i) => node.phase = i * 0.7);

  const camera = { scale: 0.16, x: 0, y: 0, targetScale: 0.16, targetX: 0, targetY: 0 };
  let width = 1, height = 1, dpr = 1, animationFrame = 0;
  let dragging = false, pointerId = null, lastX = 0, lastY = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    width = Math.max(1, innerWidth); height = Math.max(1, innerHeight);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    scheduleDraw();
  }

  function screenPoint(node, now) {
    const drift = reduceMotion || node.type === "root" ? 0 : Math.min(0.8, 0.3 / Math.max(camera.scale, 0.001));
    return {
      x: width / 2 + (node.x + Math.cos(now * 0.00012 + node.phase) * drift - camera.x) * camera.scale,
      y: height / 2 + (node.y + Math.sin(now * 0.0001 + node.phase) * drift - camera.y) * camera.scale
    };
  }

  function smoothstep(a, b, value) {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function visibility(radius) {
    return smoothstep(4, 13, radius) * (1 - smoothstep(320, 980, radius));
  }

  function wrap(text, maxWidth) {
    const words = text.split(/\s+/); const lines = []; let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawNode(node, point, radius, alpha) {
    const rootNode = node.type === "root";
    const domainNode = node.type === "domain";
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TWO_PI);
    ctx.fillStyle = rootNode ? "#1d1d1f" : domainNode ? "rgba(235,246,255,.98)" : "rgba(255,255,255,.97)";
    ctx.fill();
    ctx.lineWidth = Math.max(.65, Math.min(2.5, radius * .035));
    ctx.strokeStyle = rootNode ? "#1d1d1f" : domainNode ? "rgba(0,113,227,.48)" : "rgba(29,29,31,.14)";
    ctx.stroke();
    if (radius > 10) {
      const fontSize = Math.max(8, Math.min(rootNode ? 20 : domainNode ? 17 : 15, radius * .27));
      ctx.font = `${rootNode || domainNode ? 700 : 620} ${fontSize}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
      ctx.fillStyle = rootNode ? "#fff" : "#1d1d1f"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const lines = wrap(node.title, radius * 1.55).slice(0, radius > 60 ? 6 : 4);
      const lh = fontSize * 1.05; const start = point.y - (lines.length - 1) * lh / 2;
      lines.forEach((line, i) => ctx.fillText(line, point.x, start + i * lh));
    }
    ctx.restore();
  }

  function draw() {
    animationFrame = 0;
    const now = performance.now();
    const easing = dragging ? 1 : .24;
    camera.scale += (camera.targetScale - camera.scale) * easing;
    camera.x += (camera.targetX - camera.x) * easing;
    camera.y += (camera.targetY - camera.y) * easing;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f5f5f7"; ctx.fillRect(0, 0, width, height);

    const screen = new Map();
    allNodes.forEach(node => screen.set(node, screenPoint(node, now)));
    for (const link of edges) {
      const a = screen.get(link.a), b = screen.get(link.b);
      if (!a || !b) continue;
      const childRadius = (link.b.radius || 40) * camera.scale;
      const alpha = visibility(childRadius) * (link.type === "domain" || link.type === "contains" ? .18 : link.strength > 1 ? .22 : .075);
      if (alpha < .004) continue;
      if ((a.x < -500 && b.x < -500) || (a.x > width + 500 && b.x > width + 500) || (a.y < -500 && b.y < -500) || (a.y > height + 500 && b.y > height + 500)) continue;
      ctx.strokeStyle = link.strength > 1 ? `rgba(0,113,227,${alpha})` : `rgba(29,29,31,${alpha})`;
      ctx.lineWidth = link.strength > 1 ? 1.25 : .65;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const visible = [];
    for (const node of allNodes) {
      const point = screen.get(node); const radius = (node.radius || 40) * camera.scale;
      const alpha = visibility(radius);
      if (alpha < .008 || point.x + radius < -180 || point.x - radius > width + 180 || point.y + radius < -180 || point.y - radius > height + 180) continue;
      visible.push({ node, point, radius, alpha });
    }
    visible.sort((a, b) => a.radius - b.radius).forEach(item => drawNode(item.node, item.point, item.radius, item.alpha));
    if (!reduceMotion || Math.abs(camera.scale - camera.targetScale) > .0001 || Math.abs(camera.x - camera.targetX) > .001 || Math.abs(camera.y - camera.targetY) > .001) scheduleDraw();
  }

  function scheduleDraw() { if (!animationFrame) animationFrame = requestAnimationFrame(draw); }
  function zoomAt(clientX, clientY, deltaY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left - width / 2, py = clientY - rect.top - height / 2;
    const oldScale = camera.targetScale;
    const newScale = Math.max(.008, Math.min(1e14, oldScale * Math.exp(-deltaY * .0034)));
    const worldX = camera.targetX + px / oldScale, worldY = camera.targetY + py / oldScale;
    camera.targetScale = newScale;
    camera.targetX = worldX - px / newScale; camera.targetY = worldY - py / newScale;
    scheduleDraw();
  }

  canvas.addEventListener("wheel", event => { event.preventDefault(); zoomAt(event.clientX, event.clientY, event.deltaY); }, { passive: false });
  canvas.addEventListener("pointerdown", event => { if (event.button !== 0) return; dragging = true; pointerId = event.pointerId; lastX = event.clientX; lastY = event.clientY; canvas.classList.add("dragging"); canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", event => { if (!dragging || event.pointerId !== pointerId) return; const dx = event.clientX - lastX, dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; camera.targetX -= dx / camera.targetScale; camera.targetY -= dy / camera.targetScale; camera.x = camera.targetX; camera.y = camera.targetY; scheduleDraw(); });
  function stop(event) { if (!dragging) return; dragging = false; canvas.classList.remove("dragging"); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); pointerId = null; scheduleDraw(); }
  canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop); window.addEventListener("resize", resize);

  window.__ICG_MAP_STATS__ = {
    architecture: "concept-oriented-ontology-v10",
    visibleLectureNodes: 0,
    concepts: concepts.length,
    domains: domains.length,
    relations: edges.length,
    sourceLectures: window.ICG_SOURCE_LECTURES.map(item => ({ chapter: item.chapter, pages: item.pages }))
  };

  resize(); scheduleDraw();
})();