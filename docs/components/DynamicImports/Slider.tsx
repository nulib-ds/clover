"use client";

import Slider, { type CloverSliderProps } from "@samvera/clover-iiif/slider";
import { demoResources } from "docs/lib/demo-resources";
import { useRouter } from "docs/lib/router";

/**
 * Forwards every Slider prop rather than naming a few.
 *
 * The playground turns the embedding seams — `showHeader`, `presentational`, `align`,
 * `dragFree`, `slidesToScroll` — and an allow-list here would drop them silently, which
 * reads as the controls doing nothing.
 */
const CloverSlider = ({
  iiifContent,
  ...props
}: Omit<CloverSliderProps, "iiifContent"> & { iiifContent?: string }) => {
  const router = useRouter();

  /*
   * An explicit prop wins over the URL.
   *
   * `iiif-content` is how the docs hand a pasted resource to a component rendered with no
   * prop of its own. The playground passes the resource as a prop *and* mirrors it into the
   * URL so a configuration can be shared — so if the param won, the playground's resource
   * field would look dead: it updates the prop as you type but only syncs the URL on blur.
   */
  const iiifResource =
    iiifContent ||
    (router.query["iiif-content"] as string) ||
    demoResources.slider;

  return <Slider {...props} iiifContent={iiifResource} key={iiifResource} />;
};

export default CloverSlider;
