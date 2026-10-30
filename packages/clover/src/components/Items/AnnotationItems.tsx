import React, { useEffect, useMemo, useRef, useState } from "react";

import { type Forwarded, type ItemsProps, ItemsView, Pager } from "./Items";
import { CountMenu } from "./CountMenu";
import type { Steps } from "./Pager";
import { annotationName } from "../../core/annotation-name";
import {
  type AnnotationEntry,
  type AnnotationPageRef,
  manifestOfAnnotation,
  selectAnnotationCollection,
} from "../../core/annotation-sets";
import type { ItemModel } from "../../core/items";
import type { Manifest } from "../../core/presentation";
import { regionSource } from "../../core/region";
import { selectCanvas } from "../../core/selectors";
import type { LanguageMapLike } from "../../core/value";
import { useClover, useCloverSelector } from "../../react/context";
import { fetchManifest } from "../../react/fetchManifest";
import { usePagesReached } from "../../react/usePagesReached";
import { ListEnd } from "../../ui/ListEnd";

/**
 * Annotations walked as one whole (`selectAnnotationCollection`), as Items lists a
 * Collection's members: the AnnotationPage given as the content (James Turner's tags
 * across Manifests), or an AnnotationCollection the Manifest's pages are part of (Cookbook
 * 0309: layout markup across a newspaper's pages). Each is a picture of its region (cut
 * from its Canvas, else the Canvas's own), what it says, and under it its Canvas's label,
 * or its Manifest's title where they are on several. The one picked is selected; choosing
 * one picks it, and the Root goes to its Canvas, in another Manifest where it is there,
 * and frames it (`clover.selectAnnotation`).
 *
 * The content's are all in hand. A Collection's pages load as the reader reaches them,
 * never all at once (Mat, 2026-10-29: "we don't want to load all"): those up to the one
 * the reader is on (the view's, or the picked annotation's); the next as a step goes past
 * the last one loaded, or as a list's end comes into view. They are listed in order from
 * the first, so the count is the Collection's own `total`, where it gives one. Loaded only
 * where there are such annotations. The other Manifests they name are read only for a
 * list, for its pictures and titles.
 */
export default function AnnotationItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useClover("Items");
  const manifest = useCloverSelector((state) => state.manifest);
  const collection = useCloverSelector((state) =>
    selectAnnotationCollection(state.manifest, state.addedSets),
  );
  const picked = useCloverSelector((state) => state.annotationId);
  const pages = collection?.pages ?? NO_PAGES;
  const entries = collection?.entries ?? NO_ENTRIES;

  const { loaded, more, reachNext } = usePagesReached(pages);

  // The Manifests they are on, where that is more than the one shown, read for a list.
  const elsewhere = useMemo(
    () => [
      ...new Set(
        entries
          .map((entry) => manifestOfAnnotation(entry.annotation))
          .filter((id): id is string => Boolean(id) && id !== manifest?.id),
      ),
    ],
    [entries, manifest?.id],
  );
  const others = useManifests(rest.layout === "pager" ? NO_IDS : elsewhere);
  const several = elsewhere.length > 0;
  const items = useMemo(() => {
    // The content's are all listed; a Collection's, its pages in a run from the first.
    const listed = pages.length
      ? new Set(pages.slice(0, loaded).map((page) => page.id))
      : null;
    return entries
      .filter((entry) => !listed || listed.has(entry.setId))
      .map((entry) => {
        const own = manifestOfAnnotation(entry.annotation);
        const on =
          own && own !== manifest?.id ? (others.get(own) ?? null) : manifest;
        return annotationItem(entry, on, language, several);
      });
  }, [pages, loaded, entries, manifest, others, several, language]);
  const total = Math.max(collection?.total ?? 0, items.length);

  /*
   * A step past the last one loaded: the next page is asked for, and the step lands once
   * it is listed, as the reader pressed it.
   */
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const to = pending.current;
    if (to === null || !items[to]) return;
    pending.current = null;
    clover.selectAnnotation(items[to].id);
  }, [clover, items]);

  if (!items.length) return null;
  const position = items.findIndex((item) => item.id === picked);
  const choose = (item: ItemModel, event: React.SyntheticEvent) => {
    onSelect?.(item, event);
    clover.selectAnnotation(item.id);
  };
  if (rest.layout === "pager") {
    const steps: Steps = {
      position,
      total,
      direction: "left-to-right",
      step: (by, event) => {
        const to = position + by;
        if (to < 0) return;
        if (items[to]) return choose(items[to], event);
        if (more) {
          pending.current = to;
          reachNext();
        }
      },
    };
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={steps}
        nameKey="informationPanelTabsAnnotations"
        position={
          <CountMenu
            position={position}
            total={total}
            list={(chosen) => (
              <AnnotationItems
                layout="list"
                forwardedRef={null}
                onSelect={chosen}
              />
            )}
          />
        }
      />
    );
  }
  return (
    <>
      <ItemsView
        {...rest}
        forwardedRef={forwardedRef}
        items={items}
        selected={position}
        navigation="id"
        language={language}
        request={clover.request}
        showSummary
        onActivate={choose}
      />
      {more && <ListEnd onReached={reachNext} />}
    </>
  );
}

const NO_PAGES: AnnotationPageRef[] = [];
const NO_ENTRIES: AnnotationEntry[] = [];
const NO_IDS: string[] = [];

/** These Manifests, each read once (`fetchManifest`), as they arrive. */
function useManifests(ids: string[]): Map<string, Manifest> {
  const { clover } = useClover("Items");
  const [found, setFound] = useState<Map<string, Manifest>>(NO_MANIFESTS);
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    for (const id of ids)
      void fetchManifest(clover, id).then((manifest) => {
        if (live && manifest)
          setFound((was) =>
            was.has(id) ? was : new Map(was).set(id, manifest),
          );
      });
    return () => {
      live = false;
    };
  }, [clover, ids]);
  return found;
}
const NO_MANIFESTS = new Map<string, Manifest>();

type Json = Record<string, any>;

/**
 * An annotation as an item: what it says (as the Annotations list names it), under it its
 * Canvas's label (or, where the annotations are on several Manifests, its Manifest's
 * title), and a picture of its region, else of its Canvas, once its Manifest is read.
 */
function annotationItem(
  entry: AnnotationEntry,
  manifest: Manifest | null,
  language: string | undefined,
  several: boolean,
): ItemModel {
  const canvas = selectCanvas(manifest, entry.canvasId) as Json | null;
  const name = annotationName(entry.bodies, language);
  const label: LanguageMapLike | undefined = name.text
    ? { [name.lang ?? "none"]: [name.text] }
    : (canvas?.label as LanguageMapLike | undefined);
  const under = (several ? manifest?.label : canvas?.label) as
    | LanguageMapLike
    | undefined;
  const region =
    canvas && entry.target.rect
      ? regionSource(canvas, entry.target.rect)
      : undefined;
  return {
    id: entry.id,
    label,
    summary: name.text ? under : undefined,
    parts: [
      {
        id: entry.id,
        type: "Canvas",
        label,
        resource: canvas ?? { id: entry.canvasId },
        // Its region where one is named and can be cut; else the Canvas's own picture.
        ...(region ? { source: region } : {}),
      },
    ],
  };
}
