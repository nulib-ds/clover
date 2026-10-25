"use client";

import dynamic from "next/dynamic";
import { useRouter } from "docs/lib/router";

const Timeline = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Timeline),
  { ssr: false },
);

/** `mock`: a path under this site's `/mocks/`, so a mock plays before it is deployed. */
const CloverTimeline = ({ mock, ...props }) => {
  const { basePath } = useRouter();
  return (
    <Timeline
      {...props}
      {...(mock && {
        iiifContent: new URL(`${basePath}/mocks/${mock}`, location.origin).href,
      })}
    />
  );
};

export default CloverTimeline;
