(() => {
  "use strict";
  try {
    const bytes = Uint8Array.from(atob(window.ICG_PACK), c => c.charCodeAt(0));
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then(text => {
      const chapter2Sections = JSON.parse(text);
      const chapter1Sections = window.ICG_BRANCHES.slice();
      window.ICG_ROOT_TITLE = "Interactive Computer Graphics";
      window.ICG_BRANCHES = [
        { title: "Chapter 1 - Introduction", children: chapter1Sections },
        { title: "Chapter 2 - The Rendering Pipeline", children: chapter2Sections }
      ];
      delete window.ICG_PACK;
      const script = document.createElement("script");
      script.src = "icg-v8-renderer.js?v=20260719-8";
      document.body.appendChild(script);
    }).catch(error => console.error("Failed to unpack Chapter 2 concept data", error));
  } catch (error) {
    console.error("Failed to initialize Chapter 2 concept data", error);
  }
})();