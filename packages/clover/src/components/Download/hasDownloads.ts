import { selectVisibleCanvases } from "../../core/selectors";
import { asArray } from "../../lib/asArray";
import { useCloverSelector } from "../../react/context";

/*
 * Whether there is anything to download, read apart from the downloads themselves
 * (`downloads.ts`), which load with what lists them (`Download.tsx`): About offers its
 * Download button and its section by this, so a first view never carries the list.
 */

/** A `rendering` that names a file: what `useDownloads` lists. */
const offers = (resource: Record<string, any> | null | undefined) =>
  (asArray(resource?.rendering) as Array<Record<string, any>>).some(
    (item) => typeof (item?.id ?? item?.["@id"]) === "string",
  );

/** Whether the Manifest, or a Canvas in view, has a `rendering` to download. */
export const useHasDownloads = () =>
  useCloverSelector(
    (state) =>
      offers(state.manifest as never) ||
      selectVisibleCanvases(state.manifest, state.canvasId).some((canvas) =>
        offers(canvas as never),
      ),
    Object.is,
    "Download",
  );
