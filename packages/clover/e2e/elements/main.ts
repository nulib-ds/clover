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
