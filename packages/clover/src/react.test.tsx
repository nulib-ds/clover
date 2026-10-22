/*
 * Each test project runs the React it names (`provide` in `vitest.config.mjs` and
 * `vitest.react18.config.mjs`), Testing Library with it, as `e2e/specs/react.spec.ts`
 * checks of the end-to-end projects. Without it the React 18 project could run the
 * root's React 19, as the end-to-end projects once did, and every test would pass.
 */
import { renderHook } from "@testing-library/react";
// eslint-disable-next-line no-restricted-imports -- React's own ids, to tell its version
import React, { useId } from "react";
import { version as domVersion } from "react-dom";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    react: string;
  }
}

it("runs the React its project names, and renders with it", () => {
  const major = inject("react");
  expect(React.version.split(".")[0]).toBe(major);
  expect(domVersion.split(".")[0]).toBe(major);
  // Testing Library renders with the same React: under another, a hook throws. React 18's
  // ids alone begin ":r" (19's have changed form between its minors).
  const { result } = renderHook(() => useId());
  expect(result.current.startsWith(":r")).toBe(major === "18");
});
