"use client";

import dynamic from "next/dynamic";

const Timeline = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Timeline),
  { ssr: false },
);

const CloverTimeline = (props) => {
  return <Timeline {...props} />;
};

export default CloverTimeline;
