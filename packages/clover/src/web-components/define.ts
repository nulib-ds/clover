import { setMapWorkerUrl } from "../core/map-config";
import { type LoadPart, defineElement } from "./base";
import { SPECS } from "./specs";
import type { ElementAssets } from "./styles";

/**
 * A part drawn as it is: its module, and `drawn`, which loads beside it. Each part's
 * module is its own chunk, so a page loads only the parts it holds. `nodes` names its
 * props a page gives as functions that return a node (`renderValue`).
 */
const part =
  (
    load: () => Promise<Record<string, unknown>>,
    name: string,
    nodes?: readonly string[],
  ): LoadPart =>
  () =>
    Promise.all([load(), import("./elements/part")]).then(
      ([module, { drawn }]) =>
        drawn(module[name] as Parameters<typeof drawn>[0], nodes),
    );

/** One of the Split's three, from their module. */
const splitPart =
  (
    name: "SplitElement" | "SplitPaneElement" | "SplitHandleElement",
  ): LoadPart =>
  () =>
    import("./elements/split").then((module) => module[name]);

const primitive = (name: string) =>
  part(() => import("../components/Primitives/Primitives"), name);
const pager = (name: string) =>
  part(() => import("../components/Items/Pager"), name);

/** What each element draws, loaded the first time one connects. */
const LOADERS: Record<string, LoadPart> = {
  "clover-viewer": () =>
    import("./elements/viewer").then((module) => module.ViewerElement),
  "clover-root": () =>
    import("./elements/root").then((module) => module.RootElement),
  "clover-label": () =>
    import("./elements/label").then((module) => module.LabelElement),
  "clover-body": () =>
    import("./elements/body").then((module) => module.BodyElement),
  "clover-items": () =>
    import("./elements/items").then((module) => module.ItemsElement),
  "clover-position": part(
    () => import("../components/Items/Position"),
    "Position",
  ),
  "clover-previous": pager("Previous"),
  "clover-next": pager("Next"),
  "clover-status": () =>
    import("./elements/status").then((module) => module.StatusElement),
  "clover-thumbnail": primitive("Thumbnail"),
  "clover-summary": primitive("Summary"),
  "clover-metadata": part(
    () => import("../components/Primitives/Primitives"),
    "Metadata",
    ["renderValue"],
  ),
  "clover-required-statement": primitive("RequiredStatement"),
  "clover-rights": primitive("Rights"),
  "clover-homepage": primitive("Homepage"),
  "clover-see-also": primitive("SeeAlso"),
  "clover-rendering": primitive("Rendering"),
  "clover-part-of": primitive("PartOf"),
  "clover-id": primitive("Id"),
  // A provider reads its <clover-logo>s, which draw nothing there (`elements/provider.tsx`).
  "clover-provider": () =>
    import("./elements/provider").then((module) => module.ProviderElement),
  "clover-logo": () =>
    import("./elements/logo").then((module) => module.LogoElement),
  "clover-value": primitive("Value"),
  "clover-about": part(() => import("../components/Panel/About"), "About"),
  "clover-annotations": part(
    () => import("../components/Annotations/Annotations"),
    "Annotations",
    ["renderEntry"],
  ),
  "clover-collection": part(
    () => import("../components/Collection/Collection"),
    "Collection",
  ),
  "clover-collection-select": part(
    () => import("../components/CollectionSelect/CollectionSelect"),
    "CollectionSelect",
  ),
  "clover-contents": part(
    () => import("../components/Contents/Contents"),
    "Contents",
  ),
  "clover-search": part(() => import("../components/Search/Search"), "Search"),
  "clover-transcript": part(
    () => import("../components/Transcript/Transcript"),
    "Transcript",
  ),
  "clover-download": part(
    () => import("../components/Download/Download"),
    "Download",
  ),
  "clover-map": part(() => import("../components/Map/Map"), "CloverMap"),
  "clover-panel": () =>
    import("./elements/panel").then((module) => module.PanelElement),
  "clover-panel-toggle": () =>
    import("./elements/toggle").then((module) => module.PanelToggleElement),
  "clover-split": splitPart("SplitElement"),
  "clover-split-pane": splitPart("SplitPaneElement"),
  "clover-split-handle": splitPart("SplitHandleElement"),
  // Alone, what it is given; in a root, the root's view, as `Canvas` is.
  "clover-canvas": () =>
    import("./elements/canvas").then((module) => module.CanvasElement),
  // Presentation 4's other containers: alone, what each is given; in a root, its view.
  "clover-timeline": part(
    () => import("../components/Timeline/Timeline"),
    "Timeline",
  ),
  "clover-scene": part(() => import("../components/Scene/Scene"), "Scene"),
  "clover-tip": () =>
    import("./elements/tip").then((module) => module.TipElement),
  "clover-read-more": () =>
    import("./elements/read-more").then((module) => module.ReadMoreElement),
  // `<clover-tab>` loads nothing: its panel reads it (a `config` element).
};

/**
 * Define Clover's elements (each once), with the assets the build hands them: every one,
 * or those named. Each is a stub until one connects: then its code, the host and the
 * stylesheet load, once for the page.
 */
export function defineCloverElements(
  assets: ElementAssets,
  tags: readonly string[] = SPECS.map(({ tag }) => tag),
): void {
  if (assets.mapWorkerUrl) setMapWorkerUrl(assets.mapWorkerUrl);
  for (const spec of SPECS) {
    if (tags.includes(spec.tag)) defineElement(spec, LOADERS[spec.tag]);
  }
}
