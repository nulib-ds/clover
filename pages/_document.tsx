import { Head, Html, Main, NextScript } from "next/document";

/*
 * The page's language, for screen readers and translation tools (WCAG 3.1.1). Nextra's
 * Content-Language meta does not count, and Next's `i18n` option does not work with a
 * static export. The site is all in English.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
