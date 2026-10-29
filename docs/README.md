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

For this property, [tag-manager.json](./tag-manager.json) contains six tags,
five triggers, and thirteen variables for page views, resource opens, template changes,
reaching the install section, and section CTA clicks. In Tag Manager, open the
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

### Homepage resource opens

The homepage also queues `clover_resource_open` when a reader opens a resource:
from a shared `iiif-content` link, the Viewing field, a preset, or another choice
on the homepage that changes the resource. The Tag Manager import sends this to
GA4 as `iiif_resource_open`. It records an open request, not a successful load;
the resource may be unavailable. The initial default demo, typing in the field,
reopening the current resource, and changing the template or accent do not add
resource events or page views. Returning to a different resource does count.

Each resource event supplies:

- `page_location`: the homepage URL with only `iiif-content`, containing the
  opened resource's URL. Resource URL query parameters are kept; credentials
  and fragments are removed. For an encoded IIIF Content State, this is its
  target's Manifest or Collection URL, without the encoded annotation or its
  text. This uses GA4's built-in Page location dimension, which allows up to
  1,000 characters, instead of a custom parameter's 100-character limit.
- `resource_host`: the resource's hostname.
- `resource_input`: `url` or `content_state`.

The data layer calls the first value `resource_location`; the resource tag maps
it to GA4's `page_location`. Page-view events keep their canonical, query-free
URL. Development, previews on another origin, and `noindex` pages do not track.

After deploying the site, import the updated file using **Merge → Overwrite
conflicting tags, triggers and variables**, then Preview and **Submit → Publish**.
Open a resource and check for one `iiif_resource_open` in Analytics Realtime or
DebugView. For a report of which resources were used, create an Exploration,
filter **Event name** to `iiif_resource_open`, and use **Page location** with
**Event count**. Register `resource_host` and `resource_input` as event-scoped
custom dimensions under **Admin → Data display → Custom definitions** to group
by provider or input type. Custom dimensions can take 24–48 hours to appear.
See Google's [custom dimension guide](https://support.google.com/analytics/answer/14240153)
and [event parameter limits](https://support.google.com/analytics/answer/9267744).

### Homepage template changes

The template control below the homepage Viewer queues `clover_template_change`
when its selection changes. The import sends this to GA4 as `template_change`,
with `template` for the new selection and `previous_template` for the previous
one. Both are `default`, `document`, or `gallery`. Returning to Default counts,
even though it removes `t` from the share URL. Keyboard arrow keys and pointer
selections count in the same way.

The initial selection, including a shared `?t=document` or `?t=gallery` link,
does not count as a toggle. Choosing the current template again, opening the
menu, and changing only a resource or accent do not add template events or page
views. Tracking is limited to the public homepage, as resource tracking is.

Deploy the changes, re-import the file using **Merge → Overwrite conflicting
tags, triggers and variables**, then Preview and **Submit → Publish**. Check
for one `template_change` per selection change in Realtime or DebugView. Register
`template` and `previous_template` as event-scoped custom dimensions in Analytics
under **Admin → Data display → Custom definitions**. In an Exploration, filter
**Event name** to `template_change`, then use **Template** with **Event count**
to compare choices, or add **Previous template** to see how readers switch.

### Reaching the install section

The homepage queues `clover_install_view` when at least half of the install
command at `#install` is visible. The import sends this to GA4 as
`install_section_view`, with the homepage's canonical page context. This measures
readers reaching the install section as the page's height changes, including
keyboard scrolling and links straight to `#install`.

It fires once per homepage visit. Scrolling away and back, changing resources,
or switching templates does not count again; leaving for another page and
returning starts a new visit. It adds no page view. The same public-origin and
indexing checks apply, and the observer disconnects after recording the event.

Deploy, re-import the updated container using **Merge → Overwrite conflicting
tags, triggers and variables**, then Preview and **Submit → Publish**. Check
for one `install_section_view` when scrolling to the install command. Use its
**Event count** for visits that reached Install, and **Total users** for readers
who reached it. No additional custom dimension is needed.

### Homepage section CTA clicks

The homepage queues `clover_cta_click` when a reader activates one of its four
section links. The import sends this to GA4 as `cta_click`, with `cta_section`,
`cta_label` (the link's text, without its decorative arrow), and `link_url` (the
absolute destination without query parameters or a fragment). The page context
stays the homepage's canonical URL. The section distinguishes the two links
that say Get started:

| Section (`cta_section`) | Link (`cta_label`)   | Destination  |
| ----------------------- | -------------------- | ------------ |
| `templates`             | Get started          | `/docs`      |
| `components`            | See all … components | `/docs/body` |
| `why_clover`            | Read the docs        | `/docs`      |
| `install`               | Get started          | `/docs`      |

The components link records its current count as shown. Each activation counts,
including Enter, modified clicks, and middle clicks that open another tab.
Right clicks, opening menus, Copy, component tiles, and unmarked links do not
count. Tracking runs before Next's navigation without preventing or delaying
the link, and only on the public, indexable homepage.

After deployment, re-import using **Merge → Overwrite conflicting tags, triggers
and variables**, then Preview and **Submit → Publish**. Check for one `cta_click`
per activation in Realtime or DebugView. Register `cta_section` and `cta_label`
as event-scoped custom dimensions under **Admin → Data display → Custom
definitions**. In an Exploration, filter **Event name** to `cta_click`, then use
**CTA section** and **CTA label** with **Event count** to compare the links.

The container ID and verification token are public identifiers embedded in the
exported site. Set them as Actions variables, not account credentials. For a
local build, copy `.env.example` to `.env.local` and fill in the values. Changes
to these variables require a fresh deployment; changes within the container
require publishing it in Tag Manager.
