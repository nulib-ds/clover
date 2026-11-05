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
});
