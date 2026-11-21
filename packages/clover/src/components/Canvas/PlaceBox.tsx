import React, { useEffect, useMemo, useRef } from "react";

import { CloseGlyph as Close } from "../../ui/glyphs/Close";
import { GivenMap, MapView, useMapPutAway, useRootMap } from "../Map/MapView";
import { Thumbnail } from "../Primitives/Primitives";
import { canvasGeoreferences } from "../../core/geo";
import { isGeoreferencedContent } from "../../core/geo-detect";
import { selectSequence } from "../../core/selectors";
import { useOptionalCloverSelector } from "../../react/context";
import Button from "../../ui/Button";
import { Inset } from "../../ui/Inset";
import { focusSoon } from "../../ui/focusSoon";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { type LanguageMapLike, localize } from "../../core/value";
import { useOneOpen } from "../../ui/useOneOpen";
import { languageProps } from "../../i18n/direction";
import { useContainerName } from "../../i18n/useContainerName";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Where something is on the Earth, on a map, in a box over the Canvas, one popup at a time
 * (`useOneOpen`): a picked annotation's place (Cookbook 0139: a map in a pamphlet, tagged
 * with the place it shows), or the Canvas's `navPlace`, else its Manifest's, from the map
 * control (Cookbook 0154), with the georeferenced images of the Canvases in view warped
 * onto it by their control points (Georeference Extension). As Document's map is (Mat,
 * 2026-11-15: "default should be treated the same as document. this is the standard for
 * maps now"): small, an `Inset` hanging under the Canvas's controls, which lie over it,
 * their Tips too, the map kept where it frames, a press anywhere but its Close expanding
 * it, as its Expand map does from the keyboard; expanded, the map fills the Body, its zoom
 * row at its top end and the page's picture in an Inset under it, Collapse map, which
 * trades them back, the Canvas and its controls away once it has come in, kept as they
 * were. Its name, out of sight, names the box. Closed by its Close, by Escape, or as
 * another popup opens. Loaded with MapLibre only as it first opens.
 *
 * Asked for from Annotations (`asked`: a georeferenced image or a place pressed there, Mat,
 * 2026-11-13: "clicking the georef or navplace annotation opens the map over the body as
 * expanded"), it shows the Root's map, as the Panel's Map section did: every place the
 * Root has and its overlays, framed on the one asked for.
 */
export default function PlaceBox({
  id,
  open,
  onClose,
  swapped = false,
  onSwap,
  feature,
  name,
  canvases,
  owner,
  language,
  asked,
  onReady,
  returnFocus,
}: {
  id: string;
  open: boolean;
  /** Close, giving focus back to what opened it when `restoreFocus`. */
  onClose: (restoreFocus: boolean) => void;
  /**
   * What opened it, by id, which focus goes back to once it has gone, as the Canvas's
   * controls come back into sight with it, where it closes giving focus back.
   */
  returnFocus?: string;
  /** Whether its map and the Canvas have traded places: the map fills the Body. */
  swapped?: boolean;
  /** Trade them, or trade them back. */
  onSwap: () => void;
  /** Its place: a GeoJSON `Feature`, `FeatureCollection` or geometry. */
  feature: unknown;
  /** What it is called: a place's `label`, else what holds it. */
  name?: LanguageMapLike;
  /** The Canvases in view, whose georeferenced images it overlays. */
  canvases?: readonly unknown[];
  /**
   * What its place belongs to (the Canvas shown), whose picture it shows over its name and,
   * expanded, in the box that trades it back; else the Root's Canvas.
   */
  owner?: unknown;
  language?: string;
  /**
   * A place asked for from Annotations, keyed as a map's list keys it: the Root's map in
   * place of `feature` and `canvases`, framed on it each time `n` changes.
   */
  asked?: { key: string; n: number } | null;
  /** Its map ready, and as it goes not: the Canvas keeps its controls until then. */
  onReady?: (ready: boolean) => void;
}) {
  const { t, langOf } = useCloverTranslation();
  /*
   * Inside a Root given georeference annotations as its content, every sheet, the ones in
   * view outlined, as the Root's own map lays them (`isGeoreferencedContent`); else the
   * view's alone.
   */
  const georeferenced = useOptionalCloverSelector(
    (state) => (isGeoreferencedContent(state.manifest) ? state.manifest : null),
    null,
  );
  const overlays = useMemo(
    () =>
      (georeferenced
        ? selectSequence(georeferenced).canvases
        : (canvases ?? [])
      ).flatMap((canvas) => canvasGeoreferences(canvas as never)),
    [georeferenced, canvases],
  );
  const current = useMemo(
    () =>
      georeferenced
        ? (canvases ?? []).map((canvas) => (canvas as { id: string }).id)
        : undefined,
    [georeferenced, canvases],
  );
  /*
   * A popup while it is a box over the Canvas, put away as another opens; filling the Body,
   * it is the Body's view, and the annotations menu opens over it (`Controls`' `away`).
   */
  useOneOpen(open && !swapped, () => onClose(false));
  /*
   * Asked for from a list, focus goes back to what asked as it is put away (WCAG 2.4.3):
   * each ask's, as it comes; or, where that went away with what held it (a panel over the
   * Body, put away as it asked, `PanelPane`), to the control that opens that again.
   */
  const asker = useRef<Element | null>(null);
  useEffect(() => {
    if (asked) asker.current = document.activeElement;
    // Each ask, as it comes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.n]);
  const close = (restoreFocus: boolean) => {
    onClose(restoreFocus);
    // Once it has gone, as the Canvas's controls come back into sight with it.
    const from = asker.current;
    if (asked && restoreFocus) focusSoon(() => backTo(from));
    if (returnFocus && restoreFocus)
      focusSoon(() => document.getElementById(returnFocus));
  };
  const heading = localize(name, language);
  // A place with no label: the box is named for what it holds, in Clover's language.
  const fallback = useContainerName(
    t("mapLabel"),
    langOf("mapLabel"),
    Boolean(heading.text),
  );
  /*
   * Focus follows a swap to the control that trades them back, its Expand map or the
   * page's picture's Collapse map, where it was on the one gone (WCAG 2.4.3), once it
   * can take it, as the map comes in out of sight first (`data-map-host`).
   */
  const was = useRef(swapped);
  useEffect(() => {
    if (was.current === swapped) return;
    was.current = swapped;
    focusSoon(() => document.getElementById(`swap-${id}`));
  }, [swapped, id]);
  if (!open) return null;
  // Its Close, on the map's box: the page's picture over the map has its own.
  const closer = (
    <Button
      id={`close-${id}`}
      label={t("commonClose")}
      lang={langOf("commonClose")}
      onClick={() => close(true)}
    >
      <Close />
    </Button>
  );
  /*
   * Expanded, the page's picture over the map, in its box under its zoom row (`Inset.css`),
   * with Close after its Collapse map, as the map's box has after Expand map (Mat,
   * 2026-11-16: "include close button here as well"), which puts the picture away, as the
   * map's Image control does (`useMapPutAway`), never the map under it.
   */
  const page = swapped && (
    <Inset
      className="clover-canvas-place-page"
      label={t("mapCollapse")}
      lang={langOf("mapCollapse")}
      expandId={`swap-${id}`}
      onExpand={onSwap}
      actions={<PageClose id={`close-page-${id}`} />}
    >
      <Thumbnail of="canvas" value={owner} alt="" size={720} />
    </Inset>
  );
  return (
    <Inset
      id={id}
      expanded={swapped}
      className="clover-canvas-place"
      label={t("mapExpand")}
      lang={langOf("mapExpand")}
      expandId={`swap-${id}`}
      onExpand={onSwap}
      actions={closer}
      data-swapped={swapped || undefined}
      // Asked for from a list: a panel over the Body that asked hands focus here.
      data-asked={asked ? "" : undefined}
      // Filling the Body, it waits out of sight until its map has drawn (`Map.css`).
      data-map-host={swapped || undefined}
      data-testid="clover-canvas-place"
      role="group"
      aria-labelledby={heading.text ? `${id}-name` : undefined}
      {...fallback.props}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }}
    >
      {/* The map first, so it stays the one map as it and the Canvas trade places. */}
      {asked ? (
        <RootPlaceMap focus={asked} reframe={swapped} onReady={onReady}>
          {page}
        </RootPlaceMap>
      ) : (
        <GivenMap
          navPlace={feature}
          read={overlays}
          current={current}
          owner={owner}
          reframe={swapped}
          navigable={swapped}
          forwardedRef={null}
          landmark={false}
          items={false}
          language={language}
        >
          {page}
        </GivenMap>
      )}
      {fallback.node}
      {heading.text && (
        <p
          id={`${id}-name`}
          style={visuallyHidden}
          {...languageProps(heading.lang)}
        >
          {heading.text}
        </p>
      )}
    </Inset>
  );
}

/** Can take focus: in the page, laid out, and not under anything inert or hidden. */
const reachable = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLElement &&
  element.isConnected &&
  element.getClientRects().length > 0 &&
  !element.closest("[inert], [hidden]");

/**
 * Where focus goes back to: what asked for a place, else the control that opens what held
 * it, as a panel's toggle names that panel (`aria-controls`): never what is gone.
 */
function backTo(from: Element | null): Element | null {
  if (reachable(from)) return from;
  for (let node = from?.parentElement; node; node = node.parentElement) {
    if (!node.id) continue;
    const opener = document.querySelector(
      `button[aria-controls~="${CSS.escape(node.id)}"]`,
    );
    if (reachable(opener)) return opener;
  }
  return null;
}

/** Close on the page's picture over the expanded map: puts the picture away. */
function PageClose({ id }: { id: string }) {
  const { t, langOf } = useCloverTranslation();
  const putAway = useMapPutAway();
  return (
    <Button
      id={id}
      label={t("commonClose")}
      lang={langOf("commonClose")}
      onClick={() => putAway?.()}
    >
      <Close />
    </Button>
  );
}

/**
 * The Root's map in the box, for a place asked for from Annotations: its places and its
 * overlays as the Panel's Map section showed them, listing nothing (Annotations does),
 * framed on the one asked for.
 */
function RootPlaceMap({
  focus,
  reframe,
  onReady,
  children,
}: {
  focus: { key: string; n: number };
  reframe: boolean;
  onReady?: (ready: boolean) => void;
  /** Over the map, in its box: expanded, the page's picture. */
  children?: React.ReactNode;
}) {
  const root = useRootMap("view", undefined);
  return (
    <MapView
      {...root}
      focus={focus}
      reframe={reframe}
      navigable={reframe}
      onReady={onReady}
      forwardedRef={null}
      landmark={false}
      items={false}
    >
      {children}
    </MapView>
  );
}
