import React, { useEffect, useState } from "react";

import type { CanvasAnnotation } from "./Annotations";
import type { CloverCanvasProps } from "./Canvas.types";
import CanvasView from "./CanvasView";
import type { IIIFCanvas } from "./layout";
import { CanvasPending } from "./Pending";
import { loadAnnotationSets } from "../../core/annotation-collection";
import { type AnnotationSet, readPage } from "../../core/annotation-sets";
import type { AnnotationLink } from "../../core/link";
import { type Loaded, loadContent } from "../../core/load";
import type { CloverRequest } from "../../core/request";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";

type View =
  | { state: "loading" }
  /** `next` while what a link leads to loads, the last one cleared meanwhile. */
  | { state: "ready"; content: Loaded; canvas: IIIFCanvas; next?: boolean }
  | { state: "error"; error: Error };

/**
 * A Canvas that loads what it draws (`iiifContent`), outside any `Root`, read as a Root
 * reads its content (`loadContent`): a Canvas, a Manifest (the Canvas a `start` or content
 * state names, or its first), a Collection (its first Manifest's), a content state, or
 * annotations given as the content. It draws the Canvas's own annotations (embedded or
 * referenced, and a content state's note), unless the host gives its own, and follows a
 * linking annotation (Cookbook 0022) to another of the Manifest's Canvases, or to the
 * Manifest its target is `partOf`, unless the host takes `onAnnotationLink`.
 *
 * Until it is drawn, the Canvas's box shows its background, with the loading mark along
 * the top and `aria-busy` (`CanvasPending`); if it will not load, an alert there says so,
 * with the error's own words. Never an empty or broken box. Loaded on demand, so a Canvas
 * handed its Canvases never carries it.
 */
export default function LoadedCanvas({
  iiifContent,
  onAnnotationLink,
  ...props
}: CloverCanvasProps) {
  const { t, langOf } = useCloverTranslation();
  const [view, setView] = useState<View>({ state: "loading" });
  const request = props.options?.request;
  // An object is known by its `id`, as a Root's content is: a new one alike does not reload.
  const key =
    typeof iiifContent === "string"
      ? iiifContent
      : String((iiifContent as Record<string, unknown> | undefined)?.id ?? "");
  // A link followed to another Manifest, shown in place of the content until it changes.
  const [followed, setFollowed] = useState<
    (AnnotationLink & { key: string; manifestId: string }) | null
  >(null);
  const link = followed?.key === key ? followed : null;

  useEffect(() => {
    let live = true;
    // What was shown stays, cleared, while the next loads: focus keeps its place.
    setView((current) =>
      current.state === "ready"
        ? { ...current, next: true }
        : { state: "loading" },
    );
    (async () => {
      const content = await loadContent(link?.manifestId ?? iiifContent!, {
        request,
      });
      const canvases = (content.manifest.items ?? []) as IIIFCanvas[];
      const wanted = link?.canvasId ?? content.target?.canvasId;
      const canvas = canvases.find((each) => each.id === wanted) ?? canvases[0];
      if (!canvas) throw new Error("It has no Canvas to show.");
      if (live) setView({ state: "ready", content, canvas });
    })().catch((error) => {
      if (live)
        setView({
          state: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
    });
    return () => {
      live = false;
    };
    // `key` stands in for the content, whose identity may change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, link?.manifestId, link?.canvasId, request]);

  // The Canvas's own annotations, once it shows: they never hold it back.
  const ready = view.state === "ready" ? view : null;
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const given = Boolean(props.annotations);
  useEffect(() => {
    setAnnotations((current) => (current.length ? [] : current));
    if (!ready || given) return;
    let live = true;
    annotationsOf(ready.canvas, ready.content, request)
      .then((found) => {
        if (live && found.length) setAnnotations(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // The Canvas and what it came with, not the view's other changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready?.canvas, ready?.content, request, given]);

  /*
   * A link to another of the Manifest's Canvases shows it at once; to another Manifest,
   * loads that one, there to show the Canvas named.
   */
  const follow = (target: AnnotationLink) => {
    if (!ready) return;
    const { manifest } = ready.content;
    const here = (manifest.items as IIIFCanvas[] | undefined)?.find(
      (canvas) => canvas.id === target.canvasId,
    );
    if (here) setView({ ...ready, canvas: here });
    else if (target.manifestId && target.manifestId !== manifest.id)
      setFollowed({ ...target, key, manifestId: target.manifestId });
  };

  if (view.state === "ready")
    return (
      <CanvasView
        {...props}
        manifestId={view.next ? "loading" : view.content.manifest.id}
        canvases={[view.canvas]}
        // Named as a Root's Canvas is: its own label, else its Manifest's.
        label={
          props.label ??
          (view.canvas.label as CloverCanvasProps["label"]) ??
          (view.content.manifest.label as CloverCanvasProps["label"])
        }
        annotations={props.annotations ?? annotations}
        onAnnotationLink={onAnnotationLink ?? follow}
      />
    );
  if (view.state === "error")
    return (
      <CanvasPending>
        <div className="clover-status" data-status="error" role="alert">
          <p lang={langOf("statusError")}>{t("statusError")}</p>
          {/* The error's own words: English, as the browser and Clover write them. */}
          <p className="clover-status-detail" lang="en">
            {view.error.message}
          </p>
        </div>
      </CanvasPending>
    );
  return <CanvasPending />;
}

/**
 * The annotations on `canvas`: its own pages (embedded ones read as they are, since
 * upgrading them again breaks their targets' fragments; referenced ones fetched and
 * upgraded), a content state's note, and annotations given as the content.
 */
async function annotationsOf(
  canvas: IIIFCanvas,
  content: Loaded,
  request: CloverRequest | undefined,
): Promise<CanvasAnnotation[]> {
  const pages = (canvas.annotations ?? []) as Array<Record<string, any>>;
  const embedded = pages.filter((page) => Array.isArray(page?.items));
  const referenced = pages.filter((page) => !Array.isArray(page?.items));
  // Each with its page's label, which the menu and a recording's cues show.
  const sets: Array<Pick<AnnotationSet, "label" | "entries">> = [
    ...embedded.map((page, index) => ({
      label: page.label,
      entries: readPage(page, page.id ?? `annotations-${index}`, canvas.id),
    })),
    ...(referenced.length
      ? await loadAnnotationSets(referenced, { request })
      : []),
    ...(content.annotation
      ? [
          {
            entries: readPage({ items: [content.annotation] }, "content-state"),
          },
        ]
      : []),
    ...(content.annotationSets ?? []),
  ];
  return sets.flatMap((set) =>
    set.entries
      .filter((entry) => entry.canvasId === canvas.id)
      .map((entry) => ({
        annotation: entry.annotation as CanvasAnnotation["annotation"],
        targetIndex: 0,
        ...(set.label ? { pageLabel: set.label } : {}),
      })),
  );
}
