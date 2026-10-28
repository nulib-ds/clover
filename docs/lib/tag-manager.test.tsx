import React, { StrictMode } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GoogleTagManager from "docs/components/GoogleTagManager";
import { pageReferrer, tagManagerId } from "docs/lib/tag-manager";

const route = vi.hoisted(() => ({ pathname: "/" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("next/script", () => ({ default: () => null }));

type LayerWindow = Window & { dataLayer?: Record<string, unknown>[] };
const target = window as LayerWindow;
const siteUrl = `${window.location.origin}/clover`;
const events = () =>
  (target.dataLayer ?? []).filter((item) => item.event === "clover_page_view");
const tracker = () => (
  <StrictMode>
    <GoogleTagManager containerId="GTM-TEST123" siteUrl={siteUrl} />
  </StrictMode>
);

beforeEach(() => {
  route.pathname = "/";
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
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
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
