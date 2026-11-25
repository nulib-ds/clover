import React, { useEffect, useRef, useState } from "react";

import * as Clover from "../../parts";
import type { PageLayout } from "../../parts";

/** Each layout's word in Clover's interface language. */
const LABEL: Record<PageLayout, string> = {
  auto: "templatePageLayoutAuto",
  individuals: "templatePageLayoutSingle",
  paged: "templatePageLayoutTwo",
};

const ORDER: PageLayout[] = ["auto", "individuals", "paged"];

/**
 * A layout's glyph, as a PDF reader draws its page display, in the thumbnails' toggle's
 * weight (Mat, 2026-11-16: "a bit too bold/illegible. think through something a bit more
 * fine"): a hairline page; two, an open spread, its fold down the middle; and Automatic
 * a page with another behind it, either one or two, as the Manifest says. At 16px a line
 * is about 1px and each page has some 5px open inside it, so none reads as a solid block.
 */
export function PageLayoutGlyph({ layout }: { layout: PageLayout }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 512 512"
      fill="none"
      // Over the round controls' own glyph rule, which fills them (`ui/Button.css`).
      style={{ fill: "none" }}
      stroke="currentColor"
      strokeWidth="32"
      strokeLinejoin="round"
    >
      {layout === "individuals" && (
        <rect x="144" y="80" width="224" height="352" rx="32" />
      )}
      {layout === "paged" && (
        <>
          <rect x="48" y="112" width="416" height="288" rx="32" />
          <path d="M256 112v288" />
        </>
      )}
      {layout === "auto" && (
        <>
          <rect x="105" y="143" width="224" height="304" rx="32" />
          <path d="M183 143v-46a32 32 0 0 1 32-32h160a32 32 0 0 1 32 32v240a32 32 0 0 1-32 32h-46" />
        </>
      )}
    </svg>
  );
}

/**
 * How the pages are laid out, as a PDF reader offers its page display (Mat, 2026-11-16:
 * "like a PDF viewer would do it and not like IIIF does it. do it with icons. make it a
 * little popout"): a round control showing the layout in use, which opens a small menu
 * beside it of Automatic (as the Manifest's `behavior` says), Single page and Two pages,
 * each its glyph and its word, native radios under the menu's legend. Choosing keeps the
 * menu open and focus on the radio chosen, the current Canvas kept in view; Escape, a
 * press outside, another popup or focus moving on closes it, Escape handing focus back to
 * the control (WCAG 2.1.2, 2.4.3). Shown only where the choice changes something: a
 * Manifest whose `behavior` lays it out a page or two at a time, with three Canvases or
 * more. The Root holds the choice (`clover.setPageLayout`), for every part showing views.
 */
export function PageLayoutMenu({ className }: { className?: string }) {
  const { clover } = Clover.useClover("PageLayoutMenu");
  const t = Clover.useT();
  const langOf = Clover.useLangOf();
  const layout = Clover.useCloverSelector((state) => state.pageLayout);
  const declared = Clover.useCloverSelector((state) => state.declaredLayout);
  const pages = Clover.useCloverSelector(
    (state) =>
      ((state.manifest?.items ?? []) as Array<{ type?: string }>).filter(
        (item) => item?.type === "Canvas",
      ).length,
  );
  const [open, setOpen] = useState(false);
  const id = Clover.useUniqueId().replace(/:/g, "");
  const button = `${id}-page-layout`;
  const menu = useRef<HTMLDivElement>(null);
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) document.getElementById(button)?.focus();
  };
  Clover.useOneOpen(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menu.current?.contains(target)) return;
      if (document.getElementById(button)?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, button]);

  if (pages < 3 || (declared !== "individuals" && declared !== "paged"))
    return null;

  const name = t("templatePageLayout");
  const nameLang = langOf("templatePageLayout");
  // What Automatic lays out, so the control shows the layout in sight.
  const shown = layout === "auto" ? declared : layout;
  return (
    <span
      className={["clover-template-page-layout", className]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || !open) return;
        // One Escape closes one thing: the menu, not the drawer or full viewer around it.
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        type="button"
        id={button}
        className="clover-template-page-layout-button clover-canvas-button"
        aria-expanded={open}
        aria-controls={open ? `${button}-menu` : undefined}
        lang={nameLang}
        onClick={() => setOpen((was) => !was)}
      >
        <PageLayoutGlyph layout={shown} />
        <span style={Clover.visuallyHidden}>{name}</span>
        <Clover.Tip label={name} />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${button}-menu`}
          className="clover-template-page-layout-menu clover-canvas-menu"
        >
          <fieldset>
            <legend lang={nameLang}>{name}</legend>
            {ORDER.map((each) => (
              <label key={each} className="clover-template-page-layout-option">
                <input
                  type="radio"
                  name={`${button}-choice`}
                  checked={layout === each}
                  onChange={() => clover.setPageLayout(each)}
                />
                <PageLayoutGlyph layout={each} />
                <span lang={langOf(LABEL[each])}>{t(LABEL[each])}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </span>
  );
}
