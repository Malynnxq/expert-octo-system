const state = {
  focusId: rootConceptId,
  selectedId: rootConceptId,
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

const viewport = document.getElementById("mapViewport");
const svg = document.getElementById("mapSvg");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVG_NS = "http://www.w3.org/2000/svg";
let scene;
let edgeLayer;
let nodeLayer;
let nodeElements = new Map();
let edgeElements = [];

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
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
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function initializePositions() {
  state.positions.clear();
  const ids = visibleIds();
  state.positions.set(state.focusId, { x: 0, y: 0, vx: 0, vy: 0, angle: 0 });

  const count = Math.max(1, ids.length - 1);
  ids.slice(1).forEach((id, index) => {
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

  scene = svgElement("g", { class: "semantic-scene" });
  edgeLayer = svgElement("g", { class: "edges" });
  nodeLayer = svgElement("g", { class: "nodes" });
  scene.append(edgeLayer, nodeLayer);
  svg.appendChild(scene);

  nodeElements = new Map();
  edgeElements = [];
  initializePositions();

  const focus = currentNode();
  for (const childId of focus.children || []) {
    const line = svgElement("line", { class: "edge" });
    edgeLayer.appendChild(line);
    edgeElements.push({ element: line, from: focus.id, to: childId });
  }

  for (const id of visibleIds()) {
    const concept = knowledge[id];
    const isFocus = id === state.focusId;
    const group = svgElement("g", {
      class: `node ${isFocus ? "focus" : "child"}${id === state.selectedId ? " selected" : ""}`,
      role: "button",
      tabindex: "0",
      "aria-label": concept.title,
      "data-id": id
    });

    const radius = isFocus ? 110 : 76;
    group.appendChild(svgElement("circle", { r: radius }));

    const text = svgElement("text");
    const lines = titleLines(concept.title, isFocus ? 23 : 17);
    const lineHeight = isFocus ? 20 : 17;
    const start = -((lines.length - 1) * lineHeight) / 2 - 7;
    lines.forEach((line, index) => {
      const span = svgElement("tspan", { x: 0, y: start + index * lineHeight });
      span.textContent = line;
      text.appendChild(span);
    });
    group.appendChild(text);

    const subtitle = svgElement("text", { class: "node-subtitle", y: isFocus ? 54 : 42 });
    subtitle.textContent = concept.subtitle || "concept";
    group.appendChild(subtitle);

    if (!isFocus && (concept.children || []).length) {
      const marker = svgElement("text", { class: "depth-marker", y: -47 });
      marker.textContent = "+";
      group.appendChild(marker);
    }

    group.addEventListener("pointerdown", event => event.stopPropagation());
    group.addEventListener("click", event => {
      event.stopPropagation();
      selectNode(id);
    });
    group.addEventListener("dblclick", event => {
      event.stopPropagation();
      if (id !== state.focusId) enterNode(id);
    });
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (id === state.selectedId && id !== state.focusId) enterNode(id);
        else selectNode(id);
      }
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
  if (!node || !node.children?.length || state.transitioning) return;
  state.transitioning = true;
  const selectedElement = nodeElements.get(id);
  selectedElement?.classList.add("entering");

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

  if (newScale > 2.35) {
    const target = state.selectedId !== state.focusId ? state.selectedId : null;
    if (target && knowledge[target]?.children?.length) {
      enterNode(target);
      return;
    }
    newScale = 2.35;
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
  const factor = Math.exp(-event.deltaY * 0.0028);
  zoomAt(event.clientX, event.clientY, factor);
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
    const focus = state.positions.get(state.focusId);
    if (focus) {
      focus.x *= 0.9;
      focus.y *= 0.9;
    }

    for (const [id, position] of state.positions) {
      if (id === state.focusId) continue;
      const time = now * 0.00025;
      const targetRadius = visibleIds().length <= 4 ? 300 : visibleIds().length <= 6 ? 350 : 390;
      const targetX = Math.cos(position.angle + Math.sin(time + position.angle) * 0.035) * targetRadius;
      const targetY = Math.sin(position.angle + Math.cos(time * 0.83 + position.angle) * 0.035) * targetRadius;
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
