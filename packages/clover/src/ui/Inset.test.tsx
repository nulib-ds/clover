import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useEffect } from "react";

import { Inset } from "./Inset";
import { Body, Root } from "../parts";
import bookJson from "../fixtures/iiif-cookbook/0009-book-1.json";

// Mat, 2026-11-14: "it holds a thumb, and expands targeted content".
describe("Inset", () => {
  it("holds a thumb that a press anywhere but its buttons expands, its expand button the keyboard's way", () => {
    const expand = vi.fn();
    const close = vi.fn();
    const { container } = render(
      <Inset
        label="Expand map"
        expandId="swap"
        controls="target"
        onExpand={expand}
        actions={
          <button type="button" onClick={close}>
            Close
          </button>
        }
      >
        <span className="thumb">A thumb</span>
      </Inset>,
    );
    const box = container.firstElementChild!;
    expect(box).toHaveClass("clover-inset");
    // Its expand button, named for what a press does, aimed at what it expands.
    const button = screen.getByRole("button", { name: "Expand map" });
    expect(button).toHaveAttribute("id", "swap");
    expect(button).toHaveAttribute("aria-controls", "target");
    fireEvent.click(button);
    expect(expand).toHaveBeenCalledTimes(1);
    // A press on its thumb expands it too; one on its own other controls does not.
    fireEvent.click(box.querySelector(".thumb")!);
    expect(expand).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(expand).toHaveBeenCalledTimes(2);
  });

  it("expanded, holds its content as it is, with no box or buttons, never remounting it", () => {
    let mounts = 0;
    function Content() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p>The map</p>;
    }
    const expand = vi.fn();
    const view = (expanded: boolean) => (
      <Inset
        expanded={expanded}
        className="host"
        label="Expand map"
        expandId="swap"
        onExpand={expand}
      >
        <Content />
      </Inset>
    );
    const { container, rerender } = render(view(true));
    const box = container.firstElementChild!;
    expect(box).toHaveClass("host");
    expect(box).not.toHaveClass("clover-inset");
    expect(screen.queryByRole("button")).toBeNull();
    // Expanded, a press on it is its content's.
    fireEvent.click(screen.getByText("The map"));
    expect(expand).not.toHaveBeenCalled();
    // Small and back: the same content throughout.
    rerender(view(false));
    expect(container.firstElementChild).toHaveClass("clover-inset");
    rerender(view(true));
    expect(mounts).toBe(1);
  });

  // Mat, 2026-11-14: "This is a little too far off the controls above it." (Document's map
  // lies in its Canvas in the full viewer, under the Canvas's controls and their Tips.)
  it("lies in a container given it, and moves to another keeping what it holds", () => {
    let mounts = 0;
    function Content() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p>The map</p>;
    }
    const first = document.createElement("section");
    const second = document.createElement("figure");
    const caption = document.createElement("figcaption");
    second.append(caption);
    document.body.append(first, second);
    const view = (container: Element) => (
      <Inset
        label="Expand map"
        expandId="swap"
        onExpand={() => {}}
        container={container}
      >
        <Content />
      </Inset>
    );
    const { container, rerender, unmount } = render(view(first));
    // Not where it is written, but in its container.
    expect(container.querySelector(".clover-inset")).toBeNull();
    expect(first.querySelector(".clover-inset")).not.toBeNull();
    // Moved, the same content, before a figure's last caption.
    rerender(view(second));
    expect(first.querySelector(".clover-inset")).toBeNull();
    const box = second.querySelector(".clover-inset")!;
    expect(box.parentElement!.nextElementSibling).toBe(caption);
    expect(mounts).toBe(1);
    // Gone with it.
    unmount();
    expect(second.querySelector(".clover-inset")).toBeNull();
    first.remove();
    second.remove();
  });

  // Mat, 2026-11-14: "Yes, add it" (`container="body"`).
  it("lies in its Root's Body, in the box its view is drawn in, and moves out keeping what it holds", async () => {
    let mounts = 0;
    function Content() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p>The map</p>;
    }
    const elsewhere = document.createElement("section");
    document.body.append(elsewhere);
    const view = (container: Element | "body") => (
      <Root iiifContent={bookJson as never}>
        <Body />
        <Inset
          label="Expand map"
          expandId="swap"
          onExpand={() => {}}
          container={container}
        >
          <Content />
        </Inset>
      </Root>
    );
    const { container, rerender } = render(view("body"));
    // In the Canvas's box, under its controls, once the Body has drawn.
    await waitFor(() =>
      expect(
        container.querySelector(".clover-body > .clover-canvas .clover-inset"),
      ).not.toBeNull(),
    );
    // Moved elsewhere and back, the same content throughout.
    rerender(view(elsewhere));
    expect(elsewhere.querySelector(".clover-inset")).not.toBeNull();
    rerender(view("body"));
    await waitFor(() =>
      expect(
        container.querySelector(".clover-body > .clover-canvas .clover-inset"),
      ).not.toBeNull(),
    );
    expect(mounts).toBe(1);
    elsewhere.remove();
  });
});
