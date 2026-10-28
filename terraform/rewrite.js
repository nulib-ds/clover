/*
 * The docs site is a Next.js static export: every page but the homepage is a file
 * beside its folder (`/docs` is `docs.html`, not `docs/index.html`), and S3 behind an
 * origin access control serves keys, not directories, so it resolves no index of its
 * own the way GitHub Pages did. This puts a page's address back to its key: a trailing
 * slash comes off, the site root becomes `index.html`, and a path whose last segment
 * has no extension takes `.html`, as does the version group's `/docs/3.x` page.
 * Anything with a file extension (`/llms.txt`,
 * `/docs/items.md`, `/_next/static/…`, the mocks' JSON) is left alone.
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.length > 1 && uri.endsWith("/")) {
    uri = uri.slice(0, -1);
  }

  if (uri === "" || uri === "/") {
    request.uri = "/index.html";
    return request;
  }

  var last = uri.slice(uri.lastIndexOf("/") + 1);
  if (last.indexOf(".") === -1 || uri === "/docs/3.x") {
    uri = uri + ".html";
  }

  request.uri = uri;
  return request;
}
