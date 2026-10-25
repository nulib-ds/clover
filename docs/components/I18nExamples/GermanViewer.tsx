"use client";

import Viewer from "docs/components/DynamicImports/Viewer";
import { initCloverI18n } from "@samvera/clover-iiif/i18n";
import { useEffect } from "react";
import { EXAMPLE, example } from "docs/lib/example";

const DEMO_MANIFEST =
  "https://iiif.io/api/cookbook/recipe/0025-newspaper-article-index/manifest.json";

const viewerOptions = {
  informationPanel: {
    open: true,
    defaultTab: "manifest-contents",
  },
};

const GermanViewer: React.FC = () => {
  useEffect(() => {
    initCloverI18n({
      lng: "de",
      fallbackLng: ["de", "en"],
      resources: {
        de: {
          clover: {
            imageViewerClose: "Bildbetrachter schließen",
            sliderNext: "Nächstes Element",
            informationPanelTabsAbout: "Über",
            informationPanelTabsContents: "Inhalt",
            informationPanelTabsSearch: "Suche",
          },
        },
      },
    });
  }, []);

  return (
    <div {...example(EXAMPLE)}>
      <Viewer iiifContent={DEMO_MANIFEST} options={viewerOptions} />
    </div>
  );
};

export default GermanViewer;
