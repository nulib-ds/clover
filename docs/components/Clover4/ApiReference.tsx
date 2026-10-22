import React from "react";

import { useMDXComponents } from "../../../mdx-components";
import { DOCS, SPECS } from "../../../packages/clover/src/web-components/specs";
import type {
  AttributeType,
  ElementDocs,
  ElementSpec,
} from "../../../packages/clover/src/web-components/spec";

/**
 * A component page's "API reference" in both of the docs' flavors (WEB-COMPONENTS.md,
 * phase 7): the page's own tables for React (its children), and for web components the
 * tables of the elements it names, written from their specs and docs, as the elements'
 * types and Custom Elements Manifest are, so the three never disagree. Drawn on the
 * server, with the components a page's Markdown is drawn with, so its tables are the
 * page's own; the reader's choice shows one (`data-code-flavor`, `layout.css`).
 *
 * ```mdx
 * <ApiReference elements="clover-items">
 *
 * | Prop | Type | Default | Description |
 * …
 *
 * </ApiReference>
 * ```
 */
export function ApiReference({
  elements,
  children,
}: {
  /** The elements' tags, space-separated: `clover-panel clover-tab`. */
  elements: string;
  children: React.ReactNode;
}) {
  const docs = DOCS();
  const tags = elements.split(/\s+/).filter(Boolean);
  return (
    <>
      <div data-code-flavor="react">{children}</div>
      <div data-code-flavor="web-components">
        {tags.map((tag) => {
          const spec = SPECS.find((each) => each.tag === tag);
          if (!spec || !docs[tag])
            throw new Error(`ApiReference: no element ${tag}`);
          return <ElementTable key={tag} spec={spec} docs={docs[tag]} />;
        })}
      </div>
    </>
  );
}

/** An attribute's type as the manifest writes it. */
const typeOf = (type: AttributeType) =>
  Array.isArray(type)
    ? type.map((word) => `"${word}"`).join(" | ")
    : type === "data"
      ? "string (a URL or JSON)"
      : (type as string);

/** What an event's `keeps` makes the element hold, read-only. */
const keptOf = (spec: ElementSpec) =>
  Object.values(spec.events ?? {})
    .map((event) => event.keeps)
    .filter((name): name is string => Boolean(name));

type Row = {
  name: string;
  type: string;
  fallback?: string;
  description: string;
};

/**
 * One element: its attributes, then what it takes as properties (`.items`), what it keeps
 * (`.handle`), the events it sends and the slots it reads, one table, as each part's is.
 */
function ElementTable({
  spec,
  docs,
}: {
  spec: ElementSpec;
  docs: ElementDocs;
}) {
  const md = useMDXComponents() as Record<string, React.ElementType>;
  const { h3: H3, p: P, code: Code, table: Table, tr: Tr, th: Th, td: Td } = md;
  const attributes = Object.entries(spec.attributes);
  const byAttribute = new Set(
    attributes.map(([, attribute]) => attribute.prop),
  );
  const rows: Row[] = [
    ...attributes.map(([name, attribute]) => ({
      name,
      type: typeOf(attribute.type),
      fallback: docs.attributes[name]?.default,
      description: docs.attributes[name]?.description ?? "",
    })),
    ...[...keptOf(spec), ...(spec.properties ?? [])]
      .filter((name) => docs.properties?.[name])
      .map((name) => {
        const property = docs.properties![name];
        return {
          name: `.${name}`,
          type: property.type,
          description: `${property.readonly ? "Read-only. " : ""}${byAttribute.has(name) ? "As a property: " : ""}${property.description}`,
        };
      }),
    ...Object.keys(spec.events ?? {}).map((name) => ({
      name,
      type: docs.events?.[name]?.detail ?? "",
      description: `An event. ${docs.events?.[name]?.description ?? ""}`,
    })),
    ...(spec.slots ?? []).map((name) => ({
      name: `slot="${name}"`,
      type: "Element",
      description: docs.slots?.[name]?.description ?? "",
    })),
  ];
  return (
    <>
      <H3 id={`element-${spec.tag}`}>
        <Code>{`<${spec.tag}>`}</Code>
      </H3>
      <P>{docs.description}</P>
      <Table>
        <thead>
          <Tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Default</Th>
            <Th>Description</Th>
          </Tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.name}>
              <Td>
                <Code>{row.name}</Code>
              </Td>
              <Td>
                <Code>{row.type}</Code>
              </Td>
              <Td>{row.fallback ? <Code>{row.fallback}</Code> : "—"}</Td>
              <Td>{row.description}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
