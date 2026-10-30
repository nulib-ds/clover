import { afterEach, describe, expect, it, vi } from "vitest";

import { getCloverRoot, toggleFullscreen } from "./fullscreen";

/** iPhone Safari: no element full screen, and a video that has its own. */
function iphone() {
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: undefined,
  });
  const root = document.createElement("div");
  root.className = "clover-canvas";
  const button = document.createElement("button");
  root.appendChild(button);
  document.body.appendChild(root);
  const video = document.createElement("video") as HTMLVideoElement & {
    webkitEnterFullscreen: () => void;
  };
  const placed: boolean[] = [];
  video.webkitEnterFullscreen = vi.fn(() => placed.push(video.isConnected));
  return { root, button, video, placed };
}

afterEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
});

describe("getCloverRoot", () => {
  it("finds the Root a Canvas is in, else the Canvas on its own", () => {
    document.body.innerHTML = `<div class="clover-root" id="root"><p>Label</p><figure class="clover-canvas"><button id="in"></button></figure></div><figure class="clover-canvas" id="alone"><button id="out"></button></figure>`;
    expect(getCloverRoot(document.getElementById("in"))).toBe(
      document.getElementById("root"),
    );
    expect(getCloverRoot(document.getElementById("out"))).toBe(
      document.getElementById("alone"),
    );
    expect(getCloverRoot(null)).toBeNull();
  });

  it("takes a Canvas in a dialog inside the Root alone, as the dialog would hide", () => {
    document.body.innerHTML = `<div class="clover-root"><dialog><figure class="clover-canvas" id="lightbox"><button id="in"></button></figure></dialog></div>`;
    expect(getCloverRoot(document.getElementById("in"))).toBe(
      document.getElementById("lightbox"),
    );
  });
});

describe("toggleFullscreen on iPhone", () => {
  it("hands a video on the page to the system player as it is", async () => {
    const { root, button, video, placed } = iphone();
    root.appendChild(video);
    await toggleFullscreen(button, video);
    expect(placed).toEqual([true]);
    expect(video.parentElement).toBe(root);
    expect(video.getAttribute("style")).toBeNull();
  });

  it("places a video drawn into the canvas on the page while the player has it", async () => {
    const { root, button, video, placed } = iphone();
    video.setAttribute("style", "color: red");
    await toggleFullscreen(button, video);
    // A frame later, once the placed video has been laid out.
    await vi.waitFor(() => expect(placed).toHaveLength(1));
    // On the page when the player was asked: first in its Canvas, under the viewport,
    // and not hidden, since the player would keep a hidden video's styles.
    expect(placed).toEqual([true]);
    expect(root.firstElementChild).toBe(video);
    expect(video.style.opacity).toBe("");
    expect(video.style.visibility).toBe("");

    // The player closes: back off the page, as the renderer had it.
    video.dispatchEvent(new Event("webkitendfullscreen"));
    expect(video.isConnected).toBe(false);
    expect(video.getAttribute("style")).toBe("color: red");
  });

  it("does nothing for a video with no player of its own", async () => {
    const { button } = iphone();
    const plain = document.createElement("video");
    await toggleFullscreen(button, plain);
    expect(plain.isConnected).toBe(false);
  });
});
