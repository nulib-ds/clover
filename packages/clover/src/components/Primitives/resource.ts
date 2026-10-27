import { createContext, useContext } from "react";

import type { CloverState } from "../../core/clover";
import { selectCanvas } from "../../core/selectors";

/** Whose property a part reads: the Root's Manifest, or the Canvas in view. */
export type Of = "manifest" | "canvas";

export type Json = Record<string, any>;

/** The resource a property part reads, in a Root. */
export const resourceOf = (state: CloverState, of: Of): Json | null =>
  of === "canvas"
    ? (selectCanvas(state.manifest, state.canvasId) as Json | null)
    : (state.manifest as Json | null);

export { asArray } from "../../lib/asArray";

/**
 * The provider (a IIIF Agent) a part is drawn for, inside `Provider`, which draws its
 * parts once for each: there `Label`, `Logo`, `Homepage`, `SeeAlso` and `Id` read the
 * provider's, not the resource's. Null elsewhere.
 */
export const ProviderContext = createContext<Json | null>(null);

/** The provider a part is drawn for, inside `Provider`; null outside one. */
export const useProvider = (): Json | null => useContext(ProviderContext);
