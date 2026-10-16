import React, { forwardRef, useEffect } from "react";

import { Items } from "../Items/Items";
import { Label } from "../Label/Label";
import { Homepage, Id, Summary } from "../Primitives/Primitives";
import { partOfCollection } from "../../core/selectors";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { join } from "../../lib/classnames";
import { useClover, useCloverSelector } from "../../react/context";

export interface CollectionProps extends React.HTMLAttributes<HTMLElement> {
  /** The level of its headings: the Collection's label, Homepage and its address. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

/**
 * The Collection the Manifest was reached through, or else the first it is `partOf`, as
 * About describes a Manifest: its label and summary, its members as a list (each opening
 * its Manifest in the Root, `Items of="members"`), then its homepage and its own address.
 * The `InformationPanel`'s Collection section is this part.
 *
 * A `partOf` Collection is fetched only when the part first shows (the panel mounts a
 * section's content then), never ahead of the reader; until it arrives, what the
 * Manifest's `partOf` says of it is shown. Renders nothing when there is no Collection.
 */
export const Collection = forwardRef<HTMLDivElement, CollectionProps>(
  function Collection({ headingLevel = 3, className, ...rest }, ref) {
    const { clover } = useClover("Collection");
    const { t, langOf } = useCloverTranslation();
    const collection = useCloverSelector((state) => state.collection);
    const partOf = useCloverSelector((state) =>
      partOfCollection(state.manifest),
    );
    useEffect(() => {
      if (!collection && partOf?.id) void clover.openCollection(partOf.id);
    }, [clover, collection, partOf]);
    const shown = (collection ?? partOf) as Record<string, any> | undefined;
    if (!shown) return null;
    const Heading = `h${headingLevel}` as React.ElementType;
    const homepage = shown.homepage as unknown[] | undefined;
    return (
      <div
        ref={ref}
        className={join("clover-about clover-collection", className)}
        {...rest}
      >
        <Label
          as={Heading}
          label={shown.label}
          className="clover-collection-title"
        />
        <Summary value={shown.summary} className="clover-about-summary" />
        <Items of="members" layout="list" />
        {Array.isArray(homepage) && homepage.length > 0 && (
          <section className="clover-about-section">
            <Heading
              className="clover-about-heading"
              lang={langOf("aboutHomepage")}
            >
              {t("aboutHomepage")}
            </Heading>
            <Homepage value={homepage as never} />
          </section>
        )}
        <section className="clover-about-section">
          <Heading
            className="clover-about-heading"
            lang={langOf("aboutCollection")}
          >
            {t("aboutCollection")}
          </Heading>
          <Id value={shown.id} />
        </section>
      </div>
    );
  },
);
