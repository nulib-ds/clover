import { useEffect, useRef, useState } from "react";

import { type MediaPlacement, STILL_SIZE } from "../layout";
import { resolveThumbnail } from "../../../core/thumbnail";
import { type LanguageMapLike, localize } from "../../../core/value";
import {
  type CloverRequest,
  requestKey,
  sendsCredentials,
} from "../../../core/request";
import { loadVtt } from "../../../core/vtt";
import { isHls } from "../../../lib/hls";

/**
 * A caption track's name, as the transport's menu and the system player's both name it:
 * its label in the reader's language, else its language, else its number.
 */
export function captionName(
  caption: MediaPlacement["captions"][number],
  index: number,
  language?: string,
): { text: string; lang?: string } {
  const name = localize(caption.label as LanguageMapLike, language);
  return name.text
    ? { text: name.text, lang: name.lang }
    : { text: caption.language || String(index + 1) };
}

export interface MediaElementOptions {
  /** Captions and HLS get its credentials and headers; the element only its credentials. */
  request?: CloverRequest;
  /** The language to name caption tracks in, for the system player's menu. */
  language?: string;
}

/**
 * The media element for a Canvas's video or sound, made imperatively.
 *
 * Not JSX: the renderer moves the element into its DOM layer, and React must not try to
 * own or reconcile a node that has been moved. Sound plays
 * through a `<video>` too, as the Player plays it — one element type, one transport.
 *
 * - HLS plays through `hls.js` wherever Media Source Extensions let it run, imported only
 *   for an HLS source. Native HLS is the fallback where they cannot (older iOS). A native
 *   `canPlayType` no longer means Safari: Chromium plays HLS natively too, and there a
 *   video can stall at its first frame.
 * - Each WebVTT caption file becomes a `<track>`, `hidden`: Clover draws the cues itself,
 *   so they stay readable at any zoom. Which track shows, and how, is
 *   `useCaptionTracks`' to keep, with those the media carries itself.
 * - It asks for no CORS: the browser shows the element itself (the renderer's DOM layer),
 *   reading none of its pixels.
 */
export function useMediaElement(
  media: MediaPlacement,
  { request, language }: MediaElementOptions,
): HTMLVideoElement | null {
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const captionsKey = JSON.stringify(media.captions);
  const posterKey = media.poster
    ? (media.poster.src ?? media.poster.service ?? "")
    : "";
  const withCredentials = sendsCredentials(request);
  // Read through a ref, so a new object with the same settings does not remake the element.
  const requestRef = useRef(request);
  requestRef.current = request;
  const languageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    let canceled = false;
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "metadata";
    video.className = "clover-canvas-media-element";
    // The poster once its service's `info.json` is read, as every image is asked.
    const poster = media.poster;
    if (poster?.src) video.poster = poster.src;
    else if (poster)
      void resolveThumbnail(poster, STILL_SIZE, requestRef.current).then(
        (url) => {
          if (!canceled && url) video.poster = url;
        },
      );

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
      track.label = captionName(caption, index, languageRef.current).text;
      video.appendChild(track);
      // Shared with `Transcript`: one fetch per file.
      loadVtt(caption.id, requestRef.current)
        .then((text) => {
          if (canceled) return;
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
          if (canceled) return;
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
          if (!canceled) video.src = media.src;
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
      canceled = true;
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
  }, [media.src, media.format, posterKey, captionsKey, requestKey(request)]);

  return element;
}
