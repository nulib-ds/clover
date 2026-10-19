import type { Clover } from "./clover";
import type { AnnotationLink } from "./link";
import { selectSequence } from "./selectors";

/**
 * Show where a link leads, in a Root: its Canvas, in the Manifest shown or in the one
 * its `partOf` names, opened in that one's place. Whether it leads anywhere here.
 */
export function showLink(clover: Clover, link: AnnotationLink): boolean {
  const shown = clover.store.get().manifest;
  const here =
    link.canvasId &&
    selectSequence(shown).canvases.some(
      (canvas) => canvas.id === link.canvasId,
    );
  if (here) clover.goTo(link.canvasId!);
  else if (link.manifestId && link.manifestId !== shown?.id)
    void clover.goToManifest(link.manifestId, link.canvasId);
  else return false;
  return true;
}
