import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";

import { createPortal } from "react-dom";

import { Sections, type SectionsLayout, useSectionActions } from "./Sections";

const mounts: string[] = [];
function Body({ name }: { name: string }) {
  React.useEffect(() => {
    mounts.push(name);
  }, [name]);
  return <p>{name} body</p>;
}

const items = ["About", "Contents", "Notes"].map((name) => ({
  value: name.toLowerCase(),
  label: name,
  content: <Body name={name} />,
}));

const Layout = ({ layout }: { layout: SectionsLayout }) => (
  <Sections items={items} layout={layout} label="Information" />
);

beforeEach(() => {
  mounts.length = 0;
});

/** Content with a control of its own, put beside its heading where there is room. */
function WithAction() {
  const actions = useSectionActions();
  const control = <button type="button">Choose</button>;
  return (
    <>
      {actions ? createPortal(control, actions) : control}
      <p>Body</p>
    </>
  );
}

describe("Sections", () => {
  it("gives a section's content a place beside its heading as an accordion's box, none as a tab", () => {
    const sections = [
      { value: "one", label: "One", content: <WithAction /> },
      { value: "two", label: "Two", content: <p>Two</p> },
    ];
    const { rerender } = render(
      <Sections items={sections} layout="accordion" />,
    );
    const choose = screen.getByRole("button", { name: "Choose" });
    const heading = screen
      .getByRole("button", { name: "One" })
      .closest(".clover-sections-heading")!;
    // After the heading, before the region: in reading and tab order between them.
    expect(heading.nextElementSibling).toContainElement(choose);
    expect(screen.getByRole("region", { name: "One" })).not.toContainElement(
      choose,
    );
    // Shown only while its section is open.
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(heading.nextElementSibling).toHaveAttribute("hidden");

    rerender(<Sections items={sections} layout="tabs" />);
    fireEvent.click(screen.getByRole("tab", { name: "One" }));
    expect(screen.getByRole("tabpanel", { name: "One" })).toContainElement(
      screen.getByRole("button", { name: "Choose" }),
    );
  });

  describe("as tabs", () => {
    it("is a tablist of tabs, one panel open, one tab stop", () => {
      render(<Layout layout="tabs" />);
      const list = screen.getByRole("tablist", { name: "Information" });
      const tabs = within(list).getAllByRole("tab");
      expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
        "true",
        "false",
        "false",
      ]);
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
      expect(screen.getByRole("tabpanel", { name: "About" })).toHaveTextContent(
        "About body",
      );
      expect(screen.queryByText("Contents body")).toBeNull();
    });

    it("selects as the arrow keys move, and wraps", () => {
      render(<Layout layout="tabs" />);
      const [about, , notes] = screen.getAllByRole("tab");
      fireEvent.keyDown(about, { key: "ArrowLeft" });
      expect(notes).toHaveFocus();
      expect(notes).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("Notes body")).toBeVisible();
    });
  });

  describe("as an accordion", () => {
    it("keeps a lone box open: nothing else could open in its place", () => {
      const { container } = render(
        <Sections items={items.slice(0, 1)} layout="accordion" />,
      );
      const about = screen.getByRole("button", { name: "About" });
      expect(about).toHaveAttribute("aria-expanded", "true");
      expect(about).toHaveAttribute("aria-disabled", "true");
      expect(container.querySelector(".clover-sections-chevron")).toBeNull();
      fireEvent.click(about);
      expect(about).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("region", { name: "About" })).toBeVisible();
    });

    it("gives each box its place, and the list its count, to stack them until measured", () => {
      const { container } = render(<Layout layout="accordion" />);
      const list = container.querySelector<HTMLElement>(".clover-sections")!;
      expect(list.style.getPropertyValue("--clover-sections-count")).toBe("3");
      // On the box, so its heading and its panel's content both read it.
      const boxes = [
        ...container.querySelectorAll<HTMLElement>(".clover-sections-item"),
      ];
      expect(
        boxes.map((box) =>
          box.style.getPropertyValue("--clover-sections-index"),
        ),
      ).toEqual(["0", "1", "2"]);
    });

    describe("measuring the headings", () => {
      /** A ResizeObserver whose sizes a test reports. */
      class Observer {
        static all: Observer[] = [];
        targets: Element[] = [];
        disconnected = false;
        constructor(readonly callback: ResizeObserverCallback) {
          Observer.all.push(this);
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve(target: Element) {
          this.targets = this.targets.filter((each) => each !== target);
        }
        disconnect() {
          this.disconnected = true;
        }
        /** Border-box heights, for the targets given (all of them by default). */
        report(heights: number[], targets = this.targets) {
          this.callback(
            targets.map((target, index) => ({
              target,
              borderBoxSize: [{ blockSize: heights[index], inlineSize: 200 }],
            })) as unknown as ResizeObserverEntry[],
            this as unknown as ResizeObserver,
          );
        }
      }

      beforeEach(() => {
        Observer.all = [];
        vi.stubGlobal("ResizeObserver", Observer);
      });
      afterEach(() => {
        vi.unstubAllGlobals();
      });

      /** The observers measuring headings (an open box's own controls have another). */
      const headingObservers = () =>
        Observer.all.filter((each) =>
          each.targets.some((target) =>
            target.classList.contains("clover-sections-heading"),
          ),
        );

      const stacks = (container: HTMLElement) => ({
        total: container
          .querySelector<HTMLElement>(".clover-sections")!
          .style.getPropertyValue("--clover-sections-total"),
        boxes: [
          ...container.querySelectorAll<HTMLElement>(".clover-sections-item"),
        ].map((box) => [
          box.style.getPropertyValue("--clover-sections-before"),
          box.style.getPropertyValue("--clover-sections-after"),
        ]),
      });

      // WCAG 1.4.12 (a label wraps) and 2.4.11 (focus clears the stacks).
      it("writes the height of the headings before and after each box, as they wrap", () => {
        const { container } = render(<Layout layout="accordion" />);
        expect(headingObservers()).toHaveLength(1);
        const [observer] = headingObservers();
        expect(observer.targets).toEqual([
          ...container.querySelectorAll(".clover-sections-heading"),
        ]);

        observer.report([40, 50.5, 40]);
        expect(stacks(container)).toEqual({
          total: "130.5px",
          boxes: [
            ["0px", "90.5px"],
            ["40px", "40px"],
            ["90.5px", "0px"],
          ],
        });

        // One label rewraps onto two lines: only it is reported, and every sum follows.
        observer.report([70], [observer.targets[0]]);
        expect(stacks(container)).toEqual({
          total: "160.5px",
          boxes: [
            ["0px", "90.5px"],
            ["70px", "40px"],
            ["120.5px", "0px"],
          ],
        });
      });

      // WCAG 2.4.11, 1.4.10 and 1.4.12: in WebKit, stacks too tall overlap the open box.
      it("lets the headings scroll where the stacks would leave the open box no room", () => {
        const { container, rerender } = render(
          <div data-testid="pane" style={{ overflowY: "auto" }}>
            {/* JSDOM lays nothing out: the line, and the room the stacks keep, are set. */}
            <style>{`
              .clover-sections { line-height: 20px; }
              .clover-sections-heading { position: sticky; top: 10px; bottom: 10px; }
            `}</style>
            <Sections items={items} layout="accordion" />
          </div>,
        );
        const pane = screen.getByTestId("pane");
        let room = 200;
        Object.defineProperty(pane, "clientHeight", { get: () => room });
        const list = container.querySelector<HTMLElement>(".clover-sections")!;
        const [observer] = headingObservers();
        // The pane is watched, with the headings.
        expect(observer.targets[0]).toBe(pane);
        const headings = observer.targets.slice(1);

        // 200 less 20 at the edges and 130 of headings leaves 50: two lines and more.
        observer.report([40, 50, 40], headings);
        expect(list).not.toHaveAttribute("data-stacks");

        // A label wraps: 20 left, less than two lines, so they stop sticking.
        observer.report([70], [headings[0]]);
        expect(list).toHaveAttribute("data-stacks", "off");

        // The pane grows: room again.
        room = 300;
        observer.report([300], [pane]);
        expect(list).not.toHaveAttribute("data-stacks");

        // A pane not laid out decides nothing.
        room = 0;
        observer.report([0], [pane]);
        expect(list).not.toHaveAttribute("data-stacks");

        room = 200;
        observer.report([200], [pane]);
        expect(list).toHaveAttribute("data-stacks", "off");
        rerender(
          <div data-testid="pane" style={{ overflowY: "auto" }}>
            <Sections items={items} layout="tabs" />
          </div>,
        );
        expect(list).not.toHaveAttribute("data-stacks");
      });

      it("measures afresh when the sections change, and leaves nothing behind as tabs", () => {
        const { container, rerender } = render(
          <Sections items={items.slice(0, 2)} layout="accordion" />,
        );
        headingObservers()[0].report([40, 40]);
        rerender(<Sections items={items} layout="accordion" />);
        expect(headingObservers()[0].disconnected).toBe(true);
        const [, again] = headingObservers();
        expect(again.targets).toHaveLength(3);
        again.report([40, 40, 40]);
        expect(stacks(container).total).toBe("120px");

        rerender(<Sections items={items} layout="tabs" />);
        expect(again.disconnected).toBe(true);
        expect(headingObservers()).toHaveLength(2);
        expect(stacks(container)).toEqual({
          total: "",
          boxes: [
            ["", ""],
            ["", ""],
            ["", ""],
          ],
        });
      });
    });

    // WCAG 2.4.11: Chromium scrolls focus into view only from outside the container.
    it("moves its scrolling container to bring focus out from under a stuck heading", () => {
      const links = ["About", "Contents"].map((name) => ({
        value: name.toLowerCase(),
        label: name,
        content: <a href={`#${name}`}>{name} link</a>,
      }));
      render(
        <div data-testid="pane" style={{ overflowY: "auto" }}>
          <Sections items={links} layout="accordion" />
        </div>,
      );
      const pane = screen.getByTestId("pane");
      Object.defineProperties(pane, {
        scrollHeight: { value: 1000 },
        clientHeight: { value: 300 },
        scrollTop: { value: 100, writable: true },
      });
      const at = (element: Element, top: number, bottom: number) => {
        element.getBoundingClientRect = () =>
          ({ top, bottom, height: bottom - top }) as DOMRect;
      };
      // The open heading stuck over 0-50, the next under 250-300.
      const [open, next] = screen.getAllByRole("heading");
      at(open, 0, 50);
      at(next, 250, 300);
      const link = screen.getByRole("link", { name: "About link" });

      at(link, 100, 120);
      link.focus();
      expect(pane.scrollTop).toBe(100);

      link.blur();
      at(link, 240.5, 260.5);
      link.focus();
      expect(pane.scrollTop).toBe(111);

      link.blur();
      at(link, 30, 50);
      link.focus();
      expect(pane.scrollTop).toBe(91);

      // Focus from a press does not show, and moves nothing under the pointer.
      link.blur();
      at(link, 240.5, 260.5);
      const matches = link.matches.bind(link);
      link.matches = (selector: string) =>
        selector === ":focus-visible" ? false : matches(selector);
      link.focus();
      expect(pane.scrollTop).toBe(91);
    });

    // JSDOM lays nothing out, so the stylesheet is read; e2e/specs/sections.spec.ts looks.
    it("lets a label wrap, and keeps focused content clear of the stuck headings", () => {
      const css = readFileSync(resolve(__dirname, "Sections.css"), "utf8");
      const rule = (selector: string) =>
        css.match(
          new RegExp(
            `\\n${selector.replace(/[.[\]"*]/g, "\\$&")} \\{([^}]*)\\}`,
          ),
        )?.[1] ?? "";
      const accordion = '.clover-sections[data-layout="accordion"]';
      const label = rule(`${accordion} .clover-sections-label`);
      expect(label).toMatch(/overflow-wrap: anywhere;/);
      expect(label).not.toMatch(/nowrap|ellipsis|overflow: hidden/);
      const heading = rule(`${accordion} .clover-sections-heading`);
      expect(heading).not.toMatch(/(^|\s)height:/);
      expect(heading).toMatch(/top: calc\([^;]*--clover-sections-before\)/);
      expect(heading).toMatch(/bottom: calc\([^;]*--clover-sections-after\)/);
      expect(rule(`${accordion} .clover-sections-panel *`)).toMatch(
        /scroll-margin-block:[^;]*--clover-sections-total\) -\s*var\(--clover-sections-after\)[^;]*--clover-sections-after\)\);/,
      );
    });

    // JSDOM applies no media queries, so the stylesheet is read (WCAG 1.4.10, C34).
    it("stops sticking the headings on a short screen, so the open section has room", () => {
      const css = readFileSync(resolve(__dirname, "Sections.css"), "utf8");
      const query = css.match(/@media \(max-height: 32rem\) \{([\s\S]*?)\n\}/);
      expect(query?.[1]).toMatch(
        /\.clover-sections\[data-layout="accordion"\] \.clover-sections-heading \{\s*position: relative;\s*inset-block: auto;/,
      );
      // Nothing sticks, so focused content keeps no room clear of the headings.
      expect(query?.[1]).toMatch(
        /\.clover-sections\[data-layout="accordion"\] \.clover-sections-panel \* \{\s*scroll-margin-block: 0;/,
      );
      // The same where `Sections` finds the stacks too tall for their container.
      const off =
        '\\.clover-sections\\[data-layout="accordion"\\]\\[data-stacks="off"\\]\\s+';
      expect(css).toMatch(
        new RegExp(
          `${off}\\.clover-sections-heading \\{\\s*position: relative;\\s*inset-block: auto;`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `${off}\\.clover-sections-panel\\s+\\* \\{\\s*scroll-margin-block: 0;`,
        ),
      );
    });

    it("is a heading per section; opening one closes the others, and one stays open", () => {
      render(<Layout layout="accordion" />);
      expect(screen.queryByRole("tablist")).toBeNull();
      const headings = screen.getAllByRole("heading", { level: 3 });
      expect(headings.map((heading) => heading.textContent)).toEqual([
        "About",
        "Contents",
        "Notes",
      ]);
      const about = screen.getByRole("button", { name: "About" });
      const contents = screen.getByRole("button", { name: "Contents" });
      expect(about).toHaveAttribute("aria-expanded", "true");
      expect(contents).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(contents);
      expect(contents).toHaveAttribute("aria-expanded", "true");
      expect(about).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByText("About body")).not.toBeVisible();
      expect(
        screen.getByRole("region", { name: "Contents" }),
      ).toHaveTextContent("Contents body");

      // The open one cannot be closed: pressing it keeps it open, and it says so.
      expect(contents).toHaveAttribute("aria-disabled", "true");
      expect(about).not.toHaveAttribute("aria-disabled");
      expect(contents.querySelector(".clover-sections-chevron")).toBeNull();
      expect(about.querySelector(".clover-sections-chevron")).not.toBeNull();
      fireEvent.click(contents);
      expect(contents).toHaveAttribute("aria-expanded", "true");
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("moves between headings by arrow without opening them", () => {
      render(<Layout layout="accordion" />);
      const about = screen.getByRole("button", { name: "About" });
      const contents = screen.getByRole("button", { name: "Contents" });
      fireEvent.keyDown(about, { key: "ArrowDown" });
      expect(contents).toHaveFocus();
      expect(contents).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("mounts a section's content when it first opens, and keeps it", () => {
    render(<Layout layout="tabs" />);
    expect(mounts).toEqual(["About"]);
    fireEvent.click(screen.getByRole("tab", { name: "Contents" }));
    fireEvent.click(screen.getByRole("tab", { name: "About" }));
    expect(mounts).toEqual(["About", "Contents"]);
    // Still there, hidden, rather than mounted afresh.
    expect(screen.getByText("Contents body")).not.toBeVisible();
  });

  it("keeps what is open when the layout changes", () => {
    const { rerender } = render(<Layout layout="tabs" />);
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    rerender(<Layout layout="accordion" />);
    expect(screen.getByRole("button", { name: "Notes" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "About" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Nothing that had been shown is mounted again.
    expect(mounts).toEqual(["About", "Notes"]);
  });
});

describe("Sections, tabs that do not fit", () => {
  /*
   * jsdom lays nothing out: the row is given a width and a scroll of its own, which the
   * row measures in the next frame.
   */
  const overflow = async (row: HTMLElement, scrollLeft: number) => {
    Object.defineProperties(row, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 500 },
      scrollLeft: { configurable: true, writable: true, value: scrollLeft },
    });
    await act(async () => {
      fireEvent.scroll(row);
      await new Promise((frame) => requestAnimationFrame(frame));
    });
  };

  it("keeps the tabs in one row, its arrows hidden while they fit", () => {
    render(<Layout layout="tabs" />);
    const row = screen.getByRole("tablist", { name: "Information" });
    expect(within(row).getAllByRole("tab")).toHaveLength(3);
    const arrows = document.querySelectorAll<HTMLButtonElement>(
      ".clover-sections-scroll-prev, .clover-sections-scroll-next",
    );
    expect(arrows).toHaveLength(2);
    arrows.forEach((arrow) => expect(arrow).not.toBeVisible());
    // The arrows are not tabs: none sits in the tab list.
    expect(row.querySelector("[class*=scroll]")).toBeNull();
  });

  it("shows an arrow at an end with tabs past it, out of the tab order and the tree", async () => {
    render(<Layout layout="tabs" />);
    const row = screen.getByRole("tablist", { name: "Information" });
    await overflow(row, 0);
    const next = document.querySelector<HTMLButtonElement>(
      ".clover-sections-scroll-next",
    )!;
    const prev = document.querySelector<HTMLButtonElement>(
      ".clover-sections-scroll-prev",
    )!;
    expect(next.hidden).toBe(false);
    expect(prev.hidden).toBe(true);
    expect(next).toHaveAttribute("aria-hidden", "true");
    expect(next.tabIndex).toBe(-1);
    expect(next.closest("[data-more]")).toHaveAttribute("data-more", "end");

    await overflow(row, 150);
    expect(prev.hidden).toBe(false);
    expect(next.closest("[data-more]")).toHaveAttribute(
      "data-more",
      "start end",
    );
  });
});
