import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";

import CaptionDetails from "../Body/CaptionDetails";
import * as Clover from "../../parts";
import { Summary, Thumbnail } from "./Primitives";

const manifest = {
  id: "https://example.org/manifest",
  type: "Manifest",
  label: { fr: ["Carte d'Evanston"] },
  thumbnail: [{ id: "https://example.org/thumb.jpg", type: "Image" }],
};

describe("Thumbnail", () => {
  it("marks its default alt, the label, with the label's language", () => {
    render(<Thumbnail value={manifest} />);
    expect(
      screen.getByRole("img", { name: "Carte d'Evanston" }),
    ).toHaveAttribute("lang", "fr");
  });

  it("leaves a consumer's own alt unmarked", () => {
    render(<Thumbnail value={manifest} alt="" />);
    const img = document.querySelector("img.clover-thumbnail");
    expect(img).toHaveAttribute("alt", "");
    expect(img).not.toHaveAttribute("lang");
  });

  // Its room from the first, so nothing beside it moves as its image comes (2026-11-20).
  it("keeps its shape's room, unseen and unheard, while its image is found", async () => {
    let answer!: (response: Response) => void;
    const fetch = vi.fn(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );
    const service = "https://example.org/iiif/thumbnail-room";
    const canvas = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/canvas",
      type: "Canvas",
      label: { en: ["Plate"] },
      width: 3000,
      height: 2000,
      items: [
        {
          id: "https://example.org/page",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/painting",
              type: "Annotation",
              motivation: "painting",
              target: "https://example.org/canvas",
              body: {
                id: `${service}/full/max/0/default.jpg`,
                type: "Image",
                service: [{ id: service, type: "ImageService3" }],
              },
            },
          ],
        },
      ],
    };
    render(
      <Clover.Root iiifContent={canvas} request={{ fetch }}>
        <Thumbnail of="canvas" size={300} className="mine" />
      </Clover.Root>,
    );
    const room = await waitFor(() => {
      const found = document.querySelector("svg.clover-thumbnail.mine");
      expect(found).not.toBeNull();
      return found!;
    });
    expect(room).toHaveAttribute("aria-hidden", "true");
    expect(room).toHaveAttribute("width", "300");
    expect(room).toHaveAttribute("height", "200");
    expect(room).toHaveAttribute("viewBox", "0 0 300 200");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    answer(
      new Response(
        JSON.stringify({
          id: service,
          type: "ImageService3",
          protocol: "http://iiif.io/api/image",
          profile: "level2",
          width: 3000,
          height: 2000,
        }),
      ),
    );
    const img = await screen.findByRole("img", { name: "Plate" });
    expect(img).toHaveAttribute("width", "300");
    expect(img).toHaveAttribute("height", "200");
    expect(document.querySelector("svg.clover-thumbnail")).toBeNull();
  });
});

/*
 * A Canvas's information box draws its summary with a copy of Summary's, in the Canvas's
 * `language` (`Body/CaptionDetails.tsx`): a shared component cost more than the copy
 * (2026-10-29), so this holds the two to the same markup.
 */
describe("Summary and a Canvas's information box", () => {
  const shape = (root: HTMLElement) => {
    const summary = root.querySelector(".clover-summary")!;
    return {
      element: summary.tagName,
      lang: summary.getAttribute("lang"),
      dir: summary.getAttribute("dir"),
      html: summary.innerHTML,
      around: summary.parentElement?.className,
    };
  };

  it("draw a summary alike: its element, language, markup and Read more", async () => {
    // Paragraphs of its own (Cookbook 0007), in a language written right to left.
    const summary = { ar: ["<p>الأول</p><p>الثاني</p>"] };
    const part = render(<Summary value={summary} />).container;
    const box = render(<CaptionDetails summary={summary} />).container;
    await waitFor(() =>
      expect(part.querySelector(".clover-summary")?.tagName).toBe("DIV"),
    );
    await waitFor(() =>
      expect(box.querySelector(".clover-summary")?.tagName).toBe("DIV"),
    );
    expect(shape(box)).toEqual(shape(part));
    expect(shape(part)).toMatchObject({ lang: "ar", dir: "rtl" });
  });

  it("draw nothing at all without one", () => {
    expect(
      render(<Summary value={{ en: [""] }} />).container,
    ).toBeEmptyDOMElement();
    expect(
      render(<CaptionDetails summary={{ en: [""] }} />).container.querySelector(
        ".clover-read-more",
      ),
    ).toBeNull();
  });
});

// JSDOM lays nothing out, so the stylesheet is read (WCAG 1.4.10, C33).
describe("Primitives.css", () => {
  it("wraps long unbroken values in Summary, Metadata and RequiredStatement", () => {
    const css = readFileSync(resolve(__dirname, "Primitives.css"), "utf8");
    expect(css).toMatch(
      /\.clover-summary,\s*:is\(\.clover-metadata, \.clover-required-statement\) :is\(dt, dd\) \{\s*overflow-wrap: anywhere;/,
    );
  });
});
