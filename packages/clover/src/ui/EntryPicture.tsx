import React from "react";

import type { CloverRequest } from "../core/request";
import type { ThumbnailSource } from "../core/thumbnail";
import { useLoaded } from "../hooks/useLoaded";

/*
 * Its own module, apart from `AnnotationEntry`, as more than an annotation's entry shows
 * one: a georeferenced image's (`Places`) and a Choice's items (`Canvas/ChoiceMenu`),
 * which bring neither the Annotations list's sheet nor its words' code.
 */

// An entry's picture, loaded as a list first shows one (`AnnotationPicture`).
const loadPicture = () => import("./AnnotationPicture");

/**
 * An entry's picture (`AnnotationPicture`): its square holds its room from the start, so
 * the words beside it never move as it arrives. Decorative, as the entry's words name it;
 * nothing for an entry with nothing to picture.
 */
export function EntryPicture({
  source,
  request,
}: {
  source: ThumbnailSource | null | undefined;
  request?: CloverRequest;
}) {
  const loaded = useLoaded(loadPicture, Boolean(source));
  if (!source) return null;
  return loaded ? (
    <loaded.default
      className="clover-annotations-thumbnail"
      source={source}
      request={request}
    />
  ) : (
    <span className="clover-entry-thumbnail clover-annotations-thumbnail" />
  );
}
