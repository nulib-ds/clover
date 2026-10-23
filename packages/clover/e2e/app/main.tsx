/**
 * The end-to-end harness: one scene of @nulib/clover, chosen by the query string, over
 * the package's source.
 *
 *   ?scene=viewer|items|document|gallery|composed|collection|map|panel   what to render (default
 *                                          viewer, in its Default template; document
 *                                          and gallery are the Viewer in those
 *                                          templates); `composed` publishes the viewport
 *                                          channel as `window.__viewport` for gesture
 *                                          tests; `map` is a Root's Map, on the style
 *                                          `https://fixtures.test/map-style.json`, which
 *                                          its spec serves; `panel` is an accordion of a
 *                                          site's own sections, long named and full of
 *                                          links, in a narrow scrolling pane;
 *                                          `collection` is a Root's title, its
 *                                          CollectionSelect, its Status and the Canvas
 *   &presentation=texture                  (composed) draw video into the canvas
 *   &navigator=1                           (composed) show the Canvas's navigator
 *   &content=<url or content state>        its iiifContent
 *   &css=0                                 leave the stylesheet out (the plain layout)
 *   &headers=1                             send `X-Clover: e2e` and credentials
 *   &panel=tabs|accordion                  the information panel's sections as tabs or boxes
 *   &debug=1                               a fixed readout of the media element and the
 *                                          chrome, for devices with no console at hand
 */
import React from "react";
import { createRoot } from "react-dom/client";

import Viewer, * as Clover from "../../src/index";
import { Map, setMapWorkerUrl } from "../../src/map/index";
import * as Templates from "../../src/templates/index";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

const params = new URLSearchParams(location.search);
// A host's own choice of Clover's language (`&lng=fr`), set before anything renders.
if (params.get("lng")) Clover.initCloverI18n({ lng: params.get("lng")! });
const scene = params.get("scene") ?? "viewer";
const content =
  params.get("content") ?? "https://fixtures.test/0009-book-1.json";
const panelLayout = (["tabs", "accordion"] as const).find(
  (layout) => layout === params.get("panel"),
);
const request =
  params.get("headers") === "1"
    ? { headers: { "X-Clover": "e2e" }, credentials: "include" as const }
    : undefined;

/** The `panel` scene's sections: a site's own, named at length, each a list of links. */
const PANEL_SECTIONS = [
  ["notes", "Notes on this work", 24],
  ["provenance", "Provenance notes", 24],
  ["map", "Map", 4],
  ["contents", "Inhaltsverzeichnis", 4],
] as const;

/** The viewport channel, on `window`, so a spec can tell that a gesture moved the camera. */
function ViewportProbe() {
  const { clover } = Clover.useClover();
  React.useEffect(
    () =>
      clover.viewport.subscribe((view) => {
        (window as any).__viewport = view;
      }),
    [clover],
  );
  return null;
}

function Scene() {
  switch (scene) {
    case "items":
      return (
        <Clover.Root iiifContent={content} request={request}>
          <Clover.Label as="h1" />
          <Clover.Label of="canvas" as="p" data-testid="canvas-label" />
          <Clover.Items layout="list" />
          <button type="button">After the items</button>
        </Clover.Root>
      );
    case "composed":
      return (
        <Clover.Root iiifContent={content} request={request}>
          <Clover.Label as="h1" />
          <Clover.Body
            style={{ height: "60vh" }}
            navigator={params.get("navigator") === "1"}
            options={
              params.get("presentation") === "texture"
                ? { media: { presentation: "texture" } }
                : undefined
            }
          />
          <Clover.Items layout="pager" />
          <ViewportProbe />
        </Clover.Root>
      );
    case "collection":
      return (
        <Clover.Root iiifContent={content} request={request}>
          <Clover.Label as="h1" />
          <Clover.CollectionSelect />
          <Clover.Status loading={false} />
          <Clover.Body style={{ height: "60vh" }} />
          <button type="button">After the Canvas</button>
        </Clover.Root>
      );
    case "map":
      return (
        <Clover.Root iiifContent={content} request={request}>
          <Clover.Label of="canvas" as="p" data-testid="canvas-label" />
          <Map styleUrl="https://fixtures.test/map-style.json" />
          <button type="button">After the map</button>
        </Clover.Root>
      );
    case "panel":
      // A template's pane, as narrow as a phone's: it scrolls, so the headings stick.
      return (
        <Clover.Root iiifContent={content} request={request}>
          <div
            data-testid="pane"
            style={{ width: "15rem", height: "24rem", overflowY: "auto" }}
          >
            <Clover.Panel layout="accordion">
              {PANEL_SECTIONS.map(([value, label, count]) => (
                <Clover.Tab key={value} value={value} label={label}>
                  <ul>
                    {Array.from({ length: count }, (_, index) => (
                      <li key={index}>
                        <a href={`#${value}-${index + 1}`}>
                          {label}, {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Clover.Tab>
              ))}
            </Clover.Panel>
          </div>
          <button type="button">After the panel</button>
        </Clover.Root>
      );
    case "gallery":
      return (
        <Viewer
          iiifContent={content}
          request={request}
          template={Templates.Gallery}
        />
      );
    case "document":
      return (
        <Viewer
          iiifContent={content}
          request={request}
          template={Templates.Document}
          panelLayout={panelLayout}
        />
      );
    default:
      return (
        <Viewer
          iiifContent={content}
          request={request}
          panelLayout={panelLayout}
        />
      );
  }
}

/** Media and chrome state, as text, every half second: read off a device's screen. */
function DebugReadout() {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    // Events, not samples: a tap's chrome may come and go between two readings.
    const seen = {
      down: 0,
      target: "-",
      visible: 0,
      types: new Set<string>(),
      clicks: 0,
      clicked: "-",
      media: [] as string[],
    };
    const onClick = (event: MouseEvent) => {
      seen.clicks++;
      const button = (event.target as Element).closest?.("button");
      seen.clicked =
        button?.getAttribute("aria-label") ??
        ((event.target as Element).className?.toString().slice(0, 30) || "-");
    };
    document.addEventListener("click", onClick, true);
    const onMedia = (event: Event) => {
      seen.media = [...seen.media.slice(-3), event.type];
    };
    for (const type of [
      "play",
      "playing",
      "pause",
      "waiting",
      "error",
      "stalled",
    ])
      document.addEventListener(type, onMedia, true);
    const onDown = (event: PointerEvent) => {
      seen.down++;
      seen.types.add(event.pointerType);
      seen.target =
        (event.target as Element).className?.toString().slice(0, 30) || "-";
    };
    document.addEventListener("pointerdown", onDown, true);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if ((record.target as HTMLElement).dataset.chrome === "visible")
          seen.visible++;
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-chrome"],
      subtree: true,
    });
    const timer = setInterval(() => {
      const video = document.querySelector("video");
      const canvas = document.querySelector<HTMLElement>(".clover-canvas");
      const transport = document.querySelector(".clover-canvas-transport");
      setText(
        [
          `chrome=${canvas?.dataset.chrome ?? "-"} status=${canvas?.dataset.status ?? "-"}`,
          `transport=${transport ? getComputedStyle(transport).opacity : "none"}`,
          video
            ? `video ready=${video.readyState} net=${video.networkState} paused=${video.paused} muted=${video.muted} t=${video.currentTime.toFixed(1)} ${video.videoWidth}x${video.videoHeight} err=${video.error?.code ?? "-"} src=${(video.currentSrc || video.src).slice(0, 40)}`
            : "video none",
          `click=${seen.clicks} on ${seen.clicked} · media ${seen.media.join(",") || "-"}`,
          `pointerdown=${seen.down} (${[...seen.types].join(",")}) on ${seen.target} · chrome shown ${seen.visible}×`,
          `fullscreenEnabled=${String((document as any).fullscreenEnabled)} webkitEnter=${typeof (video as any)?.webkitEnterFullscreen}`,
        ].join("\n"),
      );
    }, 500);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return (
    <pre
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99,
        margin: 0,
        padding: 4,
        font: "10px ui-monospace, monospace",
        whiteSpace: "pre-wrap",
        background: "#ffffe0e6",
        pointerEvents: "none",
      }}
    >
      {text}
    </pre>
  );
}

// Which React runs the harness, for the React 19 run to check it really is 19.
document.documentElement.dataset.react = React.version;

async function start() {
  if (params.get("css") !== "0") {
    await import("../../src/styles/clover.css");
    await import("../../src/templates/templates.css");
    await import("maplibre-gl/dist/maplibre-gl.css");
  }
  setMapWorkerUrl(mapWorkerUrl);
  createRoot(document.getElementById("app")!).render(
    <>
      <Scene />
      {params.get("debug") === "1" && <DebugReadout />}
    </>,
  );
}
void start();
