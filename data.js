const knowledge = {
  graphics: {
    id: "graphics",
    title: "Interactive Computer Graphics",
    subtitle: "course",
    parent: null,
    children: ["geometry", "transformations", "visibility", "shading", "rasterization", "interaction"]
  },

  geometry: {
    id: "geometry",
    title: "Geometry",
    subtitle: "what exists?",
    parent: "graphics",
    children: ["meshes", "buffers", "normals"]
  },
  transformations: {
    id: "transformations",
    title: "Transformations",
    subtitle: "where is it?",
    parent: "graphics",
    children: ["coordinate-spaces", "model-transform", "camera-projection"]
  },
  visibility: {
    id: "visibility",
    title: "Visibility",
    subtitle: "what can be seen?",
    parent: "graphics",
    children: ["clipping", "culling", "depth-buffer"]
  },
  shading: {
    id: "shading",
    title: "Shading",
    subtitle: "what does it look like?",
    parent: "graphics",
    children: ["lighting", "materials", "textures"]
  },
  rasterization: {
    id: "rasterization",
    title: "Rasterization",
    subtitle: "which samples?",
    parent: "graphics",
    children: ["fragments", "coverage", "barycentric-coordinates", "interpolation"]
  },
  interaction: {
    id: "interaction",
    title: "Interaction",
    subtitle: "how does the user act?",
    parent: "graphics",
    children: ["frame-loop", "input", "picking"]
  },

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

const generatedLeafTitles = [
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

for (const title of generatedLeafTitles) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!knowledge[id]) knowledge[id] = { id, title, subtitle: "concept", parent: null, children: [] };
}

for (const node of Object.values(knowledge)) {
  for (const childId of node.children || []) {
    if (!knowledge[childId]) continue;
    knowledge[childId].parent = node.id;
  }
}

const rootConceptId = "graphics";
