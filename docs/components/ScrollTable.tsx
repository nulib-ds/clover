"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * A Markdown table in a box that scrolls sideways when the table is wider than the page.
 * While it does, the box is a focusable region named for the section it is in, so a
 * keyboard can reach it and scroll it with the arrow keys (WCAG 2.1.1), and a screen
 * reader says what it holds. A table that fits takes no tab stop. Focused, it keeps its
 * tab stop until focus leaves, so a resize never drops focus to the page.
 *
 * Nextra 4's code blocks are focusable by themselves; its tables were not (D16).
 */
export function ScrollTable(props: React.ComponentProps<"table">) {
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  const [name, setName] = useState("Table");

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    /*
     * Named for the nearest heading before it, as the section it is in; a page's tables
     * sit under headings of their own ("Props", "Styles").
     */
    const headings = [
      ...document.querySelectorAll<HTMLElement>(
        "article :is(h1, h2, h3, h4, h5, h6)",
      ),
    ].filter(
      (heading) =>
        heading.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING &&
        heading.style.visibility !== "hidden",
    );
    const heading = headings.at(-1)?.textContent?.trim();
    if (heading) setName(`${heading} table`);

    const measure = () => {
      const overflows = element.scrollWidth > element.clientWidth + 1;
      setScrolls(overflows || element.contains(document.activeElement));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.firstElementChild;
    if (table) observer.observe(table);
    element.addEventListener("focusout", measure);
    return () => {
      observer.disconnect();
      element.removeEventListener("focusout", measure);
    };
  }, []);

  return (
    <div
      ref={box}
      className="docs-table nextra-scrollbar"
      {...(scrolls
        ? { tabIndex: 0, role: "region", "aria-label": name }
        : undefined)}
    >
      <table {...props} />
    </div>
  );
}
