import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  type Forwarded,
  type ItemsProps,
  ItemsView,
  Pager,
  stepsOf,
} from "./Items";
import { itemsOf } from "../../core/items";
import { resolveDirection } from "../../core/sequence";
import { fetchResource } from "../../core/load";
import type {
  Presentation4Collection,
  Manifest,
} from "../../core/presentation";
import { type LanguageMapLike, hrefLangOf } from "../../core/value";

/** Items of a resource the component loads itself, or of a list it is handed. */
export default function StandaloneItems({
  iiifContent,
  items: provided,
  navigation,
  onSelect,
  request,
  header = true,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const [resource, setResource] = useState<
    Manifest | Presentation4Collection | null
  >(null);
  const [selected, setSelected] = useState(0);
  const key =
    typeof iiifContent === "string"
      ? iiifContent
      : (iiifContent as { id?: string })?.id;
  const latest = useRef({ iiifContent, request });
  latest.current = { iiifContent, request };

  useEffect(() => {
    if (provided || latest.current.iiifContent === undefined) return;
    const controller = new AbortController();
    fetchResource(latest.current.iiifContent, {
      request: latest.current.request,
      signal: controller.signal,
    })
      .then((loaded) => {
        if (!controller.signal.aborted) setResource(loaded);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key, provided]);

  const items = useMemo(
    () => itemsOf(provided ? (provided as never) : resource),
    [provided, resource],
  );
  if (!items.length) return null;

  const isViews = !provided && resource?.type === "Manifest";
  // The resource's own `viewingDirection` orders its views or members.
  const direction = resolveDirection(
    (resource as { viewingDirection?: unknown } | null)?.viewingDirection,
  );
  const mode = navigation ?? (isViews ? "id" : "homepage");
  // A pager steps a selection over the list, and tells `onSelect` of each step.
  if (rest.layout === "pager") {
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={stepsOf(items, selected, direction, (item, event) => {
          onSelect?.(item, event);
          setSelected(items.indexOf(item));
        })}
      />
    );
  }
  const page = (resource as { homepage?: Array<{ id?: string }> } | null)
    ?.homepage?.[0];
  const homepage = page?.id;

  return (
    <ItemsView
      {...rest}
      forwardedRef={forwardedRef}
      items={items}
      selected={mode === "id" ? selected : -1}
      navigation={mode}
      rtl={direction === "right-to-left"}
      request={request}
      showSummary={!isViews}
      heading={
        header && resource
          ? {
              label: resource.label as LanguageMapLike,
              summary: (resource as { summary?: LanguageMapLike }).summary,
              homepage,
              homepageLang: hrefLangOf(page),
            }
          : undefined
      }
      onActivate={(item, event) => {
        onSelect?.(item, event);
        setSelected(items.indexOf(item));
      }}
      followFocus={(item) => setSelected(items.indexOf(item))}
    />
  );
}
