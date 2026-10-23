// Every element, as `@nulib/clover/web-components` defines them.
import "../../src/web-components/index";
import book from "../../src/fixtures/iiif-cookbook/0009-book-1.json";

/*
 * `?many=N`: N roots more, each with five labels, over one Manifest object (no requests),
 * to time what one host tree for the page costs. The result is on `window.__many`.
 */
const many = Number(new URLSearchParams(location.search).get("many"));
if (many > 0) {
  const longTasks: number[] = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  }).observe({ type: "longtask", buffered: false });
  const start = performance.now();
  const box = document.createElement("div");
  for (let index = 0; index < many; index += 1) {
    const root = document.createElement("clover-root") as HTMLElement & {
      iiifContent: unknown;
    };
    root.iiifContent = book;
    root.innerHTML =
      `<clover-label as="h3"></clover-label>` +
      `<clover-label of="canvas"></clover-label>`.repeat(4);
    box.append(root);
  }
  document.querySelector("main")!.append(box);
  const labels = [...box.querySelectorAll("clover-label")];
  const drawn = () => labels.every((label) => label.textContent);
  const wait = () =>
    drawn()
      ? Object.assign(window, {
          __many: {
            roots: many,
            elements: many * 6,
            ms: Math.round(performance.now() - start),
            longTasks: longTasks.map(Math.round),
          },
        })
      : requestAnimationFrame(wait);
  wait();
}

/*
 * Parts of your own (the "Parts of your own" section): the root's Clover read by the
 * page's script, a control replaced, a button of the page's, and a renderer of its own.
 */
type Api = {
  navigation(): { position: number; total: number };
  subscribe(listener: () => void): () => void;
  next(): void;
  getContentState(): { encoded: string } | null;
  localize(value: unknown): { text: string };
};
const own = document.getElementById("own-root") as HTMLElement & {
  clover: Api | null;
  renderers: unknown;
};
const where = document.getElementById("own-where")!;
const show = (clover: Api) => {
  const { position, total } = clover.navigation();
  where.textContent = `View ${position + 1} of ${total}`;
};
own.addEventListener("clover-ready", (event) => {
  const { clover } = (event as CustomEvent<{ clover: Api }>).detail;
  show(clover);
  clover.subscribe(() => show(clover));
});
document
  .getElementById("own-next")!
  .addEventListener("click", () => own.clover?.next());
document.getElementById("own-copy")!.addEventListener("click", () => {
  const state = own.clover?.getContentState();
  if (state)
    void navigator.clipboard?.writeText(`?iiif-content=${state.encoded}`);
});
// Zoom in, as a button of the page's, in Clover's look: its name, key and popover are Clover's.
(
  document.getElementById("own-body") as HTMLElement & {
    controlButtons: unknown;
  }
).controlButtons = {
  zoomIn: ({ icon }: { icon: HTMLElement }) => {
    const button = document.createElement("button");
    button.className = "clover-canvas-button";
    button.append(icon);
    return button;
  },
};
// The frontispiece's view, drawn by the page: its label, in the root's language.
own.renderers = [
  {
    canvasId: [book.items[1].id],
    render(
      container: HTMLElement,
      {
        canvases,
        clover,
      }: { canvases: Array<{ label?: unknown }>; clover: Api },
    ) {
      const note = document.createElement("p");
      note.className = "own-renderer";
      note.textContent = `Drawn by the page: ${canvases
        .map((canvas) => clover.localize(canvas.label).text)
        .join(", ")}`;
      container.append(note);
    },
  },
];
