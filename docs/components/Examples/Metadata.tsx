import * as IIIF from "@samvera/clover-iiif/primitives";
import ReactDOMServer from "react-dom/server";

const MetadataExample = () => {
  return (
    <IIIF.Metadata
      metadata={[
        {
          label: {
            none: ["Alternate Title"],
          },
          value: {
            none: [
              "Volume 7. The Yakima. The Klickitat. Salishan tribes of the interior. The Kutenai",
            ],
          },
        },
        {
          label: {
            none: ["Contributor"],
          },
          value: {
            none: [
              "Curtis, Edward S., 1868-1952 (Author)",
              "Curtis, Edward S., 1868-1952 (Illustrator)",
              "Curtis, Edward S., 1868-1952 (Publisher)",
              "Hodge, Frederick Webb, 1864-1956 (Editor)",
              "Roosevelt, Theodore, 1858-1919 (Author of introduction, etc.)",
              "Morgan, J. Pierpont (John Pierpont), 1837-1913 (Patron)",
              "John Andrew & Son (Printmaker)",
              "Plimpton Press (Publisher)",
            ],
          },
        },
        {
          label: {
            none: ["Cultural Context"],
          },
          value: {
            none: [
              "Content on this site is drawn from a historical source which includes materials that may contain offensive images or language reflecting the nature of Settler Colonialism in America. Such materials should be viewed in the context of the time and place in which they were created. The images and text in this site are presented as specific, original artifacts recording the attitudes, perspectives and beliefs of a different era. Northwestern University does not endorse the views expressed in this collection which may contain images and text offensive to some researchers.",
            ],
          },
        },
        {
          label: {
            none: ["Date"],
          },
          value: {
            none: ["1910"],
          },
        },
        {
          label: {
            none: ["Department"],
          },
          value: {
            none: ["Charles Deering McCormick Library of Special Collections"],
          },
        },
        {
          label: {
            none: ["Dimensions"],
          },
          value: {
            none: ["12.1 x 18.6 cm [image size], 16 x 21 cm [plate size]"],
          },
        },
        {
          label: {
            none: ["Genre"],
          },
          value: {
            none: ["photomechanical prints", "photogravures (prints)"],
          },
        },
        {
          label: {
            none: ["Last Modified"],
          },
          value: {
            none: ["2023-04-24T19:19:13.647175Z"],
          },
        },
        {
          label: {
            none: ["Language"],
          },
          value: {
            none: ["English"],
          },
        },
        {
          label: {
            none: ["Location"],
          },
          value: {
            none: ["Washington (State)--Seattle", "Massachusetts--Norwood"],
          },
        },
        {
          label: {
            none: ["Materials"],
          },
          value: {
            none: ["1 photogravure : brown ink"],
          },
        },
        {
          label: {
            none: ["Rights Statement"],
          },
          value: {
            none: ["No Copyright - United States"],
          },
        },
        {
          label: {
            none: ["Series"],
          },
          value: {
            none: [
              "Edward S. Curtis's The North American Indian--Volume 7. The Yakima. The Klickitat. Salishan tribes of the interior. The Kutenai",
            ],
          },
        },
        {
          label: {
            none: ["Source"],
          },
          value: {
            none: [
              "The North American Indian (1907-1930) v.07, The Yakima. The Klickitat. Salishan tribes of the interior. The Kutenai ([Seattle] : E.S. Curtis ; [Cambridge, Mass. : The University Press], 1911), Facing page 100",
            ],
          },
        },
        {
          label: {
            none: ["Subject"],
          },
          value: {
            none: [
              "Washington (State)",
              "Montana",
              "Idaho",
              "Indigenous peoples of the Northwest Plateau",
              "Alberta",
              "Yakama Indians",
              "Klikitat Indians",
              "Salishan Indians",
              "Kootenai Indians",
              "Salish Indians",
              "Kalispel Indians",
              "Spokane Indians",
            ],
          },
        },
        {
          label: {
            none: ["Technique"],
          },
          value: {
            none: ["photomechanical processes", "photogravure (process)"],
          },
        },
      ]}
    />
  );
};

const RenderedHTML = () => {
  return ReactDOMServer.renderToString(<MetadataExample />);
};

export { MetadataExample, RenderedHTML };
