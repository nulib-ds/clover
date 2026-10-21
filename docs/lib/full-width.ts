/*
 * Nextra 4 has no `raw` layout: its `full` layout holds a page to the docs' 90rem
 * (`--nextra-content-width`) and pads its article. A page that runs the window's width,
 * as it did on Nextra 2's raw layout, renders these rules in a `<style>` of its own, so
 * they hold while it is on the page and go with it. No `:has()` on the page's ancestors,
 * which can make a browser restyle the whole document whenever anything is added to it. Unlayered, they outweigh Nextra's utilities, which are layered.
 */
export const FULL_WIDTH = `
body > div[class~="x:mx-auto"][class~="x:flex"] { max-width: none; }
body > div[class~="x:mx-auto"][class~="x:flex"] > article { padding: 0; }
`;
