"use client";

import type {
  ContentSearchQuery,
  CustomDisplay,
  PluginConfig,
  ViewerConfigOptions,
} from "@samvera/clover-iiif/viewer";
import dynamic from "next/dynamic";
import { useRouter } from "docs/lib/router";
import { EXAMPLE, example } from "docs/lib/example";

// todo: set this as a constant somewhere?
const defaultIiifContent =
  "https://api.dc.library.northwestern.edu/api/v2/works/71153379-4283-43be-8b0f-4e7e3bfda275?as=iiif";

const Viewer = dynamic(() => import("@samvera/clover-iiif/viewer"), {
  ssr: false,
});

/**
 * Starts loading the Viewer's code without rendering it. Webpack gives both `import()`s one
 * chunk, so calling this on hover or focus means the chunk is already there when the Viewer
 * is first rendered. A failed preload is harmless: rendering the Viewer will try again.
 */
export const preloadViewer = () => {
  import("@samvera/clover-iiif/viewer").catch(() => undefined);
};

/* The 3.x Viewer page's example callback: the content state, encoded and as JSON. */
const logState = ({ encoded, json }: { encoded: string; json: unknown }) => {
  console.log({
    encoded, // base64 encoded JSON
    json, // raw JSON
  });
};

const CloverViewer = ({
  iiifContent,
  options,
  customDisplays,
  iiifContentSearchQuery,
  plugins,
  contentStateCallback,
  logContentState = false,
}: {
  iiifContent?: string;
  options?: ViewerConfigOptions;
  customDisplays?: Array<CustomDisplay>;
  iiifContentSearchQuery?: ContentSearchQuery;
  plugins?: Array<PluginConfig>;
  contentStateCallback?: (json: any) => void;
  /**
   * Log each content state to the console, as the 3.x Viewer page's example does. A page
   * is drawn on the server, which cannot hand a callback to the Viewer, so it asks here.
   */
  logContentState?: boolean;
}) => {
  const router = useRouter();
  /*
   * An explicit prop wins over the URL.
   *
   * `iiif-content` is how the docs hand a pasted resource to a component rendered with no
   * prop of its own. The playground passes the resource as a prop *and* mirrors it into the
   * URL so a configuration can be shared — so if the param won, the playground's resource
   * field would look dead: it updates the prop as you type but only syncs the URL on blur.
   */
  const iiifResource =
    iiifContent ||
    (router.query["iiif-content"] as string) ||
    defaultIiifContent;

  /*
   * No `background` override. Clover defaults to `transparent`, so the Viewer picks up
   * whatever the page behind it is — which is what the docs want now that the page
   * background is token-driven.
   *
   * This used to force `#fff` / `rgb(17,17,17)` from a `isDark()` check, which pre-dated
   * those tokens and left the Viewer a slightly different shade from the page it sat on
   * (`#FCFCFD` light, `#111113` dark).
   */
  return (
    <div {...example(EXAMPLE)}>
      <Viewer
        contentStateCallback={
          contentStateCallback ?? (logContentState ? logState : undefined)
        }
        iiifContent={iiifResource}
        iiifContentSearchQuery={iiifContentSearchQuery}
        options={options}
        key={iiifResource}
        {...(customDisplays && { customDisplays })}
        {...(plugins && { plugins })}
      />
    </div>
  );
};

export default CloverViewer;
