import React from "react";

import { useCloverTranslation } from "../i18n/useCloverTranslation";

/** What a Body draws: an image, a video, a recording, or a 3D model. */
export type BodyMediaKind = "image" | "video" | "audio" | "model";

// One string a kind, as a language may write the words around each noun its own way.
const KEYS: Record<BodyMediaKind, string> = {
  image: "bodyUnloadableImage",
  video: "bodyUnloadableVideo",
  audio: "bodyUnloadableAudio",
  model: "bodyUnloadableModel",
};

/**
 * What a Body was to draw could not be loaded (an address that answers with an error):
 * a small note in the middle of the Body, "This image could not be loaded.", in place of
 * a picture, a film, a recording or a model that will not come, where a broken one would
 * say nothing. Its live region is always there, so the words are announced as they come
 * (WCAG 4.1.3). `room` keeps it clear of a transport at the Body's foot.
 */
export function BodyUnloadable({
  kind,
  shown,
  room = false,
}: {
  kind: BodyMediaKind;
  shown: boolean;
  room?: boolean;
}) {
  const { t, langOf } = useCloverTranslation();
  const key = KEYS[kind];
  return (
    <div
      className="clover-body-unloadable"
      data-room={room || undefined}
      role="status"
    >
      {shown && <p lang={langOf(key)}>{t(key)}</p>}
    </div>
  );
}
