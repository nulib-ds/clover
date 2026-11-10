import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as Clover from "../../parts";
import { mediaOf } from "./media";

/**
 * Document's column, as a PDF reader's continuous view: every view down it, a spread to
 * a sheet, each fitted whole and as tall as the column less a strip, so the top of the
 * next always shows under it. A Timeline or a Scene has no shape to fit (no width and
 * height): its sheet is the column less that strip, as the Body is Default's pane (Mat,
 * 2026-10-31). The reader scrolls through them as through a page:
 * wheel, trackpad, touch, scrollbar, PageUp and PageDown.
 *
 * The scroll is the reader's alone: it rests where they leave it, a sheet half up the
 * column if so, and nothing nudges it into place (Mat, 2026-11-09). The sheet most in
 * view is the active one, the current view, followed as the column scrolls (at either
 * end of the column, the sheet there). A press on another sheet makes it the active one
 * where it is; choosing a view elsewhere (the thumbnails, the pager, a key) brings its
 * sheet to the top.
 *
 * The sheets are a series of Body entries, one for each view, alike and `2l` apart (Mat,
 * 2026-11-09: "a series of scrolling body entries wrapping each entry of the sequence"):
 * none grows, none fades, the next always in sight. Each is a still, its pictures at
 * about the column's size, and the one live `Canvas` (the `Clover.Body`, holding
 * `children`: zoom, hotspots, media) sits on the active one, drawn exactly over its
 * still; zoomed into, it zooms within its own entry. One live Canvas, not one a sheet: a
 * browser keeps only so many WebGL contexts, and every sheet's tiles would load at once.
 * Moved to another, it stays out of sight, its controls away, until the scroll rests and
 * the Canvas has drawn it; then it shows, and its controls slide in, held at the column's
 * top start whichever sheet it is on (`--clover-template-document-cut`).
 */

/** A still's longer side, in pixels: sharp across most screens (no more than the image has). */
const STILL_SIZE = 1600;
/**
 * A scroll quiet this long has come to rest. A trackpad sends nothing while a finger
 * pauses on it, so this is long enough that a pause mid-gesture does not show the Canvas.
 */
const SETTLE_MS = 200;
/**
 * The Canvas's own controls among the pages: none of the view's, which only the full
 * viewer offers (`VIEW_CONTROLS`), its annotations' list is the aside's (Mat, 2026-11-09: "remove this"), its hotspots still
 * on the page, and its map is the aside's too, which expands over the pages
 * (`SectionContent.tsx`; Mat, 2026-11-09: "remove this from over here. instead someone
 * should be able to do this from the sidebar panel map"). Its information, its summary
 * and metadata, is not offered either (Mat, 2026-11-10: "remove the metadata i at the
 * canvas level"). Choice stays, where a page has one.
 */
const OWN_CONTROLS = {
  zoom: false,
  fullPage: false,
  rotation: false,
  reset: false,
  annotations: false,
  information: false,
  map: false,
} as const;
/*
 * A video's: its full screen its player's own, at its lower right after its captions and
 * its fit, as in every other layout (Mat, 2026-11-09: "the full screen button should be
 * in the lower right for video on canvas"); the template's tray has none for it.
 */
const VIDEO_CONTROLS = { ...OWN_CONTROLS, fullPage: true } as const;
/*
 * A picture's in the full viewer: the view's controls, the Canvas's own, at its top end,
 * as Default has them (Mat, 2026-11-10: "move this to the right side. don't try it
 * different than how we align it in default viewer").
 */
const VIEW_CONTROLS = {
  ...OWN_CONTROLS,
  zoom: true,
  fullPage: true,
  rotation: true,
  reset: true,
} as const;

/* A moving image's frames' own Play and Pause, by their states (Styling's Classes). */
const FRAMES_PLAY = '.clover-canvas-transport-bar [data-button="play"]';
const FRAMES_PAUSE = '.clover-canvas-transport-bar [data-button="pause"]';

/** A Canvas that has not drawn its sheet in this long shows anyway. */
const REVEAL_MS = 1500;

type Canvas = Record<string, any>;

/* Layout effects only where there is a layout: a server render has none. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A Canvas's width over its height; none for a Timeline or a Scene, which have no size. */
const ratioOf = (canvas: Canvas) => {
  const width = Number(canvas?.width);
  const height = Number(canvas?.height);
  return width > 0 && height > 0 ? width / height : undefined;
};

export function Sheets({
  collapseControls,
  canvasOptions,
  expanded = false,
  onExpandedChange,
  onHandle,
  labelledBy,
  children,
}: {
  /** The Body's, as the template is given them. */
  collapseControls?: "auto" | "always";
  canvasOptions?: Clover.CloverCanvasOptions;
  /**
   * The full viewer: the live Canvas over the whole of the column's view, the sheets
   * under it held where they are until it closes (`Document.tsx` holds it, for its
   * magnifier).
   */
  expanded?: boolean;
  /** Asked to open (a press on a sheet, a zoom) or close (Escape, a new document). */
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * The live Canvas's handle, as it is ready, for the template's own controls over the
   * page, which steer it (zoom, the turns, home).
   */
  onHandle?: (handle: Clover.CanvasHandle | null) => void;
  /** The id of what names the column: the resource's title. */
  labelledBy?: string;
  children?: React.ReactNode;
}) {
  const { clover, language } = Clover.useClover("Document");
  const sequence = Clover.useSequence();
  const navigation = Clover.useNavigation();
  const column = useRef<HTMLDivElement>(null);
  const sheetsBox = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);

  /* A spread's pages side by side, as the Canvas lays them: the book's way around. */
  const reversed =
    sequence.direction === "right-to-left" ||
    sequence.direction === "bottom-to-top";
  const sheets = useMemo(
    () =>
      sequence.views.map((view) => {
        const canvases = view.map((index) => sequence.canvases[index]);
        const shown = reversed ? [...canvases].reverse() : canvases;
        const ratios = shown.map(ratioOf);
        return {
          key: canvases.map((canvas) => canvas.id).join("|"),
          first: canvases[0]?.id as string,
          canvases: shown,
          // None where one has no size: the sheet takes the column (`data-fill`).
          ratio: ratios.every(Boolean)
            ? ratios.reduce<number>((sum, ratio) => sum + ratio!, 0)
            : undefined,
        };
      }),
    [sequence, reversed],
  );

  /* The sheet the live Canvas sits on, and the view it shows: the current one. */
  const position = Math.max(0, navigation.position);
  const latest = useRef({ sheets, position });
  latest.current = { sheets, position };
  /* A view made current here, so the change need not bring it again. */
  const followed = useRef<number | null>(null);
  /* Made current where the scroll rested: the Canvas shows on it once it has moved there. */
  const resting = useRef(false);
  /* The full viewer open, and the view it opened on: read by what reads only refs. */
  const open = useRef(expanded);
  const openedOn = useRef(0);
  const askExpanded = useRef(onExpandedChange);
  askExpanded.current = onExpandedChange;
  /* The sheet a scroll of ours is bringing to the top; the reader's own input lets it go. */
  const aiming = useRef<number | null>(null);
  /*
   * Where the column rests, as the active sheet and how far down it the column's top is,
   * a share of its height: kept as the sheets change size, so the view holds still.
   */
  const anchor = useRef({ index: 0, share: 0 });
  /* Stops a reveal still waiting for the Canvas to draw. */
  const stopReveal = useRef<() => void>(() => undefined);
  /* A scroll of ours that is no reader's: the column only keeps its sheet at the top. */
  const quiet = useRef(false);

  const sheetAt = (index: number) =>
    sheetsBox.current?.children[index] as HTMLElement | undefined;

  /* The gap between two sheets (`Document.css`), kept in sight over one brought up. */
  const gapOf = () =>
    sheetsBox.current
      ? parseFloat(getComputedStyle(sheetsBox.current).rowGap) || 0
      : 0;
  /* The space at a sheet's sides, the gap, which the Canvas fits its pictures inside. */
  const insetOf = (sheet: HTMLElement) =>
    parseFloat(getComputedStyle(sheet).paddingInlineStart) || 0;

  /*
   * Where a sheet is at the top: the gap above it in sight, as the first's is, or as far
   * as the column scrolls.
   */
  const placeOf = (index: number) => {
    const element = column.current;
    const sheet = sheetAt(index);
    if (!element || !sheet || sheet === live.current) return 0;
    return Math.max(
      0,
      Math.min(
        sheet.offsetTop - gapOf(),
        element.scrollHeight - element.clientHeight,
      ),
    );
  };

  /*
   * How far the column's top is from the live Canvas's, so its controls hold at the
   * column's top start whichever sheet is active, never moving with it (Mat, 2026-11-09:
   * "this should always just stay here … it targets whatever one is ready"): up to it
   * where the sheet is lower, down where it is scrolled past
   * (`--clover-template-document-cut`, `Document.css`). Read at rest only: while the
   * column scrolls the Canvas is out of sight.
   */
  const cut = () => {
    const element = column.current;
    const layer = live.current;
    if (!element || !layer) return;
    const by = open.current ? 0 : element.scrollTop - layer.offsetTop;
    layer.style.setProperty("--clover-template-document-cut", `${by}px`);
  };

  /*
   * The live Canvas over its sheet, on every move and whenever sizes change: its box the
   * sheet and the gap above and below it, as it fits its pictures inside the gap, so
   * they lie exactly on the stills.
   */
  const place = () => {
    const layer = live.current;
    const sheet = sheetAt(latest.current.position);
    if (!layer) return;
    const element = column.current;
    if (open.current && element) {
      // The full viewer: the whole of the column's view, wherever it rests.
      layer.style.top = `${element.scrollTop}px`;
      layer.style.height = `${element.clientHeight}px`;
    } else if (!sheet || sheet === layer) {
      layer.style.top = "0px";
      layer.style.height = "100%";
    } else {
      const inset = insetOf(sheet);
      // To the fraction of a pixel, as a sheet's height is (whole pixels left it a
      // fraction taller than its sheet and the gap round it).
      const box = sheetsBox.current?.getBoundingClientRect();
      const rect = sheet.getBoundingClientRect();
      const top = box ? rect.top - box.top : sheet.offsetTop;
      layer.style.top = `${top - inset}px`;
      layer.style.height = `${rect.height + 2 * inset}px`;
      /*
       * Where its picture's frame lies in it, for the loading mark along the frame's top
       * (`Document.css`; Mat, 2026-11-10: "show the load across the top of the resource
       * … rather than on canvas viewport"). Written only as it changes.
       */
      const frame = sheet.querySelector<HTMLElement>(
        ".clover-template-document-frame",
      );
      if (frame) {
        const at = `${inset + frame.offsetTop}px ${sheet.offsetLeft + frame.offsetLeft}px ${frame.offsetWidth}px`;
        if (framed.current !== at) {
          framed.current = at;
          const [top, left, width] = at.split(" ");
          layer.style.setProperty("--clover-template-document-frame-top", top);
          layer.style.setProperty(
            "--clover-template-document-frame-left",
            left,
          );
          layer.style.setProperty(
            "--clover-template-document-frame-width",
            width,
          );
        }
      }
    }
    cut();
  };
  const framed = useRef("");

  /*
   * Where the column rests now, kept so it holds there as the sheets change size: from
   * where the active sheet rests at the top, the gap over it (`placeOf`), a share of its
   * height on, so a sheet at its place stays at it.
   */
  const keep = () => {
    const element = column.current;
    const index = latest.current.position;
    const sheet = sheetAt(index);
    if (!element || !sheet || sheet === live.current) return;
    anchor.current = {
      index,
      share:
        (element.scrollTop - (sheet.offsetTop - gapOf())) /
        (sheet.offsetHeight || 1),
    };
  };

  /*
   * The column held where it rested, at once and as no reader's scroll, when the sheets
   * change size (the column resized, the panel opened beside it, a sheet grown by zoom):
   * the active sheet as far up the column as it was. Never while a scroll is running or
   * on its way.
   */
  function pin() {
    const element = column.current;
    if (
      !element ||
      element.hasAttribute("data-scrolling") ||
      aiming.current !== null
    )
      return;
    const index = latest.current.position;
    if (anchor.current.index !== index) anchor.current = { index, share: 0 };
    const sheet = sheetAt(index);
    const to =
      sheet && sheet !== live.current
        ? Math.min(
            Math.max(
              0,
              sheet.offsetTop -
                gapOf() +
                anchor.current.share * sheet.offsetHeight,
            ),
            element.scrollHeight - element.clientHeight,
          )
        : 0;
    if (Math.abs(element.scrollTop - to) <= 1) return cut();
    quiet.current = true;
    element.scrollTop = to;
    cut();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (quiet.current = false)),
    );
  }

  useLayout(place);

  /*
   * Stepped to by the keyboard: focus goes to that page's own stop, its Canvas or its
   * Play, once it is there, and its place is said, as focus stays put or moves to a stop
   * of the same name.
   */
  const stepped = useRef(false);
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (!stepped.current) return;
    stepped.current = false;
    const labels = (sheets[position]?.canvases ?? [])
      .map((canvas) => Clover.localize(canvas?.label as never, language).text)
      .filter(Boolean)
      .join(", ");
    const place = t("canvasPosition", {
      index: position + 1,
      total: navigation.total,
    });
    setSaid(labels ? `${labels}, ${place}` : place);
    let frames = 60;
    let frame = 0;
    const land = () => {
      const layer = live.current;
      const stop =
        layer?.querySelector<HTMLElement>(
          ".clover-template-document-live-play",
        ) ?? layer?.querySelector<HTMLElement>(".clover-canvas-viewport");
      if (stop && getComputedStyle(stop).visibility !== "hidden") {
        if (document.activeElement !== stop)
          stop.focus({ preventScroll: true });
        return;
      }
      if (frames-- > 0) frame = requestAnimationFrame(land);
    };
    frame = requestAnimationFrame(land);
    return () => cancelAnimationFrame(frame);
    // `sheets` and `t` follow `position`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);
  useEffect(() => {
    const resized = new ResizeObserver(() => {
      // The full viewer holds the column still under it: nothing to keep.
      if (!open.current) pin();
      place();
    });
    if (sheetsBox.current) resized.observe(sheetsBox.current);
    if (column.current) resized.observe(column.current);
    return () => resized.disconnect();
    // `place` and `pin` read only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Out of sight while it moves: the Canvas, and its controls. */
  const hold = () => {
    stopReveal.current();
    for (const [element, name] of [
      [column.current, "data-scrolling"],
      [live.current, "data-moved"],
    ] as const)
      if (element && !element.hasAttribute(name))
        element.setAttribute(name, "");
  };

  /*
   * The sheet is in place: once the Canvas has drawn it (or shows its placeholder, or
   * fails, or takes too long), the Canvas shows and its controls slide in.
   */
  const reveal = () => {
    const element = column.current;
    const layer = live.current;
    if (!element || !layer) return;
    stopReveal.current();
    keep();
    cut();
    const drawn = () => {
      const figure = layer.querySelector(".clover-canvas");
      return (
        !figure ||
        figure.getAttribute("data-status") !== "loading" ||
        figure.getAttribute("data-placeholder") === "true"
      );
    };
    let frame = 0;
    const watch = new MutationObserver(() => drawn() && show());
    const late = setTimeout(() => show(), REVEAL_MS);
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(late);
      watch.disconnect();
    };
    const show = () => {
      stop();
      layer.removeAttribute("data-moved");
      element.removeAttribute("data-scrolling");
    };
    stopReveal.current = stop;
    // Two frames on, the Canvas has taken the view: its status is the new view's.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (drawn()) return show();
        watch.observe(layer, {
          attributes: true,
          subtree: true,
          attributeFilter: ["data-status", "data-placeholder"],
        });
      });
    });
  };

  /*
   * A video showing its frames covers the active sheet's still, which need not have the
   * video's shape (a placeholderCanvas of another shape, a Canvas with no size, fitted
   * whole in the column): the still goes out of sight, so none of it shows around the
   * video (`data-covered`, `Document.css`). Until the video has a frame, while its
   * placeholder shows, and while the Canvas moves to another sheet, the still stays. A
   * picture's Canvas has its sheet's shape, and draws over its still exactly.
   */
  useEffect(() => {
    const element = column.current;
    const layer = live.current;
    if (!element || !layer) return;
    const check = () => {
      const figure = layer.querySelector(".clover-canvas");
      const video = layer.querySelector("video");
      element.toggleAttribute(
        "data-covered",
        Boolean(
          figure &&
            video &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            figure.getAttribute("data-media") === "video" &&
            figure.getAttribute("data-placeholder") !== "true" &&
            !layer.hasAttribute("data-moved"),
        ),
      );
    };
    check();
    const watch = new MutationObserver(check);
    watch.observe(layer, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-media", "data-placeholder", "data-moved"],
    });
    // A media element's events do not bubble: they are caught on their way down.
    for (const type of ["loadeddata", "emptied"])
      layer.addEventListener(type, check, true);
    return () => {
      watch.disconnect();
      for (const type of ["loadeddata", "emptied"])
        layer.removeEventListener(type, check, true);
    };
  }, []);

  /* A sheet to the top: smoothly, or at once for less motion or a new document. */
  const bring = (index: number, instantly = false) => {
    const element = column.current;
    if (!element) return;
    const top = placeOf(index);
    if (Math.abs(element.scrollTop - top) <= 1) return reveal();
    hold();
    aiming.current = index;
    const still =
      instantly ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top, behavior: still ? "auto" : "smooth" });
  };

  /*
   * A press on a sheet not active: it is the active one where it is, the live Canvas
   * coming to it as the scroll's rest brings it, and nothing scrolls (Mat, 2026-11-09:
   * "click into the item to open up the full viewer").
   */
  const activate = (index: number) => {
    const { sheets, position } = latest.current;
    if (index === position || !sheets[index]) return;
    hold();
    zoom(false);
    followed.current = index;
    resting.current = true;
    clover.goTo(sheets[index].first);
  };

  /*
   * The sheets shown, by their views' Canvases: a new document, or new views, where they
   * differ. Not the list itself, which is made again as the current view changes.
   */
  const shownSheets = useRef<string | null>(null);
  const sheetKeys = useMemo(
    () => sheets.map((sheet) => sheet.key).join("\n"),
    [sheets],
  );
  /*
   * A new current view. Made so here, by the reader's scroll or a press on its sheet, it
   * stays where it is; chosen elsewhere (the thumbnails, the pager, a key, a link, a new
   * document), its sheet is brought to the top.
   */
  useLayout(() => {
    const fresh = shownSheets.current !== sheetKeys;
    shownSheets.current = sheetKeys;
    zoom(false);
    // A new document opens among its sheets; another view, in the full viewer, there.
    if (fresh && open.current) askExpanded.current?.(false);
    else if (open.current) {
      followed.current = null;
      resting.current = false;
      return reveal();
    }
    if (followed.current === position && !fresh) {
      followed.current = null;
      if (resting.current) reveal();
      resting.current = false;
      return;
    }
    followed.current = null;
    resting.current = false;
    bring(position, fresh);
    // `bring` and `zoom` read only refs.
  }, [position, sheetKeys]);

  /* The reader's scroll: where it is going, and where it comes to rest. */
  useEffect(() => {
    const element = column.current;
    if (!element) return;
    let frame = 0;
    let rest: ReturnType<typeof setTimeout> | undefined;
    let held = false;

    /*
     * The sheet most in view from here: the one the column shows the most of, the first
     * of two that show as much. At the very top, the first; at the very end, the last, as
     * a short last sheet may show less than the one before it.
     */
    const choose = (top: number) => {
      const count = latest.current.sheets.length;
      if (count < 2) return 0;
      if (top <= 0.5) return 0;
      if (top >= element.scrollHeight - element.clientHeight - 0.5)
        return count - 1;
      const bottom = top + element.clientHeight;
      let best = 0;
      let most = -1;
      for (let index = 0; index < count; index++) {
        const sheet = sheetAt(index);
        if (!sheet || sheet === live.current) break;
        const from = sheet.offsetTop;
        if (from >= bottom) break;
        const shown =
          Math.min(from + sheet.offsetHeight, bottom) - Math.max(from, top);
        if (shown > most + 0.5) {
          most = shown;
          best = index;
        }
      }
      return best;
    };

    /* The view to make current, as the scroll goes: the thumbnails and pager follow. */
    const follow = () => {
      frame = 0;
      if (aiming.current !== null) return;
      const index = choose(element.scrollTop);
      const { sheets, position } = latest.current;
      if (index === position || !sheets[index]) return;
      hold();
      zoom(false);
      followed.current = index;
      clover.goTo(sheets[index].first);
    };

    /*
     * At rest, wherever the reader left it: the sheet most in view (or the one a scroll
     * of ours brought) is current, and the Canvas shows on it. Nothing scrolls.
     */
    const settle = () => {
      if (held) return;
      if (open.current) return reveal();
      const { sheets, position } = latest.current;
      const top = element.scrollTop;
      const aimed = aiming.current;
      aiming.current = null;
      const target =
        aimed !== null && Math.abs(top - placeOf(aimed)) <= 1
          ? aimed
          : choose(top);
      if (sheets[target] && target !== position) {
        hold();
        zoom(false);
        followed.current = target;
        resting.current = true;
        clover.goTo(sheets[target].first);
        return;
      }
      reveal();
    };

    const later = () => {
      clearTimeout(rest);
      rest = setTimeout(settle, SETTLE_MS);
    };

    const onScroll = () => {
      if (quiet.current) return;
      // The full viewer holds the column's view, wherever the column is.
      if (open.current) return place();
      // The Canvas's controls hold at the column's top as it scrolls, frame by frame.
      cut();
      hold();
      later();
      if (!frame) frame = requestAnimationFrame(follow);
    };

    // The reader's own hand: a scroll of ours gives way to it, and a finger on the column
    // (or the scrollbar held) keeps it from resting until let go.
    const take = (event: Event) => {
      aiming.current = null;
      // A finger, or a press on the scrollbar (the column's own box), not a wheel.
      if (
        event.type === "touchstart" ||
        (event.type === "pointerdown" && event.target === element)
      )
        held = true;
    };
    const release = () => {
      if (!held) return;
      held = false;
      later();
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("wheel", take, { passive: true });
    element.addEventListener("touchstart", take, { passive: true });
    element.addEventListener("pointerdown", take);
    window.addEventListener("touchend", release);
    window.addEventListener("touchcancel", release);
    window.addEventListener("pointerup", release);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(rest);
      stopReveal.current();
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", take);
      element.removeEventListener("touchstart", take);
      element.removeEventListener("pointerdown", take);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
      window.removeEventListener("pointerup", release);
    };
    // `placeOf`, `hold`, `reveal` and `zoom` read only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clover]);

  /*
   * Zoomed into, moved or turned (the Canvas no longer at home): it zooms within its own
   * sheet, which keeps its size, and takes every drag, to move about the page, where at
   * home a finger scrolls the column (`data-zoomed`, `Document.css`). The renderer's own
   * `atHome`, which a resize keeps. Home again, or another view, and it is at home.
   */
  const [handle, setHandle] = useState<Clover.CanvasHandle | null>(null);
  const handOn = useRef(onHandle);
  handOn.current = onHandle;
  const ready = (next: Clover.CanvasHandle | null) => {
    setHandle(next);
    handOn.current?.(next);
    // A moving image among the pages waits as its still, never playing out of sight.
    if (!open.current) requestAnimationFrame(stopFrames);
  };
  // A moving image's frames, stopped: by their own Pause, as a reader would.
  function stopFrames() {
    live.current?.querySelector<HTMLElement>(FRAMES_PAUSE)?.click();
  }
  function zoom(zoomed: boolean) {
    const element = column.current;
    if (!element || element.hasAttribute("data-zoomed") === zoomed) return;
    element.toggleAttribute("data-zoomed", zoomed);
    // Zoomed into among the sheets, it opens as the full viewer.
    if (zoomed && !open.current) askExpanded.current?.(true);
  }

  /*
   * The full viewer, opened or closed. Open, the live Canvas covers the column's view
   * and the column holds still under it (`data-expanded`, `Document.css`); closed, its
   * view goes home, and its sheet is where the column rested where it is wholly in view
   * there, else (another view chosen meanwhile, or it pressed where it partly showed)
   * brought to the top at once.
   */
  useLayout(() => {
    const element = column.current;
    if (!element || open.current === expanded) return;
    open.current = expanded;
    element.toggleAttribute("data-expanded", expanded);
    if (expanded) {
      /*
       * Opened as a scroll of ours runs (a search's hit, chosen from the thumbnails, then
       * zoomed to), it lands at once, so the viewer opens where the column comes to rest.
       */
      if (aiming.current !== null) {
        quiet.current = true;
        element.scrollTo({ top: placeOf(aiming.current), behavior: "instant" });
        aiming.current = null;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => (quiet.current = false)),
        );
      }
      openedOn.current = latest.current.position;
      stopReveal.current();
      live.current?.removeAttribute("data-moved");
      element.removeAttribute("data-scrolling");
      return place();
    }
    handle?.home(true);
    // A video goes back to its still among the pages: paused, never playing unseen.
    live.current?.querySelector("video")?.pause();
    stopFrames();
    zoom(false);
    place();
    /*
     * Its page wholly in view, the column stays where it rested; another chosen
     * meanwhile, or this one pressed where it only partly showed, comes to the top at
     * once, so what was just looked at is what shows.
     */
    const sheet = sheetAt(latest.current.position);
    const seen =
      !!sheet &&
      sheet !== live.current &&
      sheet.offsetTop >= element.scrollTop - 1 &&
      sheet.offsetTop + sheet.offsetHeight <=
        element.scrollTop + element.clientHeight + 1;
    if (latest.current.position !== openedOn.current || !seen)
      bring(latest.current.position, true);
    else reveal();
    // `place`, `zoom`, `bring` and `reveal` read only refs.
  }, [expanded]);

  /*
   * Opened by a press, the full viewer takes focus on its Canvas, as the press was into
   * it, so its keys (zoom, PageUp and PageDown, Escape) work at once (WCAG 2.4.3).
   */
  const openHere = () => {
    askExpanded.current?.(true);
    // Its view hidden while the Canvas opens from its placeholder: focus waits for it,
    // so long as focus is still nowhere else.
    const layer = live.current;
    let frames = Math.round(REVEAL_MS / 16);
    const focus = () => {
      // Its view, or a sound's player, its own Play or Pause.
      const view =
        layer?.querySelector<HTMLElement>(".clover-canvas-viewport") ??
        layer?.querySelector<HTMLElement>(
          ".clover-canvas-transport-bar :is([data-button='pause'], [data-button='play'])",
        );
      if (!layer || !view) return;
      const active = layer.ownerDocument.activeElement;
      // Focus taken elsewhere meanwhile (not the page itself, nor in the Canvas): left.
      const free =
        !active ||
        active === layer.ownerDocument.body ||
        layer.contains(active);
      if (!free || active === view) return;
      if (getComputedStyle(view).visibility !== "hidden")
        return view.focus({ preventScroll: true });
      if (frames-- > 0) requestAnimationFrame(focus);
    };
    focus();
  };

  /*
   * Its video played, from a press on its still's play button: at once where the live
   * Canvas is already on it, in the press (a browser lets a page play with sound only
   * then); else once the Canvas has moved there and has its video.
   */
  // What the active page plays, and Clover's words for its Play.
  const livePlays = mediaOf(sheets[position]?.canvases ?? []);
  const t = Clover.useT();
  const langOf = Clover.useLangOf();

  const playOn = (here: boolean) => {
    const layer = live.current;
    if (!layer) return;
    // What plays it: its media element (a sound's is out of the page), else its frames'
    // own Play (a picture with a duration).
    const find = () =>
      clover.media.get() ??
      layer.querySelector<HTMLMediaElement>("video, audio") ??
      layer.querySelector<HTMLElement>(FRAMES_PLAY) ??
      undefined;
    const start = (what: HTMLElement) =>
      what instanceof HTMLMediaElement
        ? void what.play()?.catch(() => {})
        : what.click();
    if (here) {
      const what = find();
      return what && start(what);
    }
    const before = find();
    let frames = 120;
    const attempt = () => {
      const what = find();
      // A new one for the new page, or, where it stays, one with its source.
      if (what && (what !== before || frames < 60)) return start(what);
      if (frames-- > 0) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  };

  /*
   * A press into the live Canvas among the sheets (a click or a tap, not a drag, and not
   * on one of its controls or hotspots) opens it as the full viewer (Mat, 2026-11-09).
   */
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const into = (event: React.MouseEvent) => {
    const from = pressed.current;
    pressed.current = null;
    if (open.current || !from) return;
    if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 6) return;
    if (
      (event.target as Element).closest?.(
        "button, a, input, select, textarea, [role='button'], [role='menu'], .clover-canvas-controls",
      )
    )
      return;
    openHere();
  };
  useEffect(() => {
    if (!handle) return;
    return handle.on("viewport", () => zoom(!handle.atHome));
    // `zoom` reads only refs.
  }, [handle]);

  return (
    /*
     * The column, a region named by the resource's title, its one stop for the keyboard
     * the page in view: its Canvas, or its Play. From there, among the pages, Up and Down
     * go to the previous page and the next, and Home and End to the first and last, as
     * the thumbnails' list steps, focus going with it to that page's own stop and its
     * place said, and Enter opens it (Mat, 2026-11-10: "it would tab to the active item ... then you could
     * arrow up down. similar to the items manipulation"; WCAG 2.1.1). Taken before the
     * Canvas, whose arrows would move about the page. PageUp and PageDown go a page at a
     * time too, in the full viewer as among the pages. The pages' stills stay out of the
     * tree: the page in view is its Canvas.
     */
    <div
      ref={column}
      className="clover-template-document-column"
      role="region"
      aria-labelledby={labelledBy}
      onKeyDownCapture={(event) => {
        if (open.current || event.altKey || event.ctrlKey || event.metaKey)
          return;
        if (
          !(event.target as Element).closest?.(
            ".clover-canvas-viewport, .clover-template-document-live-play",
          )
        )
          return;
        // Enter on the page's Canvas opens it as the full viewer (Mat, 2026-11-10:
        // "hitting enter on the focused item in the scroller should expand it"); a
        // page that plays, its Play.
        if (
          event.key === "Enter" &&
          (event.target as Element).matches(".clover-canvas-viewport")
        ) {
          event.preventDefault();
          event.stopPropagation();
          openHere();
          return;
        }
        const to = {
          ArrowDown: navigation.hasNext ? navigation.next : null,
          ArrowUp: navigation.hasPrevious ? navigation.previous : null,
          Home: navigation.hasPrevious ? navigation.first : null,
          End: navigation.hasNext ? navigation.last : null,
        }[event.key];
        if (to === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        if (!to) return;
        stepped.current = true;
        to();
      }}
      onKeyDown={(event) => {
        // A sheet at a time, as a reader's PageUp and PageDown turn a page.
        if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
        // Escape closes the full viewer, once nothing inside has taken it.
        if (event.key === "Escape" && open.current) onExpandedChange?.(false);
        else if (event.key === "PageDown" && navigation.hasNext)
          navigation.next();
        else if (event.key === "PageUp" && navigation.hasPrevious)
          navigation.previous();
        else return;
        event.preventDefault();
      }}
    >
      <p
        role="status"
        style={Clover.visuallyHidden}
        lang={langOf("canvasPosition")}
      >
        {said}
      </p>
      <div
        ref={sheetsBox}
        className="clover-template-document-sheets"
        data-single={sheets.length < 2 || undefined}
      >
        {sheets.map((sheet, index) => (
          /*
           * A press on a sheet not active brings it to the top: a pointer's way, beside
           * the thumbnails, the pager and PageUp and PageDown, which a keyboard has.
           */

          <div
            key={sheet.key}
            aria-hidden="true"
            className="clover-template-document-sheet"
            data-active={index === position || undefined}
            data-fill={sheet.ratio === undefined || undefined}
            // What it plays, a video or a sound, for its ground (`Document.css`).
            data-media={mediaOf(sheet.canvases) ?? undefined}
            onClick={(event) => {
              const plays = Boolean(
                (event.target as Element).closest?.("[data-play]"),
              );
              const here = index === latest.current.position;
              activate(index);
              openHere();
              if (plays) playOn(here);
            }}
            style={
              sheet.ratio === undefined
                ? undefined
                : ({ "--ratio": sheet.ratio } as React.CSSProperties)
            }
          >
            {/* Its pictures, side by side, their bounds the frame's (`Document.css`). */}
            <div className="clover-template-document-frame">
              {sheet.canvases.map((canvas) => (
                <Still key={canvas.id} canvas={canvas} />
              ))}
            </div>
            {/*
             * A video's or a sound's still has a play button over it, as a player's
             * poster has (Mat, 2026-11-09: "put a play button over videos with
             * placeholders"), Clover's over a placeholder (`Placeholder.css`). Pressed,
             * it plays in the full viewer (Mat, 2026-11-10: "the large center play on
             * video/sound"); any other page opens from itself, its cursor saying so. Out of
             * the tab order, as the sheet is out of the accessibility tree: a keyboard's
             * is the template's own, over the page's top left, shown as it takes focus
             * (`ViewControls`).
             */}
            {mediaOf(sheet.canvases) !== null && (
              <span className="clover-template-document-play" data-play>
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 512 512"
                  fill="currentColor"
                  stroke="currentColor"
                >
                  <path
                    strokeLinejoin="round"
                    strokeWidth="40"
                    d="M184 128V384L392 256Z"
                  />
                </svg>
              </span>
            )}
          </div>
        ))}
        {}
        <div
          ref={live}
          className="clover-template-document-live"
          // What its page plays, out of sight among the pages (`Document.css`).
          data-media={livePlays ?? undefined}
          onPointerDown={(event) =>
            (pressed.current = { x: event.clientX, y: event.clientY })
          }
          onClick={into}
        >
          {/*
           * Over a page that plays, among the pages, its play button is a real one, the
           * active page's, the keyboard's way in as the pointer's (Mat, 2026-11-10: "I'm
           * seeing an invisible small play button up in top left. this should not be
           * here"): named Play, in its place over the still, playing it and opening the
           * full viewer, focus to its Canvas (`openHere`).
           */}
          {livePlays && !expanded && (
            <button
              type="button"
              className="clover-template-document-play clover-template-document-live-play"
              lang={langOf("playerPlay")}
              onClick={(event) => {
                event.stopPropagation();
                playOn(true);
                openHere();
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 512 512"
                fill="currentColor"
                stroke="currentColor"
              >
                <path
                  strokeLinejoin="round"
                  strokeWidth="40"
                  d="M184 128V384L392 256Z"
                />
              </svg>
              <span style={Clover.visuallyHidden}>{t("playerPlay")}</span>
            </button>
          )}
          <Clover.Body
            className="clover-template-document-body"
            collapseControls={collapseControls}
            /*
             * The view's controls (zoom, the turns, reset, full screen) only in the full
             * viewer, a video's its player's; among the pages the Canvas keeps its own
             * (Choice, the place; `OWN_CONTROLS`). Open at once: the
             * sheet's still is its placeholder.
             */
            controls={
              mediaOf(sheets[position]?.canvases ?? []) === "video"
                ? VIDEO_CONTROLS
                : expanded
                  ? VIEW_CONTROLS
                  : OWN_CONTROLS
            }
            placeholder={false}
            options={canvasOptions}
            onReady={ready}
          >
            {children}
          </Clover.Body>
        </div>
      </div>
    </div>
  );
}

/**
 * Whether `element` has come within a column's height of the column's view, and so stays:
 * a still's image service is read only then, so a Manifest of a thousand pages reads a
 * few. Without IntersectionObserver, at once.
 */
function useNearColumn(element: Element | null): boolean {
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      {
        root: element.closest(".clover-template-document-column"),
        rootMargin: "100% 0px",
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, near]);
  return near;
}

/** A Canvas's still: its picture at about the column's size, or an empty page until then. */
function Still({ canvas }: { canvas: Canvas }) {
  const { clover } = Clover.useClover("Document");
  const source = useMemo(() => Clover.stillSource(canvas), [canvas]);
  const [page, setPage] = useState<HTMLElement | null>(null);
  const near = useNearColumn(page);
  const [src, setSrc] = useState(source?.src);
  useEffect(() => {
    if (!source || source.src) return setSrc(source?.src);
    if (!near) return;
    let current = true;
    void Clover.resolveThumbnail(source, STILL_SIZE, clover.request).then(
      (url) => current && setSrc(url),
    );
    return () => {
      current = false;
    };
  }, [source, clover, near]);
  // Its Canvas's shape; a Timeline's or a Scene's picture is fitted whole in the sheet.
  const ratio = ratioOf(canvas);
  const style = ratio ? { aspectRatio: String(ratio) } : undefined;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      decoding="async"
      loading="lazy"
      src={src}
      style={style}
      // Loaded, its ground goes (`Document.css`).
      onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
    />
  ) : (
    <span ref={setPage} style={style} />
  );
}
