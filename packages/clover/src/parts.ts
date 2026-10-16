/*
 * Every part of @nulib/clover, and its hooks and data helpers: the whole package but the
 * Viewer. `src/index.ts` re-exports all of it. The templates import from here rather than
 * from the index, which imports the Default template for the Viewer: one way, no cycle.
 */

// Parts
export { Root } from "./components/Root/Root";
export type { RootProps } from "./components/Root/Root";
export { Content } from "./components/Content/Content";
export type { ContentProps } from "./components/Content/Content";
export type {
  ContentRenderer,
  ContentRendererProps,
} from "./components/Content/renderers";
export { Label } from "./components/Label/Label";
export type { LabelProps } from "./components/Label/Label";
export { Items } from "./components/Items/Items";
export type { ItemsLayout, ItemsProps } from "./components/Items/Items";
export { Next, Position, Previous } from "./components/Items/Pager";
export type {
  PositionProps,
  StepProps,
  StepsOf,
} from "./components/Items/Pager";
export { Status } from "./components/Status/Status";
export {
  Homepage,
  Id,
  Metadata,
  PartOf,
  Rendering,
  RequiredStatement,
  Rights,
  SeeAlso,
  Summary,
  Thumbnail,
  Value,
} from "./components/Primitives/Primitives";
export {
  InformationPanel,
  Tab,
} from "./components/InformationPanel/InformationPanel";
export type {
  InformationPanelLayout,
  InformationPanelProps,
  TabProps,
} from "./components/InformationPanel/InformationPanel";
export { About } from "./components/InformationPanel/About";
export { Annotations } from "./components/Annotations/Annotations";
export type { AnnotationsProps } from "./components/Annotations/Annotations";
export { Transcript } from "./components/Transcript/Transcript";
export { Contents } from "./components/Contents/Contents";
export type { ContentsProps } from "./components/Contents/Contents";
export { Download } from "./components/Download/Download";
export { Split, SplitHandle, SplitPane } from "./components/Split/Split";
export type {
  SplitHandleProps,
  SplitLength,
  SplitPaneProps,
  SplitProps,
} from "./components/Split/Split";
export type { DownloadProps } from "./components/Download/Download";
export { Search } from "./components/Search/Search";
export type { SearchProps } from "./components/Search/Search";
export { search } from "./core/search";
export { SEARCH_SET_ID, searchServiceOf } from "./core/search-service";
/** Where MapLibre's worker is served from, for every map (a Viewer's Map tab included). */
export { setMapWorkerUrl } from "./core/map-config";
export type {
  SearchHit,
  SearchResults,
  SearchService,
} from "./core/search-service";
export { Collection } from "./components/Collection/Collection";
export type { CollectionProps } from "./components/Collection/Collection";
export { CollectionSelect } from "./components/CollectionSelect/CollectionSelect";
export type { CollectionSelectProps } from "./components/CollectionSelect/CollectionSelect";
export type { TranscriptProps } from "./components/Transcript/Transcript";
export type { AboutProps } from "./components/InformationPanel/About";
export { PanelToggle } from "./components/InformationPanel/PanelToggle";
export type { PanelToggleProps } from "./components/InformationPanel/PanelToggle";
export type { StatusProps } from "./components/Status/Status";
export { default as Canvas } from "./components/Canvas";
export type {
  CanvasHandle,
  CloverCanvasOptions,
  CloverCanvasProps,
  IIIFCanvas,
} from "./components/Canvas";
export type {
  CanvasControlsConfig,
  LabeledIIIFExternalWebResource,
} from "./components/Canvas/Canvas.types";
export type { ControlButtonProps, ControlButtons } from "./ui/controlButtons";

// Hooks, for parts of your own
export {
  useActiveCanvas,
  useAnnotationSets,
  useLocalized,
  useManifest,
  useNavigation,
  useSequence,
  useStatus,
  useT,
  useLangOf,
  useVisibleCanvases,
} from "./react/hooks";
/** Inline styles that hide text from sight but not from assistive technology. */
export { visuallyHidden } from "./ui/visuallyHidden";
/** The popover Clover's own controls show: a name, and a key when there is one. */
export { Tip } from "./ui/Tip";
export type { Shortcut } from "./ui/Tip";
/** Joins a popup of your own to Clover's, which open one at a time. */
export { useOneOpen } from "./ui/useOneOpen";
/** "Read more" for text of your own that its CSS cuts short, as `Summary` is. */
export { ReadMore } from "./ui/ReadMore";
export type { Navigation } from "./react/hooks";
export { useClover, useCloverSelector } from "./react/context";

// Data
export { createClover } from "./core/clover";
export type {
  Clover,
  CloverOptions,
  CloverState,
  CloverStatus,
  ViewportState,
} from "./core/clover";
export { isPresentation4, toPresentation4 } from "./core/presentation";
export type {
  Canvas as Presentation4Canvas,
  Collection as Presentation4Collection,
  Container,
  Manifest,
  Timeline,
} from "./core/presentation";
export type { IIIFContent } from "./core/load";
export type { CloverRequest } from "./core/request";
export type { ContentStateOutput, Target } from "./core/content-state";
export {
  buildContentState,
  decodeContentState,
  encodeContentState,
} from "./core/content-state";
export type {
  AnnotationBodyEntry,
  AnnotationEntry,
  AnnotationSet,
} from "./core/annotation-sets";
export type { AnnotationsInput } from "./core/annotation-collection";
export { cueAt, parseVtt } from "./core/vtt";
export type { Cue } from "./core/vtt";
export { chaptersOf, currentContents, tableOfContents } from "./core/ranges";
export type { Chapter, ContentsNode } from "./core/ranges";
export { localize } from "./core/value";
export { toPlainText } from "./core/text";
export type { ItemModel, ItemPart } from "./core/items";
export { thumbnailSource, resolveThumbnail } from "./core/thumbnail";
export type { LocalizedValue } from "./core/value";
export { groupViews, resolveBehavior, resolveDirection } from "./core/sequence";
export type { SequenceBehavior, View, ViewingDirection } from "./core/sequence";

export {
  CLOVER_I18N_NAMESPACE,
  initCloverI18n,
  type CloverI18n,
  type CloverI18nOptions,
  type CloverI18nResources,
} from "./i18n";
