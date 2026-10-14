import * as IIIF from "@samvera/clover-iiif/primitives";
import ReactDOMServer from "react-dom/server";

const LabelExample = () => {
  return (
    <IIIF.Label label={{ none: ["Crossing the Pend d'Oreille - Kalispel"] }} />
  );
};

const RenderedHTML = () => {
  return ReactDOMServer.renderToString(<LabelExample />);
};

export { LabelExample, RenderedHTML };
