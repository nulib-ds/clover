# Helpers for agents (WebMCP): the plan

The docs site tells agents what Clover is through `llms.txt`, each page's Markdown and the
elements' manifest. WebMCP lets a page offer tools as well, which an agent in the reader's
browser calls. The goal (Mat, 2026-10-25 and 2026-10-26): tools about Clover itself, what
it is, what it handles across the IIIF specifications and how to build with it. Helpers
that guide implementation come first, above all ones that put together a composed Clover
example as they go. They never deal in the examples' sample material: the scholarly
content of a resource is not what they are for.

The tools are lean (Mat, 2026-10-26: "let's also try to be lean and not overload tools").
They are written to change over time as Clover's templates, components and helpers grow
(Mat, 2026-10-26). The section "Built to grow" says how.

`nulib-labs/clover-mcp`, the MCP server written for 3.x, is context only. This work does
not lean on it, and updating it is a separate piece of work.

## What holds throughout

- **WCAG 2.2 AA.** What a tool draws is an example on the page, marked as one
  (`docs/lib/example.ts`), with the same names, keyboard and focus as the docs' own. A tool
  never moves focus or scrolls the page unless the reader asked for that.
- **Clover, not the samples.** A tool reads a resource's structure (its types, formats,
  services and properties present), never its words, and says what it read is untrusted
  data. Its answers are about Clover: parts, props, code, docs and sizes.
- **Read from the source.** Everything a tool says comes from what Clover already states:
  the element specs, the docs' menus, `sizes.json` and the docs' own code writer. One small
  table is kept by hand, and tests hold it to the rest (see "Built to grow").
- **Both flavors.** Code comes in React or as web components, as each docs example does,
  from the writer every live example uses (`docs/lib/live-code.ts`).
- **The site's figures.** A size is `sizes.json`'s, never written in by hand.
- **Bounded.** A tool's answer has a size limit. Lists name things; a tool gives detail
  only when asked for it.

## The tools

Three tools. Each one does a step of building with Clover.

| Tool                    | What it does                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clover_suggest_layout` | From needs ("3D", "captions", "a map"), a resource's address, or both: the parts that fit, each with its props and its docs, and a layout to start from. With an address, it reads the resource's structure only (its containers and formats, which services and properties it has) and marks it untrusted. It also answers "does Clover handle…?", and gives a part's props. Read-only. |
| `clover_compose_layout` | A layout, as JSON (the Viewer in a template, or parts in a Root), checked and written as code: the whole module, how to install it, each part's docs and what it adds to a page. Where the layout does not hold, it says what is wrong at each place and how to fix it. Read-only.                                                                                                       |
| `clover_preview_layout` | Draws that layout live, over a resource or a sample that shows what was asked for, in the page's example frame. It knows the page it is on: on a part's page it starts from that part, so "show Rights" on the Rights page needs nothing else (Mat, 2026-10-26: "would show_capability not help for primitives? context of each page?"). It changes the page, never anything else.       |

Cut, and why (Mat, 2026-10-26):

- **`search_docs`, `get_page`.** `llms.txt`, `llms-full.txt` and the Markdown beside every
  page already give agents the docs, with no WebMCP.
- **`list_parts`, `check_iiif_support`, `describe_resource`.** `suggest_layout` answers all
  three, and `compose_layout`'s errors list the props a part has.
- **`check_code`.** `compose_layout` writes code that holds. An agent composes again rather
  than checking what it wrote by hand, and a JSX parser in the browser would weigh more
  than it helps.
- **`set_template`, `open_in_viewer`.** A Viewer layout is one that `compose_layout` writes
  and `preview_layout` draws.
- **`get_viewer_state`.** It would hand agents the samples' content.
- **`show_capability`.** It is folded into `preview_layout`. A capability's sample and a
  page's own part start a preview.

Each tool's schema stays small, since every agent on the page reads it: part and template
names, not every prop. Props come back from `suggest_layout`, or in `compose_layout`'s
errors. `compose_layout` writes one flavor per call, React unless the call asks for HTML.

### A layout, and its code

What an agent hands `clover_compose_layout`: the Viewer in a template, or parts in a
Root, in the page's own `div`, `section`, `aside`, `header`, `footer` and `nav` where it
needs them. Props are named as React names them; HTML's names are read as React's, with a
note. Every name and value is checked against Clover's own: a part or prop Clover lacks
gets "Did you mean…" and the list of what there is, a value of the wrong kind says what
it takes, a part that needs a Root must be in one, and a prop of another template is
named as that template's. Where a layout does not hold, it says what is wrong at each
place and writes no code.

```json
{
  "resource": "https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json",
  "parts": [
    { "part": "Label", "props": { "as": "h2" } },
    { "part": "Body" },
    { "part": "Items", "props": { "layout": "grid" } }
  ]
}
```

It writes this, as the docs' examples are written, and the same as HTML of the web
components when asked (`docs/lib/compose/webmcp-example.test.ts` holds it to what
`compose` writes):

```jsx
import * as Clover from "@nulib/clover";
import "@nulib/clover/styles.css";

<Clover.Root iiifContent="https://iiif.io/api/cookbook/recipe/0009-book-1/manifest.json">
  <Clover.Label as="h2" />
  <Clover.Body />
  <Clover.Items layout="grid" />
</Clover.Root>;
```

`clover_suggest_layout` reads a resource without the reader's cookies
(`credentials: "omit"`) or the page's address (`referrerPolicy: "no-referrer"`): its
origin still goes with a request to another site, as CORS needs. It waits `WAIT` (10
seconds) and reads `MOST_BYTES` (8 MB), in `read-resource.ts`.

### WebMCP as the draft says (2026-10-20)

Per the W3C Web Machine Learning Community Group's draft: `document.modelContext`
(formerly `navigator.modelContext`, so a page feature-detects both), and
`registerTool(tool, { signal })`, which returns a promise, rejected (`InvalidStateError`)
for a name already taken. Aborting the signal unregisters the tool. A tool has a `name`
(1 to 128 of ASCII letters, digits, `_`, `-` and `.`), a `title`, a `description`, an
`inputSchema` (JSON Schema), `execute(input, { signal })` and `annotations`
(`readOnlyHint`, `untrustedContentHint`, `consequentialHint`). `execute` may answer with
any value, which is serialized as JSON; a tool reports its own failures inside it. It
needs a secure context, and the `tools` Permissions Policy is `'self'` by default.
Chrome has an origin trial (149 to 156, a token in a `meta` tag); Edge 147 has it behind
a flag. Checked against the draft again at phase 2 (October 26, 2026).

## Built to grow

The helpers grow with Clover, mostly by themselves. The engine is `docs/lib/compose/`:
plain modules, no React and no DOM, loaded the first time a tool is called. It reads
these sources:

| What                                    | Read from                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The parts, their props and descriptions | The element specs (`packages/clover/src/web-components/specs/`), which every part has for its web component.                                 |
| A prop's HTML name                      | The same spec (`attributeFor`), shared with the docs' live examples (`LiveExample.tsx`).                                                     |
| The templates                           | The Viewer's spec: its `template` words, its description ("Default (…), Document (…)"), and each prop's opening ("Default and Document: …"). |
| Where a prop is read                    | Its description's opening: "Alone: …" or "Inside a root: …".                                                                                 |
| Each part's page                        | The docs' menus (`content/docs/_meta.ts`, `primitives/_meta.ts`).                                                                            |
| What a part or template adds to a page  | `packages/clover/build/sizes.json`, through `docs/lib/sizes.ts`.                                                                             |
| The IIIF property a property part reads | Its name (`RequiredStatement` reads `requiredStatement`).                                                                                    |
| The code                                | `docs/lib/live-code.ts`, the docs' own writer; its HTML is held to `jsx-to-html.mjs`'s by a test.                                            |

Kept by hand, each small and each held by a test that says what to add:

- `docs/lib/compose/capabilities.ts`: what Clover handles, in a reader's words ("3D",
  "captions"), the parts for each, and a sample (`part-demo-resources.ts`).
- In `catalog.ts`: `ENTRY` (a part from another entry point: `Map`), `INSIDE` (a part
  that sits in another: a `Tab` in a `Panel`), `DOCUMENTED_ON` (a part with no page of its
  own).

When Clover grows:

- **A new part.** Give it its element spec, as every part has (WEB-COMPONENTS.md), and it
  is in the catalog. Give it a page in the menu, or a line in `DOCUMENTED_ON`, and a line
  in `capabilities.ts`. If it sits only inside another part, add it to `INSIDE`. If it
  comes from a new entry point, add it to `ENTRY` and that entry's source to
  `catalog.test.ts`. The tests fail until each is done.
- **A new template.** Add its word to the Viewer spec's `template`, name it in the spec's
  description ("Name (what it is)"), open each of its props' descriptions with its name,
  and measure it (`<word>TemplateGzip` in `sizes.json`).
- **A new prop.** Its spec's attribute is enough. Open its description with "Alone:" or
  "Inside a root:" where it is read in one place only. A prop only code can give (a
  function) goes in the spec's `properties`, and a layout leaves it out with a note.
- **A new format or feature.** An entry in `capabilities.ts`, with a sample that has it.
- **A new helper.** Fold it into one of the three tools first: a new input, or a new
  answer. Add a tool only when none of them fits, with Mat's agreement. A tool is a name
  in `TOOL_NAMES` and a definition in `agentTools()` (`docs/lib/webmcp/tools.ts`), and a
  case in `run.ts`, which does its work through the engine; `tools.test.ts` fails while
  a name has no runner. Its description and schema come from the catalog, never from
  lists written into the tool. It registers itself, and `llms.txt` lists it.
- **A new word for a need.** Add it to its capability's `words` in `capabilities.ts`.
- **A new tool, or a new answer.** Check it in the docs' e2e suite
  (`e2e/specs/agent-tools.spec.ts`), and say what a reader can now ask, in a reader's
  words, on Build with an agent (`content/docs/agents.mdx`), which never names the
  tools or how they work: that is this file's.
- **A new example frame.** A component that draws a docs example's `figure` takes
  `usePreviewHost()` (`docs/components/Clover4/PreviewHost.tsx`): its `ref` on the
  figure, and `<AgentPreview shown={preview} />` in place of its own content while
  `preview` is set. Then a preview can be drawn in it whenever it is a page's first.
- **Something new to find in a resource** (a format, a service, a motivation). Read it
  in `structure.ts` as a count, or as a token checked against what IIIF defines (never
  a string as the resource wrote it), and say in `hasOf` (`suggest.ts`) which capability
  it shows, with its evidence in Clover's words. `structure.test.ts`'s resource of
  marked words must still come through clean.

## Phases

1. **The engine** (`docs/lib/compose/`): the catalog, the capability table, the layout
   and its checks, and the code in both flavors, with tests. Done October 26, 2026.
2. **Registration, and the two read-only tools.** `docs/lib/webmcp/`: one client
   component in the root layout. It feature-detects `modelContext`, registers
   `clover_compose_layout` and `clover_suggest_layout` (needs only), and loads the engine
   on the first call. Then the tools go into `llms.txt`, with their names and what each
   does. Done October 26, 2026.
3. **`suggest_layout` from a resource.** It reads the structure only, with a size limit
   and a timeout, marked untrusted. Done October 26, 2026, with a reader of its own
   (`structure.ts`, by `type` and `motivation` in any Presentation version) rather than
   `@iiif/parser`, and the package's own content-state decoding.
4. **`preview_layout`.** It draws into the page's example frame: the Composing page's
   first example, or a part page's live example, starting from that page's part. Its
   sample comes from `capabilities.ts`. It is checked by keyboard and against the
   accessibility tree, as every example is. Done October 26, 2026.
5. **Discovery and proof.** The origin trial's token, end-to-end tests with a stub
   `modelContext`, and a page under Contribute that says what the tools do. Done
   October 26, 2026, but for the token, which is Mat's to register.

## Phase 1 progress

Built (October 26, 2026), uncommitted:

- `docs/lib/compose/catalog.ts`: the parts (every element but the Viewer and the Root:
  40), the Root's and the Viewer's props, the templates and their own props, each part's
  page, its size in either flavor, what it handles, and what only code can give it.
- `docs/lib/compose/capabilities.ts`: 18 capabilities, besides the 13 IIIF properties the
  property parts read.
- `docs/lib/compose/layout.ts`: the layout (`{ viewer }`, or `{ root, parts }`, with the
  page's own `div`, `section`, `aside`, `header`, `footer` and `nav` to arrange parts in),
  its JSON Schema, and its checks. Unknown names get "Did you mean…". A prop written as
  HTML writes it is read under its React name. Values are checked against their type,
  their words and their least value. A part that needs a Root must be in one, and a
  `Tab` must be in a `Panel`. A template prop must be its template's, and a prop read in
  one place only gets a note when placed elsewhere. What only code gives is left out,
  with a note.
- `docs/lib/compose/write.ts`: `compose(layout, flavor)`. It returns the code (a whole
  module, its imports and resource written out), the install, and each part's docs and
  size, or the issues found.
- `attributeFor` is shared with `LiveExample.tsx`, and `pageAddress` was added to
  `live-code.ts`.
- 31 tests: the catalog against the specs, menus, entry points and pages; the checks; and
  the code, whose HTML matches what `jsx-to-html.mjs` makes of its React.

## Phase 2 progress

Built (October 26, 2026), uncommitted:

- `docs/lib/compose/suggest.ts`: `suggest({ needs })`. Each need is matched, in a
  reader's words or by name, to a capability (its name or its `words`), a IIIF property,
  or a part: as a whole, or by the longest word inside it ("deep zoom images" is
  `image`). It answers with each part's props (their types as TypeScript writes them),
  docs and sizes, and a layout to start from that `compose` checks and writes. Body comes
  first where a need follows the view. A Split arranges the rest, as Composing's example
  does. A part that sits in another is placed by the other. What takes the page's own
  content (Value's text, a Tip's button) is listed, not placed. A need it cannot match
  gets "Did you mean…". With no needs, it lists all 31 capabilities.
- `docs/lib/webmcp/tools.ts`: the two tools' names, titles, descriptions and schemas,
  written on the server from the catalog. The compose tool's schema is the layout's,
  with `flavor`. `run.ts` does each tool's work. `register.ts` finds
  `document.modelContext` (else `navigator.modelContext`), registers each tool with the
  page's signal, and goes on quietly past a tool the context refuses. An earlier draft's
  handle is unregistered on abort.
- `docs/components/AgentTools.tsx`, in the root layout: registers the tools on every page
  and loads `run.ts`, and the engine with it, on the first call.
- `llms.txt` has a "Tools for agents" section, written from the same definitions.
- Checked in Chrome on the dev server, with a stand-in `document.modelContext` defined
  before the page's scripts ran. Both tools register, answer, and stay registered across
  a client-side navigation. Until the first call, the page loads only Turbopack's
  520-byte loader for `run.ts`; the engine comes with that call. Built for production
  (esbuild, minified), the engine is 21.8 kB gzipped. The definitions add 3.7 kB of
  JSON, uncompressed, to every page.
- 19 more tests: suggest; the tools against the draft's naming rules, the catalog and
  their runners; and registration against a stand-in context.

## Phase 3 progress

Built (October 26, 2026), uncommitted:

- `docs/lib/compose/structure.ts`: `structureOf(json)`, a resource's structure in any
  Presentation version (2's `sequences`, `images`, `@type`, `viewingHint` and
  `otherContent`; 3's and 4's `items`, `type`, `behavior`, Choices and
  SpecificResources). It gives the resource's type and version, and its containers by
  type. It counts what paints them (images, video, sound, models, text), and gives their
  media types, its services by kind (`image-3`, `image-level-2`, `search-2`, `auth-2`),
  and its annotations held and referenced, with their motivations. It also counts
  captions (`supplementing` text/vtt), plain-text renderings, renderings, Ranges, a
  Collection's members, placeholders and accompanying containers, and records navPlace,
  `behavior`, `viewingDirection` and which properties it has. Only counts and tokens
  checked against what IIIF defines come through: a media type must have a media type's
  shape, and a motivation, behavior or direction must be one IIIF names. Nothing the
  resource wrote does. It reads 2,000 containers, 20,000 annotations and 5,000 Ranges,
  counts the containers past that, and says so (`truncated`).
- `docs/lib/compose/read-resource.ts`: `readResource(address)`. It takes an address on
  the web (`http:` or `https:` only) or a content state, which the package decodes
  (`core/content-state.ts`, imported by path as the specs are). It fetches without the
  reader's cookies (`credentials: "omit"`) or the page's address
  (`referrerPolicy: "no-referrer"`), waits 10 seconds, and reads 8 MB, by the header or
  as the bytes come. A failure is an answer, not an error: the status, too large, not
  JSON, not IIIF, no answer in time, or refused (CORS).
- `suggest(input, read)`, in `suggest.ts`, says what the resource has (`has`), each as
  a capability with its evidence in counts ("1 caption file (text/vtt)"). It starts the
  layout from it: Label, Body (a Collection's Root opens its first member there) and
  Items for two views or more, then what was asked for, then a Panel, which shows a
  section for the rest. It gives the resource back marked `untrusted: true`, with what
  that means, and notes what it did not read (a Collection's members, referenced
  annotation pages, past its limits).
- `clover_suggest_layout` takes `resource`, and carries `untrustedContentHint`. A
  caller's cancel stops the read.
- Checked in Chrome on the dev server, with a stand-in `document.modelContext`. It read
  a local mock, Cookbook recipe 0219 on iiif.io, and an encoded content state that
  opened the Hindenburg mock. It refused a `javascript:` address and reported a 404.
  Searching each answer, with the address the agent gave taken out, found none of the
  resources' words. Answers were 4.6 to 6.6 kB. Reading resources adds 5.3 kB to the
  engine (27.1 kB gzipped, on the first call), and 0.4 kB to each page's definitions
  (4.1 kB).
- 20 more tests: the reader across Presentation 2, 3 and 4 and the mocks, a resource
  stuffed with marked strings (none come through), the limits; the fetch's bounds and
  failures, with a stand-in fetch; and suggestions from a resource.

## Phase 4 progress

Built (October 26, 2026), uncommitted:

- `docs/lib/compose/preview.ts`: `planPreview(input, route)` works out a preview before
  the page draws it. The layout is checked, and a part that titles what it holds gets
  `headingLevel` 2 under the page's title, unless the layout set it, so the outline stays
  true; the answer says so. It is drawn over the layout's resource, or else a sample
  that has what was asked for: the capability's, the page's part's, or the first placed
  part's (`capabilities.ts`). Its code is the same `compose` writes. It knows its page
  (`pageSubject`): given nothing, a part's own page shows its part, and the Viewer's page
  the Viewer. Value, Tip and ReadMore, which take the page's own content, say so instead.
- `docs/lib/webmcp/preview-store.ts`: every example frame on a page registers as a host.
  The first on the page, in document order, draws the preview, until the reader brings
  the page's example back or leaves the page. It says what changed, in the status region
  `AgentTools.tsx` keeps out of sight (WCAG 4.1.3).
- `docs/components/Clover4/PreviewHost.tsx`: `usePreviewHost()`, taken by all six
  frames (`LiveFrame`, `Example`, `ViewerExample`, `OptionsExample`, `LiveTemplates`,
  `ComposeExample`). It brings the frame into view only when asked (`reveal`), at once
  where the reader asks for less motion, and never moves focus.
- `docs/components/Clover4/AgentPreview.tsx`, loaded the first time a preview is shown,
  draws inside the frame:
  - a bar, as `OptionsExample`'s is: "Preview from your agent", and "Show this page's
    example" (`cta-outline`, 42px tall), which takes focus to the frame as the page's
    example comes back (WCAG 2.4.3);
  - the layout, drawn live with the package, marked as an example: the Root and its
    parts, the page's own elements, the Viewer in a template, `Map` with its worker, and
    the newspaper's search answered in the browser. A layout that throws as it is drawn
    says so, rather than taking the page with it;
  - its code in both flavors (`LiveCode`), the reader's shown.
- `clover_preview_layout` takes `layout`, `capability` and `reveal`, and is not
  read-only (`readOnlyHint: false`). It answers with what it shows, the address it is
  drawn over, and its notes. A page with no example frame (Get started, Styling) says
  where one is.
- Checked in Chrome on the dev server, with a stand-in `document.modelContext`:
  - **Rights page, given nothing:** it showed Rights over the catalog.
  - **Composing, the agent's own layout with `reveal`:** Label, Body, and Items in an
    `aside`. The page scrolled from 11,448px to the frame, and focus stayed put.
  - **Body page, "3d":** Scene drew the Cookbook's model.
  - **Viewer page, given nothing:** the Viewer.
  - **Styling page:** refused, saying where an example is.
  - **Accessibility tree:** a group "Preview from your agent" holding the button, the
    "Example" group and the code.
  - **Keyboard:** Tab reaches the button. Enter brings the page's example back, with
    focus on the frame and "The page's own example is back." in the status region.
  - **What loads:** nothing of the preview until it is shown. The host costs a page with
    an example frame 0.6 kB gzipped. The engine is 28.5 kB gzipped, on the first call,
    and the three tools' definitions are 5.4 kB of JSON, uncompressed, on every page.
- 13 more tests: the plan (page subjects, samples, outline levels, its code against
  `compose`'s, the refusals), the store (page order, its announcements, a page going),
  and the tool, with and without a frame.

## Phase 5 progress

Built (October 26, 2026), uncommitted:

- The docs' own end-to-end suite, `e2e/` at the root: `npm run e2e:docs`, and part of
  `npm run e2e` after the package's. It runs Chromium over `npm run dev`, reusing a
  running one. `specs/stand-in.ts` defines `document.modelContext` as the draft has it,
  before the page's scripts: it keeps each tool until its signal aborts, and refuses a
  name already taken. `specs/agent-tools.spec.ts` checks, in seven tests:
  - the three tools' names, titles and hints;
  - that a move within the docs keeps them, registered once;
  - compose's code, and its "Did you mean…";
  - suggest from a mock's structure: marked untrusted, none of its words, and a
    `javascript:` address refused;
  - the preview of a part's page's own part, its accessibility tree, and the way back by
    keyboard, with focus on the frame and the status region's words;
  - an agent's layout brought into view without moving focus, with axe finding no
    serious or critical violation in the preview;
  - the Viewer on its page, and a page with no example refused.

  It reads only the docs' mocks, from the dev server; what it checks needs no image or
  media from the network.

- The Agent tools page, under Contribute, which said what each tool does, what it never
  does, and how they grow. Rewritten the same day for the reader (Mat, 2026-10-26: "is
  the webmcp page helpful to end users? it reads like notes to a developer"), as Build
  with an agent (`content/docs/agents.mdx`, `/docs/agents`), under Use Clover after
  Styling: what to ask, what happens on the page, what it reads and never sends, and
  what a reader needs, with an example of its own for a preview to take the place of.
  Its workings, and the example of a layout and its code, moved here ("A layout, and its
  code", above). Then hidden, for now (Mat, 2026-10-26): out of the menu, search, the
  sitemap, `llms.txt` and the Markdown, at its address still. To show it again, take
  `display: "hidden"` off its entry in `content/docs/_meta.ts`, and `searchable: false`
  out of its front matter.
- `docs/lib/webmcp/origin-trial.ts`: the token's place. Once it is set, every page gives
  Chrome `<meta http-equiv="origin-trial">` (`app/layout.tsx`); while it is empty,
  pages give nothing.

## Production build check (October 26, 2026)

Built as the site deploys (`npm run build:docs`, its base path `/clover`), in a copy of
the tree with `node_modules` cloned, so the running dev server was untouched. Served as
Pages serves it (`node e2e/serve.mjs`), and checked with the docs' e2e suite against it
(`DOCS_URL=http://localhost:4400 npm run e2e:docs`):

- **The build:** it passed. 59 pages were indexed for search; 58 written as Markdown, 34
  in `llms-full.txt`. Its two warnings predate this work, or are the page's own until it
  is committed: Nextra has no Git date for the new, uncommitted page (then `agent-tools.mdx`) (so
  the sitemap gives it none yet), and Turbopack cannot follow the code-flavors loader's
  dynamic import, as before.
- **What agents read:** `llms.txt` lists the three tools under "Tools for agents", and
  the page (then Agent tools, under Contribute). The sitemap and `llms-full.txt` have
  the page. Its Markdown (then `/docs/agent-tools.md`) has its front matter, and its
  example in both
  flavors, labeled. Every page's HTML defines the tools, and none has an origin-trial
  `meta` while its token is empty.
- **The suite against the build:** all 8 tests pass, the new one among them. It reads
  every script a page loads, and finds neither the engine nor the preview's renderer
  until an agent calls.
- **What loads, measured on the built site:**
  - **A page:** nothing of the engine or the preview's renderer, only the tools'
    definitions, 5.4 kB of JSON, 1.9 kB gzipped, and the small code that registers them.
  - **The first call:** two chunks, 24.9 kB gzipped (the engine's own 19.9 kB).
  - **The first preview:** 2.3 kB more.

  The phases' figures before this were esbuild's estimates; these are the build's own.

- **Found, and older than this work, then fixed (October 26, 2026):** in every page's
  Markdown, a fenced code block lost its language (only live examples' code kept it),
  though AGENTS.md says each fence keeps it; and an external link kept a space where
  Nextra's arrow was ("[WebMCP ](…)"). `scripts/build-agent-docs.mjs` now puts a block's
  `data-lang` on its `code`, where the converter reads it, and ends a link's words where
  its words end. Built again in the copy, across all 58 pages: 532 fences with their
  language (38 before) and none without (494 before), and no link ending in a space (123
  before). Nothing else changed but the tables' padding around the shorter links, and a
  link whose words are its address, now an autolink (`<https://…>`).

## Decisions for Mat

- **The origin trial.** Register a token for the site's origin
  (https://developer.chrome.com/origintrials; `https://nulib-ds.github.io` today), and
  paste it into `WEBMCP_ORIGIN_TRIAL` (`docs/lib/webmcp/origin-trial.ts`). A domain of
  the site's own would need a token of its own.
- **Tool names.** The draft (October 20, 2026) allows ASCII letters and digits, `_`, `-`
  and `.`, up to 128, unique in a document: `clover_suggest_layout` and
  `clover_compose_layout` keep to it (`tools.test.ts`).
