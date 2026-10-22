/*
 * What every test runs with, React's or Preact's (`setupTests.ts` adds React Testing
 * Library's cleanup; the element's tests, under Preact, use this alone).
 */
import "@testing-library/jest-dom/vitest";

import { beforeEach } from "vitest";

/*
 * Browser stand-ins for jsdom. Skipped in a test that asks for the node environment (the
 * server-rendering test), where there is no DOM to patch and none may be assumed.
 */
if (typeof window !== "undefined") {
  // Mock canvas
  HTMLCanvasElement.prototype.getContext = () => {
    return {} as any;
  };

  /*
   * Mock matchMedia — jsdom does not implement it. `matches: false` presents a fine-pointer
   * desktop, which is the right default for the suite.
   */
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  // A desktop browser's Fullscreen API, which jsdom leaves out. iPhone tests turn it off.
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });

  // Mock HTML video element
  HTMLMediaElement.prototype.load = () => {};
  //HTMLMediaElement.prototype.play = () => { /* do nothing */ };
  HTMLMediaElement.prototype.pause = () => {};
  //HTMLMediaElement.prototype.addTextTrack = () => { /* do nothing */ };

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // do nothing
    }
    unobserve() {
      // do nothing
    }
    disconnect() {
      // do nothing
    }
  };

  class MockIntersectionObserver {
    constructor(callback: any) {
      this.callback = callback;
    }

    readonly callback: any;

    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn();
  }

  globalThis.IntersectionObserver = MockIntersectionObserver as any;
}

/*
 * A page in English, as a page declares its language (WCAG 3.1.1), so a Root speaking
 * Clover's English marks nothing. Tests of another page language set their own.
 */
beforeEach(() => {
  if (typeof document !== "undefined") document.documentElement.lang = "en";
});
