/*
 * The registry keeps Clover's sheets in the stylesheet's order, whatever order their code
 * arrives in: each by its index, before the page's own.
 */
import { StyleRegistry, addSheet } from "./styles";

const keys = (doc: Document) =>
  [...doc.head.querySelectorAll<HTMLElement>("style[data-clover]")].map(
    (style) => style.dataset.clover,
  );

it("puts each sheet in its place, however late its code comes", () => {
  const doc = document.implementation.createHTMLDocument();
  doc.head.innerHTML = `<style id="page">.page{}</style>`;
  new StyleRegistry(doc);
  addSheet(30, "test/c", ".c{}");
  addSheet(10, "test/a", ".a{}");
  addSheet(20, "test/b", ".b{}");
  addSheet(20, "test/b", ".b{}");
  expect(keys(doc)).toEqual(["test/a", "test/b", "test/c"]);
  // Before the page's own CSS, which comes after Clover's.
  expect(doc.head.lastElementChild?.id).toBe("page");

  // A document's registry made later takes every sheet already brought, in order.
  const later = document.implementation.createHTMLDocument();
  new StyleRegistry(later);
  expect(keys(later)).toEqual(["test/a", "test/b", "test/c"]);
});
