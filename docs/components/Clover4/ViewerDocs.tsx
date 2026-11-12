"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useId, useRef, useState } from "react";
import { ClipContext } from "docs/components/CodeBlock";
import { encodeContentState } from "docs/components/Clover4/Demos";
import { LiveCode } from "docs/components/Clover4/LiveCode";
import { ExampleSwitch } from "docs/components/Clover4/ExampleSwitch";
import styles from "docs/components/Clover4/ViewerDocs.module.css";
import {
  type CodeTree,
  type Knob,
  initialValues,
  knobId,
  knobProps,
  remountKey,
} from "docs/lib/live-code";
import { resources } from "docs/components/Playground/playground-config";
import { loadMapWorker } from "docs/lib/map-worker";
import { useRouter } from "docs/lib/router";
import { EXAMPLE, example } from "docs/lib/example";
import { MOCK_SEARCH } from "docs/lib/mock-search";
import {
  AgentPreview,
  usePreviewHost,
} from "docs/components/Clover4/PreviewHost";

/**
 * The Viewer page's examples (`content/docs/viewer/index.mdx`), laid out as Radix Themes
 * lays out its components' (Mat, 2026-10-21): a live Viewer over one of the homepage's
 * resources, its code attached under it. The page is drawn on the server, which can hand
 * these only plain data, so a resource is named by its key in `playground-config.ts`
 * and the Viewer's props are plain values. The code under an example is the page's own
 * Markdown, passed as children; where an example switches a prop, each value's code is a
 * child marked `data-option`, and only the one chosen shows. Each fence also has its "Web
 * components" twin beside it, made as the page compiles (`docs/lib/code-flavors.mjs`).
 */

export type TemplateName = "Default" | "Document" | "Gallery";
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
    /*
     * A file of this site's own, by its path, from the site it is on: the published site
     * sends no CORS headers, so `npm run dev` could not read its copy there.
     */
    if (key.startsWith("/")) {
      setUrl(new URL(`${basePath}${key}`, location.origin).href);
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

/** Where an example opens: a region of a Canvas, and a search's hit there. */
export interface Place {
  /** The Canvas, by its place in the Manifest's `items`. */
  canvas: number;
  /** The region, in the Canvas's pixels. */
  xywh: string;
  /**
   * A Content Search hit to target, by its `id` under the Manifest's search service, as
   * the docs' mocks name theirs (`hit/22-w148`): the content state then targets the hit.
   */
  hit?: string;
}

/**
 * A content state for a region of one of the Manifest's Canvases, by its place in
 * `items`, or for a search's hit there: the Manifest is read first, so the ids are the
 * ones it was served with, the dev server's in `npm run dev`.
 */
function usePlace(url: string | null, place: Place | undefined) {
  const [state, setState] = useState<string | null>(null);
  const canvas = place?.canvas;
  const xywh = place?.xywh;
  const hit = place?.hit;
  useEffect(() => {
    if (!url || canvas === undefined || !xywh) return;
    let live = true;
    fetch(url)
      .then((response) => response.json())
      .then((manifest) => {
        const id = manifest.items?.[canvas]?.id;
        if (!live || !id) return;
        const region = {
          type: "SpecificResource",
          source: {
            id,
            type: "Canvas",
            partOf: [{ id: url, type: "Manifest" }],
          },
          selector: { type: "FragmentSelector", value: `xywh=${xywh}` },
        };
        const service = ([] as Array<Record<string, string>>)
          .concat(manifest.service ?? [])
          .find((each) => /SearchService/.test(each.type ?? each["@type"]));
        setState(
          encodeContentState({
            "@context": "http://iiif.io/api/presentation/3/context.json",
            type: "Annotation",
            motivation: ["contentState"],
            target:
              hit && service
                ? {
                    id: `${service.id ?? service["@id"]}/${hit}`,
                    type: "Annotation",
                    target: region,
                  }
                : region,
          }),
        );
      });
    return () => {
      live = false;
    };
  }, [url, canvas, xywh, hit]);
  return state;
}

/**
 * Whether the example is within a few screens of the window. A Viewer draws into WebGL,
 * and a browser keeps only so many contexts, so an example far off is let go, keeping its
 * height; never one that holds focus.
 */
export function useNear(box: React.RefObject<HTMLElement | null>) {
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

export interface LiveProps {
  /** A key of the homepage's resources (`playground-config.ts`), `search`, or an address. */
  resource: string;
  template?: TemplateName;
  /** The Viewer's props, as plain values. */
  props?: Record<string, Plain>;
  /** Custom properties on the Viewer's own root (`--clover-…`), beside the example's own. */
  vars?: Record<string, string>;
  /**
   * Open at a region of a Canvas, by its place in the Manifest, or at a search's hit
   * there, as a content state.
   */
  place?: Place;
  /** The Body's height (`--clover-body-height`). */
  height?: string;
  /** A box of this height for the Viewer to `fill`. */
  box?: string;
  /** A box of this width for the Viewer, centered in the example: a phone's, say. */
  width?: string;
  /** Its title's level: one below the heading it sits under. */
  headingLevel?: number;
}

/** The live Viewer of an example, mounted near the window, its height kept when let go. */
export function Live({
  resource,
  template,
  props,
  vars,
  place,
  height = "22rem",
  box,
  width,
  headingLevel = 4,
}: LiveProps) {
  const holder = useRef<HTMLDivElement>(null);
  const near = useNear(holder);
  const url = useResource(resource);
  // The mocks' searches, answered here: the static site cannot read `?q=`.
  const request = MOCK_SEARCH;
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
  const ready = content;
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
            ["--clover-body-height" as string]: height,
            // Document is as tall as its pages' column: the Body and its toolbar.
            ["--clover-template-document-height" as string]: `calc(${height} + 4rem)`,
            ...vars,
          }}
          {...(request ? { request } : undefined)}
          {...(box ? { fill: true } : undefined)}
          {...props}
        />
      )}
    </div>
  );
}

/**
 * The editor an example's code is drawn in: light or dark whatever the page's mode. Left
 * out, it follows the page's (`--editor-*`, `tokens.css`).
 */
type Editor = "light" | "dark";

/**
 * An example's code, under its demo: its blocks drawn as every code block on the site is
 * (`CodeBlock`, through `mdx-components.tsx`), each with its own Copy, in the editor that
 * follows the page's mode, or the one the example sets (`data-editor`). Long code shows
 * its first lines until its button shows them all (`ClipContext`).
 */
function CodeArea({
  children,
  editor,
}: {
  children: React.ReactNode;
  editor?: Editor;
}) {
  return (
    <div className={styles.code} data-editor={editor}>
      <ClipContext.Provider value>{children}</ClipContext.Provider>
    </div>
  );
}

/** An example's frame: the live Viewer, and its code attached under it. */
export function ViewerExample({
  children,
  editor,
  wide,
  ...live
}: LiveProps & {
  children?: React.ReactNode;
  editor?: Editor;
  wide?: boolean;
}) {
  const { ref, preview } = usePreviewHost();
  return (
    <figure ref={ref} className={styles.example} data-wide={wide || undefined}>
      {preview ? (
        <AgentPreview shown={preview} />
      ) : (
        <>
          <div className={styles.preview} data-bleed {...example(EXAMPLE)}>
            <Live {...live} />
          </div>
          {children && <CodeArea editor={editor}>{children}</CodeArea>}
        </>
      )}
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
  editor,
  wide,
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
  editor?: Editor;
  /** Wider than the page's column, where the window has room (`data-wide`). */
  wide?: boolean;
}) {
  const id = useId();
  const { ref, preview } = usePreviewHost();
  const [value, setValue] = useState<Plain>(options[0]);
  // `template` and `width` are the example's own; any other prop is the Viewer's.
  const shown =
    prop === "template"
      ? { template: value as TemplateName }
      : prop === "width"
        ? { width: String(value) }
        : { props: { ...live.props, [prop]: value } };
  return (
    <>
      {!preview && (
        <ExampleSwitch
          id={`${id}-label`}
          label={label}
          options={options.map((option, index) => ({
            key: nameOf(option),
            label: labels?.[index] ?? nameOf(option),
          }))}
          chosen={options.indexOf(value)}
          onChoose={(index) => setValue(options[index])}
        />
      )}
      <figure
        ref={ref}
        className={styles.example}
        data-lead={lead || undefined}
        data-wide={wide || undefined}
      >
        {preview ? (
          <AgentPreview shown={preview} />
        ) : (
          <>
            <div className={styles.preview} data-bleed {...example(EXAMPLE)}>
              <Live key={nameOf(value)} {...live} {...shown} />
            </div>
            <CodeArea editor={editor}>
              {/*
               * The chosen value's code shows; the others are hidden by CSS, not `hidden`, so the
               * page's Markdown keeps every value's code (`data-shown`, `ViewerDocs.module.css`).
               */}
              {React.Children.map(children, (child) =>
                React.isValidElement<{
                  "data-option"?: string;
                  "data-shown"?: string;
                }>(child) && child.props["data-option"] !== undefined
                  ? React.cloneElement(child, {
                      "data-shown":
                        child.props["data-option"] === nameOf(value)
                          ? ""
                          : undefined,
                    })
                  : child,
              )}
            </CodeArea>
          </>
        )}
      </figure>
    </>
  );
}

/** A template's live code: its knobs, and its code's elements (`LiveExample.tsx`). */
export interface LiveTemplate {
  name: TemplateName;
  knobs: Knob[];
  tree: CodeTree;
}

/**
 * The Viewer page's first example, live (Mat, 2026-10-22): the Viewer, under it the
 * template's code, its knobs live (`LiveCode`), each template keeping its own values as
 * the reader switches, and under the code the switch (Mat, 2026-10-23: "bring it below
 * the JSX … toggle adjusts the code and vice versa … match … React/WC toggle in header"):
 * radios drawn as the navbar's code switch (`CodeSwitch.tsx`), and the template in the
 * code a choice too (a knob `on: "code"`), each moving the other. A pick in the code
 * shows the new template's code, so focus moves to the same choice there. A knob read
 * only as the Viewer mounts draws it again.
 */
export function LiveTemplates({
  options,
  resources,
  editor,
  wide,
  ...live
}: Omit<LiveProps, "template" | "props"> & {
  options: LiveTemplate[];
  /**
   * Resources to switch between, at the top (`LiveViewerExample`'s `resources`): the
   * Viewer opens the one chosen, and the code names its address.
   */
  resources?: { label: string; resource: string; address: string }[];
  editor?: Editor;
  /** Wider than the page's column, where the window has room (`data-wide`). */
  wide?: boolean;
}) {
  const id = useId();
  // The frame, which can hold an agent's preview in place of the Viewer (`PreviewHost`).
  const { ref: figure, preview } = usePreviewHost();
  const [chosen, setChosen] = useState(options[0].name);
  const [source, setSource] = useState(0);
  const shownResource = resources?.[source];
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      options.map((option) => [option.name, initialValues(option.knobs)]),
    ),
  );
  const option = options.find((each) => each.name === chosen) ?? options[0];
  const current = values[option.name];
  // The template's own knob, written in the code alone (`LiveExample.tsx`).
  const templateKnob = option.knobs.find((knob) => knob.on === "code");
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    const choices = figure.current?.querySelectorAll<HTMLSelectElement>(
      `[data-option="${chosen}"] select[aria-label="${templateKnob?.label}"]`,
    );
    // The reader's flavor's, the one shown.
    [...(choices ?? [])].find((choice) => choice.offsetParent)?.focus();
  }, [chosen, templateKnob]);
  const set = (name: TemplateName) => (knob: string, value: Plain) => {
    if (templateKnob && knob === knobId(templateKnob)) {
      picked.current = true;
      setChosen(value as TemplateName);
      return;
    }
    setValues((all) => ({ ...all, [name]: { ...all[name], [knob]: value } }));
  };
  return (
    <>
      {/*
       * The template, over the example as every example's switch is (Mat, 2026-11-01:
       * "look for other segmented controls. do them the same"); a template's own page
       * shows that one alone, with nothing to switch. The code's own choice moves it too.
       */}
      {!preview && options.length > 1 && (
        <ExampleSwitch
          id={`${id}-template`}
          label="Template"
          options={options.map(({ name }) => ({ key: name, label: name }))}
          chosen={options.indexOf(option)}
          onChoose={(index) => setChosen(options[index].name)}
        />
      )}
      {!preview && resources && resources.length > 1 && (
        // What it opens, switched over the example.
        <ExampleSwitch
          id={`${id}-resource`}
          label="Resource type"
          options={resources.map((each) => ({
            key: each.resource,
            label: each.label,
          }))}
          chosen={source}
          onChoose={setSource}
        />
      )}
      <figure
        ref={figure}
        className={styles.example}
        data-lead
        data-wide={wide || undefined}
      >
        {preview ? (
          <AgentPreview shown={preview} />
        ) : (
          <>
            <div className={styles.preview} data-bleed {...example(EXAMPLE)}>
              <Live
                key={`${option.name}|${shownResource?.resource ?? ""}|${remountKey(option.knobs, current)}`}
                {...live}
                {...(shownResource
                  ? { resource: shownResource.resource }
                  : null)}
                template={option.name}
                props={
                  knobProps(option.knobs, current) as Record<string, Plain>
                }
              />
            </div>
            <CodeArea editor={editor}>
              {/*
               * Every template's code, the chosen one's shown by CSS (`data-shown`), as
               * `OptionsExample` keeps each value's, so the page's Markdown holds them all.
               */}
              {options.map((each) => (
                <div
                  key={each.name}
                  data-option={each.name}
                  data-shown={each.name === option.name ? "" : undefined}
                >
                  <LiveCode
                    tree={
                      shownResource
                        ? { ...each.tree, url: shownResource.address }
                        : each.tree
                    }
                    knobs={each.knobs}
                    values={values[each.name]}
                    onChange={set(each.name)}
                  />
                </div>
              ))}
            </CodeArea>
          </>
        )}
      </figure>
    </>
  );
}

/**
 * Any demo in the examples' frame, its code attached under it: the first child is the
 * demo (a `PartDemo`, say), the rest its code, as the Components pages write them.
 *
 * ```mdx
 * <Example>
 * <PartDemo part="Label" />
 *
 * ```jsx
 * <Clover.Label />
 * ```
 *
 * </Example>
 * ```
 */
export function Example({
  children,
  editor,
  wide,
}: {
  children: React.ReactNode;
  editor?: Editor;
  /** Wider than the page's column, where the window has room (`data-wide`). */
  wide?: boolean;
}) {
  const [demo, ...code] = React.Children.toArray(children).filter(
    (child) => !(typeof child === "string" && !child.trim()),
  );
  const { ref, preview } = usePreviewHost();
  return (
    <figure ref={ref} className={styles.example} data-wide={wide || undefined}>
      {preview ? (
        <AgentPreview shown={preview} />
      ) : (
        <>
          <div className={styles.preview} {...example(EXAMPLE)}>
            {demo}
          </div>
          {code.length > 0 && <CodeArea editor={editor}>{code}</CodeArea>}
        </>
      )}
    </figure>
  );
}
