import Link from "next/link";
import { Table } from "nextra/components";
import React from "react";
import { ScrollTable } from "docs/components/ScrollTable";
import { docsIndex, type DocsPage } from "docs/lib/agents";
import { SPECS } from "../../../packages/clover/src/web-components/specs";

/** A Markdown link's classes, so these read as the page's own links do. */
const LINK =
  "x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]";

/** The elements' tags, from their specs: `RequiredStatement` is `<clover-required-statement>`. */
const TAGS = new Set(SPECS.map((spec) => spec.tag));
const tagOf = (name: string) => {
  const tag = `clover-${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
  return TAGS.has(tag) ? tag : null;
};

/** The part's name as the reader's flavor writes it, as the page's prose does. */
function Name({ title }: { title: string }) {
  const tag = tagOf(title);
  if (!tag) return <code className="nextra-code">{title}</code>;
  return (
    <>
      <span data-code-flavor="react">
        <code className="nextra-code">{title}</code>
      </span>
      <span data-code-flavor="web-components">
        <code className="nextra-code">{`<${tag}>`}</code>
      </span>
    </>
  );
}

function Row({ page }: { page: DocsPage }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Link href={page.route} className={LINK}>
          <Name title={page.title} />
        </Link>
      </Table.Td>
      <Table.Td>{page.description}</Table.Td>
    </Table.Tr>
  );
}

/**
 * Composing's table of core components (Mat, 2026-11-04: "all named Components (under
 * components) should be included in one table as Core Components (primitives in a section
 * of that table)"): every part in the docs' Components menu, then the Primitives as a group
 * of their own, each linked to its page and said in its page's own description. Read from
 * the menu (`docsIndex`), so a part added there is listed here too.
 */
export async function CoreComponents() {
  const { sections } = await docsIndex();
  const components =
    sections.find((section) => section.key === "components")?.pages ?? [];
  const [overview, ...primitives] =
    sections.find((section) => section.key === "primitives")?.pages ?? [];
  return (
    <ScrollTable>
      <thead>
        <Table.Tr>
          <Table.Th>Component</Table.Th>
          <Table.Th>Description</Table.Th>
        </Table.Tr>
      </thead>
      <tbody>
        {components.map((page) => (
          <Row key={page.route} page={page} />
        ))}
      </tbody>
      {overview && (
        <tbody>
          <Table.Tr>
            <th colSpan={2} scope="rowgroup">
              <Link href={overview.route} className={LINK}>
                {overview.title}
              </Link>
            </th>
          </Table.Tr>
          {primitives.map((page) => (
            <Row key={page.route} page={page} />
          ))}
        </tbody>
      )}
    </ScrollTable>
  );
}
