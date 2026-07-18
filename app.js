const state = {
  selectedId: "graphics",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
  framePending: false
};

const svg = document.getElementById("mapSvg");
const viewport = document.getElementById("mapViewport");
let mapRoot;
const nodeElements = new Map();

function conceptById(id) {
  return concepts.find(concept => concept.id === id);
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function wrapSvgText(textNode, text, maxChars, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  const startY = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((value, index) => {
    const tspan = svgEl("tspan", { x: 0, y: startY + index * lineHeight - 2 });
    tspan.textContent = value;
    textNode.appendChild(tspan);
  });
}

function updateSelection() {
  for (const [id, element] of nodeElements) {
    const concept = conceptById(id);
    element.setAttribute("class", [
      "node",
      concept.parent === null ? "root" : "",
      state.selectedId === id ? "selected" : ""
    ].filter(Boolean).join(" "));
  }
}

function selectConcept(id) {
  state.selectedId = id;
  updateSelection();
}

function buildMapOnce() {
  svg.replaceChildren();
  nodeElements.clear();
  mapRoot = svgEl("g", { class: "map-root" });

  const edges = svgEl("g", { class: "edges" });
  for (const concept of concepts) {
    if (!concept.parent) continue;
    const parent = conceptById(concept.parent);
    edges.appendChild(svgEl("line", {
      x1: parent.x,
      y1: parent.y,
      x2: concept.x,
      y2: concept.y,
      class: "edge"
    }));
  }

  for (const [a, b] of crossLinks) {
    const first = conceptById(a);
    const second = conceptById(b);
    edges.appendChild(svgEl("line", {
      x1: first.x,
      y1: first.y,
      x2: second.x,
      y2: second.y,
      class: "edge cross"
    }));
  }

  mapRoot.appendChild(edges);

  const nodes = svgEl("g", { class: "nodes" });
  for (const concept of concepts) {
    const group = svgEl("g", {
      transform: `translate(${concept.x} ${concept.y})`,
      tabindex: 0,
      role: "button",
      "aria-label": concept.title,
      "data-id": concept.id
    });

    const radius = concept.parent === null ? 88 : 68;
    group.appendChild(svgEl("circle", { r: radius }));

    const title = svgEl("text", { "font-size": concept.parent === null ? 15 : 13 });
    wrapSvgText(title, concept.title, 17, 16);
    group.appendChild(title);

    const subtitle = svgEl("text", {
      y: radius > 70 ? 38 : 31,
      class: "node-subtitle"
    });
    subtitle.textContent = concept.subtitle;
    group.appendChild(subtitle);

    group.addEventListener("pointerdown", event => event.stopPropagation());
    group.addEventListener("click", event => {
      event.stopPropagation();
      selectConcept(concept.id);
    });
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectConcept(concept.id);
      }
    });

    nodes.appendChild(group);
    nodeElements.set(concept.id, group);
  }

  mapRoot.appendChild(nodes);
  svg.appendChild(mapRoot);
  updateSelection();
  updateMapTransform();
}

function updateMapTransform() {
  const x = viewport.clientWidth / 2 + state.offsetX;
  const y = viewport.clientHeight / 2 + state.offsetY;
  mapRoot?.setAttribute("transform", `translate(${x} ${y}) scale(${state.scale})`);
}

function scheduleTransformUpdate() {
  if (state.framePending) return;
  state.framePending = true;
  requestAnimationFrame(() => {
    state.framePending = false;
    updateMapTransform();
  });
}

function zoomAt(clientX, clientY, factor) {
  const oldScale = state.scale;
  const newScale = Math.min(2.2, Math.max(0.55, oldScale * factor));
  if (newScale === oldScale) return;

  const rect = viewport.getBoundingClientRect();
  const pointerX = clientX - rect.left - rect.width / 2;
  const pointerY = clientY - rect.top - rect.height / 2;
  const worldX = (pointerX - state.offsetX) / oldScale;
  const worldY = (pointerY - state.offsetY) / oldScale;

  state.scale = newScale;
  state.offsetX = pointerX - worldX * newScale;
  state.offsetY = pointerY - worldY * newScale;
  scheduleTransformUpdate();
}

viewport.addEventListener("wheel", event => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0012));
}, { passive: false });

viewport.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  state.dragging = true;
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.startOffsetX = state.offsetX;
  state.startOffsetY = state.offsetY;
  viewport.classList.add("dragging");
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", event => {
  if (!state.dragging) return;
  state.offsetX = state.startOffsetX + event.clientX - state.dragStartX;
  state.offsetY = state.startOffsetY + event.clientY - state.dragStartY;
  scheduleTransformUpdate();
});

function finishDrag(event) {
  if (!state.dragging) return;
  state.dragging = false;
  viewport.classList.remove("dragging");
  if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
}

viewport.addEventListener("pointerup", finishDrag);
viewport.addEventListener("pointercancel", finishDrag);
window.addEventListener("resize", scheduleTransformUpdate);

buildMapOnce();
