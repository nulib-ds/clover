import React from "react";

import {
  Logo,
  Provider,
  type ProviderProps,
} from "../../components/Provider/Provider";
import type { HostedProps } from "../host";
import { useWatched } from "./nodes";

interface LogoRead {
  element: Element;
  alt: string | undefined;
}

/** A provider's `<clover-logo>`s, in their order, each with its own alt text. */
const logosOf = (provider: Element): LogoRead[] =>
  [...provider.children]
    .filter((child) => child.localName === "clover-logo")
    .map((logo) => ({
      element: logo,
      alt: logo.getAttribute("alt") ?? undefined,
    }));

const sameLogos = (a: LogoRead[], b: LogoRead[]) =>
  a.length === b.length &&
  a.every(
    (logo, index) =>
      logo.element === b[index].element && logo.alt === b[index].alt,
  );

/**
 * `<clover-provider>` (`specs/primitives.ts`): `Provider`, each provider its logo and its
 * name, linked; or, holding `<clover-logo>`s, what React's `<Provider><Logo /></Provider>`
 * draws, each provider's logo alone, as many as it holds, each with its `alt`.
 */
export function ProviderElement({ hosted, props }: HostedProps) {
  const logos = useWatched(
    hosted.element,
    () => logosOf(hosted.element),
    sameLogos,
  );
  return (
    <Provider {...(props as ProviderProps)}>
      {logos.length
        ? logos.map((logo, index) => <Logo key={index} alt={logo.alt} />)
        : undefined}
    </Provider>
  );
}
