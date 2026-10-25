"use client";

import dynamic from "next/dynamic";
import { useMock } from "docs/lib/useMock";

const Timeline = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Timeline),
  { ssr: false },
);

/**
 * `mock`: a path under this site's `/mocks/`, so a mock plays before it is deployed. Its
 * address is known only in the browser (`useMock`), so the Timeline waits for it: read
 * while rendering, `location` broke the static export (2026-10-25).
 */
const CloverTimeline = ({ mock, ...props }) => {
  const url = useMock(mock ?? "");
  if (mock && !url) return null;
  return <Timeline {...props} {...(mock && { iiifContent: url })} />;
};

export default CloverTimeline;
