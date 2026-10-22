import React, { forwardRef, useEffect } from "react";
import { useUniqueId } from "../../ui/useUniqueId";

import { Items } from "../Items/Items";
import { Label } from "../Label/Label";
import { Homepage, Id, Summary } from "../Primitives/Primitives";
import { partOfCollection } from "../../core/selectors";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";
import { titled } from "../../ui/heading";

export interface CollectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The level of its headings: the Collection's label, Homepage and its address. Default
   * 3. Past 6 each is not a heading, and names what it heads instead (`ui/heading.ts`).
   */
  headingLevel?: number;
}

/**
 * The Collection the Manifest was reached through, or else the first it is `partOf`, as
 * About describes a Manifest: its label and summary, its members as a list (each opening
 * its Manifest in the Root, `Items of="members"`), then its homepage and its own address.
 * The `Panel`'s Collection section is this part.
 *
 * A `partOf` Collection is fetched only when the part first shows (the panel mounts a
 * section's content then), never ahead of the reader; until it arrives, what the
 * Manifest's `partOf` says of it is shown. Renders nothing when there is no Collection.
 */
export const Collection = forwardRef<HTMLDivElement, CollectionProps>(
  function Collection({ headingLevel = 3, className, ...rest }, ref) {
    const { clover } = useClover("Collection");
    const { t, langOf } = useCloverTranslation();
    const id = useUniqueId();
    const collection = useCloverSelector((state) => state.collection);
    const partOf = useCloverSelector((state) =>
      partOfCollection(state.manifest),
    );
    useEffect(() => {
      if (!collection && partOf?.id) void clover.openCollection(partOf.id);
    }, [clover, collection, partOf]);
    const shown = (collection ?? partOf) as Record<string, any> | undefined;
    if (!shown) return null;
    const homepage = shown.homepage as unknown[] | undefined;
    // The label heads the whole part; each section's title, its own.
    const label = titled(headingLevel, `${id}-label`);
    const section = (titleKey: string, part: React.ReactNode) => {
      const {
        as: Title,
        title,
        group,
      } = titled(headingLevel, `${id}-${titleKey}`);
      return (
        <section className="clover-about-section" {...group}>
          <Title
            className="clover-about-heading"
            lang={langOf(titleKey)}
            {...title}
          >
            {t(titleKey)}
          </Title>
          {part}
        </section>
      );
    };
    return (
      <div
        ref={ref}
        className={join("clover-about clover-collection", className)}
        {...(shown.label ? label.group : null)}
        {...rest}
      >
        <Label
          as={label.as}
          label={shown.label}
          className="clover-collection-title"
          {...label.title}
        />
        <Summary value={shown.summary} className="clover-about-summary" />
        <Items of="members" layout="list" />
        {Array.isArray(homepage) &&
          homepage.length > 0 &&
          section("aboutHomepage", <Homepage value={homepage as never} />)}
        {section("aboutCollection", <Id value={shown.id} />)}
      </div>
    );
  },
);
