import React, { useEffect, useRef } from "react";
import styles from "docs/components/Home/Parts.module.css";

/** Where the example viewer is held beside the stories (`Parts.module.css`, `.grid`). */
const HELD = "(min-width: 64.0625rem)";

/** A story's point that is the example viewer as a whole, every part of it lit. */
const WHOLE = "viewer";

/**
 * "Why Clover", drawn to the example viewer. The story at the middle of the window (the
 * last whose top has passed it), an element with `data-point` (`Homepage.tsx`), has one
 * line drawn from its edge to the part it is about in the viewer (`data-part`), or to
 * the viewer itself (`viewer`), and `onLight` hands the part, or every part, to the
 * viewer, which outlines it as pointing at a tile does (the whole viewer is only drawn to,
 * its parts lit as its code is pointed at). A story with `data-turn` turns
 * the viewer over (`onTurn`) until the next one arrives, and one with `data-recipe` has it
 * read that Cookbook recipe (`onRecipe`) while it holds; the recipe is handed over as the
 * reader first reaches the stories (`onArrive`), so it has loaded by then. Only where the viewer is held
 * beside the stories; elsewhere nothing is drawn, lit or turned.
 *
 * The line is decoration, hidden from assistive technology: what each story is about is
 * in its words. It is drawn in as a story arrives, only where the reader allows motion,
 * and follows the viewer and the story as the page scrolls.
 */
export function StoryLines({
  viewer,
  onLight,
  onTurn,
  onRecipe,
  onArrive,
  onPassing,
  onCompose,
  onBrandStory,
}: {
  viewer: React.RefObject<HTMLElement | null>;
  onLight: (parts: string[]) => void;
  onTurn: (turned: boolean) => void;
  onRecipe: (reading: boolean) => void;
  onArrive: (recipe: { url: string; name: string } | null) => void;
  /** The parts whose tiles (`data-tile`) are at the middle of the window. */
  onPassing: (parts: string[]) => void;
  /** Whether a story with `data-compose` is well past the middle: its code's own change. */
  onCompose: (composing: boolean) => void;
  /** The same for a story with `data-brand`. */
  onBrandStory: (branding: boolean) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const light = useRef(onLight);
  light.current = onLight;
  const turn = useRef(onTurn);
  turn.current = onTurn;
  const read = useRef(onRecipe);
  read.current = onRecipe;
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const pass = useRef(onPassing);
  pass.current = onPassing;
  const compose = useRef(onCompose);
  compose.current = onCompose;
  const brandStory = useRef(onBrandStory);
  brandStory.current = onBrandStory;

  useEffect(() => {
    const overlay = svg.current;
    const line = overlay?.querySelector("path");
    const end = overlay?.querySelector("circle");
    if (!overlay || !line || !end) return;
    const held = window.matchMedia(HELD);
    let current: HTMLElement | null = null;
    let wasTurned = false;
    let wasReading = false;
    let wasComposing = false;
    let wasBranding = false;
    let arrived = false;
    let crossed = "";
    let frame = 0;

    const hide = () => {
      line.style.visibility = "hidden";
      end.style.visibility = "hidden";
    };

    const draw = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      /*
       * A story holds from when its top passes the middle until the next one's does, so
       * the gaps between them keep the last; after the last story has passed, none.
       */
      const stories = held.matches
        ? [...document.querySelectorAll<HTMLElement>("[data-point]")]
        : [];
      const passed = stories.filter(
        (element) => element.getBoundingClientRect().top <= middle,
      );
      const last = passed.at(-1) ?? null;
      const story =
        last &&
        (last !== stories.at(-1) ||
          last.getBoundingClientRect().bottom >= middle)
          ? last
          : null;
      /*
       * The tiles crossing the middle of the window light themselves and their parts, as
       * pointing at them does: the parts scroll past the viewer and name what they are in
       * it. Only where the viewer is held beside them.
       */
      const crossing = held.matches
        ? [...document.querySelectorAll<HTMLElement>("[data-tile]")]
            .filter((tile) => {
              const { top, bottom } = tile.getBoundingClientRect();
              return top <= middle && bottom >= middle;
            })
            .map((tile) => tile.dataset.tile ?? "")
        : [];
      if (crossing.join(" ") !== crossed) {
        crossed = crossing.join(" ");
        pass.current(crossing);
      }

      const point = story?.dataset.point ?? "";
      const whole = point === WHOLE;

      if (story && !arrived) {
        arrived = true;
        const recipe = stories.find((element) => element.dataset.recipe);
        arrive.current(
          recipe?.dataset.recipe
            ? {
                url: recipe.dataset.recipe,
                name: recipe.dataset.recipeName ?? "",
              }
            : null,
        );
      }

      if (story !== current) {
        current = story;
        // The whole viewer is drawn to, not lit: its parts light as its code is pointed at.
        light.current(whole || !point ? [] : [point]);
        // Drawn again once the viewer has turned (two 180ms halves), to the side then up.
        window.setTimeout(schedule, 400);
        // Drawn in afresh for each story: the attribute's return restarts the animation.
        delete overlay.dataset.drawing;
        void overlay.getBoundingClientRect();
        overlay.dataset.drawing = "";
      }

      // The viewer's place, which stays put as it turns over (`.flip`).
      /*
       * A story with `data-turn` turns the viewer over early, as it comes into view (two
       * thirds down the window), and back once the next story reaches the middle, so it
       * has room to be seen (Mat, 2026-10-20: "the flip zone for this is tight").
       */
      const turner = stories.find((element) =>
        element.hasAttribute("data-turn"),
      );
      const next = turner && stories[stories.indexOf(turner) + 1];
      const turned = Boolean(
        turner &&
          turner.getBoundingClientRect().top <= innerHeight * (2 / 3) &&
          (next
            ? next.getBoundingClientRect().top > middle
            : turner.getBoundingClientRect().bottom >= middle),
      );
      if (turned !== wasTurned) {
        wasTurned = turned;
        turn.current(turned);
      }

      // A story with a recipe reads it from as early, until it has passed the middle.
      const reader = stories.find((element) => element.dataset.recipe);
      const after = reader && stories[stories.indexOf(reader) + 1];
      const reading = Boolean(
        reader &&
          reader.getBoundingClientRect().top <= innerHeight * (2 / 3) &&
          (after
            ? after.getBoundingClientRect().top > middle
            : reader.getBoundingClientRect().bottom >= middle),
      );
      if (reading !== wasReading) {
        wasReading = reading;
        read.current(reading);
      }

      // A story with `data-compose`, once a third of it is past the middle, while it holds.
      const storyBox = story?.getBoundingClientRect();
      const composing = Boolean(
        story?.hasAttribute("data-compose") &&
          storyBox &&
          storyBox.top <= middle - Math.min(storyBox.height / 3, 200),
      );
      if (composing !== wasComposing) {
        wasComposing = composing;
        compose.current(composing);
      }
      const branding = Boolean(
        story?.hasAttribute("data-brand") &&
          storyBox &&
          storyBox.top <= middle - Math.min(storyBox.height / 3, 200),
      );
      if (branding !== wasBranding) {
        wasBranding = branding;
        brandStory.current(branding);
      }

      const frameBox = viewer.current?.parentElement?.getBoundingClientRect();
      // The part on whichever side is up (`.flip`): of its namesakes, one on a face shown.
      const part = whole
        ? viewer.current?.parentElement
        : point
          ? ([
              ...(viewer.current?.parentElement?.querySelectorAll<HTMLElement>(
                `[data-part="${CSS.escape(point)}"]`,
              ) ?? []),
            ].find((part) => {
              const face = part.closest<HTMLElement>("[data-face-of]");
              const style = face && getComputedStyle(face);
              return (
                !style ||
                (style.visibility !== "hidden" && style.opacity !== "0")
              );
            }) ?? null)
          : null;
      if (!story || !part || !frameBox || !viewer.current) return hide();

      const navbar =
        document.querySelector(".nextra-navbar")?.getBoundingClientRect()
          .bottom ?? 0;
      const from = story.getBoundingClientRect();
      const box = part.getBoundingClientRect();
      // From the story's edge, level with its middle as far as the window shows it.
      const x0 = from.left;
      const y0 =
        (Math.max(from.top, navbar) + Math.min(from.bottom, innerHeight)) / 2;
      /*
       * To the viewer's frame for the whole (and for its other side, turned over), or else
       * to the viewer's right edge, inside
       * its frame, where the parts in full rows end, just past the part's outline (4px
       * out, `.region`): a line to a part beside another (the Label, by the Thumbnail)
       * never crosses its neighbor.
       */
      const inner =
        frameBox.right -
        parseFloat(getComputedStyle(viewer.current).paddingRight);
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
      light.current([]);
      turn.current(false);
      read.current(false);
      pass.current([]);
      compose.current(false);
      brandStory.current(false);
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
}
