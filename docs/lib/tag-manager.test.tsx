import React, { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GoogleTagManager from "docs/components/GoogleTagManager";
import { pageReferrer, resourceOpen, tagManagerId } from "docs/lib/tag-manager";
import type { Query } from "docs/lib/router";

const route = vi.hoisted(() => ({
  pathname: "/" as string | null,
  query: {} as Query,
  isReady: true,
}));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("docs/lib/router", () => ({ useRouter: () => route }));
vi.mock("next/script", () => ({ default: () => null }));

type LayerWindow = Window & { dataLayer?: Record<string, unknown>[] };
const target = window as LayerWindow;
const siteUrl = `${window.location.origin}/clover`;
const events = () =>
  (target.dataLayer ?? []).filter((item) => item.event === "clover_page_view");
const resources = () =>
  (target.dataLayer ?? []).filter(
    (item) => item.event === "clover_resource_open",
  );
const tracker = () => (
  <StrictMode>
    <GoogleTagManager containerId="GTM-TEST123" siteUrl={siteUrl} />
  </StrictMode>
);

beforeEach(() => {
  route.pathname = "/";
  route.query = {};
  route.isReady = true;
  document.title = "Clover IIIF";
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = siteUrl;
  document.head.append(canonical);
  vi.spyOn(document, "referrer", "get").mockReturnValue(
    "https://example.org/collections?iiif-content=private#selection",
  );
});

afterEach(() => {
  cleanup();
  delete target.dataLayer;
  document.querySelector('meta[name="robots"]')?.remove();
  document.querySelector('link[rel="canonical"]')?.remove();
  document.getElementById("install")?.remove();
  document.getElementById("cta-fixture")?.remove();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Tag Manager page views", () => {
  it("records the homepage when the public site is at its host's root", () => {
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${window.location.origin}/`;
    render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl={window.location.origin}
      />,
    );
    expect(events()).toHaveLength(1);
    expect(events()[0].page_location).toBe(window.location.origin);
  });

  it("queues the first page before startup and reports it once in Strict Mode", () => {
    render(tracker());
    expect(target.dataLayer).toEqual([
      {
        page_location: siteUrl,
        page_title: "Clover IIIF",
        page_referrer: "https://example.org/collections",
      },
      { "gtm.start": expect.any(Number), event: "gtm.js" },
      {
        event: "clover_page_view",
        page_location: siteUrl,
        page_title: "Clover IIIF",
        page_referrer: "https://example.org/collections",
      },
    ]);
  });

  it("counts client navigation and back navigation with the previous page as referrer", () => {
    const view = render(tracker());
    route.pathname = "/docs/viewer";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/viewer`;
    document.title = "Viewer – Clover IIIF";
    view.rerender(tracker());
    route.pathname = "/";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    view.rerender(tracker());
    expect(events()).toHaveLength(3);
    expect(events()[1]).toMatchObject({
      page_location: `${siteUrl}/docs/viewer`,
      page_title: "Viewer – Clover IIIF",
      page_referrer: siteUrl,
    });
    expect(events()[2].page_referrer).toBe(`${siteUrl}/docs/viewer`);
    expect(
      target.dataLayer?.filter((item) => item.event === "gtm.js"),
    ).toHaveLength(1);
  });

  it("ignores query and fragment changes inside an example", () => {
    window.history.replaceState(null, "", "/?iiif-content=private#selection");
    const view = render(tracker());
    window.history.replaceState(null, "", "/?code=web-components#parts");
    view.rerender(tracker());
    expect(events()).toHaveLength(1);
    expect(events()[0].page_location).toBe(siteUrl);
    expect(JSON.stringify(target.dataLayer)).not.toContain("private");
  });

  it("waits for the new page's metadata before recording its title", async () => {
    const view = render(tracker());
    route.pathname = "/docs/composing";
    document.title = "";
    view.rerender(tracker());
    expect(events()).toHaveLength(1);
    document.title = "Composing layouts – Clover IIIF";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/composing`;
    await waitFor(() => expect(events()).toHaveLength(2));
    expect(events()[1].page_title).toBe("Composing layouts – Clover IIIF");
  });

  it("does not load a container or queue events on another origin", () => {
    render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://clover.iiif.library.northwestern.edu"
      />,
    );
    expect(target.dataLayer).toBeUndefined();
  });

  it("skips noindex pages and counts a later visit to a public page", () => {
    const view = render(tracker());
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, follow, noimageindex";
    document.head.append(robots);
    route.pathname = "/test/viewer";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/test/viewer`;
    view.rerender(tracker());
    expect(events()).toHaveLength(1);
    robots.remove();
    route.pathname = "/";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    view.rerender(tracker());
    expect(events()).toHaveLength(2);
  });

  it("does not initialize on an unlisted page", () => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    route.pathname = "/docs/agents";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/agents`;
    render(tracker());
    expect(target.dataLayer).toBeUndefined();
  });
});

describe("Tag Manager configuration", () => {
  it("allows an unset container and rejects measurement IDs or markup", () => {
    expect(tagManagerId()).toBeUndefined();
    expect(tagManagerId(" ")).toBeUndefined();
    expect(tagManagerId(" GTM-TEST123 ")).toBe("GTM-TEST123");
    expect(() => tagManagerId("G-TEST123")).toThrow("NEXT_PUBLIC_GTM_ID");
    expect(() => tagManagerId("GTM-TEST</script>")).toThrow(
      "NEXT_PUBLIC_GTM_ID",
    );
  });

  it("strips queries and fragments from referrers and ignores invalid URLs", () => {
    expect(pageReferrer("https://example.org/docs?q=private#fragment")).toBe(
      "https://example.org/docs",
    );
    expect(pageReferrer("")).toBe("");
    expect(pageReferrer("javascript:alert(1)")).toBe("");
  });
});

describe("homepage resource opens", () => {
  const manifest = "https://collections.example.org/manifest.json?as=iiif";

  it("records a shared resource once after its page view, including in Strict Mode", () => {
    route.query = { "iiif-content": manifest, accent: "private", t: "gallery" };
    render(tracker());
    expect(resources()).toEqual([
      {
        event: "clover_resource_open",
        resource_location: `${siteUrl}?iiif-content=${encodeURIComponent(manifest)}`,
        resource_host: "collections.example.org",
        resource_input: "url",
      },
    ]);
    expect(events()).toHaveLength(1);
    expect(target.dataLayer?.at(-2)?.event).toBe("clover_page_view");
    expect(JSON.stringify(target.dataLayer)).not.toContain("private");
  });

  it("counts new choices and returning to a resource, without adding page views", () => {
    const view = render(tracker());
    expect(resources()).toHaveLength(0); // The default demo is not an explicit open.
    for (const content of [manifest, manifest, `${manifest}/other`, manifest]) {
      route.query = { "iiif-content": content };
      view.rerender(tracker());
    }
    expect(resources()).toHaveLength(3);
    expect(events()).toHaveLength(1);
    route.query = { "iiif-content": manifest, t: "gallery", accent: "blue" };
    view.rerender(tracker());
    expect(resources()).toHaveLength(3);
    route.query = {};
    view.rerender(tracker());
    route.query = { "iiif-content": manifest };
    view.rerender(tracker());
    expect(resources()).toHaveLength(4);
  });

  it("ignores other pages, invalid inputs, and repeated query parameters", () => {
    const view = render(tracker());
    for (const content of [
      "",
      "private",
      "javascript:alert(1)",
      [manifest, manifest],
    ]) {
      route.query = { "iiif-content": content };
      view.rerender(tracker());
    }
    route.pathname = "/docs/viewer";
    route.query = { "iiif-content": manifest };
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/viewer`;
    view.rerender(tracker());
    expect(resources()).toHaveLength(0);
  });

  it("waits for homepage metadata when arriving from another docs page", async () => {
    route.pathname = "/docs/viewer";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/viewer`;
    const view = render(tracker());
    route.pathname = "/";
    route.query = { "iiif-content": manifest };
    view.rerender(tracker());
    expect(resources()).toHaveLength(0);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    await waitFor(() => expect(resources()).toHaveLength(1));
    expect(events()).toHaveLength(2);
  });

  it("does not record resources on another origin or a noindex page", () => {
    route.query = { "iiif-content": manifest };
    const view = render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://example.org"
      />,
    );
    expect(target.dataLayer).toBeUndefined();
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    view.rerender(tracker());
    expect(target.dataLayer).toBeUndefined();
  });

  it("keeps long resource URLs in page_location, without credentials or selectors", () => {
    const path = `/iiif/${"a".repeat(130)}/manifest.json?as=iiif`;
    const event = resourceOpen(
      `https://user:password@example.org${path}#xywh=1,2,3,4`,
      siteUrl,
    )!;
    expect(
      new URL(event.resource_location).searchParams.get("iiif-content"),
    ).toBe(`https://example.org${path}`);
    expect(event.resource_host).toBe("example.org");
    expect(event.resource_input).toBe("url");
    expect(event.resource_location).not.toContain("password");
    expect(event.resource_location).not.toContain("xywh");
  });

  it("identifies the parent Manifest of an encoded content state, without sending its annotation", () => {
    const state = btoa(
      encodeURIComponent(
        JSON.stringify({
          type: "Annotation",
          body: { value: "annotation text stays in the browser" },
          target: [
            {
              id: "https://example.org/canvas#xywh=1,2,3,4",
              type: "Canvas",
              partOf: [{ id: manifest, type: "Manifest" }],
            },
          ],
        }),
      ),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    route.query = { "iiif-content": state };
    render(tracker());
    expect(resources()).toEqual([
      {
        event: "clover_resource_open",
        resource_location: `${siteUrl}?iiif-content=${encodeURIComponent(manifest)}`,
        resource_host: "collections.example.org",
        resource_input: "content_state",
      },
    ]);
    expect(JSON.stringify(target.dataLayer)).not.toContain("annotation");
    expect(JSON.stringify(target.dataLayer)).not.toContain(state);
  });
});

describe("homepage template changes", () => {
  const changes = () =>
    (target.dataLayer ?? []).filter(
      (item) => item.event === "clover_template_change",
    );

  it("records each toggle and its previous value, including a return to Default", () => {
    const view = render(tracker());
    expect(changes()).toHaveLength(0);
    for (const template of ["document", "gallery", undefined]) {
      route.query = template ? { t: template } : {};
      view.rerender(tracker());
    }
    expect(changes()).toEqual([
      {
        event: "clover_template_change",
        template: "document",
        previous_template: "default",
      },
      {
        event: "clover_template_change",
        template: "gallery",
        previous_template: "document",
      },
      {
        event: "clover_template_change",
        template: "default",
        previous_template: "gallery",
      },
    ]);
    expect(events()).toHaveLength(1);
    expect(resources()).toHaveLength(0);
  });

  it("does not count the initial choice before or after query hydration", () => {
    route.isReady = false;
    const view = render(tracker());
    route.isReady = true;
    route.query = { t: "gallery" };
    view.rerender(tracker());
    expect(changes()).toHaveLength(0);
    route.query = { t: "document" };
    view.rerender(tracker());
    expect(changes()).toEqual([
      {
        event: "clover_template_change",
        template: "document",
        previous_template: "gallery",
      },
    ]);
  });

  it("ignores resource, accent, invalid template and repeated-selection changes", () => {
    const view = render(tracker());
    for (const query of [
      { t: "default" },
      { "iiif-content": "https://example.org/manifest.json" },
      { accent: "blue" },
      { t: "unexpected" },
      { t: ["document", "gallery"] },
      {},
    ]) {
      route.query = query;
      view.rerender(tracker());
    }
    expect(changes()).toHaveLength(0);
    route.query = { t: "document" };
    view.rerender(tracker());
    view.rerender(tracker());
    expect(changes()).toHaveLength(1);
    expect(events()).toHaveLength(1);
  });

  it("starts a fresh baseline after returning from a different docs page", () => {
    route.query = { t: "document" };
    const view = render(tracker());
    route.pathname = "/docs/viewer";
    route.query = { t: "gallery" };
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs/viewer`;
    view.rerender(tracker());
    route.pathname = "/";
    route.query = {};
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    view.rerender(tracker());
    expect(changes()).toHaveLength(0);
    route.query = { t: "gallery" };
    view.rerender(tracker());
    expect(changes()).toEqual([
      {
        event: "clover_template_change",
        template: "gallery",
        previous_template: "default",
      },
    ]);
  });

  it("does not record toggles on another origin or a noindex page", () => {
    const view = render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://example.org"
      />,
    );
    route.query = { t: "gallery" };
    view.rerender(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://example.org"
      />,
    );
    expect(target.dataLayer).toBeUndefined();
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    view.rerender(tracker());
    route.query = { t: "document" };
    view.rerender(tracker());
    expect(target.dataLayer).toBeUndefined();
  });
});

describe("reaching the homepage install section", () => {
  const reaches = () =>
    (target.dataLayer ?? []).filter(
      (item) => item.event === "clover_install_view",
    );
  const observed: {
    callback: IntersectionObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  let install: HTMLDivElement;

  beforeEach(() => {
    observed.length = 0;
    install = document.createElement("div");
    install.id = "install";
    install.textContent = "npm install @nulib/clover";
    document.body.append(install);
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observed.push(this);
        }
      },
    );
  });

  const intersect = (
    ratio: number,
    observer = observed.at(-1)!,
    visible = true,
  ) => {
    observer.callback(
      [
        {
          target: install,
          isIntersecting: visible,
          intersectionRatio: ratio,
          boundingClientRect: install.getBoundingClientRect(),
          intersectionRect: install.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        },
      ],
      observer as unknown as IntersectionObserver,
    );
  };

  it("counts one reach at half visibility, without adding page views", () => {
    const view = render(tracker());
    expect(observed.at(-1)!.observe).toHaveBeenCalledWith(install);
    intersect(0.49);
    intersect(1, observed.at(-1), false);
    expect(reaches()).toHaveLength(0);
    intersect(0.5);
    intersect(0);
    intersect(1);
    route.query = {
      t: "gallery",
      "iiif-content": "https://example.org/manifest.json",
    };
    view.rerender(tracker());
    intersect(1);
    expect(reaches()).toEqual([{ event: "clover_install_view" }]);
    expect(observed.at(-1)!.disconnect).toHaveBeenCalled();
    expect(events()).toHaveLength(1);
  });

  it("waits for a target mounted after the page metadata", async () => {
    install.remove();
    render(tracker());
    expect(observed).toHaveLength(0);
    document.body.append(install);
    await waitFor(() => expect(observed).toHaveLength(1));
    intersect(1);
    expect(reaches()).toHaveLength(1);
  });

  it("counts another reach on a later visit and ignores callbacks from the previous visit", () => {
    const view = render(tracker());
    intersect(1);
    const first = observed.at(-1)!;
    route.pathname = "/docs";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs`;
    view.rerender(tracker());
    intersect(1, first);
    expect(reaches()).toHaveLength(1);
    route.pathname = "/";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    view.rerender(tracker());
    intersect(1);
    expect(reaches()).toHaveLength(2);
    expect(events()).toHaveLength(3);
  });

  it("does not observe other origins, other pages, or an initially noindex page", () => {
    const view = render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://example.org"
      />,
    );
    expect(observed).toHaveLength(0);
    route.pathname = "/docs";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs`;
    view.rerender(tracker());
    expect(observed).toHaveLength(0);
    route.pathname = "/";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    view.rerender(tracker());
    expect(observed).toHaveLength(0);
    expect(reaches()).toHaveLength(0);
  });

  it("checks the current page policy before recording and stops observing on unmount", () => {
    const view = render(tracker());
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    intersect(1);
    expect(reaches()).toHaveLength(0);
    robots.remove();
    view.unmount();
    intersect(1);
    expect(reaches()).toHaveLength(0);
    expect(observed.at(-1)!.disconnect).toHaveBeenCalled();
  });
});

describe("homepage section CTA clicks", () => {
  const clicks = () =>
    (target.dataLayer ?? []).filter(
      (item) => item.event === "clover_cta_click",
    );
  let links: HTMLAnchorElement[];

  beforeEach(() => {
    const fixture = document.createElement("div");
    fixture.id = "cta-fixture";
    const labels = [
      "Get started",
      "See all 25 components",
      "Read the docs",
      "Get started",
    ];
    links = ["templates", "components", "why_clover", "install"].map(
      (section, index) => {
        const link = document.createElement("a");
        link.href = `${siteUrl}${section === "components" ? "/docs/body" : "/docs"}?private=secret#selection`;
        link.dataset.ctaSection = section;
        link.textContent = labels[index];
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = " →";
        link.append(arrow);
        // Like Next, this runs after the capture listener. Keep JSDOM on this page.
        link.addEventListener("click", (event) => event.preventDefault());
        link.addEventListener("auxclick", (event) => event.preventDefault());
        fixture.append(link);
        return link;
      },
    );
    document.body.append(fixture);
  });

  it("distinguishes all four CTAs and both Get started links, including nested arrow clicks", () => {
    render(tracker());
    for (const link of links) fireEvent.click(link.querySelector("span")!);
    expect(clicks()).toEqual([
      {
        event: "clover_cta_click",
        cta_section: "templates",
        cta_label: "Get started",
        link_url: `${siteUrl}/docs`,
      },
      {
        event: "clover_cta_click",
        cta_section: "components",
        cta_label: "See all 25 components",
        link_url: `${siteUrl}/docs/body`,
      },
      {
        event: "clover_cta_click",
        cta_section: "why_clover",
        cta_label: "Read the docs",
        link_url: `${siteUrl}/docs`,
      },
      {
        event: "clover_cta_click",
        cta_section: "install",
        cta_label: "Get started",
        link_url: `${siteUrl}/docs`,
      },
    ]);
    expect(events()).toHaveLength(1);
    expect(JSON.stringify(clicks())).not.toContain("secret");
  });

  it("counts Enter-style, modified and middle clicks once, ignoring canceled and right clicks", () => {
    render(tracker());
    fireEvent.click(links[0], { detail: 0 });
    fireEvent.click(links[0], { ctrlKey: true });
    fireEvent(
      links[0],
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    fireEvent(
      links[0],
      new MouseEvent("auxclick", { bubbles: true, button: 2 }),
    );
    fireEvent.click(links[0], { button: 1 });
    const canceled = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    canceled.preventDefault();
    fireEvent(links[0], canceled);
    expect(clicks()).toHaveLength(3);
  });

  it("ignores unmarked links, unknown sections and non-link controls", () => {
    render(tracker());
    links[0].removeAttribute("data-cta-section");
    links[1].dataset.ctaSection = "not-a-section";
    fireEvent.click(links[0]);
    fireEvent.click(links[1]);
    fireEvent.click(document.body);
    expect(clicks()).toHaveLength(0);
  });

  it("checks current indexing policy and ignores other origins", () => {
    const view = render(
      <GoogleTagManager
        containerId="GTM-TEST123"
        siteUrl="https://example.org"
      />,
    );
    fireEvent.click(links[0]);
    expect(target.dataLayer).toBeUndefined();
    view.rerender(tracker());
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    fireEvent.click(links[0]);
    expect(clicks()).toHaveLength(0);
    robots.remove();
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs`;
    fireEvent.click(links[0]);
    expect(clicks()).toHaveLength(0);
  });

  it("removes the listener off the homepage and reinstalls it once on return", () => {
    const view = render(tracker());
    route.pathname = "/docs";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      `${siteUrl}/docs`;
    view.rerender(tracker());
    fireEvent.click(links[0]);
    expect(clicks()).toHaveLength(0);
    route.pathname = "/";
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href =
      siteUrl;
    view.rerender(tracker());
    fireEvent.click(links[0]);
    expect(clicks()).toHaveLength(1);
    view.unmount();
    fireEvent.click(links[0]);
    expect(clicks()).toHaveLength(1);
  });
});
