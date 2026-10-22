// Preserve the classic script URL while letting the browser load feature chunks.
// Resolve against this script, not the embedding page (including on a CDN).
(function () {
  var script = document.currentScript;
  if (!script || !script.src) {
    throw new Error("Load Clover web components using an external script src.");
  }
  var url = new URL("./index.mjs", script.src).href;
  // Say so when it cannot load: a CDN must serve the module beside this script, with CORS.
  import(url).catch(function (error) {
    console.error(
      "Clover's web components could not load from " +
        url +
        ". Serve index.mjs and its chunks beside index.umd.js, with CORS if from another origin.",
      error,
    );
  });
})();
