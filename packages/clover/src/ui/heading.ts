import type React from "react";

/** HTML's headings: as deep as Clover's titles go. */
export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * The heading for a title at `level`, or `null` past 6. HTML's headings end at `h6`,
 * and screen readers misread an `aria-level` deeper than that (JAWS, and TalkBack with
 * Chrome, announce a 7 as a 2), so past 6 a title is no heading at all: it names the
 * group it heads instead (`titled`), and every reader hears an outline that is true as
 * far as it goes (WCAG 1.3.1; Mat, 2026-10-21).
 */
export function headingTag(level: number): HeadingTag | null {
  const whole = Math.max(1, Math.round(level));
  return whole <= 6 ? (`h${whole}` as HeadingTag) : null;
}

/**
 * The element for a title at `level`: its heading, or past 6 `fallback`, for a title
 * whose group already takes its name from it (a section `aria-labelledby` it, a
 * Sections panel named by its button).
 */
export const titleTag = (
  level: number,
  fallback: React.ElementType = "p",
): React.ElementType => headingTag(level) ?? fallback;

/** A title at a level, and what goes on it and on the group it heads. */
export interface Titled {
  /** The title's element: its heading, or past 6 the fallback, a `p`. */
  as: React.ElementType;
  /** For the title: past 6, the `id` its group is named by. */
  title: { id?: string };
  /** For the element around what it heads: past 6, a group the title names. */
  group: { role?: "group"; "aria-labelledby"?: string };
}

/**
 * A title at `level` with this `id`, and the group it heads, for a layout of your own.
 * To h6 the title is a heading, and its group needs nothing. Past 6 it is a `p` (or
 * `fallback`) that names the group: spread `title` on the title and `group` on the
 * element around what it heads.
 *
 * ```tsx
 * const title = Clover.titled(headingLevel, "viewer-title");
 * <Clover.Root iiifContent={url} {...title.group}>
 *   <Clover.Label as={title.as} {...title.title} />
 * ```
 */
export function titled(
  level: number,
  id: string,
  fallback: React.ElementType = "p",
): Titled {
  const tag = headingTag(level);
  return tag
    ? { as: tag, title: {}, group: {} }
    : {
        as: fallback,
        title: { id },
        group: { role: "group", "aria-labelledby": id },
      };
}
