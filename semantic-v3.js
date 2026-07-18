(() => {
  const knowledge = {
    graphics: { id: "graphics", title: "Interactive Computer Graphics", subtitle: "course", parent: null, children: ["geometry", "transformations", "visibility", "shading", "rasterization", "interaction"] },
    geometry: { id: "geometry", title: "Geometry", subtitle: "what exists?", parent: "graphics", children: ["meshes", "buffers", "normals"] },
    transformations: { id: "transformations", title: "Transformations", subtitle: "where is it?", parent: "graphics", children: ["coordinate-spaces", "model-transform", "camera-projection"] },
    visibility: { id: "visibility", title: "Visibility", subtitle: "what can be seen?", parent: "graphics", children: ["clipping", "culling", "depth-buffer"] },
    shading: { id: "shading", title: "Shading", subtitle: "what does it look like?", parent: "graphics", children: ["lighting", "materials", "textures"] },
    rasterization: { id: "rasterization", title: "Rasterization", subtitle: "which samples?", parent: "graphics", children: ["fragments", "coverage", "barycentric-coordinates", "interpolation"] },
    interaction: { id: "interaction", title: "Interaction", subtitle: "how does the user act?", parent: "graphics", children: ["frame-loop", "input", "picking"] },

    meshes: { id: "meshes", title: "Meshes", subtitle: "surface structure", parent: "geometry", children: ["vertices", "edges", "faces", "topology"] },
    buffers: { id: "buffers", title: "Buffers", subtitle: "GPU data", parent: "geometry", children: ["vertex-buffer", "index-buffer", "framebuffer"] },
    normals: { id: "normals", title: "Normals", subtitle: "orientation", parent: "geometry", children: ["face-normals", "vertex-normals", "normal-matrix"] },

    "coordinate-spaces": { id: "coordinate-spaces", title: "Coordinate Spaces", subtitle: "nested systems", parent: "transformations", children: ["object-space", "world-space", "view-space", "clip-space", "screen-space"] },
    "model-transform": { id: "model-transform", title: "Model Transform", subtitle: "object to world", parent: "transformations", children: ["translation", "rotation", "scaling", "matrix-order"] },
    "camera-projection": { id: "camera-projection", title: "Camera & Projection", subtitle: "world to image", parent: "transformations", children: ["view-matrix", "perspective", "orthographic", "perspective-division"] },

    clipping: { id: "clipping", title: "Clipping", subtitle: "view volume", parent: "visibility", children: ["clip-space-test", "near-plane", "far-plane"] },
    culling: { id: "culling", title: "Culling", subtitle: "remove surfaces", parent: "visibility", children: ["back-face-culling", "frustum-culling"] },
    "depth-buffer": { id: "depth-buffer", title: "Depth Buffer", subtitle: "nearest surface", parent: "visibility", children: ["depth-test", "depth-precision", "z-fighting"] },

    lighting: { id: "lighting", title: "Lighting", subtitle: "light interaction", parent: "shading", children: ["diffuse", "specular", "ambient", "light-direction"] },
    materials: { id: "materials", title: "Materials", subtitle: "surface response", parent: "shading", children: ["albedo", "roughness", "metalness"] },
    textures: { id: "textures", title: "Textures", subtitle: "sampled detail", parent: "shading", children: ["uv-coordinates", "filtering", "wrapping", "mipmaps"] },

    fragments: { id: "fragments", title: "Fragments", subtitle: "pixel candidates", parent: "rasterization", children: ["fragment-shader", "discard", "framebuffer-output"] },
    coverage: { id: "coverage", title: "Coverage", subtitle: "inside tests", parent: "rasterization", children: ["edge-functions", "sample-locations", "anti-aliasing"] },
    "barycentric-coordinates": { id: "barycentric-coordinates", title: "Barycentric Coordinates", subtitle: "triangle weights", parent: "rasterization", children: ["geometric-meaning", "inside-triangle-test", "attribute-weights"] },
    interpolation: { id: "interpolation", title: "Interpolation", subtitle: "values across surfaces", parent: "rasterization", children: ["linear-interpolation", "perspective-correct", "flat-interpolation"] },

    "frame-loop": { id: "frame-loop", title: "Frame Loop", subtitle: "continuous update", parent: "interaction", children: ["delta-time", "update", "render", "present"] },
    input: { id: "input", title: "Input", subtitle: "events and state", parent: "interaction", children: ["keyboard", "pointer", "gamepad"] },
    picking: { id: "picking", title: "Picking", subtitle: "screen to scene", parent: "interaction", children: ["ray-casting", "id-buffer", "bounding-volumes"] }
  };

  const leafTitles = [
    "Vertices", "Edges", "Faces", "Topology", "Vertex Buffer", "Index Buffer", "Framebuffer",
    "Face Normals", "Vertex Normals", "Normal Matrix", "Object Space", "World Space", "View Space",
    "Clip Space", "Screen Space", "Translation", "Rotation", "Scaling", "Matrix Order", "View Matrix",
    "Perspective", "Orthographic", "Perspective Division", "Clip-Space Test", "Near Plane", "Far Plane",
    "Back-Face Culling", "Frustum Culling", "Depth Test", "Depth Precision", "Z-Fighting", "Diffuse",
    "Specular", "Ambient", "Light Direction", "Albedo", "Roughness", "Metalness", "UV Coordinates",
    "Filtering", "Wrapping", "Mipmaps", "Fragment Shader", "Discard", "Framebuffer Output", "Edge Functions",
    "Sample Locations", "Anti-Aliasing", "Geometric Meaning", "Inside-Triangle Test", "Attribute Weights",
    "Linear Interpolation", "Perspective-Correct", "Flat Interpolation", "Delta Time", "Update", "Render",
    "Present", "Keyboard", "Pointer", "Gamepad", "Ray Casting", "ID Buffer", "Bounding Volumes"
  ];

  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const title of leafTitles) {
    const id = slug(title);
    if (!knowledge[id]) knowledge[id] = { id, title, subtitle: "concept", parent: null, children: [] };
  }
  for (const node of Object.values(knowledge)) {
    for (const childId of node.children || []) {
      if (knowledge[childId]) knowledge[childId].parent = node.id;
    }
  }

  const viewport = document.getElementById("mapViewport");
  const svg = document.getElementById("mapSvg");
  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    focusId: "graphics",
    selectedId: "graphics",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    pointerId: null,
    dragX: 0,
    dragY: 0,
    startX: 0,
    startY: 0,
    transitioning: false,
    positions: new Map(),
    lastFrame: performance.now()
  };

  let scene;
  let edgeLayer;
  let nodeLayer;
  let nodeElements = new Map();
  let edgeElements = [];

  function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function currentNode() {
    return knowledge[state.focusId];
  }

  function visibleIds() {
    const focus = currentNode();
    return [focus.id, ...(focus.children || [])];
  }

  function titleLines(title, max = 18) {
    const words = title.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function initializePositions() {
    state.positions.clear();
    state.positions.set(state.focusId, { x: 0, y: 0, vx: 0, vy: 0, angle: 0 });
    const children = currentNode().children || [];
    const count = Math.max(1, children.length);
    children.forEach((id, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / count);
      const radius = count <= 3 ? 300 : count <= 5 ? 350 : 390;
      state.positions.set(id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        angle
      });
    });
  }

  function buildScene() {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "-800 -650 1600 1300");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    scene = el("g", { class: "semantic-scene" });
    edgeLayer = el("g", { class: "edges" });
    nodeLayer = el("g", { class: "nodes" });
    scene.append(edgeLayer, nodeLayer);
    svg.appendChild(scene);

    nodeElements = new Map();
    edgeElements = [];
    initializePositions();

    const focus = currentNode();
    for (const childId of focus.children || []) {
      const line = el("line", { class: "edge" });
      edgeLayer.appendChild(line);
      edgeElements.push({ element: line, from: focus.id, to: childId });
    }

    for (const id of visibleIds()) {
      const concept = knowledge[id];
      const isFocus = id === state.focusId;
      const group = el("g", {
        class: `node ${isFocus ? "focus" : "child"}${id === state.selectedId ? " selected" : ""}`,
        role: "button",
        tabindex: "0",
        "aria-label": concept.title,
        "data-id": id
      });

      group.appendChild(el("circle", { r: isFocus ? 110 : 76 }));

      const text = el("text");
      const lines = titleLines(concept.title, isFocus ? 23 : 17);
      const lineHeight = isFocus ? 20 : 17;
      const start = -((lines.length - 1) * lineHeight) / 2 - 7;
      lines.forEach((line, index) => {
        const span = el("tspan", { x: 0, y: start + index * lineHeight });
        span.textContent = line;
        text.appendChild(span);
      });
      group.appendChild(text);

      const subtitle = el("text", { class: "node-subtitle", y: isFocus ? 54 : 42 });
      subtitle.textContent = concept.subtitle || "concept";
      group.appendChild(subtitle);

      if (!isFocus && concept.children?.length) {
        const marker = el("text", { class: "depth-marker", y: -47 });
        marker.textContent = "+";
        group.appendChild(marker);
      }

      group.addEventListener("pointerdown", event => event.stopPropagation());
      group.addEventListener("pointerenter", () => {
        if (!isFocus) selectNode(id);
      });
      group.addEventListener("click", event => {
        event.stopPropagation();
        if (isFocus) return;
        if (state.selectedId === id && concept.children?.length) enterNode(id);
        else selectNode(id);
      });
      group.addEventListener("dblclick", event => {
        event.stopPropagation();
        if (!isFocus) enterNode(id);
      });
      group.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!isFocus && concept.children?.length) enterNode(id);
        else selectNode(id);
      });

      nodeLayer.appendChild(group);
      nodeElements.set(id, group);
    }

    renderPositions();
    updateCamera();
  }

  function selectNode(id) {
    state.selectedId = id;
    for (const [nodeId, element] of nodeElements) {
      element.classList.toggle("selected", nodeId === id);
    }
  }

  function enterNode(id) {
    const node = knowledge[id];
    if (!node?.children?.length || state.transitioning) return;
    state.transitioning = true;
    nodeElements.get(id)?.classList.add("entering");

    window.setTimeout(() => {
      state.focusId = id;
      state.selectedId = id;
      state.scale = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      buildScene();
      viewport.classList.add("level-entered");
      requestAnimationFrame(() => viewport.classList.remove("level-entered"));
      state.transitioning = false;
    }, reduceMotion ? 0 : 260);
  }

  function exitLevel() {
    const parentId = currentNode().parent;
    if (!parentId || state.transitioning) return;
    state.transitioning = true;
    viewport.classList.add("level-exiting");

    window.setTimeout(() => {
      const previousId = state.focusId;
      state.focusId = parentId;
      state.selectedId = previousId;
      state.scale = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      buildScene();
      viewport.classList.remove("level-exiting");
      state.transitioning = false;
    }, reduceMotion ? 0 : 220);
  }

  function updateCamera() {
    svg.style.transform = `translate3d(calc(-50% + ${state.offsetX}px), calc(-50% + ${state.offsetY}px), 0) scale(${state.scale})`;
  }

  function zoomAt(clientX, clientY, factor) {
    if (state.transitioning) return;
    const oldScale = state.scale;
    let newScale = oldScale * factor;

    if (newScale > 2.25) {
      const target = state.selectedId !== state.focusId ? state.selectedId : null;
      if (target && knowledge[target]?.children?.length) {
        enterNode(target);
        return;
      }
      newScale = 2.25;
    }

    if (newScale < 0.52) {
      if (currentNode().parent) {
        exitLevel();
        return;
      }
      newScale = 0.52;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left - rect.width / 2;
    const pointerY = clientY - rect.top - rect.height / 2;
    const worldX = (pointerX - state.offsetX) / oldScale;
    const worldY = (pointerY - state.offsetY) / oldScale;

    state.scale = newScale;
    state.offsetX = pointerX - worldX * newScale;
    state.offsetY = pointerY - worldY * newScale;
    updateCamera();
  }

  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    const hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".node.child");
    const hoveredId = hovered?.getAttribute("data-id");
    if (hoveredId) selectNode(hoveredId);
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0032));
  }, { passive: false });

  viewport.addEventListener("pointerdown", event => {
    if (event.button !== 0 || state.transitioning) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.dragX = event.clientX;
    state.dragY = event.clientY;
    state.startX = state.offsetX;
    state.startY = state.offsetY;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", event => {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.offsetX = state.startX + event.clientX - state.dragX;
    state.offsetY = state.startY + event.clientY - state.dragY;
    updateCamera();
  });

  function stopDragging(event) {
    if (!state.dragging) return;
    state.dragging = false;
    viewport.classList.remove("dragging");
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  }

  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);

  function renderPositions() {
    for (const [id, position] of state.positions) {
      nodeElements.get(id)?.setAttribute("transform", `translate(${position.x.toFixed(2)} ${position.y.toFixed(2)})`);
    }
    for (const edge of edgeElements) {
      const a = state.positions.get(edge.from);
      const b = state.positions.get(edge.to);
      edge.element.setAttribute("x1", a.x.toFixed(2));
      edge.element.setAttribute("y1", a.y.toFixed(2));
      edge.element.setAttribute("x2", b.x.toFixed(2));
      edge.element.setAttribute("y2", b.y.toFixed(2));
    }
  }

  function animate(now) {
    const dt = Math.min(0.035, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    if (!reduceMotion && !state.dragging && document.visibilityState === "visible") {
      const ids = visibleIds();
      const radius = ids.length <= 4 ? 300 : ids.length <= 6 ? 350 : 390;
      const time = now * 0.00025;

      for (const [id, position] of state.positions) {
        if (id === state.focusId) continue;
        const targetX = Math.cos(position.angle + Math.sin(time + position.angle) * 0.035) * radius;
        const targetY = Math.sin(position.angle + Math.cos(time * 0.83 + position.angle) * 0.035) * radius;
        position.vx += (targetX - position.x) * 0.0045;
        position.vy += (targetY - position.y) * 0.0045;
        position.vx *= Math.pow(0.87, dt * 60);
        position.vy *= Math.pow(0.87, dt * 60);
        position.x += position.vx * dt * 60;
        position.y += position.vy * dt * 60;
      }
      renderPositions();
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", updateCamera);
  buildScene();
  requestAnimationFrame(animate);
})();
