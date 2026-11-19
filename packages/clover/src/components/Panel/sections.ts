import {
  canvasTimedText,
  canvasTextTranscripts,
  type IIIFCanvas,
} from "../Canvas/layout";
import { hasGeoreferences, hasMapData } from "../../core/geo-detect";
import { isImageServiceManifest } from "../../core/load";
import { searchServiceOf } from "../../core/search-service";
import { tableOfContents } from "../../core/ranges";
import { partOfCollection, selectVisibleCanvases } from "../../core/selectors";
import { selectListedSets } from "../../core/annotation-sets";
import type { CloverState } from "../../core/clover";
import { useCloverSelector } from "../../react/context";

/**
 * A section `Panel` draws by itself, from what the Root's resource holds. `sections`
 * chooses among them; each still shows only where there is data for it.
 */
export type PanelSection =
  | "about"
  | "targets"
  | "collection"
  | "contents"
  | "search"
  | "map"
  | "transcript"
  | "annotations";

/**
 * Every section, in the order a `Panel` draws them. Each is offered unasked but the Map,
 * which a page names to have (`sections`): its places and georeferenced images are listed
 * in Annotations instead, and shown on the map over the Body (Mat, 2026-11-13: "if we have
 * navPlace or georeference annotations. no longer render a Map section").
 */
const PANEL_SECTIONS: readonly PanelSection[] = [
  "about",
  "targets",
  "collection",
  "contents",
  "search",
  "map",
  "transcript",
  "annotations",
];

/**
 * Whether the resource holds anything for each section, read from a Root's state: the one
 * place that decides, for the `Panel` and for the templates around it. About is offered
 * wherever the resource says anything of itself, which is always but for an image service
 * shown as its image, which says only the rights its `info.json` gave. None of these reads the section's own
 * module, so a section never opened is never fetched.
 */
const HAS: Record<
  PanelSection,
  (state: CloverState, partOf?: boolean) => boolean
> = {
  about: (state) =>
    !isImageServiceManifest(state.manifest) ||
    Boolean(state.manifest?.rights || state.manifest?.requiredStatement),
  // A content state's several targets (Cookbook 0540), listed as a Collection's members are.
  targets: (state) => (state.targets?.items.length ?? 0) > 1,
  /*
   * Reached through a Collection; a Manifest only `partOf` one, where the page asks
   * (`partOfCollection`, nulib-ds/clover#439), as it loads the whole Collection. About
   * names that Collection either way, as Part of.
   */
  collection: (state, partOf) =>
    (state.collection?.items?.length ?? 0) > 0 ||
    Boolean(partOf && partOfCollection(state.manifest)),
  contents: (state) => tableOfContents(state.manifest).length > 0,
  search: (state) => Boolean(searchServiceOf(state.manifest)),
  map: (state) => hasMapData(state.manifest, state.collection),
  transcript: (state) =>
    (
      selectVisibleCanvases(
        state.manifest,
        state.canvasId,
      ) as unknown as IIIFCanvas[]
    ).some(
      (canvas) =>
        canvasTimedText(canvas).length > 0 ||
        canvasTextTranscripts(canvas).length > 0,
    ),
  // Its annotations, else its georeferences, which Annotations lists where no Map does.
  annotations: (state) =>
    selectListedSets(state.manifest, state.addedSets).length > 0,
};

/** The sections offered only where a page names them. */
const ASKED_ONLY: ReadonlySet<PanelSection> = new Set(["map"]);

/** What else a page may ask of the default sections, beside naming them. */
export interface PanelSectionOptions {
  /**
   * Offer the Collection section for the Collection a Manifest is `partOf`, which it
   * fetches when opened, listing its members. By default only a Collection the Root was
   * reached through has the section; About names the one it is part of either way.
   */
  partOfCollection?: boolean;
}

/**
 * Those of `PANEL_SECTIONS` with data, narrowed to the ones a page asked for. Anything
 * but an array is no narrowing: an element's attribute carries whatever JSON it was
 * given, and a page that wrote something else keeps every section rather than none.
 */
const narrow = (
  data: Record<PanelSection, boolean>,
  sections: readonly PanelSection[] | undefined,
  georeferenced: boolean,
) => {
  const chosen = Array.isArray(sections)
    ? new Set<string>(sections)
    : undefined;
  const asked = (section: PanelSection) =>
    chosen ? chosen.has(section) : !ASKED_ONLY.has(section);
  // Its georeferences are listed in Annotations wherever no Map section shows them; its
  // places (`navPlace`) are About's.
  const listed = {
    ...data,
    annotations: data.annotations || (georeferenced && !asked("map")),
  };
  return PANEL_SECTIONS.filter((section) => listed[section] && asked(section));
};

/**
 * The default sections a `Panel` in this Root would have, in its order: About, and each
 * other one the resource has data for, narrowed to `sections` where the page names the
 * ones it wants. The Map is offered only where `sections` names it; elsewhere the
 * resource's georeferenced images are listed in Annotations, which is offered for them,
 * and its places in About. None of them,
 * and the panel draws nothing, so a layout of your own can ask first and leave out the
 * pane that would hold it:
 *
 * ```jsx
 * const sections = Clover.usePanelSections(["contents", "search"]);
 * return sections.length ? <Clover.Panel sections={sections} /> : null;
 * ```
 *
 * Asking costs nothing a `Panel` does not already cost: the same reads of the Root, one
 * for each section, so a change that moves none of them re-renders nothing.
 */
export function usePanelSections(
  sections?: readonly PanelSection[],
  options?: PanelSectionOptions,
): PanelSection[] {
  /*
   * One read for each section, never one for the list: a selector that returned an array
   * would be new every time, and re-render its reader on every change of the state.
   */
  const partOf = options?.partOfCollection;
  const data: Record<PanelSection, boolean> = {
    about: useCloverSelector(HAS.about),
    targets: useCloverSelector(HAS.targets),
    collection: useCloverSelector((state) => HAS.collection(state, partOf)),
    contents: useCloverSelector(HAS.contents),
    search: useCloverSelector(HAS.search),
    map: useCloverSelector(HAS.map),
    transcript: useCloverSelector(HAS.transcript),
    annotations: useCloverSelector(HAS.annotations),
  };
  const georeferenced = useCloverSelector((state) =>
    hasGeoreferences(state.manifest),
  );
  return narrow(data, sections, georeferenced);
}
