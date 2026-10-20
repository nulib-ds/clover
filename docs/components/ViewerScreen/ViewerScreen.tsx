"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { resourceByKey } from "docs/components/Playground/playground-config";
import styles from "docs/components/ViewerScreen/ViewerScreen.module.css";
import { loadMapWorker } from "docs/lib/map-worker";
import { useRouter } from "docs/lib/router";

/**
 * The Viewer's Default template alone on the screen, for trying it on a phone: nothing of
 * the docs around it, its height the screen's (`100dvh`, so it follows a browser bar that
 * comes and goes). `?r=<key>` opens one of the playground's resources (`book`, `map`,
 * `film`…), `?iiif-content=<url>` any other; the playground's Collection otherwise.
 */
const Viewer = dynamic(
  () =>
    import("@nulib/clover").then(
      (clover) => clover.default as React.ComponentType<any>,
    ),
  { ssr: false },
);

const ViewerScreen: React.FC = () => {
  const router = useRouter();
  const [resource, setResource] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const given = router.query["iiif-content"];
    const key = String(router.query.r ?? "collection");
    const entry = resourceByKey(key) ?? resourceByKey("collection");
    const address =
      typeof given === "string" && given
        ? given
        : entry?.mock
          ? new URL(
              `${router.basePath}/mocks/${entry.resource}`,
              location.origin,
            ).href
          : (entry?.resource ?? null);
    // Any resource may have places, so the map's worker is set before it opens.
    loadMapWorker().then(() => setResource(address));
  }, [router.isReady, router.query, router.basePath]);

  return (
    <div className={styles.screen}>
      {resource && <Viewer key={resource} iiifContent={resource} />}
    </div>
  );
};

export default ViewerScreen;
