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

/** How long a line takes to fade as its story goes (`.storyLines[data-gone]`). */
const FADE = 320;

/** How long a new story's part is looked for, frame by frame, as the viewer turns to it. */
const SEEK = 1200;

/**
 * "Why Clover", drawn to the example viewer. The story at the middle of the window (the
 * last whose top has passed it), an element with `data-point` (`Homepage.tsx`), has one
 * line drawn from its edge to the part it is about in the viewer (`data-part`), which is
 * lit, or to the viewer itself (`viewer`), only drawn to. The tiles crossing the middle
 * of the window are lit too, with their parts in the viewer, but a quiet one
 * (`data-quiet`, the Thumbnail's beside the Label). Lit is `data-lit`, written
 * here on the page itself, never through React's state, so scrolling redraws nothing.
 *
 * A story's own change starts as its line is drawn, and holds as long as the line does
 * (Mat, 2026-10-21: in sync): one with `data-turn` turns the viewer to its accessibility
 * tree (`onTurn`), one with `data-recipe` to its recipe (`onRecipe`), one with
 * `data-compose` or `data-brand` makes its change (`onCompose`, `onBrandStory`), and one
 * with `data-weigh` lights every part the viewer shows, its tag giving what the part adds
 * to a page (`data-weighed` on the viewer, written here). Each is
 * undone only `BAND` past where it began. A story the line has reached is marked
 * `data-drawn`, for good, so its figure's stroke draws then too (`Home.module.css`). Only
 * where the viewer is held beside the stories; elsewhere nothing is drawn, lit or turned.
 * At the page's foot the last story is over too (Mat, 2026-10-21): its line fades and its
 * change is undone, until the page is scrolled `BAND` back up from the foot; but for a
 * recipe read (Natural's, 0032), which the viewer keeps past it (Mat, 2026-10-25).
 *
 * The line is decoration, hidden from assistive technology: what each story is about is
 * in its words. It is drawn in as a story arrives, from the moment its end can be shown
 * (a part on a face the viewer is turning to is looked for each frame until it is there),
 * only where the reader allows motion, and follows the viewer and the story as the page
 * scrolls. As a story goes with none after it, its line fades (`data-gone`), still
 * following the story it was drawn to.
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
    // When the current story began, and the one whose line was last drawn in.
    let since = 0;
    let shownFor: HTMLElement | null = null;
    // The story the line is drawn to, kept as it fades once its story has gone.
    let drawn: { story: HTMLElement; point: string } | null = null;
    let fading = 0;
    // At the page's foot, where the last story is over.
    let atFoot = false;
    const was = {
      turned: false,
      reading: false,
      composing: false,
      branding: false,
      weighing: false,
    };
    let litKey = "";
    let frame = 0;
    // The viewer's padding, read once (a style read every frame costs a recalculation).
    let pad = -1;

    const hide = () => {
      window.clearTimeout(fading);
      fading = 0;
      drawn = null;
      shownFor = null;
      line.style.visibility = "hidden";
      end.style.visibility = "hidden";
    };
    const show = () => {
      window.clearTimeout(fading);
      fading = 0;
      delete overlay.dataset.gone;
      line.style.visibility = "visible";
      end.style.visibility = "visible";
    };
    // Faded where motion is allowed, and gone once it has: still drawn to its story meanwhile.
    const fade = () => {
      if (fading || line.style.visibility !== "visible") return;
      overlay.dataset.gone = "";
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      fading = window.setTimeout(hide, reduced ? 0 : FADE);
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
        // On the viewer itself, not through React's state: its tags show it (`.regionSize`).
        weighing: (weighing: boolean) =>
          viewer.current?.toggleAttribute("data-weighed", weighing),
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
        atFoot = false;
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
      // At the page's foot, the last story is over; `BAND` back up, it is not.
      const toFoot =
        document.documentElement.scrollHeight - innerHeight - scrollY;
      if (toFoot <= 1) atFoot = true;
      else if (toFoot > BAND) atFoot = false;
      if (atFoot && story === stories.at(-1)) story = null;

      /*
       * A part this resource's viewer does not show (Seamless's Items, where the
       * Footage's viewer has its annotations instead; `STARTS`, `PartsLive.tsx`): the line
       * goes to the viewer as a whole. Not for a story that turns the viewer to another
       * face, whose part is there and not yet shown.
       */
      const named = story?.dataset.point ?? "";
      const absent =
        Boolean(story) &&
        named !== "" &&
        named !== WHOLE &&
        !story!.dataset.recipe &&
        !story!.hasAttribute("data-turn") &&
        !viewer.current?.querySelector(`[data-part="${CSS.escape(named)}"]`);
      const point = absent ? WHOLE : named;
      const whole = point === WHOLE;

      // The tiles crossing the middle of the window, lit with their parts.
      const crossing = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-tile]")]
          .filter((tile) => {
            // Not a folded one (`inert`), out of sight under its fade.
            if (tile.closest("[inert]")) return false;
            // Nor a quiet one, which leaves its row's light to the part beside it.
            if (tile.hasAttribute("data-quiet")) return false;
            const { top, bottom } = tile.getBoundingClientRect();
            return top <= middle && bottom >= middle;
          })
          .map((tile) => tile.dataset.tile ?? ""),
      );
      // A story that weighs the parts lights every one the viewer shows, for its tag.
      const pointed = story?.hasAttribute("data-weigh")
        ? [
            ...(viewer.current?.querySelectorAll<HTMLElement>("[data-part]") ??
              []),
          ]
            .filter((part) => part.offsetHeight > 0)
            .map((part) => part.dataset.part ?? "")
        : point && !whole
          ? [point]
          : [];
      light(new Set([...crossing, ...pointed]), crossing);

      if (story !== current) {
        current = story;
        since = performance.now();
        if (!story) shownFor = null;
        // Drawn again once the viewer has crossfaded (700ms), to the side then shown.
        window.setTimeout(schedule, 760);
      }

      // The story's own change, with its line: begun and undone as the line is.
      set("turned", Boolean(story?.hasAttribute("data-turn")));
      /*
       * Past the last story, to the page's foot, its recipe stays read (Mat, 2026-10-25:
       * "do not reset the side floating viewer … after the Natural story. it should remain
       * as the 0032 collection always"): the viewer keeps that face; only its line is over.
       */
      const pastLast = !story && passed === stories.length;
      set(
        "reading",
        Boolean((story ?? (pastLast ? stories.at(-1) : null))?.dataset.recipe),
      );
      set("composing", Boolean(story?.hasAttribute("data-compose")));
      set("branding", Boolean(story?.hasAttribute("data-brand")));
      set("weighing", Boolean(story?.hasAttribute("data-weigh")));

      // Every story the line has reached (past the last, all), its figure's stroke drawn
      // as the line reached it.
      const reached = story ? stories.indexOf(story) : passed - 1;
      for (let index = 0; index <= reached; index++)
        if (!stories[index].hasAttribute("data-drawn"))
          stories[index].setAttribute("data-drawn", "");
      const flip = viewer.current?.parentElement;
      // The part a story points to, on the side shown (`.flip`'s `data-face`).
      const partOf = (to: string) => {
        if (to === WHOLE) return flip;
        const shownFace = flip?.dataset.face ?? "front";
        return to
          ? flip?.querySelector<HTMLElement>(
              `[data-face-of="${shownFace}"] [data-part="${CSS.escape(to)}"]`,
            )
          : null;
      };
      const part = story ? partOf(point) : null;
      let target: { story: HTMLElement; point: string; part: HTMLElement };
      if (story && part) {
        // Drawn in from the moment it can be shown: the attribute's return restarts it.
        if (shownFor !== story) {
          shownFor = story;
          delete overlay.dataset.drawing;
          void overlay.getBoundingClientRect();
          overlay.dataset.drawing = "";
        }
        drawn = { story, point };
        target = { story, point, part };
        show();
      } else {
        // A part on a face the viewer is turning to: looked for again next frame.
        if (story && performance.now() - since < SEEK) schedule();
        const last = drawn && partOf(drawn.point);
        if (!drawn || !flip || !viewer.current) return hide();
        fade();
        // Its part gone with the face it was on: the line stays as it was, fading.
        if (!last) return;
        target = { ...drawn, part: last };
      }
      if (!flip || !viewer.current) return hide();
      const lineWhole = target.point === WHOLE;

      const frameBox = flip.getBoundingClientRect();
      const navbar =
        document.querySelector(".nextra-navbar")?.getBoundingClientRect()
          .bottom ?? 0;
      const from = tops[stories.indexOf(target.story)];
      if (!from) return hide();
      const box = target.part.getBoundingClientRect();
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
      const x1 = lineWhole ? frameBox.right : Math.max(box.right, inner) + 6;
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
    // It turns to another face, where the story's part may be: drawn to it as it does.
    const turning = new MutationObserver(schedule);
    const flip = viewer.current?.parentElement;
    if (flip)
      turning.observe(flip, {
        attributes: true,
        attributeFilter: ["data-face"],
      });
    /*
     * The recipe's face drawing what it read: the line follows its part to where it now
     * is. Only the recipe's face, not the viewer's own, which plays.
     */
    const redrawn = new MutationObserver((records) => {
      const onRecipe = records.some((record) => {
        const node = record.target;
        const element =
          node instanceof Element ? node : (node.parentElement ?? null);
        return element?.closest('[data-face-of="recipe"]');
      });
      if (onRecipe) schedule();
    });
    if (flip) redrawn.observe(flip, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fading);
      turning.disconnect();
      redrawn.disconnect();
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
