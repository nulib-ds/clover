/*
 * Nextra 4 has no `raw` layout: its `full` layout holds a page to the docs' 90rem
 * (`--nextra-content-width`) and pads its article. A page that runs the window's width,
 * as it did on Nextra 2's raw layout, renders these rules in a `<style>` of its own, so
 * they hold while it is on the page and go with it: the full width, no padding round the
 * article, and none of the empty room Nextra keeps under it (where "Last updated" would
 * be; Mat, 2026-10-21: a few rem, no more). No `:has()` on the page's ancestors,
 * which can make a browser restyle the whole document whenever anything is added to it. Unlayered, they outweigh Nextra's utilities, which are layered.
 */
export const FULL_WIDTH = `
body > div[class~="x:mx-auto"][class~="x:flex"] { max-width: none; }
body > div[class~="x:mx-auto"][class~="x:flex"] > article { padding: 0; }
body > div[class~="x:mx-auto"][class~="x:flex"] > article > div:is([class~="x:mt-16"], [class~="x:mt-12"]):empty { display: none; }
`;
