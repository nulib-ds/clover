import { createContext } from "react";

/**
 * The language of the page around the nearest Clover root (a `Root`, or a part shown
 * outside one), which Clover's strings are compared with: one in another language carries
 * its own `lang` (WCAG 3.1.2). Empty until the root has mounted and read it, or where the
 * page declares none; undefined outside any Clover root.
 */
export const HostLanguageContext = createContext<string | undefined>(undefined);
