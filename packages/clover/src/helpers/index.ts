/*
 * @nulib/clover/helpers: the functions Clover reads IIIF with, and their types, without
 * React. The same functions `@nulib/clover` exports (Helpers' page, and the Search,
 * Contents and Transcript pages for theirs), from the same modules, so a page importing
 * both carries one copy. No module this entry reaches imports React, or says
 * `"use client"`, so a server, a build script, a worker or a React Server Component can
 * call them (`build/bundle.test.mjs`, `build/consumer.test.mjs`).
 *
 *   import { localize, toPresentation4 } from "@nulib/clover/helpers";
 */

// IIIF resources
export { toPresentation4 } from "../core/presentation";
export type {
  Container,
  Manifest,
  Presentation4Canvas,
  Presentation4Collection,
  Presentation4Scene,
  Presentation4Timeline,
} from "../core/presentation";
export type { IIIFContent } from "../core/load";
export type { CloverRequest } from "../core/request";
export { readAs, toPlainText } from "../core/text";
export { localize } from "../core/value";
export type { LocalizedValue } from "../core/value";
export {
  resolveThumbnail,
  stillSource,
  thumbnailSource,
} from "../core/thumbnail";
export { regionSource } from "../core/region";
export { buildContentState, encodeContentState } from "../core/content-state";
export type { ContentStateOutput, Target } from "../core/content-state";
export { decodeContentState } from "../core/content-state-reader";
export {
  groupViews,
  resolveBehavior,
  resolveDirection,
} from "../core/sequence";
export type {
  SequenceBehavior,
  View,
  ViewingDirection,
} from "../core/sequence";

// Search, Contents and Transcript
export { search } from "../core/search";
export { searchServiceOf } from "../core/search-service";
export type {
  SearchHit,
  SearchResults,
  SearchService,
} from "../core/search-service";
export { chaptersOf, currentContents, tableOfContents } from "../core/ranges";
export type { Chapter, ContentsNode, ContentsPart } from "../core/ranges";
export { cueAt, parseVtt } from "../core/vtt";
export type { Cue } from "../core/vtt";

// Maps
export {
  affineTransform,
  boundsOf,
  canvasHasMapData,
  cornersOf,
  georeferencesOf,
  hasMapData,
  navPlaceOf,
  readGeoreference,
} from "../core/geo";
export type {
  Georeference,
  MapFeature,
  MapFeatureCollection,
} from "../core/geo";
export { setMapWorkerUrl } from "../core/map-config";
