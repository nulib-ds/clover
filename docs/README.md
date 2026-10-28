# Documentation site

The site uses Next.js 16 and Nextra 4. Pages are MDX in `content/`, ordered by
`_meta.ts` files. The app frame is in `app/`; this directory holds its components,
helpers, and styles. The package is in `packages/clover`.

## Publishing and search

The public site is <https://clover.iiif.library.northwestern.edu/>. GitHub Actions
builds and deploys it to S3 behind CloudFront after the Tests workflow passes on
`main`, or through **Deploy to S3 → Run workflow**. The build reads the public URL
from the `DOCS_SITE_URL` Actions variable and serves the site at the host's root.
The infrastructure is in `terraform/`.
The docs workflow uploads site files; changes to CloudFront's routing function
also need to be applied through Terraform.

Public pages are rendered as HTML, with titles, descriptions, canonical links,
and structured data. The build generates `/sitemap.xml`, with each page's last
committed change, and `/robots.txt`, which permits crawling and links the sitemap.
Pages marked `searchable: false` and `/test/` pages have `noindex` metadata and stay
out of the sitemap. Crawlers are kept out of `/mocks/` and `/test/`.
`noimageindex` keeps the examples' sample images out of image search; the
documentation itself can be indexed.
Every docs build checks the exported pages against the sitemap and fails if a
public page is missing, has `noindex`, or lacks its title, description, or canonical URL.

## Google Search Console

1. In [Search Console](https://search.google.com/search-console), add a
   **URL-prefix** property for `https://clover.iiif.library.northwestern.edu/`.
   A Domain property is also possible when you have DNS access.
2. Choose **HTML file** verification. Google's downloaded file is kept unchanged
   at `public/google821f438205104875.html` so deployments serve it at
   `https://clover.iiif.library.northwestern.edu/google821f438205104875.html`.
3. Deploy the site and open that URL to check that the file is available, then
   click **Verify** in Search Console. Keep the file in `public/` after
   verification; Google checks it again later.
4. In **Sitemaps**, submit
   `https://clover.iiif.library.northwestern.edu/sitemap.xml`. Use **URL inspection**
   to check the homepage and a documentation page, and request indexing.

**HTML tag** verification is also supported: set the `GOOGLE_SITE_VERIFICATION`
GitHub Actions variable to the tag's `content` value and deploy. The build puts
it in the homepage's `<head>`. This is a separate method; the HTML file above
does not need that variable.

See Google's [ownership verification instructions](https://support.google.com/webmasters/answer/9008080)
and [sitemap submission guide](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
Submitting a sitemap helps discovery; it does not guarantee indexing.

## Google Tag Manager and Analytics

This site's container is `GTM-NFKN3GMX` and its GA4 measurement ID is
`G-TYFDC4VG73`. The repository variable `NEXT_PUBLIC_GTM_ID` is already set to
this container.

For this property, [tag-manager.json](./tag-manager.json) contains the two tags,
one trigger, and five variables described below. In Tag Manager, open the
container, then **Admin → Import Container**, select the file and an existing
workspace, and choose **Merge → Overwrite conflicting tags, triggers and
variables**. The entries are named with `Clover -`; merging by these names also
lets the file update its own entries on a later import. Review the import
preview and confirm. This saves the configuration in the workspace; use Preview
and publish it as described in step 7 after the website changes are deployed.
See Google's [container import instructions](https://support.google.com/tagmanager/answer/6106997).

For another property, update the `Clover - GA4 measurement ID` variable in the
file, or configure the tags manually:

1. In [Tag Manager](https://tagmanager.google.com/), create or select a **Web**
   container for this site. Copy its **Container ID** (`GTM-…`).
2. In the same GitHub Actions variables, add `NEXT_PUBLIC_GTM_ID`. Deploy the
   site. The site loads the container itself; no additional Google script is
   needed. An unset ID leaves Tag Manager off, and development does not load it.
3. In [Google Analytics](https://analytics.google.com/), create or select a GA4
   property and add a **Web** data stream for the public URL. Turn off
   **Enhanced measurement** for this stream. The site supplies page views;
   automatic history tracking would duplicate them and count changes inside
   the example viewer. See Google's
   [manual page-view instructions](https://developers.google.com/analytics/devguides/collection/ga4/views).
4. In Tag Manager, create three **Data Layer Variables**, using Version 2,
   with these data layer variable names: `page_location`, `page_title`,
   `page_referrer`.
5. Add a **Google tag** for the stream's measurement ID (`G-…`), triggered on
   **Initialization — All Pages**. In its configuration parameters, set
   `send_page_view` to the boolean `false` (use a Custom JavaScript variable
   returning `false`), and `page_location`, `page_title`, and `page_referrer`
   to the matching Data Layer Variables. No separate Analytics script is needed
   in this repository.
6. Add a **Custom Event** trigger named `clover_page_view`. Add a **Google
   Analytics: GA4 Event** tag for the same measurement ID, with event name
   `page_view`. Set its event parameters `page_location`, `page_title`, and
   `page_referrer` to the matching Data Layer Variables. Use the
   `clover_page_view` trigger. Do not add an All Pages or History Change trigger
   to this event tag.
7. Use Tag Manager's **Preview** and Tag Assistant on the public site. Check
   that a page load and navigation to another docs page each fire the GA4 event
   once, and that changing the demo's resource does not. **Submit** and
   **Publish** the container, then check Analytics **Realtime**.

The site queues `clover_page_view` on its configured public origin, including
client navigation. Each event contains a page URL, title, and referrer. Query
strings and fragments are omitted from these URLs, so a reader's IIIF resource
is not in the page-view payload. Pages with `noindex` metadata are skipped.
The container controls any additional data collection and tags.

The container ID and verification token are public identifiers embedded in the
exported site. Set them as Actions variables, not account credentials. For a
local build, copy `.env.example` to `.env.local` and fill in the values. Changes
to these variables require a fresh deployment; changes within the container
require publishing it in Tag Manager.
