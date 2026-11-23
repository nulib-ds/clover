import { describe, expect, it } from "vitest";

import { movedPages, movedTo } from "docs/lib/moved.mjs";

describe("movedTo", () => {
  it("sends the old demo, with its query kept by the caller, to the homepage", () => {
    expect(movedTo("/docs/viewer/demo")).toBe("/");
    expect(movedTo("/docs/viewer/demo/")).toBe("/");
  });

  it("sends 3.x and 4.x pages from their earlier folders", () => {
    expect(movedTo("/docs/3.x")).toBe("/docs/deprecated-versions");
    expect(movedTo("/docs/3.x/viewer/search")).toBe(
      "/docs/deprecated-versions/viewer/search",
    );
    expect(movedTo("/docs/4.x/items")).toBe("/docs/items");
    expect(movedTo("/docs/slider")).toBe("/docs/deprecated-versions/slider");
  });

  it("sends the 3.x Viewer's own pages, but never the Viewer's", () => {
    expect(movedTo("/docs/viewer/search")).toBe(
      "/docs/deprecated-versions/viewer/search",
    );
    expect(movedTo("/docs/viewer/templates")).toBe("/docs/viewer#templates");
    expect(movedTo("/docs/viewer")).toBeNull();
  });

  it("keeps a section's anchor, and leaves other paths alone", () => {
    expect(movedTo("/docs/technical")).toBe(
      "/docs/composing/glossary#structure-of-project",
    );
    expect(movedTo("/docs/items")).toBeNull();
    expect(movedTo("/")).toBeNull();
  });
});

describe("movedPages", () => {
  const routes = [
    "/",
    "/docs",
    "/docs/items",
    "/docs/i18n",
    "/docs/panel",
    "/docs/viewer",
    "/docs/viewer/default",
    "/docs/composing/glossary",
    "/docs/deprecated-versions",
    "/docs/deprecated-versions/i18n",
    "/docs/deprecated-versions/slider",
    "/docs/deprecated-versions/viewer",
    "/docs/deprecated-versions/viewer/search",
  ];
  const pages = Object.fromEntries(
    movedPages(routes).map(({ from, to }) => [from, to]),
  );

  it("gives each moved address a built page answers for", () => {
    expect(pages).toMatchObject({
      "/docs/viewer/demo": "/",
      "/docs/information-panel": "/docs/panel",
      "/docs/technical": "/docs/composing/glossary#structure-of-project",
      "/docs/3.x/slider": "/docs/deprecated-versions/slider",
      "/docs/3.x/viewer/search": "/docs/deprecated-versions/viewer/search",
      "/docs/4.x/items": "/docs/items",
      "/docs/slider": "/docs/deprecated-versions/slider",
      "/docs/viewer/search": "/docs/deprecated-versions/viewer/search",
    });
  });

  it("never covers a page that is there, nor goes where no page is", () => {
    for (const route of routes) expect(pages).not.toHaveProperty(route);
    // `/docs/body` is not built here, so `/docs/content` has nowhere to go.
    expect(pages).not.toHaveProperty(["/docs/content"]);
    for (const to of Object.values(pages))
      expect(routes).toContain(to.split("#")[0]);
  });

  it("never sends 4.x's old folder to 3.x pages, which were never there", () => {
    expect(
      Object.keys(pages).filter((from) =>
        from.startsWith("/docs/4.x/deprecated-versions"),
      ),
    ).toEqual([]);
  });
});
