import { useEffect, useRef, useState } from "react";

import type { MediaPlacement } from "../layout";
import { type LanguageMapLike, localize } from "../../../core/value";
import {
  type CloverRequest,
  requestKey,
  sendsCredentials,
} from "../../../core/request";
import { loadVtt } from "../../../core/vtt";
import { isHls } from "../../../lib/hls";

export interface MediaElementOptions {
  /** `texture` draws frames into the canvas, which needs CORS on the media. */
  presentation: "dom" | "texture";
  /** Captions and HLS get its credentials and headers; the element only its credentials. */
  request?: CloverRequest;
  /** The language to name caption tracks in, for the system player's menu. */
  language?: string;
}

/**
 * The media element for a Canvas's video or sound, made imperatively.
 *
 * Not JSX: the renderer moves the element into its DOM layer (or reads frames from it),
 * and React must not try to own or reconcile a node that has been moved. Sound plays
 * through a `<video>` too, as the Player plays it — one element type, one transport.
 *
 * - HLS plays through `hls.js` wherever Media Source Extensions let it run, imported only
 *   for an HLS source. Native HLS is the fallback where they cannot (older iOS). A native
 *   `canPlayType` no longer means Safari: Chromium plays HLS natively too, and there a
 *   video drawn as a `texture` (never on the page) stays on the lowest rendition, and a
 *   `dom` one can stall at its first frame.
 * - Each WebVTT caption file becomes a `<track>`, `hidden`: Clover draws the cues itself,
 *   so they stay readable at any zoom and in either presentation. Which track shows, and
 *   how, is `useCaptionTracks`' to keep, with those the media carries itself.
 * - `texture` asks for CORS (`crossOrigin`), since WebGL may not read other frames;
 *   `dom` and sound do not need it. Media that will not load that way (no CORS headers,
 *   or a cached copy fetched without them) is made again without and presented as
 *   `dom`: per item, as an image without CORS is.
 */
export function useMediaElement(
  media: MediaPlacement,
  { presentation: requested, request, language }: MediaElementOptions,
): { element: HTMLVideoElement | null; presentation: "dom" | "texture" } {
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  // The source whose CORS request failed: another recording asks again.
  const [corsFailedSrc, setCorsFailedSrc] = useState<string | null>(null);
  const presentation =
    requested === "texture" && corsFailedSrc !== media.src ? "texture" : "dom";
  const captionsKey = JSON.stringify(media.captions);
  const withCredentials = sendsCredentials(request);
  // Read through a ref, so a new object with the same settings does not remake the element.
  const requestRef = useRef(request);
  requestRef.current = request;
  const languageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "metadata";
    video.className = "clover-canvas-media-element";
    const onCorsError = () => {
      // Nothing loaded at all: the CORS request itself failed.
      if (video.readyState === HTMLMediaElement.HAVE_NOTHING)
        setCorsFailedSrc(media.src);
    };
    if (presentation === "texture") {
      video.crossOrigin = withCredentials ? "use-credentials" : "anonymous";
      video.addEventListener("error", onCorsError, { once: true });
    }
    if (media.poster) video.poster = media.poster;

    /*
     * A cross-origin `<track>` loads only when the video itself asks for CORS, which a
     * `dom` video does not. So each file is fetched here (CORS, as Clover fetches all
     * WebVTT) and handed to its track as a same-origin blob.
     */
    const blobs: string[] = [];
    media.captions.forEach((caption, index) => {
      const track = document.createElement("track");
      track.kind = "captions";
      if (caption.language) track.srclang = caption.language;
      // Named as Clover's menu names it, for the system player's own menu.
      track.label =
        localize(caption.label as LanguageMapLike, languageRef.current).text ||
        caption.language ||
        String(index + 1);
      video.appendChild(track);
      // Shared with `Transcript`: one fetch per file.
      loadVtt(caption.id, requestRef.current)
        .then((text) => {
          if (cancelled) return;
          const url = URL.createObjectURL(
            new Blob([text], { type: "text/vtt" }),
          );
          blobs.push(url);
          track.src = url;
        })
        .catch(() => undefined);
    });

    let hls: { destroy: () => void } | null = null;
    if (isHls(media.src, media.format)) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            video.src = media.src;
            return;
          }
          const instance = new Hls({
            xhrSetup: (xhr: XMLHttpRequest) => {
              xhr.withCredentials = withCredentials;
              for (const [name, value] of Object.entries(
                requestRef.current?.headers ?? {},
              )) {
                xhr.setRequestHeader(name, value);
              }
            },
          });
          instance.loadSource(media.src);
          instance.attachMedia(video);
          hls = instance;
        })
        // hls.js itself failed to load: the browser's own player, if it has one.
        .catch(() => {
          if (!cancelled) video.src = media.src;
        });
    } else {
      video.src = media.src;
    }

    // Hidden from the start: their cues are live, and Clover draws them.
    for (const track of Array.from(video.textTracks ?? [])) {
      track.mode = "hidden";
    }

    setElement(video);
    return () => {
      cancelled = true;
      video.removeEventListener("error", onCorsError);
      video.pause();
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
      video.remove();
      blobs.forEach((url) => URL.revokeObjectURL(url));
      setElement(null);
    };
    // `captionsKey` stands in for `media.captions`, whose identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    media.src,
    media.format,
    media.poster,
    captionsKey,
    presentation,
    requestKey(request),
  ]);

  return { element, presentation };
}
