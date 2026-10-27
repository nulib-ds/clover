import React from "react";

import { ConnectedMap, type Forwarded, type MapProps } from "./MapView";
import { Root } from "../Root/Root";

/** A map of a resource it loads itself, standalone: every Canvas's overlays (`Map`). */
export default function LoadedMap({
  iiifContent,
  request,
  language,
  forwardedRef,
  ...rest
}: MapProps & Forwarded) {
  return (
    <Root
      iiifContent={iiifContent!}
      request={request}
      language={language}
      annotationPages="all"
      style={{ display: "contents" }}
    >
      <ConnectedMap {...rest} scope="all" forwardedRef={forwardedRef} />
    </Root>
  );
}
