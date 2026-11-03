import {
  canvasTimedText,
  canvasTextTranscripts,
  type IIIFCanvas,
} from "../Canvas/layout";
import { hasMapData } from "../../core/geo-detect";
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

/** Every default section, in the order a `Panel` draws them. */
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
 * place that decides, for the `Panel` and for the templates around it. About is always
 * offered: the resource says at least its label. None of these reads the section's own
 * module, so a section never opened is never fetched.
 */
const HAS: Record<PanelSection, (state: CloverState) => boolean> = {
  about: () => true,
  // A content state's several targets (Cookbook 0540), listed as a Collection's members are.
  targets: (state) => (state.targets?.items.length ?? 0) > 1,
  // Reached through a Collection, or part of one: offered either way, fetched when opened.
  collection: (state) =>
    (state.collection?.items?.length ?? 0) > 0 ||
    Boolean(partOfCollection(state.manifest)),
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
  annotations: (state) =>
    selectListedSets(state.manifest, state.addedSets).length > 0,
};

/** Those of `PANEL_SECTIONS` with data, narrowed to the ones a page asked for. */
const narrow = (
  data: Record<PanelSection, boolean>,
  sections?: readonly PanelSection[],
) => {
  const chosen = sections && new Set<string>(sections);
  return PANEL_SECTIONS.filter(
    (section) => data[section] && (!chosen || chosen.has(section)),
  );
};

/**
 * The default sections a `Panel` in this Root would have, in its order: About, and each
 * other one the resource has data for, narrowed to `sections` where the page names the
 * ones it wants. None of them, and the panel draws nothing, so a layout of your own can
 * ask first and leave out the pane that would hold it:
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
): PanelSection[] {
  /*
   * One read for each section, never one for the list: a selector that returned an array
   * would be new every time, and re-render its reader on every change of the state.
   */
  const data: Record<PanelSection, boolean> = {
    about: true,
    targets: useCloverSelector(HAS.targets),
    collection: useCloverSelector(HAS.collection),
    contents: useCloverSelector(HAS.contents),
    search: useCloverSelector(HAS.search),
    map: useCloverSelector(HAS.map),
    transcript: useCloverSelector(HAS.transcript),
    annotations: useCloverSelector(HAS.annotations),
  };
  return narrow(data, sections);
}
