import React, { useEffect, useMemo, useState } from "react";

import {
  type Forwarded,
  type ItemsProps,
  ItemsView,
  Pager,
  stepsOf,
} from "./Items";
import { CountMenu } from "./CountMenu";
import type { ContentTarget } from "../../core/content-state";
import type { ItemModel } from "../../core/items";
import type { Manifest } from "../../core/presentation";
import { regionSource } from "../../core/region";
import { selectSequence, selectTargetIndex } from "../../core/selectors";
import { type LanguageMapLike, localize } from "../../core/value";
import { useClover, useCloverSelector } from "../../react/context";
import { fetchManifest } from "../../react/fetchManifest";
import { Steps } from "../../ui/Steps";
import { titleTag } from "../../ui/heading";
import { languageProps } from "../../core/direction";

/**
 * A content state's targets (Cookbook 0540: two Canvases from two Manifests, to compare),
 * as Items lists them: each a picture of its place (its region, cut from its Canvas, else
 * the Canvas's own), the Canvas's name, and its Manifest's title under it where that says
 * more. Each Manifest is read once, as the listing first shows (`fetchManifest`), the one
 * shown from the Root; until it arrives, a target has no name or picture. The one shown is
 * selected; choosing one goes there (`clover.goToTarget`). Loaded only for a content state
 * that names two or more.
 */
export default function TargetItems({
  onSelect,
  forwardedRef,
  ...rest
}: ItemsProps & Forwarded) {
  const { clover, language } = useClover("Items");
  const { items, position } = useTargetItems();
  const choose = (item: ItemModel, event: React.SyntheticEvent) => {
    onSelect?.(item, event);
    const index = items.findIndex((each) => each.id === item.id);
    if (index >= 0) clover.goToTarget(index);
  };
  if (rest.layout === "pager") {
    return (
      <Pager
        {...rest}
        forwardedRef={forwardedRef}
        steps={stepsOf(items, position, "left-to-right", choose)}
        nameKey="informationPanelTabsTargets"
        position={
          <CountMenu
            position={position}
            total={items.length}
            list={(chosen) => (
              <TargetItems
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
  );
}

/** The targets as Items' models, and which is shown (-1 where none is). */
export function useTargetItems(): { items: ItemModel[]; position: number } {
  const { language } = useClover("Items");
  const targets = useCloverSelector((state) => state.targets);
  const shown = useCloverSelector((state) => state.manifest);
  const position = useCloverSelector((state) =>
    selectTargetIndex(
      state.targets,
      state.targetIndex,
      state.manifest,
      state.canvasId,
    ),
  );
  const manifests = useTargetManifests(targets?.items, shown);
  const items = useMemo(
    () =>
      (targets?.items ?? []).map((target) =>
        targetItem(
          target,
          manifests.get(target.manifestId) ??
            (target.manifestAs ? manifests.get(target.manifestAs) : undefined),
          language,
        ),
      ),
    [targets, manifests, language],
  );
  return { items, position };
}

/** Each target's Manifest: the one shown, from the Root; the others fetched, once each. */
function useTargetManifests(
  targets: ContentTarget[] | undefined,
  shown: Manifest | null,
): Map<string, Manifest> {
  const { clover } = useClover("Items");
  const ids = useMemo(
    () => [...new Set((targets ?? []).map((target) => target.manifestId))],
    [targets],
  );
  const [fetched, setFetched] = useState<Map<string, Manifest>>(new Map());
  useEffect(() => {
    let live = true;
    void Promise.all(
      ids.map(async (id) => [id, await fetchManifest(clover, id)] as const),
    ).then((found) => {
      if (!live) return;
      setFetched(
        new Map(
          found.filter((entry): entry is [string, Manifest] =>
            Boolean(entry[1]),
          ),
        ),
      );
    });
    return () => {
      live = false;
    };
  }, [clover, ids]);
  return useMemo(() => {
    const all = new Map(fetched);
    if (shown) all.set(shown.id, shown);
    return all;
  }, [fetched, shown]);
}

type Json = Record<string, any>;

/**
 * A target as an item: its Canvas's name (else its Manifest's title), the title under it
 * where it says more, and a picture of its region, else of its Canvas.
 */
function targetItem(
  target: ContentTarget,
  manifest: Manifest | undefined,
  language: string | undefined,
): ItemModel {
  const canvases = manifest
    ? (selectSequence(manifest).canvases as Json[])
    : [];
  const canvas =
    canvases.find((each) => each.id === target.canvasId) ?? canvases[0];
  const title = manifest?.label as LanguageMapLike | undefined;
  const own = canvas?.label as LanguageMapLike | undefined;
  const label = localize(own, language).text ? own : title;
  const under =
    title &&
    label !== title &&
    localize(title, language).text !== localize(label, language).text
      ? title
      : undefined;
  const region =
    canvas && target.region ? regionSource(canvas, target.region) : undefined;
  return {
    id: target.id,
    label,
    summary: under,
    parts: [
      {
        id: target.id,
        type: "Canvas",
        label,
        resource: canvas ?? { id: target.canvasId ?? target.manifestId },
        // Its region where one is named and can be cut; else the Canvas's own picture.
        ...(region ? { source: region } : {}),
      },
    ],
  };
}

/**
 * The Panel's Views section: a content state's targets, as a Collection's members are
 * listed (`Collection`), under the content state's own `label` where it gives one, with
 * a way to walk them in order beside it, Previous, the place ("1 / 2") and Next, as an
 * article's parts are walked in Contents (`ui/Steps`; Cookbook 0027's sequences).
 */
export function TargetsSection({
  headingLevel = 3,
}: {
  headingLevel?: number;
}) {
  const { clover, language } = useClover("Items");
  const label = useCloverSelector((state) => state.targets?.label);
  const total = useCloverSelector((state) => state.targets?.items.length ?? 0);
  const position = useCloverSelector((state) =>
    selectTargetIndex(
      state.targets,
      state.targetIndex,
      state.manifest,
      state.canvasId,
    ),
  );
  if (total < 2) return null;
  const heading = localize(label, language);
  const Title = titleTag(headingLevel) as React.ElementType;
  return (
    <div className="clover-about clover-collection clover-targets">
      <div className="clover-targets-head">
        {heading.text && (
          <Title
            className="clover-collection-title"
            {...languageProps(heading.lang)}
          >
            {heading.text}
          </Title>
        )}
        <Steps
          className="clover-targets-steps"
          steps={{
            position,
            total,
            step: (by) => {
              const to = position + by;
              if (to >= 0 && to < total) clover.goToTarget(to);
            },
          }}
        />
      </div>
      <TargetItems layout="list" forwardedRef={null} />
    </div>
  );
}
