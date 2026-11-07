import { render, screen } from "@testing-library/react";
import React from "react";

import ttbJson from "../../../fixtures/iiif-cookbook/0010-book-2-viewing-direction-ttb.json";

/*
 * A vertical slider's styles load apart (`ItemsView`), and once in they stay in for the
 * page, so each test takes Clover afresh.
 */
async function freshClover() {
  vi.resetModules();
  return import("../../../index");
}

/** Calls `arrived` for each `.clover-items` put in `host`, as it arrives. */
function watchItems(host: HTMLElement, arrived: () => void) {
  const observer = new MutationObserver((records) => {
    for (const { addedNodes } of records)
      for (const node of addedNodes)
        if (node instanceof HTMLElement)
          for (const each of [node, ...node.querySelectorAll("*")])
            if (each.classList.contains("clover-items")) arrived();
  });
  observer.observe(host, { childList: true, subtree: true });
  return () => observer.disconnect();
}

afterEach(() => {
  vi.doUnmock("./ItemsVertical");
});

describe("a vertical slider's styles, loaded apart", () => {
  it("draws nothing until they are in, never a row first", async () => {
    let loaded = false;
    vi.doMock("./ItemsVertical", () => {
      loaded = true;
      return { default: "items-vertical" };
    });
    const Clover = await freshClover();
    const host = document.body.appendChild(document.createElement("div"));
    // Whether the styles were in as each slider arrived.
    const styled: boolean[] = [];
    const stop = watchItems(host, () => styled.push(loaded));
    render(
      <Clover.Root iiifContent={ttbJson}>
        <Clover.Items orientation="vertical" />
      </Clover.Root>,
      { container: host },
    );
    await screen.findAllByRole("option");
    stop();
    expect(styled).toEqual([true]);
    expect(host.querySelector(".clover-items")).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("is a row where they cannot load", async () => {
    vi.doMock("./ItemsVertical", () => {
      throw new Error("Offline");
    });
    const Clover = await freshClover();
    const { container } = render(
      <Clover.Root iiifContent={ttbJson}>
        <Clover.Items orientation="vertical" />
      </Clover.Root>,
    );
    await screen.findAllByRole("option");
    expect(container.querySelector(".clover-items")).not.toHaveAttribute(
      "data-orientation",
    );
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });
});
