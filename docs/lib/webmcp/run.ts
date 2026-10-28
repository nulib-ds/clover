import { planPreview } from "docs/lib/compose/preview";
import { readResource } from "docs/lib/compose/read-resource";
import { suggest } from "docs/lib/compose/suggest";
import { compose } from "docs/lib/compose/write";
import { pageAddress } from "docs/lib/live-code";
import { firstHost, showPreview } from "docs/lib/webmcp/preview-store";
import type { ToolName } from "docs/lib/webmcp/tools";

/**
 * What each agent tool does (`tools.ts`), loaded by the page the first time one is called
 * (`AgentTools.tsx`), with the compose engine behind it: no page loads either until an
 * agent asks. Each answers with plain data, which WebMCP serializes as JSON; a layout that
 * does not hold, or a resource that cannot be read, is an answer too (`ok: false`), never
 * a thrown error. The caller's cancel (`signal`) stops a resource being read.
 */
export async function run(
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
          "In the page's first example, in place of its own, its code under it in the reader's flavor. The reader brings the page's example back with Show this page's example.",
        notes: plan.notes,
      };
    }
  }
}
