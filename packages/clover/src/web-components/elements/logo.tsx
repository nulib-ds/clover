import React from "react";

import { Logo, type LogoProps } from "../../components/Provider/Provider";
import type { HostedProps } from "../host";

/**
 * `<clover-logo>`: `Logo`, the resource's providers' logos; inside a `<clover-provider>`,
 * nothing, as the provider reads it and draws each provider's logo in its place.
 */
export function LogoElement({ hosted, props }: HostedProps) {
  if (hosted.element.parentElement?.localName === "clover-provider")
    return null;
  return <Logo {...(props as LogoProps)} />;
}
