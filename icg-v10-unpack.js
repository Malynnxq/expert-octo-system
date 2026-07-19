(() => {
  "use strict";

  function unpackBase64Gzip(value) {
    const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text().then(JSON.parse);
  }

  try {
    Promise.all([
      unpackBase64Gzip(window.ICG_PACK),
      unpackBase64Gzip(window.ICG_PACK3)
    ]).then(([chapter2, chapter3]) => {
      window.ICG_SOURCE_LECTURES = [
        { chapter: 1, title: "Introduction", pages: 51, children: window.ICG_BRANCHES.slice() },
        { chapter: 2, title: "The Rendering Pipeline", pages: 94, children: chapter2 },
        { chapter: 3, title: "Geometric Transformations", pages: 54, children: chapter3 }
      ];
      delete window.ICG_PACK;
      delete window.ICG_PACK3;
      const script = document.createElement("script");
      script.src = "icg-v10-ontology.js?v=20260719-10";
      document.body.appendChild(script);
    }).catch(error => console.error("Failed to unpack source lectures", error));
  } catch (error) {
    console.error("Failed to initialize source lectures", error);
  }
})();