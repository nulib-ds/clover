/**
 * Example of a custom component which accepts a Canvas id from
 * a Manifest.  It then renders expected PDF content by wrapping
 * in a simple iFrame (uses browser's default PDF renderer).
 *
 * One could make this as complex as they like, for flexible implementations.
 */

import type { LabeledIIIFExternalWebResource } from "@samvera/clover-iiif/image";

const PDFViewer = ({
  id,
  annotationBody,
  ...restProps
}: {
  id: string;
  annotationBody: LabeledIIIFExternalWebResource;
  restProps: {
    [key: string]: unknown;
  };
}) => {
  return (
    <>
      <p>CustomProps:</p>
      <pre style={{ paddingBottom: "1rem" }}>{JSON.stringify(restProps)}</pre>
      <div style={{ background: "hotpink", padding: "2rem" }}>
        <iframe id={id} src={annotationBody.id} width="100%" height="600" />
      </div>
    </>
  );
};

export default PDFViewer;
