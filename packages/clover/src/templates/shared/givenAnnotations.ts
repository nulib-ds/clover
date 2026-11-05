import * as Clover from "../../parts";
import type { AnnotationCollection } from "../../parts";

/**
 * The annotations given as the Root's content (`addedSets` marked `content`), walked as
 * one whole (`useAnnotationCollection`); null where the content is a Manifest or a
 * Collection, even one whose pages are part of an AnnotationCollection. The lightbox
 * reads it too, to step through them and to name where Back goes.
 */
export function useGivenAnnotations(): AnnotationCollection | null {
  const given = Clover.useCloverSelector((state) =>
    state.addedSets.some((set) => Boolean(set.content)),
  );
  const set = Clover.useAnnotationCollection();
  return given ? set : null;
}
