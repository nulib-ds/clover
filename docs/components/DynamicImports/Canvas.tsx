"use client";

import dynamic from "next/dynamic";
import { useSiteMock } from "docs/lib/useMock";

const Canvas = dynamic(
  () => import("@nulib/clover").then((clover) => clover.Canvas),
  { ssr: false },
);

// A published mock is read from the site the page is on (`useSiteMock`).
const CloverCanvas = (props) => {
  const iiifContent = useSiteMock(props.iiifContent);
  if (iiifContent === null) return null;
  return <Canvas {...props} iiifContent={iiifContent} />;
};

export default CloverCanvas;
