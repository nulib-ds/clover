import { render, screen } from "@testing-library/react";
import React from "react";

import commentJson from "../fixtures/iiif-cookbook/0266-full-canvas-annotation.json";
import { initCloverI18n } from "../i18n";
import * as Clover from "../index";

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("useAnnotationPages", () => {
  it("reads each AnnotationPage with its annotations, as useAnnotationSets did", async () => {
    function Pages() {
      const pages = Clover.useAnnotationPages();
      return (
        <p>
          {pages.length} {pages[0]?.entries.length ?? 0} {pages[0]?.id}
        </p>
      );
    }
    render(
      <Clover.Root iiifContent={commentJson}>
        <Pages />
      </Clover.Root>,
    );
    expect(
      await screen.findByText(`1 1 ${commentJson.items[0].annotations[0].id}`),
    ).toBeInTheDocument();
    // The old name is the same hook.
    expect(Clover.useAnnotationSets).toBe(Clover.useAnnotationPages);
  });

  it("with listed, leaves out the pages that start hidden, a still Canvas's OCR", async () => {
    const canvas = commentJson.items[0];
    const ocr = {
      id: `${canvas.id}/ocr`,
      type: "AnnotationPage",
      items: [
        {
          id: `${canvas.id}/ocr/1`,
          type: "Annotation",
          motivation: "supplementing",
          body: { type: "TextualBody", value: "A line read by machine" },
          target: `${canvas.id}#xywh=10,10,200,20`,
        },
      ],
    };
    const manifest = {
      ...commentJson,
      id: "https://example.org/ocr.json",
      items: [{ ...canvas, annotations: [...(canvas.annotations ?? []), ocr] }],
    };
    function Pages() {
      const all = Clover.useAnnotationPages();
      const listed = Clover.useAnnotationPages({ listed: true });
      return (
        <p>
          {all.length} {listed.length} {listed[0]?.id}
        </p>
      );
    }
    render(
      <Clover.Root iiifContent={manifest}>
        <Pages />
      </Clover.Root>,
    );
    expect(
      await screen.findByText(`2 1 ${commentJson.items[0].annotations[0].id}`),
    ).toBeInTheDocument();
  });
});
