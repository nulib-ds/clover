import React, { Suspense, lazy, useMemo } from "react";

import { Viewer, type ViewerProps } from "../../components/Viewer/Viewer";
import { Default } from "../../templates/default/Default";
import type { HostedProps } from "../host";
import { loadRenderers, useLoaded } from "./later";

/*
 * The templates a viewer names: Default with the element, as most pages use it; Document
 * and Gallery each loaded the first time one is shown, its styles beside it (the
 * `templates` run, `index.ts`).
 */
const Document = lazy(() =>
  import("../../templates/document/Document").then((module) => ({
    default: module.Document,
  })),
);
const Gallery = lazy(() =>
  import("../../templates/gallery/Gallery").then((module) => ({
    default: module.Gallery,
  })),
);
const TEMPLATES = { default: Default, document: Document, gallery: Gallery };
type Named = keyof typeof TEMPLATES;

/*
 * The props only some templates take, by the templates that do: each template is handed
 * its own, and none of another's, which it would pass on to its root's element.
 */
const ONLY: Record<string, readonly Named[]> = {
  header: ["default"],
  panel: ["default"],
  items: ["default"],
  fill: ["default"],
  defaultPanelOpen: ["default", "document"],
  panelLayout: ["default", "document"],
  download: ["default", "document"],
  storageKey: ["default", "document"],
  defaultSidebarOpen: ["document"],
  size: ["gallery"],
};

/**
 * `<clover-viewer>` (`specs/viewer.ts`): Clover's Viewer in the template it names,
 * Default's by default, with that template's own attributes. `storage-key="false"`
 * forgets the reader's widths, as `storageKey={false}` does.
 */
export function ViewerElement({ props }: HostedProps) {
  const named: Named =
    typeof props.template === "string" && props.template in TEMPLATES
      ? (props.template as Named)
      : "default";
  const given: Record<string, unknown> = Object.fromEntries(
    Object.entries(props).filter(
      ([name]) => name !== "template" && (ONLY[name]?.includes(named) ?? true),
    ),
  );
  const rendering = useLoaded(loadRenderers, Boolean(props.renderers));
  const renderers = useMemo(
    () => rendering?.toRenderers(props.renderers),
    [rendering, props.renderers],
  );
  if (props.renderers && !rendering) return null;
  given.renderers = renderers;
  if (typeof given.storageKey === "string")
    given.storageKey =
      given.storageKey.trim().toLowerCase() === "false"
        ? false
        : given.storageKey;
  const Template = TEMPLATES[named];
  return (
    <Suspense fallback={null}>
      <Viewer
        {...(given as Partial<ViewerProps>)}
        template={Template as ViewerProps["template"]}
        iiifContent={props.iiifContent as ViewerProps["iiifContent"]}
      />
    </Suspense>
  );
}
