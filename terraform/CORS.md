# CORS on the docs site

The docs site publishes IIIF resources for any viewer to open: the mocks (`/mocks/…`) and
the 3.x fixtures (`/manifest/…`, `/annotations/…`). A viewer on another origin needs
`Access-Control-Allow-Origin` on each of them, which the distribution's response headers
policy gives: `Managed-CORS-with-preflight-and-SecurityHeadersPolicy` (`main.tf`).

## Why the preflight policy

Until 2026-11-16 the site used `Managed-CORS-and-SecurityHeadersPolicy`, and no browser on
another origin could load the mocks or fixtures, though `curl` could. That policy adds its
CORS header only to a request CloudFront takes for a simple one, with no header beyond the
CORS-safelisted ones and those a browser always sets. Chrome, Firefox and Safari now send
`Priority` with every `fetch()` (`u=1, i`, `u=0`, `u=3, i`), so they never got it, and a
preflight (`OPTIONS`) reached S3 and was answered with the 404 page. The preflight policy
answers both. It was switched in the console first, then here to match, so an apply keeps
it.

## Check it

Always with a browser's headers, never `Origin` alone, which passed all along:

```bash
curl -sS -o /dev/null -D - -H "Origin: https://example.org" -H "Priority: u=1, i" https://clover.iiif.library.northwestern.edu/mocks/paged/manifest.json | grep -i access-control
```

It prints `access-control-allow-origin: *`.
