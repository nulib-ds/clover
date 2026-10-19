import React from "react";

import { Loading } from "../../ui/Loading";

/**
 * A Canvas's box with nothing yet to draw: its own background, the loading mark along its
 * top, and `aria-busy`, as a Canvas loading its images shows. Never an empty box.
 */
export function CanvasPending({ children }: { children?: React.ReactNode }) {
  return children ? (
    <div className="clover-canvas" data-status="error">
      {children}
    </div>
  ) : (
    <div className="clover-canvas" data-status="loading" aria-busy="true">
      <Loading overlay />
    </div>
  );
}
