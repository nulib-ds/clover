import type { MetaRecord } from "nextra";

/*
 * Styling's own page is its index (Mat, 2026-11-07: "break styling page out into multiple
 * sections like composing is. landing page should feed into these sections. 3-4 sub page
 * is max. preferable 3"): the stylesheets, its example near the top, and base styling
 * ("let's move it there"), feeding into the pages under it, as Composing's does: Colors,
 * Fonts, Spacing, Classes and Variables, each named plainly (Mat, 2026-11-07: "Fonts, Colors,
 * Classes, Variables").
 */
const meta: MetaRecord = {
  // In this order (Mat, 2026-11-07: "new order should be Color, Fonts, Spacing, Classes,
  // Variables"), each named plainly ("let's be plain Just say Fonts"), Spacing apart
  // from Fonts ("break Fonts from Spacing give spacing its own page").
  colors: "Colors",
  fonts: "Fonts",
  spacing: "Spacing",
  // Apart (Mat, 2026-11-07: "Break out classes from variables. give Variables its own
  // page").
  classes: "Classes",
  variables: "Variables",
};

export default meta;
