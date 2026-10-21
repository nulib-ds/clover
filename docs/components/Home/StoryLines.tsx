import React, { useEffect, useRef } from "react";
import styles from "docs/components/Home/Parts.module.css";

/** Where the example viewer is held beside the stories (`Parts.module.css`, `.grid`). */
const HELD = "(min-width: 64.0625rem)";

/** A story's point that is the example viewer as a whole: drawn to, not lit. */
const WHOLE = "viewer";

/**
 * How far past an edge the page must scroll back before what it started is undone, so
 * nothing switches back and forth while the reader lingers at an edge.
 */
const BAND = 48;

/**
 * "Why Clover", drawn to the example viewer. The story at the middle of the window (the
 * last whose top has passed it), an element with `data-point` (`Homepage.tsx`), has one
 * line drawn from its edge to the part it is about in the viewer (`data-part`), which is
 * lit, or to the viewer itself (`viewer`), only drawn to. The tiles crossing the middle
 * of the window are lit too, with their parts in the viewer. Lit is `data-lit`, written
 * here on the page itself, never through React's state, so scrolling redraws nothing.
 *
 * A story's own change starts as its line is drawn, and holds as long as the line does
 * (Mat, 2026-10-21: in sync): one with `data-turn` turns the viewer to its accessibility
 * tree (`onTurn`), one with `data-recipe` to its recipe (`onRecipe`), and one with
 * `data-compose` or `data-brand` makes its change (`onCompose`, `onBrandStory`). Each is
 * undone only `BAND` past where it began. A story the line has reached is marked
 * `data-drawn`, for good, so its figure's stroke draws then too (`Home.module.css`). Only
 * where the viewer is held beside the stories; elsewhere nothing is drawn, lit or turned.
 *
 * The line is decoration, hidden from assistive technology: what each story is about is
 * in its words. It is drawn in as a story arrives, only where the reader allows motion,
 * and follows the viewer and the story as the page scrolls.
 */
export const StoryLines = React.memo(function StoryLines({
  viewer,
  onTurn,
  onRecipe,
  onCompose,
  onBrandStory,
}: {
  viewer: React.RefObject<HTMLElement | null>;
  onTurn: (turned: boolean) => void;
  onRecipe: (reading: boolean) => void;
  onCompose: (composing: boolean) => void;
  onBrandStory: (branding: boolean) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const callbacks = useRef({ onTurn, onRecipe, onCompose, onBrandStory });
  callbacks.current = { onTurn, onRecipe, onCompose, onBrandStory };

  useEffect(() => {
    const overlay = svg.current;
    const line = overlay?.querySelector("path");
    const end = overlay?.querySelector("circle");
    if (!overlay || !line || !end) return;
    const held = window.matchMedia(HELD);
    let current: HTMLElement | null = null;
    const was = {
      turned: false,
      reading: false,
      composing: false,
      branding: false,
    };
    let litKey = "";
    let frame = 0;
    // The viewer's padding, read once (a style read every frame costs a recalculation).
    let pad = -1;

    const hide = () => {
      line.style.visibility = "hidden";
      end.style.visibility = "hidden";
    };

    // Lights exactly these parts in the viewer, and these tiles, and nothing else.
    const light = (parts: Set<string>, tiles: Set<string>) => {
      const key = `${[...parts].sort().join(" ")}|${[...tiles].sort().join(" ")}`;
      if (key === litKey) return;
      litKey = key;
      viewer.current
        ?.querySelectorAll<HTMLElement>("[data-part]")
        .forEach((part) =>
          part.toggleAttribute("data-lit", parts.has(part.dataset.part ?? "")),
        );
      document
        .querySelectorAll<HTMLElement>("[data-tile]")
        .forEach((tile) =>
          tile.toggleAttribute("data-lit", tiles.has(tile.dataset.tile ?? "")),
        );
    };

    const set = (name: keyof typeof was, on: boolean) => {
      if (was[name] === on) return;
      was[name] = on;
      const { onTurn, onRecipe, onCompose, onBrandStory } = callbacks.current;
      ({
        turned: onTurn,
        reading: onRecipe,
        composing: onCompose,
        branding: onBrandStory,
      })[name](on);
    };

    const draw = () => {
      frame = 0;
      const middle = innerHeight / 2;
      if (!held.matches) {
        light(new Set(), new Set());
        (Object.keys(was) as (keyof typeof was)[]).forEach((name) =>
          set(name, false),
        );
        current = null;
        return hide();
      }
      const stories = [
        ...document.querySelectorAll<HTMLElement>("[data-point]"),
      ];
      const tops = stories.map((element) => element.getBoundingClientRect());

      /*
       * A story holds from when its top passes the middle until the next one's does, so
       * the gaps between them keep the last; after the last story has passed, none. The
       * one held keeps its hold `BAND` either side of those edges.
       */
      const passed = tops.filter((box) => box.top <= middle).length;
      let story: HTMLElement | null = passed ? stories[passed - 1] : null;
      if (story === stories.at(-1) && tops[passed - 1].bottom < middle)
        story = null;
      if (current && story !== current) {
        const at = stories.indexOf(current);
        const box = tops[at];
        const next = tops[at + 1];
        if (
          box &&
          box.top <= middle + BAND &&
          (next ? next.top > middle - BAND : box.bottom >= middle - BAND)
        )
          story = current;
      }

      const point = story?.dataset.point ?? "";
      const whole = point === WHOLE;

      // The tiles crossing the middle of the window, lit with their parts.
      const crossing = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-tile]")]
          .filter((tile) => {
            const { top, bottom } = tile.getBoundingClientRect();
            return top <= middle && bottom >= middle;
          })
          .map((tile) => tile.dataset.tile ?? ""),
      );
      light(
        new Set([...crossing, ...(point && !whole ? [point] : [])]),
        crossing,
      );

      if (story !== current) {
        current = story;
        // Drawn again once the viewer has crossfaded (700ms), to the side then shown.
        window.setTimeout(schedule, 760);
        // Drawn in afresh for each story: the attribute's return restarts the animation.
        delete overlay.dataset.drawing;
        void overlay.getBoundingClientRect();
        overlay.dataset.drawing = "";
      }

      // The story's own change, with its line: begun and undone as the line is.
      set("turned", Boolean(story?.hasAttribute("data-turn")));
      set("reading", Boolean(story?.dataset.recipe));
      set("composing", Boolean(story?.hasAttribute("data-compose")));
      set("branding", Boolean(story?.hasAttribute("data-brand")));

      // Every story the line has reached (past the last, all), its figure's stroke drawn
      // as the line reached it.
      const reached = story ? stories.indexOf(story) : passed - 1;
      for (let index = 0; index <= reached; index++)
        if (!stories[index].hasAttribute("data-drawn"))
          stories[index].setAttribute("data-drawn", "");
      const storyBox = story && tops[stories.indexOf(story)];

      const flip = viewer.current?.parentElement;
      // The part on the side shown (`.flip`'s `data-face`).
      const shownFace = flip?.dataset.face ?? "front";
      const part = whole
        ? flip
        : point
          ? flip?.querySelector<HTMLElement>(
              `[data-face-of="${shownFace}"] [data-part="${CSS.escape(point)}"]`,
            )
          : null;
      if (!story || !part || !flip || !viewer.current) return hide();

      const frameBox = flip.getBoundingClientRect();
      const navbar =
        document.querySelector(".nextra-navbar")?.getBoundingClientRect()
          .bottom ?? 0;
      const from = storyBox!;
      const box = part.getBoundingClientRect();
      // From the story's edge, level with its middle as far as the window shows it.
      const x0 = from.left;
      const y0 =
        (Math.max(from.top, navbar) + Math.min(from.bottom, innerHeight)) / 2;
      /*
       * To the viewer's frame for the whole, or else to the viewer's right edge, inside
       * its frame (its padding, `.viewer`), where the parts in full rows end, just past
       * the part's outline (4px out, `.region`): a line to a part beside another (the
       * Label, by the Thumbnail) never crosses its neighbor.
       */
      if (pad < 0)
        pad = parseFloat(getComputedStyle(viewer.current).paddingRight) || 0;
      const inner = frameBox.right - pad;
      const x1 = whole ? frameBox.right : Math.max(box.right, inner) + 6;
      // Level with the middle of what of it is in view.
      const top = Math.max(box.top, navbar) + 8;
      const bottom = Math.min(box.bottom, innerHeight) - 8;
      const y1 =
        top < bottom
          ? Math.min(Math.max(box.top + box.height / 2, top), bottom)
          : box.top + box.height / 2;
      const bend = (x0 - x1) / 2;
      line.setAttribute(
        "d",
        `M ${x0} ${y0} C ${x0 - bend} ${y0}, ${x1 + bend} ${y1}, ${x1} ${y1}`,
      );
      end.setAttribute("cx", String(x1));
      end.setAttribute("cy", String(y1));
      line.style.visibility = "visible";
      end.style.visibility = "visible";
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    held.addEventListener("change", schedule);
    // The viewer changes size (its code opened, another layout) and so where it is held.
    const observer = new ResizeObserver(schedule);
    if (viewer.current) observer.observe(viewer.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      held.removeEventListener("change", schedule);
      observer.disconnect();
      light(new Set(), new Set());
      (Object.keys(was) as (keyof typeof was)[]).forEach((name) =>
        set(name, false),
      );
    };
  }, [viewer]);

  return (
    <svg
      ref={svg}
      className={styles.storyLines}
      aria-hidden="true"
      focusable="false"
    >
      <path pathLength={1} />
      <circle r={5} />
    </svg>
  );
});
