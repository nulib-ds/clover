import { lazy } from "react";

/*
 * The map's list (`MapItems`, Items' code with it), as a component a map is handed rather
 * than one it imports: the maps that list hand it (`Map`, the Root's, the Panel's), and the
 * Canvas's map box, which lists nothing, never does. A module a page's first load holds
 * keeps every export any lazy chunk it can reach uses, so a Canvas that could reach Items
 * here, though it never lists, carried Items' needs up front (selectors, `localize`; about
 * 0.6 kB, 2026-11-12). Side-effect free, so a page that lists nothing drops this too.
 */
export const MapList = lazy(() => import("./MapItems"));
