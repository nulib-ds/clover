/*
 * Two copies of Clover's elements on one page, as a page that loads both entries
 * (`web-components` and `web-components/viewer`) has: each its own host, counting the
 * page's elements together, so their ids never meet.
 */
import type { Hosted } from "./host";

const hosted = (element: HTMLElement): Hosted => ({
  element,
  kind: "alone",
  Component: () => null,
  getProps: () => ({}),
  subscribe: () => () => undefined,
});

it("counts the page's elements with another copy of Clover's, and says it is there", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const first = await import("./host");
  vi.resetModules();
  const second = await import("./host");
  expect(second.hostOf).not.toBe(first.hostOf);

  const one = document.body.appendChild(
    document.createElement("clover-viewer"),
  );
  const two = document.body.appendChild(
    document.createElement("clover-viewer"),
  );
  first.hostOf(document).connect(hosted(one));
  expect(warn).not.toHaveBeenCalled();
  second.hostOf(document).connect(hosted(two));

  const [a] = first.hostOf(document).list(null);
  const [b] = second.hostOf(document).list(null);
  expect(a.key).not.toBe(b.key);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toMatch(/loaded twice on this page/);
  warn.mockRestore();
});
