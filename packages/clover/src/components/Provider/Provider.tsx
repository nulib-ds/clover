import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { toPlainText } from "../../core/text";
import { type LanguageMapLike, hrefLangOf, localize } from "../../core/value";
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
import { languageProps } from "../../core/direction";

/**
 * `provider` and the `logo` on each: who provided the resource, IIIF's Agents, each with
 * its name, its logo and its homepage (Mat, 2026-10-24: "Provider and Logo components to
 * match the iiif properties").
 */

/** A layout effect in the browser, an effect on the server (where there is no layout). */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Told once a logo drawn for a provider has failed to load and left the page, so the
 * provider can see whether it still shows anything (`ProviderItem`).
 */
const LogoFailed = createContext<(() => void) | null>(null);

/** Whether an element shows anything: words, or a picture of some kind. */
const showsAnything = (element: Element) =>
  Boolean(element.textContent?.trim()) ||
  element.querySelector("img, svg, picture, video, canvas, object") !== null;

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

/** An Agent's homepage: the first with an address, and its page's language. */
const homepageOf = (
  agent: Json,
): { id: string; hrefLang?: string } | undefined => {
  const page = asArray<Json>(agent.homepage).find(isImage);
  return page ? { id: page.id, hrefLang: hrefLangOf(page) } : undefined;
};

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
          <ProviderItem
            key={agent.id ?? index}
            agent={agent}
            homepage={homepage}
          >
            {drawn}
          </ProviderItem>
        );
      })}
    </ul>
  );
}

/**
 * One provider: what `Provider` draws for it, linked to its homepage when it has one. A
 * logo in it that fails to load draws nothing (`LogoImage`); if nothing is left to show,
 * the provider draws nothing either, never an empty link, a tab stop with no name (WCAG
 * 2.4.4, 4.1.2), and a list left with none is hidden (`Provider.css`).
 */
function ProviderItem({
  agent,
  homepage,
  children,
}: {
  agent: Json;
  homepage: { id: string; hrefLang?: string } | undefined;
  children: React.ReactNode;
}) {
  // Its link, or its span where it has no homepage.
  const content = useRef<HTMLAnchorElement & HTMLSpanElement>(null);
  // The provider it was emptied for: another, given in its place, is drawn afresh.
  const [emptied, setEmptied] = useState<Json | null>(null);
  const failed = useCallback(() => {
    if (content.current && !showsAnything(content.current)) setEmptied(agent);
  }, [agent]);
  if (emptied === agent) return null;
  return (
    <li className="clover-provider-agent">
      <ProviderContext.Provider value={agent}>
        <LogoFailed.Provider value={failed}>
          {homepage ? (
            <a
              ref={content}
              href={homepage.id}
              // In a tab of its own, as the other links away from the viewer open.
              target="_blank"
              rel="noopener noreferrer"
              hrefLang={homepage.hrefLang}
              className="clover-provider-link"
            >
              {children}
            </a>
          ) : (
            <span ref={content} className="clover-provider-content">
              {children}
            </span>
          )}
        </LogoFailed.Provider>
      </ProviderContext.Provider>
    </li>
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
 * without a logo, and nothing for a logo that fails to load, never the browser's broken
 * picture.
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
          <LogoImage
            key={`${image.id}-${index}`}
            src={image.id}
            alt={alt ?? name?.text ?? t("logo")}
            // The language its alt is in, while the alt is Clover's or the provider's.
            {...languageProps(
              alt !== undefined ? undefined : name ? name.lang : langOf("logo"),
            )}
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

/**
 * One logo's picture. One that fails to load draws nothing, as a provider without a logo
 * does, never the browser's broken picture with its alt text in it, and tells the provider
 * it is drawn for (`LogoFailed`).
 */
function LogoImage({
  alt,
  onError,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const failedFor = useContext(LogoFailed);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  // Told once the picture is gone from the page, so the provider sees what is left.
  useIsomorphicLayoutEffect(() => {
    if (failed) failedFor?.();
  }, [failed, failedFor]);
  /*
   * One that failed before this script could listen (a page drawn on the server) is told
   * apart from one with no size of its own (an SVG's can have none) by decoding it, which
   * a broken picture refuses.
   */
  const check = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && !image.naturalWidth) image.decode?.().catch(fail);
    },
    [fail],
  );
  if (failed) return null;
  return (
    <img
      ref={check}
      alt={alt}
      onError={(event) => {
        onError?.(event);
        fail();
      }}
      {...rest}
    />
  );
}
