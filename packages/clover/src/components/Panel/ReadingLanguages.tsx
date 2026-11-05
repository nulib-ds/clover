import { createContext } from "react";

import { useReadingLanguages } from "../../react/readingLanguages";

export { useReadingLanguages };

/** Whether a part is inside a `Panel`, which holds the languages beside About's heading. */
export const InPanelContext = createContext(false);
