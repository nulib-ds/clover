import * as IIIF from "@samvera/clover-iiif/primitives";
import ReactDOMServer from "react-dom/server";

const ThumbnailImageExample = () => {
  return (
    <IIIF.Thumbnail
      thumbnail={[
        {
          id: "https://api.dc.library.northwestern.edu/api/v2/works/0488dfa4-6e40-4484-9f19-18f54b35a019/thumbnail",
          type: "Image",
          format: "image/jpeg",
          height: 300,
          width: 300,
        },
      ]}
    />
  );
};

const ThumbnailVideoExample = () => {
  return (
    <IIIF.Thumbnail
      thumbnail={[
        {
          id: "https://meadow-streaming.rdc.library.northwestern.edu/31/ea/94/58/-6/f1/4-/45/48/-9/30/b-/62/c3/db/19/2e/b6/1949_NU-Rosebowl-vs-Cal.m3u8#t=500,530",
          type: "Video",
          format: "video/mp4",
          width: 300,
          height: 300,
          duration: 30,
        },
      ]}
    />
  );
};

const RenderedHTML = ({ children }) => {
  return ReactDOMServer.renderToString(children);
};

export { ThumbnailImageExample, ThumbnailVideoExample, RenderedHTML };
