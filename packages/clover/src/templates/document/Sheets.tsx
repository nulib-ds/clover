import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as Clover from "../../parts";

/**
 * Document's stage, as a PDF reader's continuous view: every view down one column, a
 * spread to a sheet, each fitted whole and as tall as the stage less a strip, so the top
 * of the next always shows under it. The reader scrolls through them as through a page:
 * wheel, trackpad, touch, scrollbar, PageUp and PageDown.
 *
 * The top of the stage is the one place a sheet is active. Where the scroll comes to
 * rest, a sheet is brought there: the next one once the active sheet has been scrolled a
 * quarter of its height on (`THRESHOLD`), the previous once a quarter of it is in sight,
 * and otherwise the active one back into place. A press on another sheet brings it
 * there too, and so does choosing a view elsewhere (the thumbnails, the pager, a key).
 * Sheets that are not active are muted (`Document.css`).
 *
 * Each sheet is a still, its pictures at about the stage's size. The one live `Canvas`
 * (`Body`, holding `children`: zoom, hotspots, media) sits on the active sheet, drawn
 * exactly over its still; zoomed into, that sheet grows to the stage's height. Moved to another, it stays out of sight, its controls away, until that sheet is
 * in place at the top and the Canvas has drawn it; then it shows, and its controls slide
 * in.
 */

/** A still's longer side, in pixels: sharp across most screens. */
const STILL_SIZE = 1600;
/**
 * A scroll quiet this long has come to rest. A trackpad sends nothing while a finger
 * pauses on it, so this is long enough that a pause mid-gesture does not bring a sheet in.
 */
const SETTLE_MS = 200;
/** How far, as a share of the way to the next sheet, a scroll goes before that sheet comes in. */
const THRESHOLD = 0.25;
/** A Canvas that has not drawn its sheet in this long shows anyway. */
const REVEAL_MS = 1500;

type Canvas = Record<string, any>;

/* Layout effects only where there is a layout: a server render has none. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A Canvas's width over its height; a recording with no size, a screen's. */
const ratioOf = (canvas: Canvas) => {
  const width = Number(canvas?.width);
  const height = Number(canvas?.height);
  return width > 0 && height > 0 ? width / height : 16 / 9;
};

export function Sheets({ children }: { children?: React.ReactNode }) {
  const { clover } = Clover.useClover("Document");
  const sequence = Clover.useSequence();
  const navigation = Clover.useNavigation();
  const stage = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);

  /* A spread's pages side by side, as the Canvas lays them: the book's way round. */
  const reversed =
    sequence.direction === "right-to-left" ||
    sequence.direction === "bottom-to-top";
  const sheets = useMemo(
    () =>
      sequence.views.map((view) => {
        const canvases = view.map((index) => sequence.canvases[index]);
        const shown = reversed ? [...canvases].reverse() : canvases;
        return {
          key: canvases.map((canvas) => canvas.id).join("|"),
          first: canvases[0]?.id as string,
          canvases: shown,
          ratio: shown.reduce((sum, canvas) => sum + ratioOf(canvas), 0),
        };
      }),
    [sequence, reversed],
  );

  /* The sheet the live Canvas sits on, and the view it shows: the current one. */
  const position = Math.max(0, navigation.position);
  const latest = useRef({ sheets, position });
  latest.current = { sheets, position };
  /* A view this stage made current itself, so the change need not bring it again. */
  const followed = useRef<number | null>(null);
  /* The sheet a scroll of ours is bringing to the top; the reader's own input lets it go. */
  const aiming = useRef<number | null>(null);
  /* Where the column last rested: which way the reader has scrolled since. */
  const rested = useRef(0);
  /* Stops a reveal still waiting for the Canvas to draw. */
  const stopReveal = useRef<() => void>(() => undefined);
  /* A scroll of ours that is no reader's: the column only keeps its sheet at the top. */
  const quiet = useRef(false);

  const sheetAt = (index: number) =>
    column.current?.children[index] as HTMLElement | undefined;

  /* Where a sheet is at the top: its own top, or as far as the column scrolls. */
  const placeOf = (index: number) => {
    const element = stage.current;
    const sheet = sheetAt(index);
    if (!element || !sheet || sheet === live.current) return 0;
    return Math.min(
      sheet.offsetTop,
      element.scrollHeight - element.clientHeight,
    );
  };

  /* The live Canvas over its sheet, exactly: on every move, and whenever sizes change. */
  const place = () => {
    const layer = live.current;
    const sheet = sheetAt(latest.current.position);
    if (!layer) return;
    if (!sheet || sheet === layer) {
      layer.style.top = "0px";
      layer.style.height = "100%";
      return;
    }
    layer.style.top = `${sheet.offsetTop}px`;
    layer.style.height = `${sheet.offsetHeight}px`;
  };

  /*
   * The active sheet back at the top, at once and as no reader's scroll: when the sheets
   * change size (the stage resized, the panel opened beside it, a sheet grown by zoom).
   * Never while a scroll is running or on its way.
   */
  function pin() {
    const element = stage.current;
    if (
      !element ||
      element.hasAttribute("data-scrolling") ||
      aiming.current !== null
    )
      return;
    const top = placeOf(latest.current.position);
    rested.current = top;
    if (Math.abs(element.scrollTop - top) <= 1) return;
    quiet.current = true;
    element.scrollTop = top;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (quiet.current = false)),
    );
  }

  useLayout(place);
  useEffect(() => {
    const resized = new ResizeObserver(() => {
      place();
      pin();
    });
    if (column.current) resized.observe(column.current);
    if (stage.current) resized.observe(stage.current);
    return () => resized.disconnect();
    // `place` and `pin` read only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Out of sight while it moves: the Canvas, and its controls. */
  const hold = () => {
    stopReveal.current();
    for (const [element, name] of [
      [stage.current, "data-scrolling"],
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
    const element = stage.current;
    const layer = live.current;
    if (!element || !layer) return;
    stopReveal.current();
    rested.current = element.scrollTop;
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

  /* A sheet to the top: smoothly, or at once for less motion or a new document. */
  const bring = (index: number, instantly = false) => {
    const element = stage.current;
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
   * A new current view. Made so by this stage, it is already on its way to the top;
   * chosen elsewhere (the thumbnails, the pager, a key, a press on its sheet, a link, a
   * new document), its sheet is brought there.
   */
  const shownSheets = useRef<typeof sheets | null>(null);
  useLayout(() => {
    const fresh = shownSheets.current !== sheets;
    shownSheets.current = sheets;
    zoom(false);
    if (followed.current === position && !fresh) {
      followed.current = null;
      return;
    }
    followed.current = null;
    bring(position, fresh);
    // `bring` and `zoom` read only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, sheets]);

  /* The reader's scroll: where it is going, and where it comes to rest. */
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let frame = 0;
    let rest: ReturnType<typeof setTimeout> | undefined;
    let held = false;

    /*
     * The sheet to bring to the top from here: past the threshold on from where the
     * column last rested, the next; short of it, the one it rested on. At the very end,
     * the last.
     */
    const choose = (top: number) => {
      const count = latest.current.sheets.length;
      if (count < 2) return 0;
      let at = 0;
      for (let index = 0; index < count; index++) {
        if (placeOf(index) <= top + 0.5) at = index;
        else break;
      }
      if (at >= count - 1) return count - 1;
      const from = placeOf(at);
      const share = (top - from) / Math.max(1, placeOf(at + 1) - from);
      return top >= rested.current
        ? share > THRESHOLD
          ? at + 1
          : at
        : share < 1 - THRESHOLD
          ? at
          : at + 1;
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

    const settle = () => {
      if (held) return;
      const { sheets, position } = latest.current;
      const top = element.scrollTop;
      const aimed = aiming.current;
      aiming.current = null;
      const target =
        aimed !== null && Math.abs(top - placeOf(aimed)) <= 1
          ? aimed
          : choose(top);
      if (!sheets[target]) return reveal();
      if (target !== position) {
        hold();
        zoom(false);
        followed.current = target;
        clover.goTo(sheets[target].first);
      }
      bring(target);
    };

    const later = () => {
      clearTimeout(rest);
      rest = setTimeout(settle, SETTLE_MS);
    };

    const onScroll = () => {
      if (quiet.current) return;
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
    // `placeOf`, `hold`, `reveal` and `bring` read only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clover]);

  /*
   * Zoomed into, moved or turned (the Canvas no longer at home): the active sheet grows to
   * the stage's whole height, pushing the others down, and the Canvas takes every drag,
   * to move about the page, where at home a finger scrolls the column (`data-zoomed`,
   * `Document.css`). The renderer's own `atHome`, which a resize keeps, so the sheet
   * growing never reads as zooming out. Home again, or another view, and it is a sheet
   * among the rest.
   */
  const [handle, setHandle] = useState<Clover.CanvasHandle | null>(null);
  function zoom(zoomed: boolean) {
    const element = stage.current;
    if (!element || element.hasAttribute("data-zoomed") === zoomed) return;
    element.toggleAttribute("data-zoomed", zoomed);
    // Grown, it can reach the top even at the column's end: it goes there at once.
    if (zoomed) pin();
  }
  useEffect(() => {
    if (!handle) return;
    return handle.on("viewport", () => zoom(!handle.atHome));
    // `zoom` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return (
    <div
      ref={stage}
      className="clover-template-document-stage"
      onKeyDown={(event) => {
        // A sheet at a time, as a reader's PageUp and PageDown turn a page.
        if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
        if (event.key === "PageDown" && navigation.hasNext) navigation.next();
        else if (event.key === "PageUp" && navigation.hasPrevious)
          navigation.previous();
        else return;
        event.preventDefault();
      }}
    >
      <div
        ref={column}
        className="clover-template-document-sheets"
        data-single={sheets.length < 2 || undefined}
      >
        {sheets.map((sheet, index) => (
          /*
           * A press on a sheet not active brings it to the top: a pointer's way, beside
           * the thumbnails, the pager and PageUp and PageDown, which a keyboard has.
           */
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            key={sheet.key}
            aria-hidden="true"
            className="clover-template-document-sheet"
            data-active={index === position || undefined}
            onClick={() => index !== position && clover.goTo(sheet.first)}
            style={{ "--ratio": sheet.ratio } as React.CSSProperties}
          >
            {sheet.canvases.map((canvas) => (
              <Still key={canvas.id} canvas={canvas} />
            ))}
          </div>
        ))}
        <div ref={live} className="clover-template-document-live">
          <Clover.Body
            className="clover-template-document-content"
            onReady={setHandle}
          >
            {children}
          </Clover.Body>
        </div>
      </div>
    </div>
  );
}

/** A Canvas's still: its picture at about the stage's size, or an empty page until then. */
function Still({ canvas }: { canvas: Canvas }) {
  const { clover } = Clover.useClover("Document");
  const source = useMemo(
    () => Clover.stillSource(canvas, STILL_SIZE),
    [canvas],
  );
  const [src, setSrc] = useState(source?.src);
  useEffect(() => {
    if (!source || source.src) return setSrc(source?.src);
    let current = true;
    void Clover.resolveThumbnail(source, STILL_SIZE, clover.request).then(
      (url) => current && setSrc(url),
    );
    return () => {
      current = false;
    };
  }, [source, clover]);
  const style = { aspectRatio: String(ratioOf(canvas)) };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" decoding="async" loading="lazy" src={src} style={style} />
  ) : (
    <span style={style} />
  );
}
