import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  type Forwarded,
  type ItemsProps,
  ItemsView,
  Pager,
  stepsOf,
} from "./Items";
import {
  type ItemModel,
  itemsOfCollection,
  itemsOfManifest,
} from "../../core/items";
import { resolveDirection } from "../../core/sequence";
import { fetchResource } from "../../core/load";
import type {
  Container,
  Presentation4Collection,
  Manifest,
} from "../../core/presentation";
import { type LanguageMapLike, hrefLangOf, localize } from "../../core/value";
import { languageProps } from "../../i18n/direction";
import { titleTag } from "../../ui/heading";

/**
 * Items from any resource: a Manifest's views, a Collection's members, or a list. Here,
 * beside its one caller, which a Root's Items never loads.
 */
function itemsOf(
  resource: Manifest | Presentation4Collection | Container[] | null,
): ItemModel[] {
  if (!resource) return [];
  if (Array.isArray(resource)) {
    return itemsOfCollection({
      items: resource,
    } as unknown as Presentation4Collection);
  }
  return resource.type === "Collection"
    ? itemsOfCollection(resource as Presentation4Collection)
    : itemsOfManifest(resource as Manifest);
}

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
  /*
   * Another content: the last one's items go in this very render, before the next is
   * asked for (Mat, 2026-11-06), and the choice starts again at the first.
   */
  const [loadingFor, setLoadingFor] = useState(key);
  if (loadingFor !== key) {
    setLoadingFor(key);
    setResource(null);
    setSelected(0);
  }

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
          ? (titleId, langOf, t) => {
              const label = localize(
                resource.label as LanguageMapLike,
                rest.language,
              );
              const summary = localize(
                (resource as { summary?: LanguageMapLike }).summary,
                rest.language,
              );
              // Past 6 not a heading (`ui/heading.ts`): the list is named by it either way.
              const Title = titleTag(rest.headingLevel ?? 2) as "h2";
              return {
                titled: Boolean(label.text),
                node: (label.text || summary.text) && (
                  <header className="clover-items-header">
                    {label.text && (
                      <Title
                        className="clover-items-title clover-title"
                        id={titleId}
                        {...languageProps(label.lang)}
                      >
                        {label.text}
                      </Title>
                    )}
                    {summary.text && (
                      <p
                        className="clover-items-description"
                        {...languageProps(summary.lang)}
                      >
                        {summary.text.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    {homepage && (
                      <a
                        className="clover-items-homepage"
                        href={homepage}
                        hrefLang={hrefLangOf(page)}
                        {...languageProps(langOf("commonViewAll"))}
                      >
                        {t("commonViewAll")}
                      </a>
                    )}
                  </header>
                ),
              };
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
