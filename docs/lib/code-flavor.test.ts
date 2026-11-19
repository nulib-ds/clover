import { afterEach, describe, expect, it } from "vitest";

import { setCodeFlavor, showFlavorOfTarget } from "docs/lib/code-flavor";
import {
  CODE_FLAVOR_KEY,
  CODE_FLAVOR_SCRIPT,
} from "docs/lib/code-flavor-script";

const root = document.documentElement;

afterEach(() => {
  localStorage.clear();
  delete root.dataset.code;
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

describe("the docs' code choice", () => {
  it("is React by default: nothing on the root, nothing stored", () => {
    new Function(CODE_FLAVOR_SCRIPT)();
    expect(root.dataset.code).toBeUndefined();
  });

  it("puts a stored choice of Web components on the root before the page paints", () => {
    localStorage.setItem(CODE_FLAVOR_KEY, "web-components");
    new Function(CODE_FLAVOR_SCRIPT)();
    expect(root.dataset.code).toBe("web-components");
  });

  it("ignores anything else stored", () => {
    localStorage.setItem(CODE_FLAVOR_KEY, "</script><script>alert(1)");
    new Function(CODE_FLAVOR_SCRIPT)();
    expect(root.dataset.code).toBeUndefined();
  });

  it("sets and remembers Web components, and React clears both", () => {
    setCodeFlavor("web-components");
    expect(root.dataset.code).toBe("web-components");
    expect(localStorage.getItem(CODE_FLAVOR_KEY)).toBe("web-components");

    setCodeFlavor("react");
    expect(root.dataset.code).toBeUndefined();
    expect(localStorage.getItem(CODE_FLAVOR_KEY)).toBeNull();
  });

  it("shows the flavor a link's target is in, for the visit only", () => {
    setCodeFlavor("react");
    document.body.innerHTML =
      '<div data-code-flavor="web-components"><h3 id="element-clover-body">clover-body</h3></div>';
    Element.prototype.scrollIntoView = () => {};
    history.replaceState(null, "", "/docs/body#element-clover-body");
    showFlavorOfTarget();
    expect(root.dataset.code).toBe("web-components");
    expect(localStorage.getItem(CODE_FLAVOR_KEY)).toBeNull();
  });

  it("leaves the flavor alone for a target both show", () => {
    setCodeFlavor("react");
    document.body.innerHTML =
      '<div data-code-flavor="both"><h2 id="api-reference">API reference</h2></div>';
    history.replaceState(null, "", "/docs/body#api-reference");
    showFlavorOfTarget();
    expect(root.dataset.code).toBeUndefined();
  });
});
