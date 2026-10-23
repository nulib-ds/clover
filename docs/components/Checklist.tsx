import React from "react";

/**
 * A list to tick through, for a reader checking their own work (the Styling page's colors;
 * Mat, 2026-10-23: "use checkboxes"). Each item is a native checkbox inside its label, so
 * its words are the box's name and a press anywhere on them ticks it. Nothing is kept:
 * the ticks are the reader's, for the visit.
 *
 * Items are plain strings, their code in backticks, as Markdown writes it: MDX would make
 * an item written as children a paragraph, which a label cannot hold.
 *
 * ```mdx
 * <Checklist items={["Text is 4.5:1 on `secondary`."]} />
 * ```
 */
export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="docs-checklist">
      {items.map((item) => (
        <li key={item}>
          <label>
            <input type="checkbox" />
            <span>
              {item.split("`").map((part, index) =>
                index % 2 ? (
                  <code key={index} className="nextra-code" dir="ltr">
                    {part}
                  </code>
                ) : (
                  part
                ),
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
