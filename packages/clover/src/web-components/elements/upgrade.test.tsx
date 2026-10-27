/*
 * Markup written before Clover's script defines its elements, as a page whose script loads
 * async has it: the elements upgrade in whatever order they are defined, and what the page
 * set on them early is kept. A page of its own, since an element is defined only once.
 */
import { waitFor, within } from "@testing-library/dom";

import { defineCloverElements } from "../define";
import bookJson from "../../fixtures/iiif-cookbook/0009-book-1.json";
import tocJson from "../../fixtures/iiif-cookbook/0024-book-4-toc.json";
import { initCloverI18n } from "../../i18n";

const ASSETS = {};
const BOOK = "Simple Manifest - Book";
const TOC = "Ethiopic Ms 10";

type WithContent = HTMLElement & { iiifContent: unknown };

/** A turn of the event loop: Preact renders in a microtask, effects after. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  initCloverI18n({ lng: "en" });
});

it("waits for a root defined after its parts, and takes what was set on either before", async () => {
  document.body.innerHTML = `
    <clover-root id="one">
      <clover-label as="h2"></clover-label>
    </clover-root>
  `;
  const one = document.getElementById("one") as WithContent;
  // Set before `clover-root` is defined: a property of the element itself, for now.
  one.iiifContent = bookJson;
  // Made, given its content and kept off the page until later.
  const later = document.createElement("clover-root") as WithContent;
  later.innerHTML = `<clover-label as="h2"></clover-label>`;
  later.iiifContent = tocJson;

  // The parts first: each finds the root it is in, and waits for it.
  defineCloverElements(ASSETS, ["clover-label"]);
  await settle();
  expect(one.querySelector("h2")).toBeNull();

  // Then the root: it takes the content set early, and its part draws.
  defineCloverElements(ASSETS, ["clover-root"]);
  expect(
    await within(one).findByRole("heading", { level: 2, name: BOOK }),
  ).toBeInTheDocument();
  expect(Object.prototype.hasOwnProperty.call(one, "iiifContent")).toBe(false);
  expect(one.iiifContent).toBe(bookJson);

  // One made before either was defined, put on the page after.
  document.body.append(later);
  expect(
    await within(later).findByRole("heading", { level: 2, name: TOC }),
  ).toBeInTheDocument();
});

it("draws a part that arrives in a root already drawn", async () => {
  const root = document.querySelector("clover-root") as WithContent;
  const label = document.createElement("clover-label");
  label.setAttribute("of", "canvas");
  root.append(label);
  await waitFor(() => expect(label).toHaveTextContent("Blank page"));
});
