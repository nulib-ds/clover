import React from "react";

import { toPlainText } from "../../core/text";
import { type LanguageMapLike, localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import {
  useOptionalClover,
  useOptionalCloverSelector,
} from "../../react/context";
import { Label } from "../Label/Label";
import {
  type Json,
  type Of,
  ProviderContext,
  asArray,
  resourceOf,
  useProvider,
} from "../Primitives/resource";

/**
 * `provider` and the `logo` on each: who provided the resource, IIIF's Agents, each with
 * its name, its logo and its homepage (Mat, 2026-10-24: "Provider and Logo components to
 * match the iiif properties").
 */

/** An Agent worth drawing: one with a name, a logo or a homepage to show. */
const isAgent = (value: unknown): value is Json =>
  Boolean(value) &&
  typeof value === "object" &&
  ["label", "logo", "homepage"].some(
    (key) => asArray((value as Json)[key]).length > 0,
  );

/** A logo worth drawing: an image with an address. */
const isImage = (value: unknown): value is Json =>
  Boolean(value) && typeof (value as Json).id === "string";

/** An Agent's homepage: the first with an address. */
const homepageOf = (agent: Json): string | undefined =>
  asArray<Json>(agent.homepage).find(isImage)?.id;

/** What names an Agent: its label, else its homepage's. */
const nameOf = (agent: Json | null, language?: string) => {
  if (!agent) return null;
  for (const label of [
    agent.label,
    asArray<Json>(agent.homepage).find((page) => page?.label)?.label,
  ]) {
    const name = localize(label as LanguageMapLike, language);
    if (name.text) return { text: toPlainText(name.text), lang: name.lang };
  }
  return null;
};

export interface ProviderProps
  extends Omit<React.HTMLAttributes<HTMLUListElement>, "lang" | "children"> {
  /** Whose providers: the Manifest's (default) or the current Canvas's. */
  of?: Of;
  /** Providers to show instead of the Root's: an Agent, or a list of them. */
  value?: unknown;
  /** Link each provider to its homepage, when it has one. Default `true`. */
  link?: boolean;
  /**
   * What to draw for each provider, inside its link: `Logo`, `Label` and the link parts,
   * which read that provider, and anything of your own (`useProvider`). Default: its logo
   * and its name.
   */
  children?: React.ReactNode;
}

/**
 * `provider`: who provided the resource, each as a list item, its logo and its name
 * linked to its homepage. A compound part: what it holds is drawn once for each provider,
 * so `<Provider><Logo /></Provider>` shows each one's logo alone, linked, named for
 * assistive technology by the provider's name. Renders nothing without a provider.
 */
export function Provider({
  of = "manifest",
  value,
  link = true,
  children,
  className,
  ...rest
}: ProviderProps) {
  const fromRoot = useOptionalCloverSelector(
    (state) => resourceOf(state, of)?.provider as unknown,
    undefined,
  );
  const language = useOptionalClover()?.language;
  const agents = asArray(value !== undefined ? value : fromRoot).filter(
    isAgent,
  );
  if (!agents.length) return null;
  return (
    <ul className={join("clover-provider", className)} {...rest}>
      {agents.map((agent, index) => {
        const homepage = link ? homepageOf(agent) : undefined;
        // Its name beside its logo names it, so the logo is then drawn only.
        const named = Boolean(localize(agent.label, language).text);
        const drawn = children ?? (
          <>
            <Logo alt={named ? "" : undefined} />
            <Label className="clover-provider-label" />
          </>
        );
        return (
          <li key={agent.id ?? index} className="clover-provider-agent">
            <ProviderContext.Provider value={agent}>
              {homepage ? (
                <a href={homepage} className="clover-provider-link">
                  {drawn}
                </a>
              ) : (
                <span className="clover-provider-content">{drawn}</span>
              )}
            </ProviderContext.Provider>
          </li>
        );
      })}
    </ul>
  );
}

export interface LogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Whose providers' logos: the Manifest's (default) or the current Canvas's. */
  of?: Of;
  /** Logos to show instead: an image (`{ id, width?, height? }`), an Agent, or a list. */
  value?: unknown;
}

/**
 * `logo`: a provider's logo, the first it gives, at `--clover-logo-height`. Inside a
 * `Provider`, the logo of the provider it is drawn for; elsewhere, each of the resource's
 * providers' in turn. Its `alt` is the provider's name (else its homepage's, else "Logo"),
 * unless one is given; `alt=""` where its name is written beside it. Renders nothing
 * without a logo.
 */
export function Logo({
  of = "manifest",
  value,
  alt,
  className,
  ...rest
}: LogoProps) {
  const { t, langOf } = useCloverTranslation();
  const provider = useProvider();
  const fromRoot = useOptionalCloverSelector(
    (state) => resourceOf(state, of)?.provider as unknown,
    undefined,
  );
  const language = useOptionalClover()?.language;
  const sources =
    value !== undefined
      ? asArray(value)
      : provider
        ? [provider]
        : asArray(fromRoot);
  const logos = sources.flatMap(
    (source): { image: Json; agent: Json | null }[] => {
      if (!source || typeof source !== "object") return [];
      const agent = source as Json;
      // An image given as it is, or an Agent's first logo with an address.
      if (agent.type !== "Agent" && isImage(agent) && !agent.logo)
        return [{ image: agent, agent: null }];
      const image = asArray<Json>(agent.logo).find(isImage);
      return image ? [{ image, agent }] : [];
    },
  );
  if (!logos.length) return null;
  return (
    <>
      {logos.map(({ image, agent }, index) => {
        const name = nameOf(agent, language);
        return (
          <img
            key={`${image.id}-${index}`}
            src={image.id}
            alt={alt ?? name?.text ?? t("logo")}
            // The language its alt is in, while the alt is Clover's or the provider's.
            lang={
              alt !== undefined ? undefined : name ? name.lang : langOf("logo")
            }
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            className={join("clover-logo", className)}
            {...rest}
          />
        );
      })}
    </>
  );
}
