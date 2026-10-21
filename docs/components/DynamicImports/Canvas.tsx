"use client";

import dynamic from "next/dynamic";

const Canvas = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Canvas),
  { ssr: false },
);

const CloverCanvas = (props) => {
  return <Canvas {...props} />;
};

export default CloverCanvas;
