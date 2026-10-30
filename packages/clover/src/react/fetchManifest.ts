import type { Clover } from "../core/clover";
import { loadManifest } from "../core/load";
import type { Manifest } from "../core/presentation";

/**
 * A Manifest other than the one shown, read for what a listing says of it (its title, its
 * Canvases' names and pictures): fetched once a Root, with its request settings, and
 * null where it will not load. Annotations given as the content name their Manifests so,
 * and a content state's several targets theirs (Cookbook 0540).
 */
const fetched = new WeakMap<Clover, Map<string, Promise<Manifest | null>>>();

export function fetchManifest(
  clover: Clover,
  id: string,
): Promise<Manifest | null> {
  let byId = fetched.get(clover);
  if (!byId) fetched.set(clover, (byId = new Map()));
  let manifest = byId.get(id);
  if (!manifest) {
    manifest = loadManifest(
      { id, type: "Manifest" },
      { request: clover.request },
    ).catch(() => null);
    byId.set(id, manifest);
  }
  return manifest;
}
