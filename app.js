const state = {
  selectedId: null,
  mode: "read",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
  framePending: false,
  learned: new Set(JSON.parse(localStorage.getItem("learningMapProgress") || "[]"))
};

const svg = document.getElementById("mapSvg");
const viewport = document.getElementById("mapViewport");
const emptyState = document.getElementById("emptyState");
const conceptView = document.getElementById("conceptView");
const conceptTitle = document.getElementById("conceptTitle");
const conceptPath = document.getElementById("conceptPath");
const modeContent = document.getElementById("modeContent");
const markKnownBtn = document.getElementById("markKnownBtn");

let mapRoot;
const nodeElements = new Map();

function conceptById(id) {
  return concepts.find(concept => concept.id === id);
}

function childrenOf(id) {
  return concepts.filter(concept => concept.parent === id);
}

function ancestorsOf(id) {
  const chain = [];
  let current = conceptById(id);
  while (current) {
    chain.unshift(current);
    current = current.parent ? conceptById(current.parent) : null;
  }
  return chain;
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
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
      x1: parent.x, y1: parent.y, x2: concept.x, y2: concept.y, class: "edge"
    }));
  }

  for (const [a, b] of crossLinks) {
    const first = conceptById(a);
    const second = conceptById(b);
    edges.appendChild(svgEl("line", {
      x1: first.x, y1: first.y, x2: second.x, y2: second.y, class: "edge cross"
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

    const subtitle = svgEl("text", { y: radius > 70 ? 38 : 31, class: "node-subtitle" });
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
  updateNodeClasses();
  updateMapTransform();
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

function updateMapTransform() {
  if (!mapRoot) return;
  const x = viewport.clientWidth / 2 + state.offsetX;
  const y = viewport.clientHeight / 2 + state.offsetY;
  mapRoot.setAttribute("transform", `translate(${x} ${y}) scale(${state.scale})`);
}

function scheduleTransformUpdate() {
  if (state.framePending) return;
  state.framePending = true;
  requestAnimationFrame(() => {
    state.framePending = false;
    updateMapTransform();
  });
}

function updateNodeClasses() {
  for (const concept of concepts) {
    const element = nodeElements.get(concept.id);
    if (!element) continue;
    element.setAttribute("class", [
      "node",
      concept.parent === null ? "root" : "",
      state.learned.has(concept.id) ? "learned" : "",
      state.selectedId === concept.id ? "selected" : ""
    ].filter(Boolean).join(" "));
  }
}

function selectConcept(id) {
  state.selectedId = id;
  emptyState.classList.add("hidden");
  conceptView.classList.remove("hidden");
  updateNodeClasses();
  renderConcept();
}

function renderConcept() {
  const concept = conceptById(state.selectedId);
  if (!concept) return;
  conceptTitle.textContent = concept.title;
  conceptPath.textContent = ancestorsOf(concept.id).map(item => item.title).join("  ›  ");
  markKnownBtn.textContent = state.learned.has(concept.id) ? "Learned ✓" : "Mark as learned";
  renderMode();
}

function renderMode() {
  const concept = conceptById(state.selectedId);
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
  });
  if (state.mode === "read") renderRead(concept);
  else if (state.mode === "recall") renderRecall(concept);
  else if (state.mode === "apply") renderApply(concept);
  else renderConnections(concept);
}

function renderRead(concept) {
  const template = document.getElementById("readTemplate");
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('[data-field="why"]').textContent = concept.why;
  fragment.querySelector('[data-field="explanation"]').textContent = concept.explanation;
  fragment.querySelector('[data-field="formal"]').textContent = concept.formal;
  fragment.querySelector('[data-field="mistake"]').textContent = concept.mistake;

  const nearby = [concept, ...childrenOf(concept.id)];
  const learnedCount = nearby.filter(item => state.learned.has(item.id)).length;
  const percent = Math.round((learnedCount / nearby.length) * 100);
  const progressCard = document.createElement("article");
  progressCard.className = "study-card";
  progressCard.innerHTML = `<h3>Region progress</h3><p>${learnedCount} of ${nearby.length} nearby concepts marked as learned.</p><div class="progress-line"><div class="progress-fill" style="width:${percent}%"></div></div>`;
  fragment.appendChild(progressCard);
  modeContent.replaceChildren(fragment);
}

function renderRecall(concept) {
  const card = document.createElement("article");
  card.className = "study-card";
  card.innerHTML = `<h3>Fill the gaps</h3><p>Recall the missing concepts without opening the reading mode.</p>`;
  const sentence = concept.recall[0];
  const answers = [...sentence.matchAll(/{{(.*?)}}/g)].map(match => match[1]);
  let index = 0;
  const exercise = document.createElement("div");
  exercise.className = "recall-sentence";
  exercise.innerHTML = sentence.replace(/{{(.*?)}}/g, () => `<input class="recall-input" data-answer="${escapeHtml(answers[index++])}" aria-label="Missing phrase" />`);
  const check = document.createElement("button");
  check.textContent = "Check answers";
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  check.addEventListener("click", () => {
    const correct = [...exercise.querySelectorAll("input")].every(input => normalize(input.value) === normalize(input.dataset.answer));
    feedback.className = `feedback ${correct ? "good" : "bad"}`;
    feedback.textContent = correct ? "Correct. You reconstructed the anchor sentence." : `Not yet. Expected: ${answers.join("; ")}.`;
  });
  card.append(exercise, check, feedback);
  modeContent.replaceChildren(card);
}

function renderApply(concept) {
  const card = document.createElement("article");
  card.className = "study-card task-box";
  card.innerHTML = `<h3>Transfer task</h3><p>${concept.task}</p><textarea placeholder="Write your reasoning here..."></textarea>`;
  const reveal = document.createElement("button");
  reveal.textContent = "Show self-check criteria";
  const criteria = document.createElement("div");
  criteria.className = "feedback";
  reveal.addEventListener("click", () => {
    criteria.className = "study-card";
    criteria.innerHTML = `<h3>Self-check</h3><p>Your answer should use the formal anchor, explain the intuition, and distinguish this concept from at least one neighboring concept.</p>`;
  });
  card.append(reveal, criteria);
  modeContent.replaceChildren(card);
}

function renderConnections(concept) {
  const connections = new Map();
  if (concept.parent) connections.set(concept.parent, "parent concept");
  for (const child of childrenOf(concept.id)) connections.set(child.id, "deeper concept");
  for (const [a, b] of crossLinks) {
    if (a === concept.id) connections.set(b, "cross-link");
    if (b === concept.id) connections.set(a, "cross-link");
  }
  const card = document.createElement("article");
  card.className = "study-card";
  card.innerHTML = `<h3>Doors from this concept</h3><p>Use these links to rehearse the map as a navigable structure.</p>`;
  const list = document.createElement("div");
  list.className = "connection-list";
  for (const [id, relation] of connections) {
    const target = conceptById(id);
    const button = document.createElement("button");
    button.className = "connection-button";
    button.innerHTML = `${target.title}<span>${relation} →</span>`;
    button.addEventListener("click", () => selectConcept(id));
    list.appendChild(button);
  }
  card.appendChild(list);
  modeContent.replaceChildren(card);
}

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function saveProgress() {
  localStorage.setItem("learningMapProgress", JSON.stringify([...state.learned]));
}

markKnownBtn.addEventListener("click", () => {
  if (!state.selectedId) return;
  if (state.learned.has(state.selectedId)) state.learned.delete(state.selectedId);
  else state.learned.add(state.selectedId);
  saveProgress();
  updateNodeClasses();
  renderConcept();
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    state.mode = tab.dataset.mode;
    renderMode();
  });
});

document.getElementById("resetProgressBtn").addEventListener("click", () => {
  state.learned.clear();
  saveProgress();
  updateNodeClasses();
  if (state.selectedId) renderConcept();
});

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

function zoomFromCenter(factor) {
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

document.getElementById("zoomInBtn").addEventListener("click", () => zoomFromCenter(1.16));
document.getElementById("zoomOutBtn").addEventListener("click", () => zoomFromCenter(0.86));
document.getElementById("resetViewBtn").addEventListener("click", () => {
  state.scale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  scheduleTransformUpdate();
});

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
selectConcept("graphics");
