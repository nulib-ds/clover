"use client";

import React, { useEffect, useId, useState } from "react";

import { LiveCode } from "docs/components/Clover4/LiveCode";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import { findPart } from "docs/lib/compose/catalog";
import { type LayoutNode, isViewer } from "docs/lib/compose/layout";
import { partsOf } from "docs/lib/compose/preview";
import { EXAMPLE, example } from "docs/lib/example";
import { loadMapWorker } from "docs/lib/map-worker";
import { RESOURCES } from "docs/lib/part-demo-resources";
import { useMock } from "docs/lib/useMock";
import { type Shown, closePreview } from "docs/lib/webmcp/preview-store";

/**
 * An agent's preview, in a page's first example frame (WEBMCP.md, phase 4): what it is,
 * and the way back to the page's own example, over the layout drawn live and its code in
 * both flavors, as every example on the docs is (`LiveCode`), marked as an example. It
 * draws a checked layout (`docs/lib/compose/preview.ts`) with the package itself: the
 * Root and its parts, the page's own elements, the Viewer in a template, or `Map` with its
 * worker. Loaded the first time a preview is shown (`PreviewHost.tsx`).
 */

type Component = React.ComponentType<Record<string, unknown>>;

interface Loaded {
  clover: Record<string, unknown>;
  templates?: Record<string, unknown>;
  Map?: Component;
  request?: { fetch: typeof fetch };
}

const noChange = () => {};

/** The package, and what the layout needs besides: a template, the Map and its worker. */
function useLoaded(shown: Shown) {
  const { layout, sample } = shown.plan;
  const viewer = isViewer(layout);
  const mapped = !viewer && partsOf(layout.parts).includes("Map");
  const searching = sample === "search";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      import("@nulib/clover"),
      viewer ? import("@nulib/clover/templates") : undefined,
      mapped
        ? loadMapWorker().then(() => import("@nulib/clover/map"))
        : undefined,
      // The newspaper's search service, answered here: the static site cannot read `?q=`.
      searching ? import("docs/mocks/content-search/index.mjs") : undefined,
    ]).then(([clover, templates, map, search]) => {
      if (!live) return;
      setLoaded({
        clover: clover as unknown as Record<string, unknown>,
        templates: templates as unknown as Record<string, unknown> | undefined,
        Map: map?.Map as unknown as Component | undefined,
        request: search
          ? { fetch: search.mockFetch() as typeof fetch }
          : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [viewer, mapped, searching]);
  return loaded;
}

/** The resource it is drawn over: the agent's, or the sample's, from this site. */
function useAddress(shown: Shown) {
  const { layout, sample } = shown.plan;
  const path: string | undefined = sample ? RESOURCES[sample] : undefined;
  const remote = !path || /^https?:/.test(path);
  const mock = useMock(remote ? "" : path);
  return layout.resource ?? (remote ? path : mock);
}

function Drawn({ shown }: { shown: Shown }) {
  const loaded = useLoaded(shown);
  const url = useAddress(shown);
  if (!loaded || !url) return null;
  const { layout } = shown.plan;
  const { clover, templates, Map, request } = loaded;

  if (isViewer(layout)) {
    const Viewer = clover.default as Component;
    const name = layout.viewer.template;
    return (
      <Viewer
        iiifContent={url}
        {...(request && { request })}
        {...(name && templates && { template: templates[name] })}
        // On the Viewer's own root, where each template sets its default.
        style={{
          ["--clover-body-height" as string]: "22rem",
          ["--clover-template-document-height" as string]: "26rem",
        }}
        {...layout.viewer.props}
      />
    );
  }

  const inRoot = layout.root !== false;
  const draw = (node: LayoutNode, key: number): React.ReactNode => {
    const children = node.children?.map(draw);
    if ("element" in node)
      return React.createElement(
        node.element,
        { key, ...node.props },
        children,
      );
    const Part = (node.part === "Map" ? Map : clover[node.part]) as
      | Component
      | undefined;
    if (!Part) return null;
    // Alone, a part that reads a resource reads the preview's.
    const reads =
      !inRoot &&
      findPart(node.part)?.props.some((prop) => prop.prop === "iiifContent");
    return (
      <Part
        key={key}
        {...(reads && { iiifContent: url })}
        {...(reads && request && { request })}
        {...node.props}
      >
        {children}
      </Part>
    );
  };
  const parts = layout.parts.map(draw);
  if (!inRoot) return <>{parts}</>;
  const Root = clover.Root as Component;
  return (
    <Root
      iiifContent={url}
      {...(request && { request })}
      {...(layout.root || undefined)}
    >
      {parts}
    </Root>
  );
}

/** A layout that throws as it is drawn says so, rather than taking the page with it. */
class Holds extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">This layout could not be drawn.</p>
    ) : (
      this.props.children
    );
  }
}

export function AgentPreview({ shown }: { shown: Shown }) {
  const id = useId();
  const back = (event: React.MouseEvent<HTMLButtonElement>) => {
    const figure = event.currentTarget.closest("figure");
    closePreview();
    // Focus to the frame, where the page's example comes back (WCAG 2.4.3).
    requestAnimationFrame(() => {
      if (!(figure instanceof HTMLElement)) return;
      figure.tabIndex = -1;
      figure.focus({ preventScroll: true });
    });
  };
  return (
    <div role="group" aria-labelledby={id}>
      <div className={styles.switchBar}>
        <span className={styles.switchLabel} id={id}>
          Preview from your agent
        </span>
        <button type="button" className="cta-outline" onClick={back}>
          Show this page&apos;s example
        </button>
      </div>
      <div className={styles.preview} {...example(EXAMPLE)}>
        <Holds key={shown.id}>
          <Drawn shown={shown} />
        </Holds>
      </div>
      <div className={styles.code}>
        <LiveCode
          tree={shown.plan.tree}
          knobs={[]}
          values={{}}
          onChange={noChange}
        />
      </div>
    </div>
  );
}
