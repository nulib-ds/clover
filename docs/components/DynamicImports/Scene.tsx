"use client";

import dynamic from "next/dynamic";

/*
 * Clover's Scene, with three.js registered as its `three` engine, as a page opts in
 * (`@nulib/clover/three`), for the Scene page's comparison of the two engines.
 */
const Scene = dynamic(
  () =>
    Promise.all([import("@nulib/clover"), import("@nulib/clover/three")]).then(
      ([clover, three]) => {
        three.registerThreeEngine();
        return clover.Scene;
      },
    ),
  { ssr: false },
);

const CloverScene = (props) => {
  return <Scene {...props} />;
};

export default CloverScene;
