import type { MetaRecord } from "nextra";

/* The property parts, one IIIF descriptive property each, in the order About shows them. */
const meta: MetaRecord = {
  label: "Label",
  thumbnail: "Thumbnail",
  summary: "Summary",
  metadata: "Metadata",
  "required-statement": "RequiredStatement",
  rights: "Rights",
  homepage: "Homepage",
  "see-also": "SeeAlso",
  rendering: "Rendering",
  "part-of": "PartOf",
  id: "Id",
  provider: "Provider",
  logo: "Logo",
  value: "Value",
};

export default meta;
