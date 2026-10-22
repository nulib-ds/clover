import { afterEach, describe, expect, it } from "vitest";

import { setCodeFlavor } from "docs/lib/code-flavor";
import {
  CODE_FLAVOR_KEY,
  CODE_FLAVOR_SCRIPT,
} from "docs/lib/code-flavor-script";

const root = document.documentElement;

afterEach(() => {
  localStorage.clear();
  delete root.dataset.code;
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
});
