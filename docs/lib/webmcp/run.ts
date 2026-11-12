import { planPreview } from "docs/lib/compose/preview";
import { readResource } from "docs/lib/compose/read-resource";
import { suggest } from "docs/lib/compose/suggest";
import { compose } from "docs/lib/compose/write";
import { pageAddress } from "docs/lib/live-code";
import { basePath } from "docs/lib/router";
import { earlierPackage, isEarlierVersion } from "docs/lib/site";
import { firstHost, showPreview } from "docs/lib/webmcp/preview-store";
import type { ToolName } from "docs/lib/webmcp/tools";

/** The page the user has open, as the docs route it: its base path and `.html` off. */
function routeHere() {
  if (typeof location === "undefined") return "/";
  const path = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  const route =
    basePath && path.startsWith(basePath) ? path.slice(basePath.length) : path;
  return route || "/";
}

/*
 * What every answer on a 3.x page carries (Mat, 2026-11-12): that the page the user has
 * open documents a deprecated version, never to be used or recommended but to support an
 * older installation, and that the answer is Clover 4's, with where its docs are.
 */
const EARLIER_PAGE = {
  version: "3.x",
  package: earlierPackage,
  status: "deprecated",
  says: `The page the user has open documents Clover 3.x (${earlierPackage}), which is deprecated and no longer maintained. Don't use or recommend it unless the user is supporting an older installation. These tools answer for Clover 4 (@nulib/clover) alone, documented at ${pageAddress("/docs")}; ${pageAddress("/docs/upgrading")} moves a 3.x page to Clover 4.`,
  docs: pageAddress("/docs"),
  upgrading: pageAddress("/docs/upgrading"),
};

/**
 * What each agent tool does (`tools.ts`), loaded by the page the first time one is called
 * (`AgentTools.tsx`), with the compose engine behind it: no page loads either until an
 * agent asks. Each answers with plain data, which WebMCP serializes as JSON; a layout that
 * does not hold, or a resource that cannot be read, is an answer too (`ok: false`), never
 * a thrown error. The caller's cancel (`signal`) stops a resource being read. On a 3.x
 * page, each answer says it is deprecated (`deprecated`).
 */
export async function run(
  name: ToolName,
  input: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const answer = await answerOf(name, input, signal);
  return isEarlierVersion(routeHere())
    ? { ...(answer as object), deprecated: EARLIER_PAGE }
    : answer;
}

async function answerOf(
  name: ToolName,
  input: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const given =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  switch (name) {
    case "clover_suggest_layout": {
      if (given.resource === undefined) return suggest(given);
      if (typeof given.resource !== "string")
        return { ok: false, says: "The resource is an address, as text." };
      const read = await readResource(given.resource, { signal });
      return read.ok ? suggest(given, read) : read;
    }
    case "clover_compose_layout": {
      const { flavor, ...layout } = given;
      return compose(layout, flavor === "html" ? "html" : "react");
    }
    case "clover_preview_layout": {
      // The first example frame the page shows, where the preview is drawn, its level too.
      const host = firstHost();
      if (!host)
        return {
          ok: false,
          says: `This page has no example to draw in. Composing (${pageAddress("/docs/composing")}) and each component's page have one.`,
        };
      const planned = planPreview(given, host.route, host.level);
      if (!planned.ok) return planned;
      const { plan } = planned;
      showPreview(plan, host.key, given.reveal === true);
      return {
        ok: true,
        shows: plan.shows,
        // The resource it is drawn over: the layout's, or a sample's published address.
        over: plan.address,
        ...(plan.sample && { sample: plan.sample }),
        ...(plan.page && { page: plan.page }),
        where:
          "In the page's first example, in place of its own, its code under it in the chosen flavor. Show this page's example brings the page's own back.",
        notes: plan.notes,
      };
    }
  }
}
