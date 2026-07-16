const state = {
  selectedId: null,
  mode: "read",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  dragStart: null,
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

function conceptById(id) {
  return concepts.find(c => c.id === id);
}

function childrenOf(id) {
  return concepts.filter(c => c.parent === id);
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
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function renderMap() {
  svg.innerHTML = "";
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  const root = svgEl("g", {
    transform: `translate(${width / 2 + state.offsetX} ${height / 2 + state.offsetY}) scale(${state.scale})`
  });

  for (const concept of concepts) {
    if (!concept.parent) continue;
    const parent = conceptById(concept.parent);
    root.appendChild(svgEl("line", {
      x1: parent.x,
      y1: parent.y,
      x2: concept.x,
      y2: concept.y,
      class: "edge"
    }));
  }

  for (const [a, b] of crossLinks) {
    const ca = conceptById(a);
    const cb = conceptById(b);
    root.appendChild(svgEl("line", {
      x1: ca.x,
      y1: ca.y,
      x2: cb.x,
      y2: cb.y,
      class: "edge cross"
    }));
  }

  for (const concept of concepts) {
    const group = svgEl("g", {
      class: [
        "node",
        concept.parent === null ? "root" : "",
        state.learned.has(concept.id) ? "learned" : "",
        state.selectedId === concept.id ? "selected" : ""
      ].filter(Boolean).join(" "),
      transform: `translate(${concept.x} ${concept.y})`,
      tabindex: 0,
      role: "button",
      "aria-label": concept.title
    });

    const radius = concept.parent === null ? 88 : 68;
    group.appendChild(svgEl("circle", { r: radius }));

    const title = svgEl("text", { y: -4, "font-size": concept.parent === null ? 15 : 13 });
    wrapSvgText(title, concept.title, 17, 16);
    group.appendChild(title);

    const subtitle = svgEl("text", { y: radius > 70 ? 38 : 31, class: "node-subtitle" });
    subtitle.textContent = concept.subtitle;
    group.appendChild(subtitle);

    group.addEventListener("click", event => {
      event.stopPropagation();
      selectConcept(concept.id);
    });
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") selectConcept(concept.id);
    });

    root.appendChild(group);
  }

  svg.appendChild(root);
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
  lines.forEach((value, i) => {
    const tspan = svgEl("tspan", { x: 0, y: startY + i * lineHeight - 2 });
    tspan.textContent = value;
    textNode.appendChild(tspan);
  });
}

function selectConcept(id) {
  state.selectedId = id;
  emptyState.classList.add("hidden");
  conceptView.classList.remove("hidden");
  renderMap();
  renderConcept();
}

function renderConcept() {
  const concept = conceptById(state.selectedId);
  if (!concept) return;
  conceptTitle.textContent = concept.title;
  conceptPath.textContent = ancestorsOf(concept.id).map(c => c.title).join("  ›  ");
  markKnownBtn.textContent = state.learned.has(concept.id) ? "Learned ✓" : "Mark as learned";
  renderMode();
}

function renderMode() {
  const concept = conceptById(state.selectedId);
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.mode === state.mode);
  });

  if (state.mode === "read") renderRead(concept);
  if (state.mode === "recall") renderRecall(concept);
  if (state.mode === "apply") renderApply(concept);
  if (state.mode === "connections") renderConnections(concept);
}

function renderRead(concept) {
  const template = document.getElementById("readTemplate");
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('[data-field="why"]').textContent = concept.why;
  fragment.querySelector('[data-field="explanation"]').textContent = concept.explanation;
  fragment.querySelector('[data-field="formal"]').textContent = concept.formal;
  fragment.querySelector('[data-field="mistake"]').textContent = concept.mistake;

  const progressCard = document.createElement("article");
  progressCard.className = "study-card";
  const descendants = [concept, ...childrenOf(concept.id)];
  const learnedCount = descendants.filter(c => state.learned.has(c.id)).length;
  const percent = Math.round((learnedCount / descendants.length) * 100);
  progressCard.innerHTML = `
    <h3>Region progress</h3>
    <p>${learnedCount} of ${descendants.length} nearby concepts marked as learned.</p>
    <div class="progress-line"><div class="progress-fill" style="width:${percent}%"></div></div>
  `;
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
  const html = sentence.replace(/{{(.*?)}}/g, () => {
    const current = index++;
    return `<input class="recall-input" data-answer="${escapeHtml(answers[current])}" aria-label="Missing phrase ${current + 1}" />`;
  });

  const exercise = document.createElement("div");
  exercise.className = "recall-sentence";
  exercise.innerHTML = html;

  const check = document.createElement("button");
  check.textContent = "Check answers";
  const feedback = document.createElement("div");
  feedback.className = "feedback";

  check.addEventListener("click", () => {
    const inputs = [...exercise.querySelectorAll("input")];
    const correct = inputs.every(input => normalize(input.value) === normalize(input.dataset.answer));
    feedback.className = `feedback ${correct ? "good" : "bad"}`;
    feedback.textContent = correct
      ? "Correct. You reconstructed the anchor sentence."
      : `Not yet. Expected: ${answers.join("; ")}.`;
  });

  card.append(exercise, check, feedback);
  modeContent.replaceChildren(card);
}

function renderApply(concept) {
  const card = document.createElement("article");
  card.className = "study-card task-box";
  card.innerHTML = `
    <h3>Transfer task</h3>
    <p>${concept.task}</p>
    <textarea placeholder="Write your reasoning here..."></textarea>
  `;

  const reveal = document.createElement("button");
  reveal.textContent = "Show self-check criteria";
  const criteria = document.createElement("div");
  criteria.className = "feedback";
  reveal.addEventListener("click", () => {
    criteria.className = "study-card";
    criteria.innerHTML = `
      <h3>Self-check</h3>
      <p>Your answer should use the formal anchor, explain the intuition, and distinguish this concept from at least one neighboring concept.</p>
    `;
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

  if (connections.size === 0) {
    list.innerHTML = "<p>No direct connections.</p>";
  } else {
    for (const [id, relation] of connections) {
      const target = conceptById(id);
      const button = document.createElement("button");
      button.className = "connection-button";
      button.innerHTML = `${target.title}<span>${relation} →</span>`;
      button.addEventListener("click", () => selectConcept(id));
      list.appendChild(button);
    }
  }

  card.appendChild(list);
  modeContent.replaceChildren(card);
}

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function saveProgress() {
  localStorage.setItem("learningMapProgress", JSON.stringify([...state.learned]));
}

markKnownBtn.addEventListener("click", () => {
  if (!state.selectedId) return;
  if (state.learned.has(state.selectedId)) state.learned.delete(state.selectedId);
  else state.learned.add(state.selectedId);
  saveProgress();
  renderConcept();
  renderMap();
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
  renderMap();
  if (state.selectedId) renderConcept();
});

function zoomBy(factor) {
  state.scale = Math.min(2.2, Math.max(0.55, state.scale * factor));
  renderMap();
}

document.getElementById("zoomInBtn").addEventListener("click", () => zoomBy(1.15));
document.getElementById("zoomOutBtn").addEventListener("click", () => zoomBy(0.87));
document.getElementById("resetViewBtn").addEventListener("click", () => {
  state.scale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  renderMap();
});

viewport.addEventListener("wheel", event => {
  event.preventDefault();
  zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
}, { passive: false });

viewport.addEventListener("pointerdown", event => {
  state.dragging = true;
  state.dragStart = { x: event.clientX - state.offsetX, y: event.clientY - state.offsetY };
  viewport.setPointerCapture(event.pointerId);
});

viewport.addEventListener("pointermove", event => {
  if (!state.dragging) return;
  state.offsetX = event.clientX - state.dragStart.x;
  state.offsetY = event.clientY - state.dragStart.y;
  renderMap();
});

viewport.addEventListener("pointerup", event => {
  state.dragging = false;
  viewport.releasePointerCapture(event.pointerId);
});

window.addEventListener("resize", renderMap);
renderMap();
selectConcept("graphics");
