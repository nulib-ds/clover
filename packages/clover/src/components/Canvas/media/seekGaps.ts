/*
 * Where the thumb's middle is at a share of the seek bar (in percent): it travels the bar
 * less its own width. The gaps, a chapter's stretch and the popover over it are all placed
 * so, as the pointer is read (`seekShare`); placed across the whole bar instead, they
 * drifted from the gaps by up to half a thumb toward either end.
 */
const along = (share: number) =>
  `var(--clover-transport-thumb) / 2 + (100% - var(--clover-transport-thumb)) * ${share / 100}`;

/** Where a share of the seek bar (in percent) lies along it, as the thumb stands there. */
export const alongBar = (share: number) => `calc(${along(share)})`;

/** How long a stretch of the seek bar is, `share` (in percent) of the thumb's travel. */
export const lengthOnBar = (share: number) =>
  `calc((100% - var(--clover-transport-thumb)) * ${share / 100})`;

/**
 * The seek bar's mask: opaque but for a gap `--clover-transport-gap` wide at each share of
 * it (a chapter's start, or a frame's, in percent), cut out of the bar (`Transport.css`),
 * where the thumb stands at that time.
 * The recording's transport and an animation's bar share it.
 */
export function gapMask(at: number[]): string {
  const half = "var(--clover-transport-gap) / 2";
  const stops = at.flatMap((share) => [
    `#000 0 calc(${along(share)} - ${half})`,
    `transparent 0 calc(${along(share)} + ${half})`,
  ]);
  return `linear-gradient(to right, ${[...stops, "#000 0"].join(", ")})`;
}

/**
 * Where the seek bar is cut, in percent: wherever a span (a chapter, an animation's
 * frame) begins or ends with no other taking over there, so the stretch none covers
 * stands apart, as a film's past its last chapter does; never at the bar's own ends.
 */
export function gapsOf(
  spans: Array<{ start: number; end?: number }>,
  total: number,
): number[] {
  if (!(total > 0)) return [];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  const marks: number[] = [];
  const mark = (at: number) => {
    if (at > 0 && at < total && !marks.some((each) => near(each, at)))
      marks.push(at);
  };
  for (const span of spans) mark(span.start);
  for (const span of spans)
    if (
      span.end !== undefined &&
      Number.isFinite(span.end) &&
      !spans.some((other) => near(other.start, span.end!))
    )
      mark(span.end);
  return marks.sort((a, b) => a - b).map((at) => (at / total) * 100);
}

/**
 * The share of the seek bar under the pointer, 0 to 1, as the thumb counts it: from its
 * middle at the start to its middle at the end, so the time read under the pointer is the
 * time the thumb shows there, as the gaps are placed.
 */
export function seekShare(area: HTMLElement, clientX: number): number {
  const seek = area.querySelector<HTMLElement>("input") ?? area;
  const box = seek.getBoundingClientRect();
  const thumb =
    parseFloat(
      getComputedStyle(seek).getPropertyValue("--clover-transport-thumb"),
    ) || 0;
  const travel = box.width - thumb;
  if (!(travel > 0)) return 0;
  return Math.min(1, Math.max(0, (clientX - box.left - thumb / 2) / travel));
}
