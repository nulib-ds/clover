import React, {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import * as Clover from "../../parts";
import type { PanelSection } from "../../parts";

/*
 * Search's field and Download's links, each loaded as it is wanted, never with the
 * template: the field as its magnifier is pointed at, focused or pressed, the links as
 * the toolbar first draws, beside the page's first view.
 */
let searchField: React.ComponentType | undefined;
const loadSearch = () =>
  import("./SearchField").then((module) => (searchField = module.default));
// Pressed before its code has come: React reveals it once it comes.
const Search = lazy(() => import("./SearchField"));
const Download = lazy(() => import("./DownloadLinks"));

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The toolbar's controls at its top end, as a Mac's Preview groups its own (Mat,
 * 2026-11-09: "like in preview on a mac, build out the top right controls"): the globe,
 * where there are languages to choose, first (Mat, 2026-11-10: "move lang into the menu
 * next to the i. make it the first left button"), then one round button for each section this resource has (About, the views, the Collection, the
 * contents, the map, the transcript, the annotations), Clover's round controls
 * (`Document.css`), each opening its section alone in the aside (`Document.tsx`), and
 * pressed again, closing it;
 * then Search, a magnifier that opens into the search's field, the field's X clearing the
 * query and folding it back (Mat: "search would expand out. X of the value would remove
 * it").
 *
 * Each button is a disclosure of the aside (`aria-expanded`, `aria-controls`), named by
 * its section, its glyph with it; the open one in the accent, as About's Download is.
 * A section that holds something of the page in sight (`marked`, `marks.ts`) carries a
 * dot of the accent at its top end, as a message app marks what is new (Mat,
 * 2026-11-10: "a small facebook/slack style indicator on the item. we don't need a
 * number. it should be a accent dot"), and is described by "This page" (WCAG 1.3.1),
 * both gone while its section is open, and back as it closes ("indicators should go away
 * if clicked into. come back if clicked out of").
 */
export function SectionControls({
  aside,
  sections,
  open,
  marked,
  onChoose,
  labelOf,
  groupLabel,
  search,
  searchOpen = false,
  onSearched,
  download,
  downloadHeadingLevel,
  language,
  provider,
}: {
  /** The aside's id. */
  aside: string;
  /** The sections to offer, in order, Search apart. */
  sections: readonly PanelSection[];
  /** The section the aside shows, while it is open. */
  open: PanelSection | null;
  /** The sections that hold something of the page in sight, each marked by a dot. */
  marked?: ReadonlySet<PanelSection>;
  onChoose: (section: PanelSection) => void;
  labelOf: (section: PanelSection) => { text: string; lang?: string };
  /** The group's name, the sections' together ("Information panel"). */
  groupLabel: { text: string; lang?: string };
  /** Whether the resource can be searched. */
  search: boolean;
  /** Whether Search's field is open whatever happens: the toolbar has room for it. */
  searchOpen?: boolean;
  /** A search made in the toolbar's field. */
  onSearched: () => void;
  /** Whether to offer the downloads (`rendering`), at the bar's end. */
  download: boolean;
  /** The level of the downloads' group titles ("This page", "All pages"). */
  downloadHeadingLevel: number;
  /** The languages to read in, first on the capsule (`Clover.Language`). */
  language?: React.ReactNode;
  /** Who provided the resource, before the capsule (`Clover.Provider`). */
  provider?: React.ReactNode;
}) {
  // Whether there is anything to download, for the view in sight or the whole.
  const [downloads, setDownloads] = useState(false);
  // Whether the globe shows: `Clover.Language` draws nothing with nothing to choose.
  const [languages, setLanguages] = useState(false);
  const bar = languages || sections.length > 0 || (download && downloads);
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  // What a dot says, for each section it marks.
  const markId = `${aside}-marked`;
  const marks = (section: PanelSection) =>
    (marked?.has(section) ?? false) && open !== section;
  const anyMarked = sections.some(marks);
  return (
    <div className="clover-template-document-actions">
      {provider}
      {/* The capsule and Search, one control in one edge (`Document.css`). */}
      <div className="clover-template-document-tools" hidden={!bar && !search}>
        <div className="clover-template-document-bar" hidden={!bar}>
          {language && <Offered onOffered={setLanguages}>{language}</Offered>}
          {sections.length > 0 && (
            /*
             * Named in Clover's interface language, never marked with it: the group holds
             * the sections' own names, a page's `panelLabels` among them (DESIGN.md §0,
             * WCAG 3.1.2). In another language than the page's, by a hidden name.
             */
            <div
              className="clover-template-document-group"
              role="group"
              aria-label={groupLabel.lang ? undefined : groupLabel.text}
              aria-labelledby={
                groupLabel.lang ? `${aside}-group-name` : undefined
              }
            >
              {groupLabel.lang && (
                <span hidden id={`${aside}-group-name`} lang={groupLabel.lang}>
                  {groupLabel.text}
                </span>
              )}
              {sections.map((section) => {
                const label = labelOf(section);
                const mark = marks(section);
                return (
                  <button
                    key={section}
                    type="button"
                    className="clover-canvas-button clover-template-document-section"
                    data-section={section}
                    data-marked={mark || undefined}
                    lang={label.lang}
                    aria-expanded={open === section}
                    aria-controls={aside}
                    aria-describedby={mark ? markId : undefined}
                    onClick={() => onChoose(section)}
                  >
                    <svg
                      aria-hidden="true"
                      focusable="false"
                      width="16"
                      height="16"
                      viewBox="0 0 512 512"
                      fill="currentColor"
                      stroke="currentColor"
                    >
                      {GLYPHS[section]}
                    </svg>
                    <span style={Clover.visuallyHidden}>{label.text}</span>
                    {mark && (
                      <span
                        className="clover-template-document-mark"
                        aria-hidden="true"
                      />
                    )}
                    <Clover.Tip label={label.text} />
                  </button>
                );
              })}
            </div>
          )}
          {anyMarked && (
            <span id={markId} hidden lang={langOf("downloadPage")}>
              {t("downloadPage")}
            </span>
          )}
          {download && (
            <DownloadControl
              headingLevel={downloadHeadingLevel}
              onOffered={setDownloads}
            />
          )}
        </div>
        {search && (
          <SearchControl
            aside={aside}
            label={labelOf("search")}
            open={searchOpen}
            onSearched={onSearched}
          />
        )}
      </div>
    </div>
  );
}

/** Says whether what it holds draws anything, as it changes. */
function Offered({
  children,
  onOffered,
}: {
  children: React.ReactNode;
  onOffered: (offered: boolean) => void;
}) {
  const slot = useRef<HTMLSpanElement>(null);
  useIsomorphicLayoutEffect(() => {
    const element = slot.current;
    if (!element) return;
    const check = () => onOffered(element.childElementCount > 0);
    check();
    const observer = new MutationObserver(check);
    observer.observe(element, { childList: true });
    return () => observer.disconnect();
  }, [onOffered]);
  return (
    <span ref={slot} className="clover-template-document-language">
      {children}
    </span>
  );
}

/**
 * Search, folded to its magnifier until pressed: then Clover's Search, its field alone in
 * sight (`Document.css`), focus in it. A search made opens the aside on its hits. Its X
 * (Clear) empties the query and folds it back, focus to the magnifier; so do Escape in an
 * empty field and focus leaving it empty.
 */
function SearchControl({
  aside,
  label,
  open = false,
  onSearched,
}: {
  aside: string;
  label: { text: string; lang?: string };
  /** Open whatever happens, with no magnifier: the toolbar has room for it. */
  open?: boolean;
  onSearched: () => void;
}) {
  const id = Clover.useUniqueId().replace(/:/g, "");
  const query = Clover.useCloverSelector((state) => state.search.query);
  const [unfolded, setUnfolded] = useState(false);
  // Widening out of its magnifier, until its animation ends (`Document.css`).
  const [unfolding, setUnfolding] = useState(false);
  const shown = open || unfolded || Boolean(query);
  const box = useRef<HTMLDivElement>(null);
  /*
   * The field, once its code has come, drawn as it is: through `lazy` React would hold
   * its first reveal back about 300ms, even with the code there.
   */
  const [Field, setField] = useState(() => searchField);

  /*
   * Its code comes while the page is idle after the toolbar first draws, so a press
   * unfolds it at once (Mat, 2026-11-09: "opening search take a while. make it more
   * smooth"), and the field, where it is open from the start, is there with the rest.
   */
  useEffect(() => {
    let current = true;
    const load = () =>
      void loadSearch().then((field) => current && setField(() => field));
    if (open) {
      load();
      return () => {
        current = false;
      };
    }
    // Safari has no idle callback: a moment after the first draw there.
    const idle = (
      window as { requestIdleCallback?: typeof window.requestIdleCallback }
    ).requestIdleCallback;
    if (!idle) {
      const timer = setTimeout(load, 200);
      return () => {
        current = false;
        clearTimeout(timer);
      };
    }
    const handle = idle(load);
    return () => {
      current = false;
      window.cancelIdleCallback?.(handle);
    };
  }, [open]);

  // Unfolded by a press, focus goes into the field, once its code has come.
  const focusField = useRef(false);
  /*
   * The toolbar crossing the width that opens it (`open`), a window resized or zoomed,
   * with focus on what that swaps (WCAG 2.4.3): narrowed with focus in the field, it
   * stays unfolded; widened with focus on the magnifier, which goes, focus goes into the
   * field. Read as the render begins, while focus is still where it was.
   */
  const wasOpen = useRef(open);
  if (wasOpen.current !== open) {
    wasOpen.current = open;
    const active =
      typeof document === "undefined" ? null : document.activeElement;
    if (open && active?.id === id) focusField.current = true;
    else if (!open && active && box.current?.contains(active) && !unfolded)
      setUnfolded(true);
  }
  useEffect(() => {
    if (!shown || !focusField.current) return;
    let frames = 120;
    let frame = 0;
    const land = () => {
      const input = box.current?.querySelector<HTMLInputElement>("input");
      if (input) {
        focusField.current = false;
        input.focus();
      } else if (frames-- > 0) frame = requestAnimationFrame(land);
    };
    land();
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  // The query cleared (its X): folded back, focus to the magnifier.
  const had = useRef(query);
  useEffect(() => {
    const cleared = had.current && !query;
    had.current = query;
    if (!cleared || open) return;
    setUnfolded(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }, [query, id, open]);

  const fold = () => {
    if (open) return;
    setUnfolded(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  if (!shown)
    return (
      // Folded, its magnifier alone, one of Clover's round controls (`Document.css`).
      <div className="clover-template-document-bar">
        <button
          id={id}
          type="button"
          className="clover-canvas-button clover-template-document-search-toggle"
          lang={label.lang}
          aria-expanded={false}
          aria-controls={`${id}-field`}
          onPointerEnter={() => void loadSearch()}
          onFocus={() => void loadSearch()}
          onClick={() => {
            focusField.current = true;
            setUnfolded(true);
            setUnfolding(true);
          }}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 512 512"
          >
            <Clover.SearchGlyph />
          </svg>
          <span style={Clover.visuallyHidden}>{label.text}</span>
          <Clover.Tip label={label.text} />
        </button>
      </div>
    );

  return (
    // A form's submit reaches here after the field has searched.

    <div
      ref={box}
      id={`${id}-field`}
      className="clover-template-document-search"
      data-aside={aside}
      // Unfolded by a press, it widens out of its magnifier (`Document.css`).
      data-unfolding={(!open && unfolding) || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setUnfolding(false);
      }}
      onSubmit={(event) => {
        const value = (event.target as HTMLElement)
          .querySelector?.("input")
          ?.value.trim();
        if (value) onSearched();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || query) return;
        event.preventDefault();
        fold();
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (open || query || (next && box.current?.contains(next))) return;
        setUnfolded(false);
      }}
    >
      {Field ? (
        <Field />
      ) : (
        <Suspense fallback={null}>
          <Search />
        </Suspense>
      )}
    </div>
  );
}

/* Clover's glyphs (`Clover.…Glyph`) and a few of the template's own, on their 512 grid. */
const LINES = {
  fill: "none",
  strokeLinecap: "round",
  strokeWidth: 40,
} as const;
const GLYPHS: Record<PanelSection, React.ReactNode> = {
  about: <Clover.InformationGlyph />,
  // Views: two pages, the one behind the front one shifted 86 down and left, so it shows as
  // far at its left as at its foot, 46 clear of the front one, its ends at its own corners
  // (Mat, 2026-11-21: "the left part of the views underlayer seems closer to the top layer
  // than the bottom line").
  targets: (
    <>
      <rect x="147" y="61" width="304" height="304" rx="36" {...LINES} />
      <path d="M61 147v268a36 36 0 0 0 36 36h268" {...LINES} />
    </>
  ),
  // A Collection: a stack, its layers 46 apart.
  collection: (
    <>
      <rect x="64" y="242" width="384" height="200" rx="36" {...LINES} />
      <path d="M112 156h288M160 70h192" {...LINES} />
    </>
  ),
  contents: <Clover.ChaptersGlyph />,
  search: null,
  map: <Clover.PlaceGlyph />,
  // A transcript: the lines of one text, 46 apart, the last shorter.
  transcript: (
    <path d="M96 127h320M96 213h320M96 299h320M96 385h192" {...LINES} />
  ),
  annotations: <Clover.CommentGlyph />,
};

/**
 * The downloads behind a button at the bar's end (Mat, 2026-11-09: "remove this download.
 * make it a download button in the menu to the right"), as About offers them in Default:
 * Download, a disclosure (`aria-expanded`, `aria-controls`), its popover under it holding
 * Clover's Download part, the `rendering` of the page in view ("This page") and of the
 * whole ("All pages"), each a link. Focus stays on the button as it opens, the links next
 * in the tab order; Escape closes it, focus back on the button, and a press outside it or
 * focus moving on past it closes it too. It shows only while there is something to
 * download: Download draws nothing when there is not, which the popover, always there
 * and hidden while closed, is watched for.
 */
function DownloadControl({
  headingLevel,
  onOffered,
}: {
  headingLevel: number;
  onOffered: (offered: boolean) => void;
}) {
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const id = Clover.useUniqueId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [offered, setOffered] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const check = () => setOffered(element.childElementCount > 0);
    check();
    const observer = new MutationObserver(check);
    observer.observe(element, { childList: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    onOffered(offered);
    if (!offered) setOpen(false);
  }, [offered, onOffered]);

  // A press anywhere outside it closes it.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={holder}
      className="clover-template-document-download"
      hidden={!offered}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        setOpen(false);
        document.getElementById(id)?.focus();
      }}
      onBlur={(event) => {
        // Focus gone on past it, not a press inside it, which takes focus nowhere.
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        className="clover-canvas-button clover-template-document-download-button"
        lang={langOf("download")}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((was) => !was)}
      >
        {/* About's Download glyph: an arrow down to a line. */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="16"
          height="16"
          viewBox="0 0 512 512"
        >
          <Clover.DownloadGlyph />
        </svg>
        <span style={Clover.visuallyHidden}>{t("download")}</span>
        <Clover.Tip label={t("download")} />
      </button>
      <div
        ref={menu}
        id={`${id}-menu`}
        className="clover-template-document-download-menu"
        hidden={!open}
      >
        <Suspense fallback={null}>
          <Download headingLevel={headingLevel} />
        </Suspense>
      </div>
    </div>
  );
}
