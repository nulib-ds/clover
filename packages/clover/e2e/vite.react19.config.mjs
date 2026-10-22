import { harness } from "./vite.config.mjs";

/** The same harness on React 19 (installed in `e2e/react19`), on its own port. */
export default harness("react19", 4322);
