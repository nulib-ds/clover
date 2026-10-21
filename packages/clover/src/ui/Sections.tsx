import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { titleTag } from "./heading";
import { Tip } from "./Tip";
import { useContainerName } from "./useContainerName";
import { useScrollTrack } from "./useScrollTrack";
import { useCloverTranslation } from "../i18n/useCloverTranslation";

/** A layout effect in the browser, an effect on the server (where there is no layout). */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Where a section's content may put controls of its own beside its heading: the element
 * to portal them into (`createPortal`), while its section is laid out as an accordion's
 * box; elsewhere (tabs, or no `Sections` around it) `null`, and the content shows them
 * itself. A transcript puts its languages there.
 */
const SectionActionsContext = createContext<HTMLElement | null>(null);

export function useSectionActions() {
  return useContext(SectionActionsContext);
}

/** One section: what its button says, and what its panel shows. */
export interface SectionSpec {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

/** How the sections are laid out. */
export type SectionsLayout = "tabs" | "accordion";

export interface SectionsProps {
  items: SectionSpec[];
  layout?: SectionsLayout;
  /** The section open, controlled. One always is: a value naming none opens the first. */
  value?: string | null;
  /** The section open to start with. Default: the first. */
  defaultValue?: string;
  /** Called with a section as it opens. */
  onValueChange?: (value: string) => void;
  /** The tab list's accessible name (`tabs`). */
  label?: string;
  /** The language of `label`, where it is not the page's. */
  labelLang?: string;
  /**
   * The heading level each button sits in (`accordion`). Default 3. Past 6 it sits in no
   * heading (`ui/heading.ts`); its panel is named by the button either way.
   */
  headingLevel?: number;
  className?: string;
}

/**
 * Sections, laid out as tabs or as an accordion from the same parts: a button and a panel
 * each, the same state (the one section open), and the same mounting (a panel's content
 * mounts when it first opens, and stays). The layouts differ only where the patterns do:
 *
 * - `tabs`: the buttons gather in a `tablist` as `tab`s; one is always open, and the
 *   arrow keys (Home, End) move and select, with one tab stop (WAI-ARIA tabs). They keep
 *   to one row, which scrolls sideways where they do not fit, fades at an end while tabs
 *   lie past it, and shows an arrow there to page it.
 * - `accordion`: each button sits in a heading above its panel, `aria-expanded`; opening
 *   one closes the others. One is always open, as a tab is, so the open one cannot be
 *   closed: its button is `aria-disabled` and draws no chevron. The arrow keys move
 *   between headings without opening them, and each button is its own tab stop
 *   (WAI-ARIA accordion). Every heading stays in sight in a scrolling container: those
 *   scrolled past stack at its top, those an open section pushes below stack at its
 *   bottom, and what is focused in the open section is kept clear of both; where they
 *   would leave it no room, the headings scroll with it instead. A label wraps, so the
 *   headings are measured: each box carries the height of the headings before it and
 *   after it (`--clover-sections-before`, `-after`), the list their total
 *   (`--clover-sections-total`), and, for the stylesheet to count in lines until then,
 *   the box its place (`--clover-sections-index`) and the list their number
 *   (`--clover-sections-count`).
 *
 * So switching layout keeps what is open, and the stylesheet keys on `data-layout`.
 */
export function Sections({
  items,
  layout = "tabs",
  value,
  defaultValue,
  onValueChange,
  label,
  labelLang,
  headingLevel = 3,
  className,
}: SectionsProps) {
  const id = useId();
  const name = useContainerName(label ?? "", labelLang, label === undefined);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [own, setOwn] = useState<string | null>(
    defaultValue ?? items[0]?.value ?? null,
  );
  const tabs = layout === "tabs";
  const { t, langOf } = useCloverTranslation();
  /*
   * The tabs keep to one row, which scrolls sideways when they do not fit: by touch,
   * wheel or a mouse's drag, and to whichever tab takes focus. Its arrows page it.
   */
  const track = useScrollTrack({ dragFree: true, itemCount: items.length });

  // Open: the controlled value, or the reader's; the first when that names none.
  const chosen = value !== undefined ? value : own;
  const open = items.some((item) => item.value === chosen)
    ? chosen
    : (items[0]?.value ?? null);
  // Every section opened so far: its content stays mounted once it has been shown.
  const mounted = useRef(new Set<string>());
  if (open) mounted.current.add(open);

  /*
   * A box opened by a press starts in sight: when the box it replaces had been scrolled
   * through, the new one's start can be left above its heading, under the headings stuck
   * at the top. Then the scrolling container is moved just enough to bring it back.
   */
  const pressed = useRef<string | null>(null);
  useEffect(() => {
    if (tabs || !open || pressed.current !== open) return;
    pressed.current = null;
    const index = items.findIndex((item) => item.value === open);
    const panel = document.getElementById(`${id}-panel-${index}`);
    const heading = buttons.current[index]?.parentElement;
    if (!panel || !heading) return;
    const hidden =
      heading.getBoundingClientRect().bottom -
      panel.getBoundingClientRect().top;
    if (hidden <= 0) return;
    const scroller = scrollerOf(panel);
    if (scroller) scroller.scrollTop -= hidden;
  }, [open, tabs, items, id]);

  /*
   * Focus in the open box lands clear of the stuck headings (WCAG 2.4.11). The panel's
   * content keeps a scroll margin as tall as the stacks, which a browser honors when it
   * scrolls; but Chromium scrolls a focused element only when it is outside the scrolling
   * container, however much a sticky heading covers it. So the container is moved just
   * enough to bring it out between the stacks: below the open heading, above the next.
   * Only focus that shows, as from the keyboard: a press on something partly covered
   * leaves the pane where it is, so nothing moves under the pointer (a map's drag).
   */
  const keepInSight = (event: React.FocusEvent<HTMLElement>) => {
    const index = items.findIndex((item) => item.value === open);
    const panel = document.getElementById(`${id}-panel-${index}`);
    const target = event.target;
    if (!panel || target === panel || !panel.contains(target)) return;
    if (!focusShows(target)) return;
    const above =
      buttons.current[index]?.parentElement?.getBoundingClientRect();
    const below =
      index + 1 < items.length
        ? buttons.current[index + 1]?.parentElement?.getBoundingClientRect()
        : undefined;
    if (!above) return;
    const box = target.getBoundingClientRect();
    // Under the stack above, or under the one below while it fits between them.
    const shift =
      box.top < above.bottom
        ? Math.floor(box.top - above.bottom)
        : below && box.bottom > below.top
          ? Math.ceil(Math.min(box.bottom - below.top, box.top - above.bottom))
          : 0;
    const scroller = shift ? scrollerOf(panel) : null;
    if (scroller) scroller.scrollTop += shift;
  };

  /*
   * The stacks are as tall as the headings in them, and a heading is as tall as its
   * label, which wraps. One observer measures every heading, again whenever one changes
   * size (a label rewrapping as the panel narrows, text spaced or a font arriving, a box
   * opening), and writes the sums to the elements, not to state, so measuring never
   * renders the sections again. Each height is a border box: a heading's own padding is
   * part of the stack.
   *
   * It measures the scrolling container too. The stacks, and the room they keep at its
   * edges, must leave the open box two lines of its text: in a pane too short for them,
   * or under labels wrapped onto many lines, WebKit squeezes the stacks together over the
   * open box, and the other browsers drop the bottom one. There the headings scroll with
   * the content instead, as on a short screen (`data-stacks="off"`).
   */
  const list = useRef<HTMLDivElement>(null);
  const values = items.map((item) => item.value).join("\n");
  useIsomorphicLayoutEffect(() => {
    const root = list.current;
    if (tabs || !root || typeof ResizeObserver === "undefined") return;
    const sections = [
      ...root.querySelectorAll<HTMLElement>(":scope > .clover-sections-item"),
    ];
    const headings = sections.map((section) => section.firstElementChild);
    const first = headings[0];
    const last = headings[headings.length - 1];
    const heights = new Map<Element, number>();
    const height = (heading: Element | null) =>
      (heading && heights.get(heading)) ?? 0;
    const page = document.scrollingElement;
    let scroller: Element | null = null;
    // The room kept at the container's edges, read while the headings stick.
    let insets = 0;

    const measure = () => {
      const total = headings.reduce((sum, heading) => sum + height(heading), 0);
      let before = 0;
      sections.forEach((section, index) => {
        section.style.setProperty("--clover-sections-before", `${before}px`);
        before += height(headings[index]);
        section.style.setProperty(
          "--clover-sections-after",
          `${total - before}px`,
        );
      });
      root.style.setProperty("--clover-sections-total", `${total}px`);

      // Stuck, the first heading's `top` and the last's `bottom` are the edges' room.
      const style = first && getComputedStyle(first);
      if (style?.position === "sticky" && last) {
        insets =
          parseFloat(style.top) + parseFloat(getComputedStyle(last).bottom) ||
          0;
      }
      const text = getComputedStyle(root);
      const line =
        parseFloat(text.lineHeight) || 1.2 * parseFloat(text.fontSize);
      const room = scroller?.clientHeight ?? 0;
      // A container not laid out (hidden, or not yet shown) is left to its stylesheet.
      if (room > 0 && room - insets - total < 2 * line) {
        root.dataset.stacks = "off";
      } else {
        delete root.dataset.stacks;
      }
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (!headings.includes(entry.target)) continue;
        heights.set(
          entry.target,
          entry.borderBoxSize?.[0]?.blockSize ??
            entry.target.getBoundingClientRect().height,
        );
      }
      measure();
    });
    /*
     * The container can change while the sections stay: a template's pane docks or
     * floats as the window resizes. It is watched from outside the observer's callback:
     * observed from inside it, an ancestor of what it reports would wait a frame, and
     * raise the observer's loop error.
     */
    const watch = () => {
      const next = scrollerOf(root);
      if (next === scroller) return;
      if (scroller && scroller !== page) observer.unobserve(scroller);
      if (next && next !== page) observer.observe(next);
      scroller = next;
    };
    // The page, when it is what scrolls, is measured by the window.
    const resize = () => {
      watch();
      measure();
    };
    watch();
    for (const heading of headings) {
      if (heading) observer.observe(heading, { box: "border-box" });
    }
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      for (const section of sections) {
        section.style.removeProperty("--clover-sections-before");
        section.style.removeProperty("--clover-sections-after");
      }
      root.style.removeProperty("--clover-sections-total");
      delete root.dataset.stacks;
    };
  }, [tabs, values, headingLevel]);

  const choose = (item: string) => {
    // The open section stays open; another opens in its place.
    if (item === open) return;
    pressed.current = item;
    if (value === undefined) setOwn(item);
    onValueChange?.(item);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const [back, forward] = tabs
      ? ["ArrowLeft", "ArrowRight"]
      : ["ArrowUp", "ArrowDown"];
    const next =
      event.key === forward
        ? (index + 1) % items.length
        : event.key === back
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    // A tab is chosen as it is reached; a heading waits for Enter or Space.
    if (tabs) choose(items[next].value);
  };

  /*
   * The open tab, brought into the row's view when it opens out of sight (chosen from
   * outside, or the first open one past the end), clear of the arrows at its ends: the
   * row's scroll padding. In place at once the first time, smoothly after.
   */
  const placed = useRef(false);
  useEffect(() => {
    if (!tabs) return;
    const index = items.findIndex((item) => item.value === open);
    const tab = buttons.current[index];
    const row = tab?.parentElement;
    if (!tab || !row) return;
    const style = getComputedStyle(row);
    const room = row.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    const start = room.left + (parseFloat(style.scrollPaddingLeft) || 0);
    const end = room.right - (parseFloat(style.scrollPaddingRight) || 0);
    if (box.left < start - 1 || box.right > end + 1)
      track.scrollToIndex(index, { instant: !placed.current });
    placed.current = true;
    // `track` is a new object each render; its `scrollToIndex` follows the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tabs, items.length, track.scrollToIndex]);

  /*
   * The arrows at the row's ends, shown while tabs lie past that end. They page the row
   * for a pointer. The keyboard reaches every tab already (the arrow keys move through
   * them, and the row follows focus), and a tab list holds only tabs, so they sit beside
   * it, out of the tab order and the accessibility tree; a press leaves focus where it
   * was. Each names itself on hover, as Clover's round controls do.
   */
  const scroller = (step: "prev" | "next") => {
    const more = step === "prev" ? track.canScrollPrev : track.canScrollNext;
    const key =
      step === "prev" ? "sectionsScrollBack" : "sectionsScrollForward";
    return (
      <button
        type="button"
        className={`clover-sections-scroll-${step}`}
        aria-hidden="true"
        tabIndex={-1}
        hidden={!more}
        lang={langOf(key)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={step === "prev" ? track.scrollPrev : track.scrollNext}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="16"
          height="16"
          viewBox="0 0 16 16"
        >
          <path
            d={step === "next" ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Tip label={t(key)} />
      </button>
    );
  };

  const Heading = titleTag(headingLevel, "div") as "h3";
  const button = (item: SectionSpec, index: number) => {
    const isOpen = item.value === open;
    return (
      <button
        key={item.value}
        ref={(element) => {
          buttons.current[index] = element;
        }}
        type="button"
        id={`${id}-button-${index}`}
        className="clover-sections-button"
        data-value={item.value}
        data-track-index={tabs ? index : undefined}
        aria-controls={`${id}-panel-${index}`}
        {...(tabs
          ? {
              role: "tab",
              "aria-selected": isOpen,
              tabIndex: isOpen ? 0 : -1,
            }
          : {
              "aria-expanded": isOpen,
              // WAI-ARIA's accordion: an open panel that cannot collapse is disabled.
              "aria-disabled": isOpen || undefined,
            })}
        onClick={() => choose(item.value)}
        onKeyDown={(event) => onKeyDown(event, index)}
      >
        <span className="clover-sections-label">{item.label}</span>
        {/* A closed box's heading, drawn as something to open; a tab's state is its underline. */}
        {!tabs && !isOpen && (
          <svg
            aria-hidden="true"
            focusable="false"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className="clover-sections-chevron"
          >
            <path
              d="M3 4.5l3 3 3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    );
  };

  return (
    <div
      ref={list}
      className={["clover-sections", className].filter(Boolean).join(" ")}
      data-layout={layout}
      onFocus={tabs ? undefined : keepInSight}
      // How many headings there are, for the stylesheet to stack them (`accordion`).
      style={
        tabs
          ? undefined
          : ({
              "--clover-sections-count": items.length,
            } as React.CSSProperties)
      }
    >
      {tabs && (
        <div
          className="clover-sections-tabs"
          data-more={
            [track.canScrollPrev && "start", track.canScrollNext && "end"]
              .filter(Boolean)
              .join(" ") || undefined
          }
        >
          <div className="clover-sections-row">
            <div
              role="tablist"
              ref={track.ref}
              {...name.props}
              className="clover-sections-list"
            >
              {items.map(button)}
            </div>
            {scroller("prev")}
            {scroller("next")}
          </div>
        </div>
      )}
      {tabs && name.node}
      {items.map((item, index) => {
        const isOpen = item.value === open;
        return (
          <section
            key={item.value}
            className="clover-sections-item"
            data-value={item.value}
            data-open={isOpen}
            // Its place among the headings, for the stylesheet to stack its heading and
            // keep its content clear of the stacks (`accordion`).
            style={
              tabs
                ? undefined
                : ({
                    "--clover-sections-index": index,
                  } as React.CSSProperties)
            }
          >
            {!tabs && (
              <Heading className="clover-sections-heading">
                {button(item, index)}
              </Heading>
            )}
            <Panel
              id={`${id}-panel-${index}`}
              tabs={tabs}
              labelledBy={`${id}-button-${index}`}
              hidden={!isOpen}
            >
              {mounted.current.has(item.value) ? item.content : null}
            </Panel>
          </section>
        );
      })}
    </div>
  );
}

/**
 * A section's panel. In an accordion it comes after a place for its content's own
 * controls, beside the heading (`useSectionActions`): held where the heading is held, over
 * the end of its row, while the section is open. Its width is written to the section
 * (`--clover-sections-actions`), so the heading's button keeps that room clear and its
 * label never runs under them, however long or spaced its text (WCAG 1.4.12). Empty, it
 * takes no room.
 */
function Panel({
  id,
  tabs,
  labelledBy,
  hidden,
  children,
}: {
  id: string;
  tabs: boolean;
  labelledBy: string;
  hidden: boolean;
  children: React.ReactNode;
}) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  // Measured while its section is open: closed, it is hidden, and holds nothing.
  useIsomorphicLayoutEffect(() => {
    const section = actions?.parentElement;
    if (hidden || !actions || !section || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(() => {
      const width = actions.offsetWidth;
      if (width) {
        section.style.setProperty("--clover-sections-actions", `${width}px`);
      } else {
        section.style.removeProperty("--clover-sections-actions");
      }
    });
    observer.observe(actions);
    return () => {
      observer.disconnect();
      section.style.removeProperty("--clover-sections-actions");
    };
  }, [actions, hidden]);
  return (
    <>
      {!tabs && (
        <div
          ref={setActions}
          className="clover-sections-actions"
          hidden={hidden}
        />
      )}
      <div
        id={id}
        role={tabs ? "tabpanel" : "region"}
        aria-labelledby={labelledBy}
        // A tab panel is a tab stop of its own; a region is reached by its content.
        tabIndex={tabs ? 0 : undefined}
        className="clover-sections-panel"
        hidden={hidden}
      >
        <SectionActionsContext.Provider value={tabs ? null : actions}>
          {children}
        </SectionActionsContext.Provider>
      </div>
    </>
  );
}

/**
 * The container a node's headings stick in, and so the one to scroll: the nearest element
 * around it that clips its content (`overflow` auto, scroll or hidden), whether or not it
 * overflows yet, or else the page.
 */
function scrollerOf(node: Element): Element | null {
  for (
    let at = node.parentElement;
    at && at !== document.body;
    at = at.parentElement
  ) {
    if (/auto|scroll|hidden/.test(getComputedStyle(at).overflowY)) return at;
  }
  return document.scrollingElement;
}

/** Whether focus on a node shows, as it does from the keyboard; where unknown, it does. */
function focusShows(node: Element) {
  try {
    return node.matches(":focus-visible");
  } catch {
    return true;
  }
}
