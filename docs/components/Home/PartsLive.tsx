import * as Clover from "@nulib/clover";
import { createPortal, flushSync } from "react-dom";
import React, {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useLayoutEffect,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  accentPresets,
  resourceByKey,
} from "docs/components/Playground/playground-config";
import styles from "docs/components/Home/Parts.module.css";
import { useMapWorker } from "docs/lib/map-worker";
import { isScrolling } from "docs/lib/scrolling";
import { StoryLines } from "docs/components/Home/StoryLines";
import { AccessibilityTree } from "docs/components/Home/AccessibilityTree";
import { elementLoads, partLoads } from "docs/lib/sizes";
import { Choice, Scrub, Switch } from "docs/components/CodeValues";
import { Flavored, PartName, elementTag } from "docs/components/Flavored";
import { useCodeFlavor } from "docs/lib/code-flavor";
import { useRecipeContent } from "docs/components/Home/recipeThumbnails";
import { endPageThemePreview, previewPageTheme } from "docs/lib/page-theme";

/**
 * The playground's resource, taken apart (`Parts.tsx` is the section around it). One
 * `Root` holds it; on the left its parts make a small viewer, its code a click away, and
 * on the right each part stands on its own, live, named, with what it reads and what the
 * resource has there. Choosing in one part moves the others, since they read the same
 * Root. Pointing at a part, or at its line of code, outlines it in the viewer, and so does
 * a story of "Why Clover", beside the viewer below the parts, that names it
 * (`StoryLines.tsx`).
 *
 * Nothing here is made up: every value shown is the resource's own, read as Clover reads
 * it. A part the resource gives nothing to is a chip at the end, naming what it would
 * read, and the playground resource that has it.
 */

const MapPart = lazy(() =>
  import("@nulib/clover/map").then((map) => ({ default: map.Map })),
);

type Json = Record<string, any>;

type PartKey =
  | "label"
  | "thumbnail"
  | "body"
  | "items"
  | "summary"
  | "metadata"
  | "requiredStatement"
  | "rights"
  | "homepage"
  | "seeAlso"
  | "partOf"
  | "id"
  | "provider"
  | "annotations"
  | "map"
  | "contents"
  | "search"
  | "transcript"
  | "download";

const asArray = (value: unknown): any[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/** A language map's first value, in whichever language it has one. */
function first(map: unknown): string | undefined {
  if (!map || typeof map !== "object") return undefined;
  for (const list of Object.values(map as Record<string, unknown>)) {
    const value = asArray(list).find((item) => typeof item === "string");
    if (value) return value;
  }
  return undefined;
}

/** Captions on any Canvas: what `Transcript` reads. */
const hasCaptions = (canvases: Json[]) =>
  canvases.some((canvas) =>
    [...asArray(canvas.annotations), ...asArray(canvas.items)]
      .flatMap((page) => asArray(page?.items))
      .flatMap((annotation) => asArray(annotation?.body))
      .some(
        (body) =>
          body?.format === "text/vtt" || /\.vtt(\?|$)/i.test(String(body?.id)),
      ),
  );

/** The places a resource has: `navPlace` features on it and its Canvases. */
const placesOf = (manifest: Json, canvases: Json[]) =>
  [manifest, ...canvases].reduce(
    (count, resource) => count + asArray(resource?.navPlace?.features).length,
    0,
  );

/**
 * For each conditional part, a playground resource that gives it something: the chips
 * offer it. Read from the resources themselves; none of them has a search service or
 * downloads.
 */
const SHOWN_IN: Partial<Record<PartKey, string>> = {
  summary: "collection",
  metadata: "collection",
  requiredStatement: "collection",
  rights: "collection",
  homepage: "collection",
  seeAlso: "collection",
  partOf: "collection",
  provider: "catalog",
  items: "catalog",
  annotations: "print",
  map: "map",
  contents: "catalog",
  transcript: "footage",
};

/*
 * The fewest parts folded where the resource has no Collection to fold them from: fewer
 * fit in about the fold's own height, so it would hide next to nothing.
 */
const FOLD_FROM = 3;

/** Where each part is documented: its own page, under Components. */
const DOCS: Record<string, string> = {
  Label: "/docs/primitives/label",
  Thumbnail: "/docs/primitives/thumbnail",
  Body: "/docs/body",
  Items: "/docs/items",
  Summary: "/docs/primitives/summary",
  Metadata: "/docs/primitives/metadata",
  Collection: "/docs/collection",
  Homepage: "/docs/primitives/homepage",
  SeeAlso: "/docs/primitives/see-also",
  Id: "/docs/primitives/id",
  Provider: "/docs/primitives/provider",
  Logo: "/docs/primitives/logo",
  Rights: "/docs/primitives/rights",
  RequiredStatement: "/docs/primitives/required-statement",
  Annotations: "/docs/annotations",
  Map: "/docs/map",
  Contents: "/docs/contents",
  Search: "/docs/search",
  Transcript: "/docs/transcript",
  Download: "/docs/download",
};

interface PartSpec {
  key: PartKey;
  /** The component, as it is written: `Clover.Label`. */
  name: string;
  /** What it reads: a property, or for `Body` the containers it draws. */
  reads: string;
  href: string;
  /** Whether the resource gives it anything to show. */
  present: boolean;
  /** Its share of the grid's six columns, and whether it runs tall. */
  span: 2 | 3 | 4 | 6;
  tall?: boolean;
  body: React.ReactNode;
}

export default function PartsLive({
  resource,
  onTry,
}: {
  resource: string;
  onTry: (key: string) => void;
}) {
  // Every part shown, once the reader asks: kept over the Root, so another resource keeps it.
  const [all, setAll] = useState(false);
  const showAll = useCallback(() => setAll(true), []);
  return (
    <Clover.Root iiifContent={resource} key={resource} className={styles.root}>
      <Exploded
        resource={resource}
        onTry={onTry}
        all={all}
        onShowAll={showAll}
      />
    </Clover.Root>
  );
}

function Exploded({
  resource,
  onTry,
  all,
  onShowAll,
}: {
  resource: string;
  onTry: (key: string) => void;
  /** Whether every part shows, those after the Collection's tile too. */
  all: boolean;
  onShowAll: () => void;
}) {
  const manifest = Clover.useManifest() as Json | null;
  const { canvases, views } = Clover.useSequence();
  const sets = Clover.useAnnotationSets();
  const collection = Clover.useCloverSelector(
    (state) => state.collection,
  ) as Json | null;
  const [pointed, setPointed] = useState<PartKey | null>(null);
  const viewer = useRef<HTMLElement>(null);
  /*
   * Turned over to its accessibility tree while a story asks (`data-turn`), unless focus
   * is in it, or under it at its code control, which the tree, taller, covers: then its
   * face stays up, so what is focused is seen (WCAG 2.4.7, 2.4.11).
   */
  const [turned, setTurned] = useState(false);
  const [focused, setFocused] = useState(false);
  // The Coverage story's Cookbook recipe, loaded as the stories are reached, and read then.
  const [recipe, setRecipe] = useState<{ url: string; name: string } | null>(
    null,
  );
  const [reading, setReading] = useState(false);
  useEffect(() => {
    const story = document.querySelector<HTMLElement>("[data-recipe]");
    if (!story?.dataset.recipe) return;
    const load = () =>
      setRecipe({
        url: story.dataset.recipe!,
        name: story.dataset.recipeName ?? "",
      });
    if (!("requestIdleCallback" in window)) {
      const timer = setTimeout(load, 2000);
      return () => clearTimeout(timer);
    }
    const idle = requestIdleCallback(load, { timeout: 4000 });
    return () => cancelIdleCallback(idle);
  }, []);
  const face = focused
    ? "front"
    : turned
      ? "back"
      : reading && recipe
        ? "recipe"
        : "front";

  const [code, setCode] = useState(false);
  const codeId = useId();
  // What the viewer's code says, and so what the viewer shows.
  const [view, setView] = useState<ViewValues>(VIEW_DEFAULTS);

  // A part's name tag, shown while it is pointed at, is put away by Escape (WCAG 1.4.13).
  useEffect(() => {
    if (!pointed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setPointed(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pointed]);

  /*
   * Its height, for holding it in view by its foot once it is taller than the window, and
   * what is under the grid it is held in, for holding it just low enough that its foot
   * meets the grid's (the npm block's) at the page's end (`.assembled`).
   */
  const assembled = useRef<HTMLDivElement>(null);
  /*
   * Held, a part of it can sit above the window, where no scrolling reaches while it is
   * held. Focus landing there lets it go, and brings what is focused into view; focus
   * leaving it holds it again (WCAG 2.4.11).
   */
  const reveal = (event: React.FocusEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const target = event.target as HTMLElement;
    const navbar =
      document.querySelector(".nextra-navbar")?.getBoundingClientRect()
        .bottom ?? 0;
    const { top, bottom } = target.getBoundingClientRect();
    if (top >= navbar && bottom <= window.innerHeight) return;
    node.dataset.hold = "free";
    requestAnimationFrame(() => target.scrollIntoView({ block: "nearest" }));
  };
  const hold = (event: React.FocusEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    if (!node.contains(event.relatedTarget as Node | null))
      delete node.dataset.hold;
  };
  const ready = Boolean(manifest);
  useEffect(() => {
    const node = assembled.current;
    if (!node) return;
    const grid = node.closest<HTMLElement>(`.${styles.grid}`);
    const measure = () => {
      node.style.setProperty("--assembled-height", `${node.offsetHeight}px`);
      if (!grid) return;
      const under =
        document.documentElement.scrollHeight -
        (grid.getBoundingClientRect().bottom + window.scrollY);
      node.style.setProperty(
        "--assembled-end",
        `${Math.max(0, Math.round(under))}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // The page under the grid grows and shrinks with the window (the footer's lines).
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [ready]);

  const parts = useMemo<PartSpec[]>(() => {
    if (!manifest) return [];
    const all = canvases as Json[];
    const entries = sets.flatMap((set) => set.entries);
    const georeferences = entries.filter((entry) =>
      entry.motivation.includes("georeferencing"),
    ).length;
    const notes = entries.filter(
      (entry) => !entry.motivation.includes("georeferencing"),
    );
    const places = placesOf(manifest, all);
    const partOf = first(asArray(manifest.partOf)[0]?.label);
    // Items moves between views, so a single view gives it nothing.
    const several = views.length > 1;
    // Annotations and Contents share a row; either alone takes it whole.
    const annotated = notes.length > 0;
    const structured = asArray(manifest.structures).length > 0;

    /*
     * In this order (Mat, 2026-10-23): the parts the example viewer is made of, then what
     * a record states, the lists beside each other, and the Collection it is part of,
     * folded from halfway through with the rest until the reader shows them all (`folded`).
     */
    return [
      {
        key: "label",
        name: "Label",
        reads: "label",
        present: Boolean(first(manifest.label)),
        span: 4,
        href: DOCS.Label,
        body: <Clover.Label as="p" className={styles.display} />,
      },
      {
        key: "thumbnail",
        name: "Thumbnail",
        reads: manifest.thumbnail ? "thumbnail" : "items[0]",
        present: true,
        span: 2,
        href: DOCS.Thumbnail,
        body: <Clover.Thumbnail alt="" size={400} className={styles.thumb} />,
      },
      {
        key: "body",
        name: "Body",
        reads: "Canvas, Scene, or Timeline",
        present: true,
        span: 6,
        tall: true,
        href: DOCS.Body,
        body: <Clover.Body className={styles.body} />,
      },
      {
        key: "items",
        name: "Items",
        // Its `items`, in views by `behavior`, laid out by `viewingDirection`; named by
        // the first alone (Mat, 2026-10-23: "just items").
        reads: "items",
        present: several,
        span: 6,
        href: DOCS.Items,
        body: <Clover.Items className={styles.strip} />,
      },
      {
        key: "summary",
        name: "Summary",
        reads: "summary",
        present: Boolean(first(manifest.summary)),
        span: 6,
        href: DOCS.Summary,
        body: <Clover.Summary />,
      },
      {
        key: "metadata",
        name: "Metadata",
        reads: "metadata",
        present: asArray(manifest.metadata).length > 0,
        span: 6,
        href: DOCS.Metadata,
        body: <Clover.Metadata className={styles.fields} />,
      },
      {
        key: "requiredStatement",
        name: "RequiredStatement",
        reads: "requiredStatement",
        present: Boolean(first(manifest.requiredStatement?.value)),
        span: 6,
        href: DOCS.RequiredStatement,
        body: <Clover.RequiredStatement className={styles.statement} />,
      },
      {
        key: "annotations",
        name: "Annotations",
        reads: "annotations",
        present: annotated,
        // Beside Contents, the list beside the list (Mat, 2026-10-21).
        span: structured ? 3 : 6,
        href: DOCS.Annotations,
        // Its pages' titles one below the tile's.
        body: <Clover.Annotations headingLevel={4} className={styles.scroll} />,
      },
      {
        key: "contents",
        name: "Contents",
        reads: "structures",
        present: structured,
        span: annotated ? 3 : 6,
        href: DOCS.Contents,
        body: <Clover.Contents className={styles.scroll} />,
      },
      {
        key: "partOf",
        name: "Collection",
        reads: "partOf",
        present: Boolean(partOf || collection),
        span: 6,
        href: DOCS.Collection,
        // What the Panel's Collection section shows, as the part it is.
        body: (
          <Clover.Collection
            headingLevel={4}
            className={`${styles.scroll} ${styles.tall}`}
          />
        ),
      },
      {
        key: "homepage",
        name: "Homepage",
        reads: "homepage",
        present: asArray(manifest.homepage).length > 0,
        span: 3,
        href: DOCS.Homepage,
        body: <Clover.Homepage className={styles.links} />,
      },
      {
        key: "seeAlso",
        name: "SeeAlso",
        reads: "seeAlso",
        present: asArray(manifest.seeAlso).length > 0,
        span: 3,
        href: DOCS.SeeAlso,
        body: <Clover.SeeAlso className={styles.links} />,
      },
      {
        key: "id",
        name: "Id",
        reads: "id",
        present: true,
        span: 3,
        href: DOCS.Id,
        body: <Clover.Id className={styles.links} />,
      },
      {
        key: "rights",
        name: "Rights",
        reads: "rights",
        present: Boolean(manifest.rights),
        span: 3,
        href: DOCS.Rights,
        body: <Clover.Rights className={styles.small} />,
      },
      {
        key: "provider",
        name: "Provider",
        reads: "provider",
        present: asArray(manifest.provider).length > 0,
        span: 3,
        href: DOCS.Provider,
        // Its logo and its name, linked to its homepage, as About shows it.
        body: <Clover.Provider />,
      },
      {
        key: "map",
        name: "Map",
        reads: "navPlace",
        present: places > 0 || georeferences > 0,
        span: 6,
        tall: true,
        href: DOCS.Map,
        body: <MapTile />,
      },
      {
        key: "search",
        name: "Search",
        reads: "service",
        present: Boolean(Clover.searchServiceOf(manifest as never)),
        span: 3,
        href: DOCS.Search,
        body: <Clover.Search />,
      },
      {
        key: "transcript",
        name: "Transcript",
        reads: "WebVTT captions",
        present: hasCaptions(all),
        span: 3,
        href: DOCS.Transcript,
        body: <Clover.Transcript className={styles.scroll} />,
      },
      {
        key: "download",
        name: "Download",
        reads: "rendering",
        present:
          asArray(manifest.rendering).length > 0 ||
          all.some((canvas) => asArray(canvas.rendering).length > 0),
        span: 3,
        href: DOCS.Download,
        body: <Clover.Download />,
      },
    ];
  }, [manifest, canvases, views, sets, collection]);

  /*
   * Where the viewer is held beside the stories, its code moves to the Composable story
   * (`data-composer`, drawn by `Homepage.tsx`), and is drawn there through a portal, so it
   * keeps this Root and the view it edits. Elsewhere it stays under the viewer.
   */
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const held = window.matchMedia("(min-width: 64.0625rem)");
    const place = () => {
      setSlot(
        held.matches
          ? document.querySelector<HTMLElement>("[data-composer]")
          : null,
      );
    };
    place();
    held.addEventListener("change", place);
    return () => held.removeEventListener("change", place);
  }, []);

  /*
   * As the Composable story passes (`onCompose`), its code makes a change of its own, to
   * the layout Mat set in it (2026-10-20): Body first and taller, then the Label and
   * Summary, then Items with larger pictures; the Thumbnail and Metadata out. Nothing is
   * lit for it: the code crossfades to the new (`change`), its new lines lit a moment, and
   * the viewer follows; a part lights as its code is pointed at. When the story goes, it
   * is put back, unless the reader has changed the code meanwhile.
   */
  /*
   * As the Seamless story passes (`onBrandStory`), the whole site shows another color a
   * while: Northwestern purple, a preset of the site's, shown but not kept
   * (`previewPageTheme`), and put back as the story goes, unless the reader chose
   * meanwhile. Never the font, which would reflow the page under the reader (Mat,
   * 2026-10-20: a layout shift). Not on a dark page, where a dark accent on the dark
   * ground would fall below the contrast its text needs (WCAG 1.4.3). Shown on what is
   * in view as it begins (the viewer's face shown, the stories and their line, the
   * navbar, the tiles and chips on screen, of those folded only what the fold shows),
   * which looks the same as the whole page and spares it a restyle of every element
   * mid-scroll (Mat, 2026-10-21: smooth), and a few at a time (`previewPageTheme`; Mat,
   * 2026-10-24: the viewer's three faces and the folded tiles, 1,500 elements, restyled
   * in one frame as the story began and ended). Meanwhile the viewer's
   * thumbnails show their Next as the pointer would find it (`data-hovered`,
   * `Parts.module.css`): in the accent, its name showing, so the color is plain to see
   * (Mat, 2026-10-21). Only shown: nothing is focused or pressed.
   */
  const [branding, setBranding] = useState(false);
  useEffect(() => {
    if (!branding) return endPageThemePreview();
    if (document.documentElement.classList.contains("dark")) return;
    const node = assembled.current;
    // On screen, and within `clip` (the fold) where one is given.
    const inView = (element: Element, clip?: DOMRect) => {
      const { top, bottom } = element.getBoundingClientRect();
      return (
        bottom > Math.max(0, clip?.top ?? 0) &&
        top < Math.min(window.innerHeight, clip?.bottom ?? Infinity)
      );
    };
    // An element the preview can be set on: HTML, or the stories' line (SVG).
    const html = (element: Element | null | undefined) =>
      element instanceof HTMLElement || element instanceof SVGElement
        ? [element as HTMLElement]
        : [];
    // The stories' column: each story on screen, and the intros around them.
    const column = [
      ...(node
        ?.closest<HTMLElement>(`.${styles.grid}`)
        ?.querySelector<HTMLElement>(`.${styles.after}`)?.children ?? []),
    ].flatMap((child) =>
      child.querySelector(":scope > [data-point]")
        ? [...child.children]
        : [child],
    );
    // The tiles on screen; of those folded under "Show all", what the fold shows.
    const tiles = [
      ...(document.querySelector<HTMLElement>(`.${styles.tiles}`)?.children ??
        []),
    ].flatMap((child) =>
      child.classList.contains(styles.rest)
        ? [...child.children].filter((tile) =>
            inView(
              tile,
              child.hasAttribute("data-folded")
                ? child.getBoundingClientRect()
                : undefined,
            ),
          )
        : [child].filter((tile) => inView(tile)),
    );
    // The face shown alone, its others out of sight meanwhile; the nearest first.
    const within = [
      ...html(viewer.current),
      ...column.filter((element) => inView(element)).flatMap(html),
      ...html(document.querySelector(`.${styles.storyLines}`)),
      ...html(document.querySelector(".nextra-navbar")),
      ...tiles.flatMap(html),
    ];
    previewPageTheme(
      {
        accent:
          accentPresets.find((preset) => preset.name === "Northwestern purple")
            ?.value ?? "",
      },
      within,
    );
    const next = node?.querySelector<HTMLElement>(
      '[data-part="items"] button.clover-items-scroll-next:not([aria-disabled="true"])',
    );
    next?.setAttribute("data-hovered", "");
    return () => next?.removeAttribute("data-hovered");
  }, [branding]);
  useEffect(() => () => endPageThemePreview(), []);

  const [composing, setComposing] = useState(false);
  const [change, setChange] = useState(0);
  const scripted = useRef<{ before: ViewValues; after: ViewValues } | null>(
    null,
  );
  /*
   * The viewer fades from the old layout to the new as the code crossfades (Mat,
   * 2026-10-20: no flip): out, the change made while it is unseen, and in, 700ms in all,
   * by opacity alone, so the compositor runs it and scrolling never waits on it. (A view
   * transition crossfaded it too, but its snapshot cost the scroll a frame or three.)
   * Where the reader wants no motion, it simply changes.
   */
  /*
   * The change renders as a transition, which React can break across frames, so the
   * page scrolls on while it does; the viewer fades in once it has landed (`landed`).
   */
  const landed = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    landed.current?.();
    landed.current = null;
  }, [view]);
  const crossfade = (change: () => void) => {
    const node = viewer.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !node?.animate) return change();
    const out = node.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 220,
      easing: "ease-in",
      fill: "forwards",
    });
    out.finished.then(
      () => {
        landed.current = () => {
          node
            .animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 480,
              easing: "ease-out",
            })
            .finished.catch(() => undefined);
          out.cancel();
        };
        startTransition(change);
      },
      () => change(),
    );
  };
  useEffect(() => {
    if (composing && !scripted.current && manifest) {
      const before = view;
      const lead: ViewerPart[] = ["body", "label", "summary", "items"];
      const after: ViewValues = {
        ...view,
        height: 400,
        itemsSize: "9rem",
        order: [
          ...lead.filter((key) => view.order.includes(key)),
          ...view.order.filter(
            (key) =>
              !lead.includes(key) && key !== "thumbnail" && key !== "metadata",
          ),
        ],
      };
      scripted.current = { before, after };
      crossfade(() => {
        setView(after);
        setChange((n) => n + 1);
      });
    } else if (!composing && scripted.current) {
      const { before, after } = scripted.current;
      scripted.current = null;
      crossfade(() => {
        setView((current) =>
          JSON.stringify(current) === JSON.stringify(after) ? before : current,
        );
        setChange((n) => n + 1);
      });
    }
  }, [composing]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Pointing at a part, or focusing in it, outlines it in the viewer, and back. What a
   * story names, and the tiles at the middle of the window, are lit by `StoryLines` itself
   * (`data-lit`), never through this component's state, so scrolling redraws nothing here.
   * Nor does the page scrolling under a resting pointer: what passes under it is not
   * pointed at (`isScrolling`), only what the pointer then moves over.
   */
  const point = useCallback(
    (key: PartKey) => ({
      "data-on": pointed === key || undefined,
      ...pointerTo(key, setPointed),
      onFocus: () => setPointed(key),
      onBlur: () => setPointed(null),
    }),
    [pointed],
  );
  const region = (key: PartKey) => ({ ...point(key), "data-part": key });

  /*
   * A tile's list scrolls in a box of its own (`.scroll`), and a box under the pointer
   * takes the wheel from the page: a page scrolled under a resting pointer stopped at
   * each, the reader's gesture spent on the box (Mat, 2026-10-21: smooth). So a box takes
   * the wheel only once the reader points into it (moves the pointer over it, presses,
   * or focuses in it; `data-armed`), never as the page brings it under the pointer
   * (`isScrolling`), and the page scrolling lets it go. Until then it lets the wheel pass
   * (`Parts.module.css`). Its own scrolling (a transcript following its cue) is as ever.
   */
  const armed = useRef<HTMLElement | null>(null);
  const disarmList = useCallback(() => {
    armed.current?.removeAttribute("data-armed");
    armed.current = null;
  }, []);
  const armList = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isScrolling()) return;
      const { clientX: x, clientY: y } = event;
      const box =
        [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            `.${styles.scroll}`,
          ),
        ].find((list) => {
          const { left, right, top, bottom } = list.getBoundingClientRect();
          return x >= left && x <= right && y >= top && y <= bottom;
        }) ?? null;
      if (box === armed.current) return;
      disarmList();
      armed.current = box;
      box?.setAttribute("data-armed", "");
    },
    [disarmList],
  );
  useEffect(() => {
    // The page scrolled, not the armed box: what it brings under the pointer is not pointed at.
    const onScroll = (event: Event) => {
      if (
        event.target === document ||
        event.target === document.documentElement
      )
        disarmList();
    };
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      window.removeEventListener("scroll", onScroll, { capture: true });
  }, [disarmList]);
  const shown = useMemo(() => parts.filter((part) => part.present), [parts]);
  const missing = useMemo(() => parts.filter((part) => !part.present), [parts]);
  /*
   * The Collection's tile and the parts after it, folded under a fade until the reader
   * shows them all (Mat, 2026-10-23: "Collection --> Nothing"), so the stories after them
   * come sooner.
   */
  const folded = useMemo(
    () =>
      new Set(
        parts
          .slice(parts.findIndex((part) => part.key === "partOf"))
          .map((part) => part.key),
      ),
    [parts],
  );
  const after = shown.filter((part) => folded.has(part.key));
  const lead = after[0]?.key;
  const fold = !all && (lead === "partOf" || after.length >= FOLD_FROM);
  const rest = useRef<HTMLDivElement>(null);
  const restId = useId();
  /*
   * Folded, it ends halfway through its first tile, the Collection's (Mat, 2026-10-23:
   * "fade should occur half way through collections"), the fade centered there: written
   * on it as the tile's height changes, never through React's state.
   */
  useLayoutEffect(() => {
    const node = rest.current;
    const first = node?.firstElementChild;
    if (!fold || !node || !(first instanceof HTMLElement)) return;
    const measure = () =>
      node.style.setProperty("--fold-at", `${first.offsetHeight / 2}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(first);
    return () => observer.disconnect();
  }, [fold, lead]);
  // Shown, focus goes on to the first of them, as the button goes (WCAG 2.4.3).
  const showAll = () => {
    flushSync(onShowAll);
    rest.current?.querySelector<HTMLElement>("a[href]")?.focus();
  };
  // The parts the example viewer shows, in the order its code gives them.
  const order = useMemo(
    () =>
      view.order.filter(
        (key) =>
          key === "thumbnail" ||
          key === "label" ||
          key === "body" ||
          shown.some((part) => part.key === key),
      ),
    [view.order, shown],
  );

  /*
   * The viewer's parts themselves, made once for the values they take: an outline coming
   * or going redraws its Region, never the part inside it.
   */
  const thumbnailPart = useMemo(
    () => <Clover.Thumbnail alt="" size={128} className={styles.viewerThumb} />,
    [],
  );
  const labelPart = useMemo(
    () => <Clover.Label as="h3" className={styles.viewerTitle} />,
    [],
  );
  const bodyPart = useMemo(
    () => (
      <Clover.Body controls={view.controls} style={{ height: view.height }} />
    ),
    [view.controls, view.height],
  );
  const itemsPart = useMemo(
    () => (
      <Clover.Items
        className={styles.viewerStrip}
        layout={view.layout}
        style={
          view.itemsSize
            ? ({
                [itemsSizeProperty(view.layout)]: view.itemsSize,
              } as React.CSSProperties)
            : undefined
        }
      />
    ),
    [view.layout, view.itemsSize],
  );
  const summaryPart = useMemo(
    () => <Clover.Summary className={styles.viewerSummary} />,
    [],
  );
  const metadataPart = useMemo(
    () => <Clover.Metadata className={styles.viewerFields} />,
    [],
  );

  // The tiles, drawn again only for what they show, or a pointer coming or going.
  const tiles = useMemo(() => {
    const tile = (part: PartSpec) => (
      <Tile
        key={part.key}
        part={part}
        on={pointed === part.key}
        onPoint={setPointed}
      />
    );
    return {
      through: shown.filter((part) => !folded.has(part.key)).map(tile),
      after: shown.filter((part) => folded.has(part.key)).map(tile),
    };
  }, [shown, folded, pointed]);

  if (!manifest) {
    return (
      <>
        <div className={styles.assembled} aria-hidden="true" />
        <Clover.Status className={styles.loading} />
      </>
    );
  }

  const regions: Record<ViewerPart, React.ReactNode> = {
    thumbnail: (
      <Region
        key="thumbnail"
        name="Thumbnail"
        className={styles.regionThumb}
        {...region("thumbnail")}
      >
        {thumbnailPart}
      </Region>
    ),
    label: (
      <Region
        key="label"
        name="Label"
        className={styles.regionLabel}
        {...region("label")}
      >
        {labelPart}
      </Region>
    ),
    body: (
      <Region key="body" name="Body" {...region("body")}>
        {bodyPart}
      </Region>
    ),
    items: (
      <Region
        key="items"
        name="Items"
        className={styles.regionItems}
        {...region("items")}
      >
        {itemsPart}
      </Region>
    ),
    summary: (
      <Region
        key="summary"
        name="Summary"
        className={styles.regionSummary}
        {...region("summary")}
      >
        {summaryPart}
      </Region>
    ),
    metadata: (
      <Region
        key="metadata"
        name="Metadata"
        className={styles.regionMetadata}
        {...region("metadata")}
      >
        {metadataPart}
      </Region>
    ),
  };

  return (
    <>
      <div
        ref={assembled}
        className={styles.assembled}
        data-code={(code && !slot) || undefined}
        onFocus={(event) => {
          setFocused(true);
          reveal(event);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setFocused(false);
          hold(event);
        }}
      >
        <div className={styles.flip} data-face={face}>
          {/* Named for assistive technology; on screen the viewer speaks for itself. */}
          <section
            ref={viewer}
            className={styles.viewer}
            aria-label="Example Viewer"
            data-face-of="front"
          >
            {order.map((key) => regions[key])}
          </section>
          <AccessibilityTree of={viewer} shown={face === "back"} />
          {recipe && <RecipeFace recipe={recipe} height={RECIPE_HEIGHT} />}
        </div>
        {slot ? (
          createPortal(
            <ViewerCode
              id={codeId}
              open
              resource={resource}
              order={order}
              view={view}
              onView={setView}
              point={point}
              change={change}
              // The most the Composable story's change needs (`composing`).
              rows={15}
            />,
            slot,
          )
        ) : (
          <div>
            <div className={styles.codeBar}>
              <button
                type="button"
                className={styles.codeToggle}
                aria-label="Code"
                title="Code"
                aria-expanded={code}
                aria-controls={codeId}
                onClick={() => setCode((open) => !open)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m7 8-4 4 4 4M17 8l4 4-4 4M14 4l-4 16" />
                </svg>
              </button>
            </div>
            <ViewerCode
              id={codeId}
              open={code}
              resource={resource}
              order={order}
              view={view}
              onView={setView}
              point={point}
            />
          </div>
        )}
      </div>

      <StoryLines
        viewer={viewer}
        onTurn={setTurned}
        onRecipe={setReading}
        onCompose={setComposing}
        onBrandStory={setBranding}
      />

      <div
        className={styles.tiles}
        onPointerMove={armList}
        onPointerDown={armList}
        onPointerLeave={disarmList}
      >
        {/*
         * Under "…or build your own.", the choice's half for a layout of one's own,
         * which heads them (`Playground.tsx`; Mat, 2026-10-23).
         */}
        {tiles.through}
        {/*
         * Folded, the Collection's tile and the rest fade out, a preview only, inert, so
         * nothing out of sight takes focus or is read (WCAG 2.4.11), until "Show all":
         * the parts this resource gives nothing to among them, at their end (Mat,
         * 2026-10-24: "place this inside of the Show All expanded content").
         */}
        {(tiles.after.length > 0 || missing.length > 0) && (
          <div
            ref={rest}
            id={restId}
            className={styles.rest}
            data-folded={fold || undefined}
            inert={fold}
          >
            {tiles.after}
            {missing.length > 0 && (
              <div className={styles.missing}>
                <p className={styles.missingTitle}>
                  Nothing for these in this resource
                </p>
                <ul className={styles.chips}>
                  {missing.map((part) => {
                    const elsewhere = SHOWN_IN[part.key];
                    const name = elsewhere && resourceByKey(elsewhere)?.name;
                    return (
                      <li key={part.key} className={styles.chip}>
                        <Link href={part.href} className={styles.chipName}>
                          <PartName name={part.name} />
                        </Link>
                        <span className={styles.reads}>{part.reads}</span>
                        {name && (
                          <button
                            type="button"
                            className={styles.try}
                            onClick={() => {
                              // A part folded here shows in the resource that has it.
                              if (folded.has(part.key)) onShowAll();
                              onTry(elsewhere);
                            }}
                          >
                            {name} →
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
        {fold && (
          <button
            type="button"
            className={`cta-outline ${styles.showAll}`}
            aria-expanded="false"
            aria-controls={restId}
            onClick={showAll}
          >
            Show all<span className={styles.visuallyHidden}> parts</span>
          </button>
        )}
      </div>
    </>
  );
}

/*
 * A part's pointer handlers: pointed at as the pointer enters it or moves over it, but
 * not as the page scrolls it under a resting pointer (`isScrolling`), and let go as the
 * pointer leaves, scrolled or not, so nothing stays outlined that the pointer is off.
 */
const pointerTo = (
  key: PartKey,
  onPoint: (key: PartKey | null) => void,
): React.HTMLAttributes<HTMLElement> => ({
  onPointerEnter: () => {
    if (!isScrolling()) onPoint(key);
  },
  onPointerMove: () => {
    if (!isScrolling()) onPoint(key);
  },
  onPointerLeave: () => onPoint(null),
});

/**
 * A part on its own: drawn again only when it, or whether it is pointed at, changes. An
 * `article`, named by its heading, not a `section`: a region each, the page's landmarks
 * would run to dozens, where its heading already finds it (Mat, 2026-10-21).
 */
const Tile = React.memo(function Tile({
  part,
  on,
  onPoint,
}: {
  part: PartSpec;
  on: boolean;
  onPoint: (key: PartKey | null) => void;
}) {
  return (
    <article
      aria-labelledby={`part-${part.key}`}
      className={styles.tile}
      data-span={part.span}
      data-tall={part.tall || undefined}
      data-tile={part.key}
      data-on={on || undefined}
      {...pointerTo(part.key, onPoint)}
      // Lit by focus where focus shows: not a press's, nor "Show all" moving it after one.
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) onPoint(part.key);
      }}
      onBlur={() => onPoint(null)}
    >
      {/*
       * Its head is the link to the part's page, an arrow at its end saying so; pointed at
       * or focused, the name underlines and the arrow steps forward (`Parts.module.css`;
       * Mat, 2026-10-23).
       */}
      <header className={styles.tileHead}>
        <h3 id={`part-${part.key}`} className={styles.tileName}>
          <Link href={part.href}>
            <PartName name={part.name} />
          </Link>
        </h3>
        <span className={styles.reads}>{part.reads}</span>
        <span className={styles.tileArrow} aria-hidden="true">
          →
        </span>
      </header>
      <div className={styles.tileBody}>{part.body}</div>
    </article>
  );
});

/**
 * "Why Clover"'s Coverage story, read on the viewer's other side: a Cookbook recipe in a
 * Root of its own (0032, a Collection; Mat, 2026-10-21), read by the same Label, Body,
 * Metadata and Collection, all but Metadata outlined with their names (Mat, 2026-10-21),
 * and the recipe named at the head, so it is plain what is being read. Its members are
 * given thumbnails from their own images, for this example only (`recipeThumbnails.ts`).
 * An illustration as the page scrolls, so it is inert: focus and assistive technology
 * stay with the viewer itself, which turns back the moment focus comes to it.
 */
const RecipeFace = React.memo(function RecipeFace({
  recipe,
  height,
}: {
  recipe: { url: string; name: string };
  height: number;
}) {
  // The Collection, its members' thumbnails added; drawn once it is read.
  const content = useRecipeContent(recipe.url);
  return (
    <section
      className={`${styles.viewer} ${styles.recipeFace}`}
      data-face-of="recipe"
      inert
    >
      <p className={styles.recipeName}>{recipe.name}</p>
      {content && (
        <Clover.Root iiifContent={content} className={styles.recipeRoot}>
          <Region name="Label" data-on data-part="label">
            <Clover.Label as="p" className={styles.recipeLabel} />
          </Region>
          <Region name="Body" data-on data-part="body">
            <Clover.Body controls={false} style={{ height }} />
          </Region>
          <Region name="Metadata" data-part="metadata">
            <Clover.Metadata className={styles.recipeNotes} />
          </Region>
          <Region
            name="Collection"
            className={styles.recipeInset}
            data-on
            data-part="collection"
          >
            <Clover.Collection
              headingLevel={4}
              className={styles.recipeNotes}
            />
          </Region>
        </Clover.Root>
      )}
    </section>
  );
});

/**
 * A part in the assembled viewer: outlined, its name shown, while its tile is pointed at.
 */
function Region({
  name,
  className,
  children,
  ...rest
}: {
  name: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement> & {
    "data-on"?: boolean;
    "data-part"?: string;
  }) {
  return (
    <div
      className={className ? `${styles.region} ${className}` : styles.region}
      {...rest}
    >
      <span className={styles.regionName} aria-hidden="true">
        {name}
        {/* What it adds to a page, shown while the Lightweight story is up (`data-weighed`). */}
        {name in partLoads && (
          <span className={styles.regionSize}>
            {" "}
            <Flavored
              react={`${partLoads[name as keyof typeof partLoads]} kB`}
              webComponents={`${elementLoads[name as keyof typeof elementLoads]} kB`}
            />
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/** The parts of the example viewer, which its code lists and a reader can reorder. */
type ViewerPart =
  | "thumbnail"
  | "label"
  | "body"
  | "items"
  | "summary"
  | "metadata";

const PART_NAMES: Record<ViewerPart, string> = {
  thumbnail: "Thumbnail",
  label: "Label",
  body: "Body",
  items: "Items",
  summary: "Summary",
  metadata: "Metadata",
};

/** The values the example viewer's code lets a reader change, as they start. */
interface ViewValues {
  /** Body's height, in pixels. */
  height: number;
  /** Body's control cluster. */
  controls: boolean;
  layout: Clover.ItemsLayout;
  /**
   * Items' size where the code sets one: a carousel's picture height
   * (`--clover-items-height`), or a grid's or list's column (`--clover-items-size`).
   */
  itemsSize?: string;
  /** The parts, in the order the code writes them and the viewer shows them. */
  order: ViewerPart[];
}

const VIEW_DEFAULTS: ViewValues = {
  height: 240,
  controls: true,
  layout: "carousel",
  order: ["thumbnail", "label", "body", "items", "summary", "metadata"],
};

const LAYOUTS: Clover.ItemsLayout[] = ["carousel", "list", "grid"];

/*
 * The recipe side's Body height, its own: tied to the viewer's code, every change
 * there redrew the recipe's viewer too, unseen.
 */
const RECIPE_HEIGHT = 220;

/** The custom property that sizes Items' pictures in a layout (`Items.css`). */
const itemsSizeProperty = (layout: Clover.ItemsLayout) =>
  layout === "carousel" ? "--clover-items-height" : "--clover-items-size";

type TokenKind =
  | "keyword"
  | "string"
  | "tag"
  | "attr"
  | "punctuation"
  | "number"
  | "property";

/** A run of code: its text, which Copy copies, and for a value to change, its control. */
interface Token {
  kind?: TokenKind;
  text: string;
  control?: React.ReactNode;
}

/** A line of code, its depth in the tree, and the part it writes, if any. */
interface Line {
  part?: PartKey;
  depth: number;
  tokens: Token[];
}

const run =
  (kind?: TokenKind) =>
  (text: string): Token => ({ kind, text });
const plain = run();
const keyword = run("keyword");
const str = run("string");
const tag = run("tag");
const attr = run("attr");
const punct = run("punctuation");
const num = run("number");
const property = run("property");

const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: styles.tokenKeyword,
  string: styles.tokenString,
  tag: styles.tokenTag,
  attr: styles.tokenAttr,
  punctuation: styles.tokenPunctuation,
  number: styles.tokenNumber,
  property: styles.tokenProperty,
};

/** `<Clover.Name a="b" />` on one line. */
const element = (name: string, attrs: Token[][] = []): Token[] => [
  punct("<"),
  tag(`Clover.${name}`),
  ...attrs.flatMap((tokens) => [plain(" "), ...tokens]),
  punct(" />"),
];

/** A part's element, `<clover-name a="b"></clover-name>`, on one line: the editor's HTML. */
const htmlElement = (name: string, attrs: Token[][] = []): Token[] => [
  punct("<"),
  tag(elementTag(name)),
  ...attrs.flatMap((tokens) => [plain(" "), ...tokens]),
  punct("></"),
  tag(elementTag(name)),
  punct(">"),
];

/** A part moved from one place in the order to another. */
const moved = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * The code behind the example viewer, as an editor under it: its Root and the parts in
 * it, in order, as they are written, without the class names and outlines that dress it
 * for this page. Its values are live (drag Body's height, switch its controls, pick
 * Items' layout), and each part's lines can be dragged into another order (by mouse
 * anywhere on them, by touch from the grip, by keyboard with the grip's arrow keys). The
 * viewer follows, so the code is always what it shows. A part's lines outline the part in
 * the viewer while pointed at, as its tile does.
 */
const ViewerCode = React.memo(function ViewerCode({
  id,
  open,
  resource,
  order,
  view,
  onView,
  point,
  change = 0,
  rows = 0,
}: {
  id: string;
  open: boolean;
  resource: string;
  order: ViewerPart[];
  view: ViewValues;
  onView: React.Dispatch<React.SetStateAction<ViewValues>>;
  point: (key: PartKey) => React.HTMLAttributes<HTMLElement>;
  /**
   * Counts the changes made for the reader (the Composable story's), each crossfaded
   * from the code before it, its new lines lit, rather than simply redrawn.
   */
  change?: number;
  /**
   * Lines it always shows, blank ones after the code where it has fewer, and none of
   * them wrapping: where a change is made for the reader, so its height stays put.
   */
  rows?: number;
}) {
  const set = (change: Partial<ViewValues>) =>
    onView((values) => ({ ...values, ...change }));
  /*
   * The code in the reader's choice (the header's switch, `code-flavor.ts`): React, or
   * the same layout as Clover's elements, its values as live, a part's lines as many.
   */
  const html = useCodeFlavor() === "web-components";
  const hint = useId();
  const pickedName = useId();
  /*
   * The part picked to move without a drag: by a press on its lines, or focus on its
   * grip. Move up and Move down in the head move it (WCAG 2.5.7); Escape lets it go.
   */
  const [picked, setPicked] = useState<ViewerPart | null>(null);
  const pickedAt = picked ? order.indexOf(picked) : -1;
  useEffect(() => {
    if (!picked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setPicked(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [picked]);
  const [copied, setCopied] = useState(false);
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  // The parts in a new order; the parts this resource has none of keep their place after.
  const reorder = (next: ViewerPart[]) =>
    onView((values) => ({
      ...values,
      order: [...next, ...values.order.filter((key) => !next.includes(key))],
    }));

  // A drag: pressed (`press`), then moving once past a few pixels (`drag`).
  const blocks = useRef(new Map<ViewerPart, HTMLElement>());
  const grips = useRef(new Map<ViewerPart, HTMLButtonElement>());
  const press = useRef<{
    from: number;
    y: number;
    rects: { top: number; height: number }[];
  } | null>(null);
  type Drag = { from: number; to: number; dy: number };
  const [drag, setDrag] = useState<Drag | null>(null);
  // The latest, for the drop, which may come before the last move has rendered.
  const dragged = useRef<Drag | null>(null);
  const show = (next: Drag | null) => {
    dragged.current = next;
    setDrag(next);
  };
  const refocus = useRef<ViewerPart | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    grips.current.get(refocus.current)?.focus();
    refocus.current = null;
  });

  const startDrag = (index: number, event: React.PointerEvent) => {
    dragEnded.current = false;
    const target = event.target as Element;
    const fromGrip = Boolean(target.closest("[data-grip]"));
    if (event.button !== 0) return;
    // A value is changed, not dragged; by touch, only the grip drags, so the page scrolls.
    if (!fromGrip && target.closest("button, select, input")) return;
    if (!fromGrip && event.pointerType !== "mouse") return;
    event.preventDefault();
    // Moves past the part's edges still drag it. (A pointer the browser has already let
    // go of cannot be captured, and needs not be.)
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The press goes on uncaptured.
    }
    press.current = {
      from: index,
      y: event.clientY,
      rects: order.map((key) => {
        const rect = blocks.current.get(key)!.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }),
    };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const pressed = press.current;
    if (!pressed) return;
    const dy = event.clientY - pressed.y;
    if (!dragged.current && Math.abs(dy) < 4) return;
    const { top, height } = pressed.rects[pressed.from];
    const middle = top + height / 2 + dy;
    const to = pressed.rects.filter(
      (rect, index) =>
        index !== pressed.from && rect.top + rect.height / 2 < middle,
    ).length;
    show({ from: pressed.from, to, dy });
  };

  const endDrag = () => {
    const last = dragged.current;
    press.current = null;
    if (last && last.to !== last.from)
      reorder(moved(order, last.from, last.to));
    // The click that ends a drag is not a pick.
    if (last) dragEnded.current = true;
    show(null);
  };

  // A press on a part's lines that moved nothing picks it, or lets it go; its grip's picks it.
  const dragEnded = useRef(false);
  const pick = (key: ViewerPart, event: React.MouseEvent) => {
    if (dragEnded.current) {
      dragEnded.current = false;
      return;
    }
    const target = event.target as Element;
    if (target.closest("[data-grip]")) return setPicked(key);
    if (target.closest("button, select, input")) return;
    if (picked === key) return setPicked(null);
    setPicked(key);
    // The keys then move the part picked, not one whose grip had focus.
    grips.current.get(key)?.focus({ preventScroll: true });
  };

  // While a part is dragged, the others step aside for it.
  const shift = (index: number) => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    const height = press.current?.rects[drag.from].height ?? 0;
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return -height;
    if (drag.to < drag.from && index >= drag.to && index < drag.from)
      return height;
    return 0;
  };

  const step = (index: number, by: number, fromGrip = true) => {
    const to = index + by;
    if (to < 0 || to >= order.length) return;
    const key = order[index];
    if (fromGrip) refocus.current = key;
    reorder(moved(order, index, to));
    setSaid(`${PART_NAMES[key]}, ${to + 1} of ${order.length}`);
  };

  const partLines = (key: ViewerPart): Line[] =>
    html ? htmlLines(key) : jsxLines(key);

  // Each part as Clover's elements write it: what `jsxLines` writes, in HTML.
  const htmlLines = (key: ViewerPart): Line[] => {
    switch (key) {
      case "thumbnail":
        return [
          {
            depth: 1,
            tokens: htmlElement("Thumbnail", [
              [attr("alt"), punct("="), str('""')],
              [attr("size"), punct("="), str('"128"')],
            ]),
          },
        ];
      case "label":
        return [
          {
            depth: 1,
            tokens: htmlElement("Label", [
              [attr("as"), punct("="), str('"h3"')],
            ]),
          },
        ];
      case "body":
        return [
          { depth: 1, tokens: [punct("<"), tag("clover-body")] },
          {
            depth: 2,
            tokens: [
              attr("controls"),
              punct('="'),
              {
                text: String(view.controls),
                control: (
                  <Switch
                    label="Body controls"
                    value={view.controls}
                    onChange={(controls) => set({ controls })}
                    className={`${styles.value} ${styles.tokenNumber}`}
                  />
                ),
              },
              punct('"'),
            ],
          },
          {
            depth: 2,
            tokens: [
              attr("style"),
              punct('="'),
              property("height"),
              punct(": "),
              {
                text: String(view.height),
                control: (
                  <Scrub
                    label="Body height, in pixels"
                    min={120}
                    max={480}
                    value={view.height}
                    onChange={(height) => set({ height })}
                    className={`${styles.value} ${styles.scrub} ${styles.tokenNumber}`}
                  />
                ),
              },
              plain("px"),
              punct('">'),
            ],
          },
          {
            depth: 1,
            tokens: [punct("</"), tag("clover-body"), punct(">")],
          },
        ];
      case "items": {
        const layout: Token[] = [
          attr("layout"),
          // The menu shows its value quoted, `"carousel"`, as the attribute writes it.
          punct("="),
          {
            text: `"${view.layout}"`,
            control: (
              <Choice
                label="Items layout"
                options={LAYOUTS}
                value={view.layout}
                onChange={(next) => set({ layout: next })}
                className={`${styles.value} ${styles.choice} ${styles.tokenString}`}
              />
            ),
          },
        ];
        if (!view.itemsSize)
          return [{ depth: 1, tokens: htmlElement("Items", [layout]) }];
        return [
          { depth: 1, tokens: [punct("<"), tag("clover-items")] },
          { depth: 2, tokens: layout },
          {
            depth: 2,
            tokens: [
              attr("style"),
              punct('="'),
              property(itemsSizeProperty(view.layout)),
              punct(": "),
              plain(view.itemsSize),
              punct('">'),
            ],
          },
          { depth: 1, tokens: [punct("</"), tag("clover-items"), punct(">")] },
        ];
      }
      default:
        return [{ depth: 1, tokens: htmlElement(PART_NAMES[key]) }];
    }
  };

  const jsxLines = (key: ViewerPart): Line[] => {
    switch (key) {
      case "thumbnail":
        return [
          {
            depth: 1,
            tokens: element("Thumbnail", [
              [attr("alt"), punct("="), str('""')],
              [attr("size"), punct("={"), num("128"), punct("}")],
            ]),
          },
        ];
      case "label":
        return [
          {
            depth: 1,
            tokens: element("Label", [[attr("as"), punct("="), str('"h3"')]]),
          },
        ];
      case "body":
        return [
          { depth: 1, tokens: [punct("<"), tag("Clover.Body")] },
          {
            depth: 2,
            tokens: [
              attr("controls"),
              punct("={"),
              {
                text: String(view.controls),
                control: (
                  <Switch
                    label="Body controls"
                    value={view.controls}
                    onChange={(controls) => set({ controls })}
                    className={`${styles.value} ${styles.tokenNumber}`}
                  />
                ),
              },
              punct("}"),
            ],
          },
          {
            depth: 2,
            tokens: [
              attr("style"),
              punct("={{ "),
              property("height"),
              punct(": "),
              {
                text: String(view.height),
                control: (
                  <Scrub
                    label="Body height, in pixels"
                    min={120}
                    max={480}
                    value={view.height}
                    onChange={(height) => set({ height })}
                    className={`${styles.value} ${styles.scrub} ${styles.tokenNumber}`}
                  />
                ),
              },
              punct(" }}"),
            ],
          },
          { depth: 1, tokens: [punct("/>")] },
        ];
      case "items": {
        const layout: Token[] = [
          attr("layout"),
          punct("="),
          {
            text: `"${view.layout}"`,
            control: (
              <Choice
                label="Items layout"
                options={LAYOUTS}
                value={view.layout}
                onChange={(next) => set({ layout: next })}
                className={`${styles.value} ${styles.choice} ${styles.tokenString}`}
              />
            ),
          },
        ];
        if (!view.itemsSize)
          return [{ depth: 1, tokens: element("Items", [layout]) }];
        // With a size of its own, its props a line each, as a page would write them.
        return [
          { depth: 1, tokens: [punct("<"), tag("Clover.Items")] },
          { depth: 2, tokens: layout },
          {
            depth: 2,
            tokens: [
              attr("style"),
              punct("={{ "),
              str(`"${itemsSizeProperty(view.layout)}"`),
              punct(": "),
              str(`"${view.itemsSize}"`),
              punct(" }}"),
            ],
          },
          { depth: 1, tokens: [punct("/>")] },
        ];
      }
      default:
        return [{ depth: 1, tokens: element(PART_NAMES[key]) }];
    }
  };

  // The package's import, as one module script, keeps the HTML within the rows it has.
  const htmlHead: Line[] = [
    {
      depth: 0,
      tokens: [
        punct("<"),
        tag("script"),
        plain(" "),
        attr("type"),
        punct("="),
        str('"module"'),
        punct(">"),
        keyword("import"),
        plain(" "),
        str('"@nulib/clover/web-components"'),
        punct(";</"),
        tag("script"),
        punct(">"),
      ],
    },
    { depth: 0, tokens: [] },
    {
      depth: 0,
      tokens: [
        punct("<"),
        tag("clover-root"),
        plain(" "),
        attr("iiif-content"),
        punct("="),
        str(JSON.stringify(resource)),
        punct(">"),
      ],
    },
  ];
  const jsxHead: Line[] = [
    {
      depth: 0,
      tokens: [
        keyword("import"),
        plain(" * "),
        keyword("as"),
        plain(" Clover "),
        keyword("from"),
        plain(" "),
        str('"@nulib/clover"'),
        punct(";"),
      ],
    },
    {
      depth: 0,
      tokens: [
        keyword("import"),
        plain(" "),
        str('"@nulib/clover/styles.css"'),
        punct(";"),
      ],
    },
    { depth: 0, tokens: [] },
    {
      depth: 0,
      tokens: [
        punct("<"),
        tag("Clover.Root"),
        plain(" "),
        attr("iiifContent"),
        punct("="),
        str(JSON.stringify(resource)),
        punct(">"),
      ],
    },
  ];
  const head = html ? htmlHead : jsxHead;
  const tail: Line[] = [
    {
      depth: 0,
      tokens: [
        punct("</"),
        tag(html ? "clover-root" : "Clover.Root"),
        punct(">"),
      ],
    },
  ];
  const parts = order.map((key) => ({ key, lines: partLines(key) }));
  const text = [...head, ...parts.flatMap((part) => part.lines), ...tail]
    .map(
      (line) =>
        "  ".repeat(line.depth) +
        line.tokens.map((token) => token.text).join(""),
    )
    .join("\n");

  // Blank lines after the code, up to the rows it keeps (`rows`).
  const code = [...head, ...parts.flatMap((part) => part.lines), ...tail];
  const padding: Line[] = Array.from(
    { length: Math.max(0, rows - code.length) },
    () => ({ depth: 0, tokens: [] }),
  );
  const all = [...code, ...padding];
  const textOf = (line: Line) =>
    "  ".repeat(line.depth) + line.tokens.map((token) => token.text).join("");
  /*
   * A change made for the reader crossfades: the code as it was is laid over the code as
   * it is and fades out, and each line that is new is lit a moment. Where the reader does
   * not want motion, it simply changes, the new lines still lit.
   */
  const shown = useRef<Line[]>(all);
  const [ghost, setGhost] = useState<{ lines: Line[]; fresh: Set<string> }>();
  useEffect(() => {
    if (!change) return;
    const before = shown.current;
    const had = new Set(before.map(textOf));
    setGhost({
      lines: before,
      fresh: new Set(all.map(textOf).filter((line) => !had.has(line))),
    });
    const timer = setTimeout(() => setGhost(undefined), 1600);
    return () => clearTimeout(timer);
  }, [change]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    shown.current = all;
  });

  // Lines are numbered by where they are, not which part they belong to.
  let number = 0;
  const lineOf = (line: Line, key: React.Key, grip?: React.ReactNode) => (
    <span
      key={key}
      className={styles.codeLine}
      data-fresh={ghost?.fresh.has(textOf(line)) || undefined}
    >
      <span className={styles.gripCell}>{grip}</span>
      <span className={styles.lineNumber} aria-hidden="true">
        {(number += 1)}
      </span>
      <span
        className={styles.lineText}
        style={{ "--depth": line.depth } as React.CSSProperties}
      >
        {line.tokens.length === 0
          ? " "
          : line.tokens.map((token, at) =>
              token.control ? (
                <React.Fragment key={at}>{token.control}</React.Fragment>
              ) : (
                <span
                  key={at}
                  className={token.kind ? TOKEN_CLASS[token.kind] : undefined}
                >
                  {token.text}
                </span>
              ),
            )}
      </span>
    </span>
  );

  return (
    <div
      id={id}
      role="group"
      aria-label="Code"
      className={styles.editor}
      data-open={open || undefined}
      data-rows={rows || undefined}
    >
      <div className={styles.editorInner}>
        <div className={styles.editorFrame}>
          <div className={styles.editorHead}>
            <span>{html ? "HTML" : "JSX"}</span>
            {picked && (
              <div
                role="group"
                aria-labelledby={pickedName}
                className={styles.moves}
              >
                <span id={pickedName} className={styles.picked}>
                  {PART_NAMES[picked]}
                </span>
                <button
                  type="button"
                  className={styles.copy}
                  aria-disabled={pickedAt <= 0 || undefined}
                  onClick={() => step(pickedAt, -1, false)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className={styles.copy}
                  aria-disabled={pickedAt >= order.length - 1 || undefined}
                  onClick={() => step(pickedAt, 1, false)}
                >
                  Move down
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.copy}
              onClick={() =>
                navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => undefined,
                )
              }
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <span role="status" className={styles.visuallyHidden}>
              {copied ? "Copied the code" : said}
            </span>
            <span id={hint} className={styles.visuallyHidden}>
              Arrow up or down moves the part, as Move up and Move down do.
            </span>
          </div>
          <div className={styles.codeStack}>
            {ghost && (
              <pre
                className={`${styles.codeText} ${styles.codeGhost}`}
                aria-hidden="true"
              >
                <code>
                  {ghost.lines.map((line, index) => (
                    <span key={index} className={styles.codeLine}>
                      <span className={styles.gripCell} />
                      <span className={styles.lineNumber}>{index + 1}</span>
                      <span
                        className={styles.lineText}
                        style={{ "--depth": line.depth } as React.CSSProperties}
                      >
                        {line.tokens.length === 0
                          ? " "
                          : line.tokens.map((token, at) => (
                              <span
                                key={at}
                                className={
                                  token.kind
                                    ? TOKEN_CLASS[token.kind]
                                    : undefined
                                }
                              >
                                {token.text}
                              </span>
                            ))}
                      </span>
                    </span>
                  ))}
                </code>
              </pre>
            )}
            <pre
              className={styles.codeText}
              data-dragging={drag ? true : undefined}
              data-crossfade={ghost ? true : undefined}
            >
              <code>
                {head.map((line, index) => lineOf(line, `head-${index}`))}
                {parts.map(({ key, lines }, index) => (
                  <span
                    key={key}
                    ref={(node) => {
                      if (node) blocks.current.set(key, node);
                      else blocks.current.delete(key);
                    }}
                    className={styles.codeBlock}
                    data-dragged={drag?.from === index || undefined}
                    data-picked={picked === key || undefined}
                    onClick={(event) => pick(key, event)}
                    style={{ transform: `translateY(${shift(index)}px)` }}
                    {...point(key)}
                    onPointerDown={(event) => startDrag(index, event)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    {lines.map((line, at) =>
                      lineOf(
                        line,
                        at,
                        at === 0 && (
                          <button
                            ref={(node) => {
                              if (node) grips.current.set(key, node);
                              else grips.current.delete(key);
                            }}
                            type="button"
                            data-grip
                            className={styles.grip}
                            aria-label={`Move ${PART_NAMES[key]}`}
                            aria-describedby={hint}
                            onFocus={() => setPicked(key)}
                            onKeyDown={(event) => {
                              const by =
                                event.key === "ArrowUp"
                                  ? -1
                                  : event.key === "ArrowDown"
                                    ? 1
                                    : 0;
                              if (!by) return;
                              event.preventDefault();
                              step(index, by);
                            }}
                          >
                            <svg
                              width="8"
                              height="12"
                              viewBox="0 0 8 12"
                              aria-hidden="true"
                              focusable="false"
                            >
                              {[2, 6, 10].flatMap((y) =>
                                [2, 6].map((x) => (
                                  <circle
                                    key={`${x}${y}`}
                                    cx={x}
                                    cy={y}
                                    r="1.1"
                                    fill="currentColor"
                                  />
                                )),
                              )}
                            </svg>
                          </button>
                        ),
                      ),
                    )}
                  </span>
                ))}
                {tail.map((line, index) => lineOf(line, `tail-${index}`))}
                {padding.map((line, index) => lineOf(line, `pad-${index}`))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
});

/** The map's part, once MapLibre's worker is set: loaded only for a resource with places. */
function MapTile() {
  const ready = useMapWorker(true);
  return (
    <div className={styles.map}>
      {ready && (
        <Suspense fallback={null}>
          <MapPart />
        </Suspense>
      )}
    </div>
  );
}
