"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useId, useRef, useState } from "react";
import { encodeContentState } from "docs/components/Clover4/Demos";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import { resources } from "docs/components/Playground/playground-config";
import { loadMapWorker } from "docs/lib/map-worker";
import { useRouter } from "docs/lib/router";

/**
 * The Viewer page's examples (`content/docs/viewer/index.mdx`), laid out as Radix Themes
 * lays out its components' (Mat, 2026-10-21): a live Viewer over one of the homepage's
 * resources, its code attached under it. The page is drawn on the server, which can hand
 * these only plain data, so a resource is named by its key in `playground-config.ts`
 * and the Viewer's props are plain values. The code under an example is the page's own
 * Markdown, passed as children; where an example switches a prop, each value's code is a
 * child marked `data-option`, and only the one chosen shows.
 */

type TemplateName = "Default" | "Document" | "Gallery";
type Plain = string | number | boolean;

/** The newspaper with a Content Search service, Clover's mock: none of the homepage's has one. */
const SEARCH_MOCK = "content-search/manifest.json";

/** The Viewer and the templates, as a page imports them; on the client only. */
const LiveViewer = dynamic(
  () =>
    Promise.all([
      import("@nulib/clover"),
      import("@nulib/clover/templates"),
    ]).then(([clover, templates]) => {
      const Viewer = clover.default;
      function LiveViewer({
        template,
        ...props
      }: {
        template?: TemplateName;
        iiifContent: string;
        [prop: string]: unknown;
      }) {
        return (
          <Viewer
            {...(props as React.ComponentProps<typeof Viewer>)}
            template={template ? templates[template] : undefined}
          />
        );
      }
      return LiveViewer;
    }),
  { ssr: false },
);

/**
 * A homepage resource's address, a mock's under this site; once a resource with places
 * has its MapLibre worker. Null until known.
 */
function useResource(key: string) {
  const { basePath } = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const mock = (path: string) =>
      new URL(`${basePath}/mocks/${path}`, location.origin).href;
    if (key === "search") {
      setUrl(mock(SEARCH_MOCK));
      return;
    }
    // An address of its own: the homepage's Collection, say, as the Collection itself.
    if (/^https?:/.test(key)) {
      setUrl(key);
      return;
    }
    const resource = resources.find((item) => item.key === key);
    if (!resource) return;
    const address = resource.mock ? mock(resource.resource) : resource.resource;
    (resource.map ? loadMapWorker() : Promise.resolve()).then(() => {
      if (live) setUrl(address);
    });
    return () => {
      live = false;
    };
  }, [basePath, key]);
  return url;
}

/**
 * The Content Search mock's service, answered in the browser by its own `mockFetch`: the
 * docs are a static site, which cannot read `?q=`.
 */
function useSearchRequest(enabled: boolean) {
  const [request, setRequest] = useState<{ fetch: typeof fetch } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    import("docs/mocks/content-search/index.mjs").then(({ mockFetch }) => {
      if (live) setRequest({ fetch: mockFetch() as typeof fetch });
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return request;
}

/**
 * A content state for a region of one of the Manifest's Canvases, by its place in
 * `items`: the Manifest is read first, so the ids are the ones it was served with.
 */
function usePlace(
  url: string | null,
  place: { canvas: number; xywh: string } | undefined,
) {
  const [state, setState] = useState<string | null>(null);
  const canvas = place?.canvas;
  const xywh = place?.xywh;
  useEffect(() => {
    if (!url || canvas === undefined || !xywh) return;
    let live = true;
    fetch(url)
      .then((response) => response.json())
      .then((manifest) => {
        const id = manifest.items?.[canvas]?.id;
        if (!live || !id) return;
        setState(
          encodeContentState({
            "@context": "http://iiif.io/api/presentation/3/context.json",
            type: "Annotation",
            motivation: ["contentState"],
            target: {
              type: "SpecificResource",
              source: {
                id,
                type: "Canvas",
                partOf: [{ id: url, type: "Manifest" }],
              },
              selector: { type: "FragmentSelector", value: `xywh=${xywh}` },
            },
          }),
        );
      });
    return () => {
      live = false;
    };
  }, [url, canvas, xywh]);
  return state;
}

/**
 * Whether the example is within a few screens of the window. A Viewer draws into WebGL,
 * and a browser keeps only so many contexts, so an example far off is let go, keeping its
 * height; never one that holds focus.
 */
function useNear(box: React.RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
        else if (!element.contains(document.activeElement)) setNear(false);
      },
      { rootMargin: "150% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);
  return near;
}

interface LiveProps {
  /** A key of the homepage's resources (`playground-config.ts`), `search`, or an address. */
  resource: string;
  template?: TemplateName;
  /** The Viewer's props, as plain values. */
  props?: Record<string, Plain>;
  /** Open at a region of a Canvas, by its place in the Manifest, as a content state. */
  place?: { canvas: number; xywh: string };
  /** The stage's height (`--clover-content-height`). */
  height?: string;
  /** A box of this height for the Viewer to `fill`. */
  box?: string;
  /** A box of this width for the Viewer, centered in the example: a phone's, say. */
  width?: string;
  /** Its title's level: one below the heading it sits under. */
  headingLevel?: number;
}

/** The live Viewer of an example, mounted near the window, its height kept when let go. */
function Live({
  resource,
  template,
  props,
  place,
  height = "22rem",
  box,
  width,
  headingLevel = 4,
}: LiveProps) {
  const holder = useRef<HTMLDivElement>(null);
  const near = useNear(holder);
  const url = useResource(resource);
  const request = useSearchRequest(resource === "search");
  const state = usePlace(url, place);
  const kept = useRef(0);
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (element.firstElementChild) kept.current = element.offsetHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const content = place ? state : url;
  const ready = content && (resource !== "search" || request);
  return (
    <div
      ref={holder}
      className={styles.live}
      style={{
        minHeight: near ? undefined : kept.current || `calc(${height} + 8rem)`,
        height: box,
        maxWidth: width,
        marginInline: width ? "auto" : undefined,
      }}
    >
      {near && ready && (
        <LiveViewer
          iiifContent={content}
          template={template}
          headingLevel={headingLevel}
          // On the Viewer's own root, where each template sets its default.
          style={{
            ["--clover-content-height" as string]: height,
            // Document is as tall as its pages' column: the stage and its toolbar.
            ["--clover-template-document-height" as string]: `calc(${height} + 4rem)`,
          }}
          {...(request ? { request } : undefined)}
          {...(box ? { fill: true } : undefined)}
          {...props}
        />
      )}
    </div>
  );
}

/** An example's frame: the live Viewer, and its code attached under it. */
export function ViewerExample({
  children,
  ...live
}: LiveProps & { children?: React.ReactNode }) {
  return (
    <figure className={styles.example}>
      <div className={styles.preview}>
        <Live {...live} />
      </div>
      {children && <div className={styles.code}>{children}</div>}
    </figure>
  );
}

/** A value's name on its switch, and its `data-option`. */
const nameOf = (value: Plain) => String(value);

/**
 * An example that switches one prop: a segmented control over the Viewer (buttons that
 * show which is pressed, in a group named for the prop), the Viewer remounted for each
 * value as a page passing another would, and that value's code under it. The page's
 * first example, the template, is the large one (`lead`).
 */
export function OptionsExample({
  prop,
  label,
  options,
  labels,
  lead,
  children,
  ...live
}: LiveProps & {
  /** The prop it switches: `template`, the box's `width`, or another the Viewer takes. */
  prop: string;
  /** The switch's name, shown before it. */
  label: string;
  options: Plain[];
  /** Each option's name on its button, where it is not the value itself. */
  labels?: string[];
  lead?: boolean;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [value, setValue] = useState<Plain>(options[0]);
  // `template` and `width` are the example's own; any other prop is the Viewer's.
  const shown =
    prop === "template"
      ? { template: value as TemplateName }
      : prop === "width"
        ? { width: String(value) }
        : { props: { ...live.props, [prop]: value } };
  return (
    <figure className={styles.example} data-lead={lead || undefined}>
      <div className={styles.switchBar}>
        <span className={styles.switchLabel} id={`${id}-label`}>
          {label}
        </span>
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          className={styles.segmented}
        >
          {options.map((option, index) => (
            <button
              key={nameOf(option)}
              type="button"
              aria-pressed={option === value}
              className={styles.segment}
              onClick={() => setValue(option)}
            >
              {labels?.[index] ?? nameOf(option)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.preview}>
        <Live key={nameOf(value)} {...live} {...shown} />
      </div>
      <div className={styles.code}>
        {React.Children.map(children, (child) =>
          React.isValidElement<{ "data-option"?: string; hidden?: boolean }>(
            child,
          ) && child.props["data-option"] !== undefined
            ? React.cloneElement(child, {
                hidden: child.props["data-option"] !== nameOf(value),
              })
            : child,
        )}
      </div>
    </figure>
  );
}
