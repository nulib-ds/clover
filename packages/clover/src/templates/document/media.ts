type Json = Record<string, any>;

const list = (value: unknown): any[] =>
  Array.isArray(value) ? value : value ? [value] : [];

/** A painting annotation's bodies, a Choice's options in its place. */
const bodiesOf = (body: unknown): Json[] =>
  list(body).flatMap((each) =>
    each?.type === "Choice" ? list(each.items) : [each],
  );

/**
 * What a view's Canvases play, by their painting annotations' bodies as IIIF types them:
 * a video (a `Video` on any of them), else a sound, else a moving image (pictures on a
 * Canvas with a `duration`, its frames played in time, Muybridge's plates), else nothing
 * (a picture, a model).
 */
export function mediaOf(
  canvases: readonly (Json | undefined)[],
): "video" | "sound" | "moving" | null {
  let found: "video" | "sound" | "moving" | null = null;
  for (const canvas of canvases)
    for (const page of list(canvas?.items))
      for (const annotation of list(page?.items)) {
        const motivation = list(annotation?.motivation);
        if (motivation.length && !motivation.includes("painting")) continue;
        for (const body of bodiesOf(annotation?.body)) {
          if (body?.type === "Video") return "video";
          if (body?.type === "Sound" || body?.type === "Audio") found = "sound";
          else if (
            body?.type === "Image" &&
            Number(canvas?.duration) > 0 &&
            found === null
          )
            found = "moving";
        }
      }
  return found;
}
