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
    ]).then(([chapter2Sections, chapter3Sections]) => {
      const chapter1Sections = window.ICG_BRANCHES.slice();

      window.ICG_ROOT_TITLE = "Interactive Computer Graphics";
      window.ICG_BRANCHES = [
        { title: "Chapter 1 - Introduction", children: chapter1Sections },
        { title: "Chapter 2 - The Rendering Pipeline", children: chapter2Sections },
        { title: "Chapter 3 - Geometric Transformations", children: chapter3Sections }
      ];

      delete window.ICG_PACK;
      delete window.ICG_PACK3;

      const script = document.createElement("script");
      script.src = "icg-v8-renderer.js?v=20260719-9";
      document.body.appendChild(script);
    }).catch(error => {
      console.error("Failed to unpack the Interactive Computer Graphics concept data", error);
    });
  } catch (error) {
    console.error("Failed to initialize the Interactive Computer Graphics concept data", error);
  }
})();
