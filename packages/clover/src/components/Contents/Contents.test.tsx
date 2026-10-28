import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import React from "react";

import tocJson from "../../fixtures/iiif-cookbook/0024-book-4-toc.json";
import articlesJson from "../../fixtures/iiif-cookbook/0025-newspaper-article-index.json";
import operaJson from "../../fixtures/iiif-cookbook/0026-toc-opera.json";
import behaviorsJson from "../../fixtures/iiif-cookbook/0229-behavior-ranges.json";
import { initCloverI18n } from "../../i18n";
import * as Clover from "../../index";

beforeEach(() => initCloverI18n({ lng: "en" }));

describe("Contents", () => {
  it("nests the Ranges, marks where the reader is, and goes to an entry", async () => {
    render(
      <Clover.Root iiifContent={tocJson}>
        <Clover.Label of="canvas" data-testid="canvas" />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const lists = nav.querySelectorAll("ol");
    expect(lists.length).toBe(2);
    const first = within(nav).getAllByRole("button")[0];
    expect(first).toHaveTextContent("Tabiba Tabiban");
    expect(first).toHaveAttribute("aria-current", "true");

    // Monday is under Arede'et, closed until opened.
    fireEvent.click(
      within(nav).getByRole("button", { name: /^Sections in Arede'et/ }),
    );
    fireEvent.click(within(nav).getByRole("button", { name: "Monday" }));
    expect(within(nav).getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(first).not.toHaveAttribute("aria-current");
  });

  it("opens and closes an entry's entries, the current one's open from the root", async () => {
    render(
      <Clover.Root iiifContent={tocJson}>
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    // A disclosure, named for its entry, each part in its own language.
    const toggle = within(nav).getByRole("button", {
      name: /^Sections in Arede'et/,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const list = document.getElementById(
      toggle.getAttribute("aria-controls")!,
    )!;
    expect(list).not.toBeVisible();
    expect(within(nav).queryByRole("button", { name: "Monday" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(list).toBeVisible();
    fireEvent.click(toggle);
    expect(list).not.toBeVisible();

    // Going to Tuesday from elsewhere (Items, the arrows) opens the way to it.
    fireEvent.click(toggle);
    fireEvent.click(within(nav).getByRole("button", { name: "Tuesday" }));
    fireEvent.click(toggle);
    expect(list).not.toBeVisible();
    fireEvent.click(
      within(nav).getByRole("button", { name: /^Tabiba Tabiban/ }),
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("starts with the way to the current entry open, marked to the root", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={tocJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const toggle = within(nav).getByRole("button", {
      name: /^Sections in Arede'et/,
    });
    const tuesday = tocJson.structures[0].items[1].items[1] as any;
    act(() => clover.goTo(tuesday.items[0].id));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(nav).getByRole("button", { name: "Tuesday" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      within(nav).getByRole("button", { name: /^Arede'et/ }),
    ).toHaveAttribute("data-trail", "true");
  });

  it("keeps a branch the reader closed while the current entry moves within it", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={tocJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const toggle = within(nav).getByRole("button", {
      name: /^Sections in Arede'et/,
    });
    const [monday, tuesday] = (tocJson.structures[0].items[1] as any).items;
    act(() => clover.goTo(monday.items[0].id));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    act(() => clover.goTo(tuesday.items[0].id));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // Cookbook 0025: an article's columns, page 2 then page 5, in its Range's order.
  it("steps through an article's parts in its reading order, each region selected", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={articlesJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const page = (n: number) => (articlesJson.items[n - 1] as any).id;
    const state = () => clover.store.get();
    // The Root reads the regions its Ranges name as it shows the Manifest.
    await vi.waitFor(() => expect(state().regions).not.toBeNull());
    fireEvent.click(
      within(nav).getByRole("button", { name: "Tagesneuigkeiten" }),
    );
    expect(state().canvasId).toBe(page(2));
    expect(state().annotationId).toMatch(/#region-1$/);
    const next = within(nav).getByRole("button", { name: "Next" });
    expect(nav.querySelector(".clover-steps-position")).toHaveTextContent(
      "1 / 4",
    );
    fireEvent.click(next);
    expect(state().annotationId).toMatch(/#region-2$/);
    expect(state().canvasId).toBe(page(2));
    fireEvent.click(next);
    expect(state().canvasId).toBe(page(5));
    expect(nav.querySelector(".clover-steps-position")).toHaveTextContent(
      "3 / 4",
    );
    // A region picked on the Canvas is the place too.
    act(() => clover.selectAnnotation(state().annotationId.replace(/3$/, "4")));
    expect(nav.querySelector(".clover-steps-position")).toHaveTextContent(
      "4 / 4",
    );
    // The other article has no step while it is not the current one.
    expect(nav.querySelectorAll(".clover-steps")).toHaveLength(1);
    // Its regions are a set a page may hide, as a search's hits are.
    act(() => clover.setSetVisible(Clover.CONTENTS_SET_ID, false));
    expect(state().hiddenSets).toContain(Clover.CONTENTS_SET_ID);
  });

  it("goes to an article's parts by their regions before the Root has read them", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={articlesJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const page = (n: number) => (articlesJson.items[n - 1] as any).id;
    // Read, then taken away: as a step taken before they arrive finds them.
    await vi.waitFor(() => expect(clover.store.get().regions).not.toBeNull());
    act(() => clover.store.set({ regions: null }));
    fireEvent.click(
      within(nav).getByRole("button", { name: "Tagesneuigkeiten" }),
    );
    expect(clover.store.get().canvasId).toBe(page(2));
    expect(clover.store.get().target?.region).toEqual({
      x: 553,
      y: 1157,
      w: 470,
      h: 1103,
    });
  });

  it("marks each entry with the language of its label", async () => {
    render(
      <Clover.Root iiifContent={operaJson}>
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    // On the recording's time, each leads with it, its label carrying the language.
    const first = within(nav).getByRole("button", {
      name: /^0:\d\d Atto Primo$/,
    });
    expect(first.querySelector(".clover-cue-time")).toBeInTheDocument();
    expect(first.querySelector(".clover-cue-text")).toHaveAttribute(
      "lang",
      "it",
    );
    // An entry in a branch still closed carries its language too.
    expect(
      within(nav)
        .getByRole("button", { name: /Remainder of Atto Primo$/, hidden: true })
        .querySelector(".clover-cue-text"),
    ).toHaveAttribute("lang", "en");
  });

  /*
   * One highlight with the seek bar, through the Root: hovering or focusing an entry
   * names its Range there, and the chapter under the pointer there marks its entry.
   */
  it("shares the chapter hovered with the seek bar", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={operaJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const act1 = within(nav).getByRole("button", {
      name: /^\d+:\d\d Atto Primo$/,
    });
    fireEvent.mouseEnter(act1);
    const id = clover.chapter.get();
    expect(id).toEqual(expect.stringContaining("http"));
    expect(act1).toHaveAttribute("data-highlighted", "true");
    fireEvent.mouseLeave(act1);
    expect(clover.chapter.get()).toBeNull();
    expect(act1).not.toHaveAttribute("data-highlighted");

    // From the seek bar.
    act(() => clover.chapter.emit(id));
    expect(act1).toHaveAttribute("data-highlighted", "true");
  });

  // Cookbook 0229: the current entry's Range thumbnail under its time and label, unnamed;
  // the other entries none.
  it("shows the current entry's thumbnail, and no other's", async () => {
    let clover: any;
    const Spy = () => {
      clover = Clover.useClover("Spy").clover;
      return null;
    };
    render(
      <Clover.Root iiifContent={behaviorsJson}>
        <Spy />
        <Clover.Contents />
      </Clover.Root>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    expect(nav.querySelectorAll("img")).toHaveLength(0);
    // Playing at 6:00, in the second chapter.
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { value: 360 });
    act(() => clover.media.emit(video));
    const second = within(nav).getByRole("button", {
      name: /^5:05 305s – 610s$/,
    });
    const picture = await waitFor(() => {
      expect(second).toHaveAttribute("aria-current", "true");
      const found = second.querySelector("img.clover-entry-thumbnail");
      expect(found).not.toBeNull();
      return found!;
    });
    expect(picture).toHaveAttribute("alt", "");
    expect(picture).toHaveAttribute(
      "src",
      "https://fixtures.iiif.io/video/indiana/donizetti-elixir/thumbnails/thumb-nav-02.png",
    );
    // After its time and label, and named by them alone.
    expect(picture.previousElementSibling).toHaveClass("clover-cue-text");
    expect(nav.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders nothing without structures", async () => {
    render(
      <Clover.Root iiifContent={{ ...tocJson, structures: undefined }}>
        <Clover.Label as="h1" />
        <Clover.Contents />
      </Clover.Root>,
    );
    await screen.findByRole("heading");
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
