import React, { useEffect, useId, useRef, useState } from "react";

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
  /** The heading level each button sits in (`accordion`). Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/**
 * Sections, laid out as tabs or as an accordion from the same parts: a button and a panel
 * each, the same state (the one section open), and the same mounting (a panel's content
 * mounts when it first opens, and stays). The layouts differ only where the patterns do:
 *
 * - `tabs`: the buttons gather in a `tablist` as `tab`s; one is always open, and the
 *   arrow keys (Home, End) move and select, with one tab stop (WAI-ARIA tabs).
 * - `accordion`: each button sits in a heading above its panel, `aria-expanded`; opening
 *   one closes the others. One is always open, as a tab is, so the open one cannot be
 *   closed: its button is `aria-disabled` and draws no chevron. The arrow keys move
 *   between headings without opening them, and each button is its own tab stop
 *   (WAI-ARIA accordion). Every heading stays in sight in a scrolling container: those
 *   scrolled past stack at its top, those an open section pushes below stack at its
 *   bottom. The headings carry their place (`--clover-sections-index`) and the list its
 *   count (`--clover-sections-count`) for the stylesheet to stack them.
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
  headingLevel = 3,
  className,
}: SectionsProps) {
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [own, setOwn] = useState<string | null>(
    defaultValue ?? items[0]?.value ?? null,
  );
  const tabs = layout === "tabs";

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
    for (let node = panel.parentElement; node; node = node.parentElement) {
      if (
        node.scrollHeight > node.clientHeight &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)
      ) {
        node.scrollTop -= hidden;
        return;
      }
    }
  }, [open, tabs, items, id]);

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

  const Heading = `h${headingLevel}` as "h3";
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
      className={["clover-sections", className].filter(Boolean).join(" ")}
      data-layout={layout}
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
        <div role="tablist" aria-label={label} className="clover-sections-list">
          {items.map(button)}
        </div>
      )}
      {items.map((item, index) => {
        const isOpen = item.value === open;
        return (
          <section
            key={item.value}
            className="clover-sections-item"
            data-value={item.value}
            data-open={isOpen}
          >
            {!tabs && (
              <Heading
                className="clover-sections-heading"
                // Its place among the headings, for the stylesheet to stack it.
                style={
                  {
                    "--clover-sections-index": index,
                  } as React.CSSProperties
                }
              >
                {button(item, index)}
              </Heading>
            )}
            <div
              id={`${id}-panel-${index}`}
              role={tabs ? "tabpanel" : "region"}
              aria-labelledby={`${id}-button-${index}`}
              // A tab panel is a tab stop of its own; a region is reached by its content.
              tabIndex={tabs ? 0 : undefined}
              className="clover-sections-panel"
              hidden={!isOpen}
            >
              {mounted.current.has(item.value) ? item.content : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
