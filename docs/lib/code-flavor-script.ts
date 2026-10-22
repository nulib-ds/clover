/*
 * Where the docs' code choice is kept, and the script that sets it on the page's root
 * before the page paints, apart from `code-flavor.ts` so the root layout, a server
 * module, can read them without React's client hooks.
 */
export const CODE_FLAVOR_KEY = "clover-docs-code";

/**
 * Run in the page's head, before it paints: the address's choice (`?code=web-components`
 * or `?code=react`, for an agent or a link, never stored), else the stored one, on the
 * root when it is not the default. Anything else is ignored.
 */
export const CODE_FLAVOR_SCRIPT = `try{var q=new URLSearchParams(location.search).get("code"),c=q==="react"||q==="web-components"?q:localStorage.getItem(${JSON.stringify(CODE_FLAVOR_KEY)});if(c==="web-components")document.documentElement.dataset.code=c}catch(e){}`;
