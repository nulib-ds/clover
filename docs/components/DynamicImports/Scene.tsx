"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Scene),
  { ssr: false },
);

const CloverScene = (props) => {
  return <Scene {...props} />;
};

export default CloverScene;
