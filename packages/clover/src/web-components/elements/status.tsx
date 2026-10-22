import React from "react";

import { Status, type StatusProps } from "../../components/Status/Status";
import type { HostedProps } from "../host";
import { Copy, useSlot } from "./nodes";

/**
 * `<clover-status>` (`specs/sections.ts`): `Status`, and what its slots hold in place of
 * Clover's own: `slot="loading"`, shown and announced while the root loads, and
 * `slot="error"`, the alert if it fails. Each is shown as a copy, kept in step.
 */
export function StatusElement({ hosted, props }: HostedProps) {
  const loading = useSlot(hosted.element, "loading");
  const error = useSlot(hosted.element, "error");
  return (
    <Status
      {...(props as StatusProps)}
      loading={loading ? <Copy of={loading} /> : (props as StatusProps).loading}
      error={error ? () => <Copy of={error} /> : undefined}
    />
  );
}
