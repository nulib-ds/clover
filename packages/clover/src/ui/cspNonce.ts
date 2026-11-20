/**
 * The nonce a page's Content Security Policy gives the styles Clover writes, where the
 * page names one: on `<meta property="csp-nonce">` (as Vite writes it), else its
 * scripts' own. Empty where it names none. The elements' registry gives it every
 * `<style>` it writes (`web-components/styles.ts`), and `adoptSheet` its `<style>` where
 * a browser cannot adopt a sheet.
 */
export function cspNonce(doc: Document): string {
  return (
    doc.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce ||
    doc.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ||
    ""
  );
}
