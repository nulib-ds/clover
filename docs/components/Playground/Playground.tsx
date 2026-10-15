import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  type PlaygroundResource,
  type TemplateKey,
  resourceByKey,
  resources,
  templateOrder,
  templateSpecs,
} from "docs/components/Playground/playground-config";
import { loadMapWorker, useMapWorker } from "docs/lib/map-worker";
import { normalizeHex, setPageTheme, usePageTheme } from "docs/lib/page-theme";

import dynamic from "next/dynamic";
import styles from "docs/components/Playground/Playground.module.css";
import { useRouter } from "next/router";

/** The reader's own resource, where a resource's key would be. */
const OWN = "own";

/*
 * The reader's own resource must be a web address. Not `validIiifContent` from
 * `docs/lib/iiif-content`: it brings `@iiif/helpers`, an ESM external on the server, and
 * that makes this module async, so the homepage's import of it is undefined while the
 * page is rendered there. A shared link may still carry an encoded content state.
 */
const webAddress = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  try {
    const { protocol, hostname } = new URL(trimmed);
    return (protocol === "http:" || protocol === "https:") && hostname
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The Viewer in a template, as a page would write it: `<Viewer template={Document} />`.
 * Loaded on the client, since the renderer needs a browser.
 */
const TemplateViewer = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([clover, templates]) => {
      const Viewer = clover.default as React.ComponentType<any>;
      function TemplateViewer({
        template,
        ...props
      }: { template: "Default" | "Document" | "Gallery" } & Record<
        string,
        unknown
      >) {
        return <Viewer {...props} template={templates[template]} />;
      }
      return TemplateViewer;
    }),
  { ssr: false },
);

/** Calls `onOutside` on a press outside `ref`'s element, while `active`. */
function usePressOutside(
  ref: React.RefObject<HTMLElement>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const press = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [ref, active, onOutside]);
}

/**
 * Marks the bar `data-stuck` while it is held under the navbar with the stage passing
 * beneath it: from when the stage's top goes under the bar's foot until the bar, let go
 * where the playground ends, has gone up under the navbar. Its stylesheet holds the bar
 * on wide screens only; elsewhere the stage never reaches under it.
 *
 * Read from the two boxes once a frame while the page scrolls, and written to the bar
 * itself rather than to state, so holding and letting go never re-render the stage.
 */
function useStuck(
  bar: React.RefObject<HTMLElement>,
  stage: React.RefObject<HTMLElement>,
) {
  useEffect(() => {
    const node = bar.current;
    const under = stage.current;
    if (!node || !under) return;
    let frame = 0;
    // The line the bar is held at, the navbar's foot: 0 where the bar is not sticky.
    let line = 0;
    const read = () => {
      frame = 0;
      const { bottom } = node.getBoundingClientRect();
      node.toggleAttribute(
        "data-stuck",
        bottom > line + 1 && under.getBoundingClientRect().top < bottom,
      );
    };
    const measure = () => {
      line = parseFloat(getComputedStyle(node).top) || 0;
      read();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
    };
  }, [bar, stage]);
}

/**
 * The homepage's hero: any template beside any resource, live.
 *
 * Two pickers over one stage: the resources, as thumbnails, and at the end of the bar the
 * templates, by name, in a dropdown. Either changes the stage and leaves the other as it was,
 * so the same resource can be seen in each layout, and each layout with every kind of
 * resource. Both are native radios inside labels, so each group gets arrow keys and one
 * tab stop.
 *
 * The stage keeps one height for every template, scrolling within when a template is
 * taller, so switching never moves the page. Each template is shown with its own
 * defaults: the point is the range, not the knobs.
 */
export interface PlaygroundProps {
  /**
   * The resource on the stage, whenever it changes: its address (or content state) and
   * its tile's key (`"own"` for the reader's own). The parts below the playground follow it.
   */
  onResourceChange?: (resource: string, key: string) => void;
}

/** For the page around the playground: put one of its resources on the stage. */
export interface PlaygroundHandle {
  pickResource: (key: string) => void;
}

const Playground = forwardRef<PlaygroundHandle, PlaygroundProps>(
  function Playground({ onResourceChange }, ref) {
    const router = useRouter();

    const [active, setActive] = useState<TemplateKey>("default");
    /*
     * The resource the reader picked: a resource's key, or `OWN`. Until they pick one, each
     * template opens on its own, so the first look at each is a resource it suits.
     */
    const [picked, setPicked] = useState<string | null>(null);
    const [own, setOwn] = useState("");
    /*
     * The page's accent, set from the gear in the site header. The playground carries it in
     * the share link; a link that names one sets it.
     */
    const { accent } = usePageTheme();

    const spec = templateSpecs[active];
    const current = picked ?? spec.defaultResource;
    const entry = current === OWN ? undefined : resourceByKey(current);

    /* Mocks are served by the docs, so their address is known only in the browser. */
    const [origin, setOrigin] = useState<string | null>(null);
    useEffect(() => setOrigin(location.origin), []);
    const addressOf = useCallback(
      (resource: PlaygroundResource) =>
        !resource.mock
          ? resource.resource
          : origin
            ? new URL(`${router.basePath}/mocks/${resource.resource}`, origin)
                .href
            : null,
      [origin, router.basePath],
    );
    const resource = current === OWN ? own : entry ? addressOf(entry) : null;

    /* A map's worker is set before its resource opens, and only for one that has places. */
    const mapReady = useMapWorker(Boolean(entry?.map));
    const ready = Boolean(resource) && (!entry?.map || mapReady);

    // The page hears of each resource once it can open, as the stage opens it.
    const heard = useRef(onResourceChange);
    heard.current = onResourceChange;
    useEffect(() => {
      if (ready && resource) heard.current?.(resource, current);
    }, [ready, resource, current]);

    /*
     * Read state out of the URL once the router and the origin are known, so a shared link
     * restores it. The resource travels as `iiif-content`, the parameter Clover has always
     * read for a resource handed to the docs; one of ours is matched back to its tile.
     */
    useEffect(() => {
      if (!router.isReady || !origin) return;
      const q = router.query;
      const next = (
        typeof q.t === "string" && templateOrder.includes(q.t as TemplateKey)
          ? q.t
          : "default"
      ) as TemplateKey;
      setActive(next);
      const shared = q["iiif-content"];
      const content =
        typeof shared === "string" && shared.trim() ? shared.trim() : undefined;
      if (content) {
        const match = resources.find((r) => addressOf(r) === content);
        if (match) {
          setPicked(match.key);
        } else {
          setOwn(content);
          setPicked(OWN);
          loadMapWorker();
        }
      }
      // A shared link's accent wins over the reader's stored one.
      if (typeof q.accent === "string") {
        setPageTheme({ accent: normalizeHex(q.accent) });
      }
      // Only once both are known; later changes are pushed by the handlers below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, origin]);

    /**
     * Mirror the shareable parts of the state into the URL, without a navigation. Only what
     * differs from a first visit is named: the template, unless it is Default, and the
     * resource, once the reader has picked one.
     */
    const syncUrl = useCallback(
      (t: TemplateKey, content: string | null) => {
        const query: Record<string, string> = {};
        if (t !== "default") query.t = t;
        if (content) query["iiif-content"] = content;
        if (accent) query.accent = accent;
        router.replace({ query }, undefined, { shallow: true, scroll: false });
      },
      [accent, router],
    );

    /*
     * Keep the link's accent in step with the header's. Debounced, because the colour
     * wheel reports every frame of a drag and each would otherwise be a history entry.
     */
    const accentSynced = useRef(false);
    useEffect(() => {
      if (!router.isReady) return;
      if (!accentSynced.current) {
        accentSynced.current = true;
        return;
      }
      const timer = setTimeout(
        () => syncUrl(active, picked ? resource : null),
        300,
      );
      return () => clearTimeout(timer);
      // Only the accent changing should rewrite the link here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accent, router.isReady]);

    const selectTemplate = (key: TemplateKey) => {
      setActive(key);
      syncUrl(key, picked ? resource : null);
    };

    const selectResource = (key: string) => {
      setPicked(key);
      const chosen = resourceByKey(key);
      syncUrl(active, chosen ? addressOf(chosen) : null);
    };

    useImperativeHandle(ref, () => ({ pickResource: selectResource }));

    /*
     * "Your own": a field in a popover from the last tile. Escape, the tile again, or a
     * press outside closes it; opening a resource closes it too.
     */
    const [ownOpen, setOwnOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [draftError, setDraftError] = useState<string>();
    const ownRef = useRef<HTMLDivElement>(null);
    const ownTriggerRef = useRef<HTMLButtonElement>(null);
    const ownInputRef = useRef<HTMLInputElement>(null);
    const closeOwn = useCallback((focusTrigger = true) => {
      setOwnOpen(false);
      setDraftError(undefined);
      if (focusTrigger) ownTriggerRef.current?.focus();
    }, []);
    const dismissOwn = useCallback(() => closeOwn(false), [closeOwn]);
    usePressOutside(ownRef, ownOpen, dismissOwn);
    useEffect(() => {
      // Selected, so typing replaces the address that was open, and a paste does too.
      if (ownOpen) ownInputRef.current?.select();
    }, [ownOpen]);

    /* Opens on the address already open, if it is the reader's, ready to edit. */
    const toggleOwn = () => {
      if (ownOpen) return closeOwn();
      setDraft(own);
      setOwnOpen(true);
    };

    const openOwn = (event: React.FormEvent) => {
      event.preventDefault();
      const content = webAddress(draft);
      if (!content) {
        setDraftError(
          "Enter the web address of a IIIF Manifest or Collection, starting with https://",
        );
        return;
      }
      // Anything can have places, so the map's worker is set for a resource of the reader's.
      loadMapWorker();
      setOwn(content);
      setPicked(OWN);
      syncUrl(active, content);
      closeOwn();
    };

    /*
     * The templates: a button naming the one on the stage, opening a list of the four.
     * Arrow keys move through them and the stage follows; a press on one, Enter or Escape
     * closes them, and so does a press outside or focus moving away.
     */
    const [layoutOpen, setLayoutOpen] = useState(false);
    const layoutRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const layoutTriggerRef = useRef<HTMLButtonElement>(null);
    const layoutMenuRef = useRef<HTMLDivElement>(null);
    /* Whether the menu's last input was a press rather than a key. */
    const pressed = useRef(false);
    const closeLayout = useCallback((focusTrigger = true) => {
      setLayoutOpen(false);
      if (focusTrigger) layoutTriggerRef.current?.focus();
    }, []);
    const dismissLayout = useCallback(() => closeLayout(false), [closeLayout]);
    usePressOutside(layoutRef, layoutOpen, dismissLayout);
    useStuck(barRef, stageRef);
    useEffect(() => {
      if (layoutOpen)
        layoutMenuRef.current
          ?.querySelector<HTMLInputElement>("input:checked")
          ?.focus();
    }, [layoutOpen]);

    return (
      <section
        aria-label="Try the templates"
        className={styles.section}
        id="playground"
      >
        <div className={styles.bar} ref={barRef}>
          <div className={styles.resourceRow}>
            <div
              aria-label="Select a IIIF resource"
              className={`${styles.tiles} ${styles.track}`}
              role="radiogroup"
            >
              {resources.map((r) => (
                <label
                  className={styles.tile}
                  data-selected={r.key === current}
                  key={r.key}
                  title={r.title}
                >
                  <input
                    checked={r.key === current}
                    className={styles.tileInput}
                    name="pg-resource"
                    onChange={() => selectResource(r.key)}
                    type="radio"
                    value={r.key}
                  />
                  <span className={styles.media}>
                    {/* Static export with unoptimized images: next/image has nothing to add for a remote thumbnail. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className={styles.thumb}
                      decoding="async"
                      src={r.thumbnail}
                    />
                  </span>
                  <span className={styles.tileName}>{r.name}</span>
                </label>
              ))}
            </div>

            <div className={styles.own} ref={ownRef}>
              <button
                aria-controls="pg-own"
                aria-expanded={ownOpen}
                className={styles.tile}
                data-selected={current === OWN}
                onClick={toggleOwn}
                ref={ownTriggerRef}
                title={current === OWN ? own : undefined}
                type="button"
              >
                <span className={styles.media}>
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="20"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className={styles.tileName}>Your own</span>
              </button>

              {ownOpen && (
                <form
                  className={styles.ownForm}
                  id="pg-own"
                  noValidate
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      closeOwn();
                    }
                  }}
                  onSubmit={openOwn}
                >
                  <label className={styles.fieldLabel} htmlFor="pg-own-input">
                    A IIIF Manifest or Collection
                  </label>
                  <div className={styles.ownRow}>
                    <input
                      aria-describedby={draftError ? "pg-own-error" : undefined}
                      aria-invalid={Boolean(draftError)}
                      className={styles.input}
                      id="pg-own-input"
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setDraftError(undefined);
                      }}
                      placeholder="https://"
                      ref={ownInputRef}
                      spellCheck={false}
                      type="url"
                      value={draft}
                    />
                    <button className="cta-solid" type="submit">
                      Open
                    </button>
                  </div>
                  {draftError && (
                    <p className={styles.error} id="pg-own-error">
                      {draftError}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          <div
            className={styles.layoutPicker}
            onBlur={(e) => {
              if (layoutOpen && !e.currentTarget.contains(e.relatedTarget))
                closeLayout(false);
            }}
            ref={layoutRef}
          >
            <span className={styles.inlineLabel} id="pg-layout">
              Template
            </span>
            <button
              aria-controls="pg-layouts"
              aria-expanded={layoutOpen}
              aria-labelledby="pg-layout pg-layout-current"
              className={styles.layoutTrigger}
              onClick={() => (layoutOpen ? closeLayout() : setLayoutOpen(true))}
              ref={layoutTriggerRef}
              type="button"
            >
              <span id="pg-layout-current">{spec.name}</span>
              <svg
                aria-hidden="true"
                className={styles.chevron}
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {layoutOpen && (
              <div
                aria-labelledby="pg-layout"
                className={styles.layoutMenu}
                id="pg-layouts"
                onKeyDown={(e) => {
                  pressed.current = false;
                  if (e.key === "Escape" || e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeLayout();
                  }
                }}
                onPointerDown={() => (pressed.current = true)}
                ref={layoutMenuRef}
                role="radiogroup"
              >
                {templateOrder.map((key) => (
                  <label
                    className={styles.layoutOption}
                    data-selected={key === active}
                    key={key}
                  >
                    <input
                      checked={key === active}
                      className={styles.tileInput}
                      name="pg-layout"
                      onChange={() => selectTemplate(key)}
                      // A press chooses and closes; an arrow key only chooses.
                      onClick={() => pressed.current && closeLayout()}
                      type="radio"
                      value={key}
                    />
                    {templateSpecs[key].name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* No font and no colour here: Clover takes both from the page. */}
        <div className={styles.stage} data-template={active} ref={stageRef}>
          {ready && (
            <TemplateViewer
              key={`${active}-${resource}`}
              template={spec.name as "Default"}
              iiifContent={resource}
            />
          )}
        </div>
      </section>
    );
  },
);

export default Playground;
