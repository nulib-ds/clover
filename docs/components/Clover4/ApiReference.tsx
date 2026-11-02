import React from "react";

import { useMDXComponents } from "../../../mdx-components";
import { DOCS, SPECS } from "../../../packages/clover/src/web-components/specs";
import type {
  AttributeType,
  ElementDocs,
  ElementSpec,
} from "../../../packages/clover/src/web-components/spec";

/**
 * A component page's "API reference" in both of the docs' flavors (AGENTS.md: every page
 * in both flavors): the page's own tables for React (its children), and for web
 * components the tables of the elements it names, written from their specs and docs, as
 * the elements' types and Custom Elements Manifest are, so the three never disagree.
 * Drawn on the server, with the components a page's Markdown is drawn with, so its tables
 * are the page's own; the reader's choice shows one (`data-code-flavor`, `layout.css`).
 *
 * ```mdx
 * <ApiReference elements="clover-items">
 *
 * | Prop | Type | Default | Description |
 * …
 *
 * </ApiReference>
 * ```
 *
 * With `sections`, one element's reference is split as the React tables are, under their
 * `###` headings: each of its rows goes to the section that lists its React prop, and a
 * row whose prop no section lists fails the build, saying so.
 */
export function ApiReference({
  elements,
  sections,
  children,
}: {
  /** The elements' tags, space-separated: `clover-panel clover-tab`. */
  elements: string;
  /** Split the one element's table by the React tables' `###` headings. */
  sections?: boolean;
  children: React.ReactNode;
}) {
  const docs = DOCS();
  const md = useMDXComponents() as Record<string, React.ElementType>;
  const tags = elements.split(/\s+/).filter(Boolean);
  if (sections && tags.length !== 1)
    throw new Error(
      `ApiReference: sections split one element, not ${elements}`,
    );
  return (
    <>
      <div data-code-flavor="react">{children}</div>
      <div data-code-flavor="web-components">
        {tags.map((tag) => {
          const spec = SPECS.find((each) => each.tag === tag);
          if (!spec || !docs[tag])
            throw new Error(`ApiReference: no element ${tag}`);
          return (
            <ElementTable
              key={tag}
              spec={spec}
              docs={docs[tag]}
              sections={sections ? sectionsOf(children, md) : undefined}
            />
          );
        })}
      </div>
    </>
  );
}

type Section = { title: string; props: string[] };

/** A node's text, as its MDX children write it. */
const textOf = (node: React.ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : React.isValidElement<{ children?: React.ReactNode }>(node)
        ? textOf(node.props.children)
        : "";

/** Every element under `node` that `is` picks, in document order. */
const findAll = (
  node: React.ReactNode,
  is: (element: React.ReactElement) => boolean,
): React.ReactElement<{ children?: React.ReactNode }>[] =>
  React.Children.toArray(node).flatMap((child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return [];
    return [
      ...(is(child) ? [child] : []),
      ...findAll(child.props.children, is),
    ];
  });

/**
 * The React tables' sections: each `###` heading's title, and the props its tables list
 * (each body row's first cell), in their order.
 */
function sectionsOf(
  children: React.ReactNode,
  md: Record<string, React.ElementType>,
): Section[] {
  const of = (name: string) => (element: React.ReactElement) =>
    element.type === md[name] || element.type === name;
  const found: Section[] = [];
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) continue;
    if (of("h3")(child)) {
      found.push({ title: textOf(child.props.children).trim(), props: [] });
      continue;
    }
    for (const row of findAll(child, of("tr"))) {
      const [first] = React.Children.toArray(row.props.children).filter(
        React.isValidElement,
      );
      if (first && of("td")(first))
        found.at(-1)?.props.push(textOf(first).trim());
    }
  }
  return found;
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** An attribute's type as the manifest writes it. */
const typeOf = (type: AttributeType) =>
  Array.isArray(type)
    ? type.map((word) => `"${word}"`).join(" | ")
    : type === "data"
      ? "string (a URL or JSON)"
      : (type as string);

/**
 * The values an attribute takes, each its own chip, `|` between them, in its spec's order
 * (Mat, 2026-11-01: a Label's elements headings first, "by highlight, I meant ordering").
 */
function ValuesCell({
  values,
  Code,
}: {
  values: readonly string[];
  Code: React.ElementType;
}) {
  return (
    <>
      {values.map((value, index) => {
        return (
          <React.Fragment key={value}>
            {index > 0 && " | "}
            <Code>{`"${value}"`}</Code>
          </React.Fragment>
        );
      })}
    </>
  );
}

/** What an event's `keeps` makes the element hold, read-only. */
const keptOf = (spec: ElementSpec) =>
  Object.values(spec.events ?? {})
    .map((event) => event.keeps)
    .filter((name): name is string => Boolean(name));

type Row = {
  name: string;
  /** The React prop it stands for, which places it in a section. */
  prop?: string;
  /** Its type, or the values it takes, each its own chip (`ValuesCell`). */
  type: string | readonly string[];
  fallback?: string;
  description: string;
};

/**
 * One element: its attributes, then what it takes as properties (`.items`), what it keeps
 * (`.handle`), the events it sends and the slots it reads, one table, as each part's is;
 * or, given the React tables' `sections`, a table under each section's own heading.
 */
function ElementTable({
  spec,
  docs,
  sections,
}: {
  spec: ElementSpec;
  docs: ElementDocs;
  sections?: Section[];
}) {
  const md = useMDXComponents() as Record<string, React.ElementType>;
  const { h3: H3, h4: H4, p: P, code: Code } = md;
  const attributes = Object.entries(spec.attributes);
  const byAttribute = new Set(
    attributes.map(([, attribute]) => attribute.prop),
  );
  const keeper = (name: string) =>
    Object.values(spec.events ?? {}).find((event) => event.keeps === name)
      ?.prop;
  const rows: Row[] = [
    ...attributes.map(([name, attribute]) => ({
      name,
      prop: attribute.prop,
      type: Array.isArray(attribute.type)
        ? (attribute.type as readonly string[])
        : typeOf(attribute.type),
      fallback: docs.attributes[name]?.default,
      description: docs.attributes[name]?.description ?? "",
    })),
    ...[...keptOf(spec), ...(spec.properties ?? [])]
      .filter((name) => docs.properties?.[name])
      .map((name) => {
        const property = docs.properties![name];
        return {
          name: `.${name}`,
          prop: keeper(name) ?? name,
          type: property.type,
          description: `${property.readonly ? "Read-only. " : ""}${byAttribute.has(name) ? "As a property: " : ""}${property.description}`,
        };
      }),
    ...Object.entries(spec.events ?? {}).map(([name, event]) => ({
      name,
      prop: event.prop,
      type: docs.events?.[name]?.detail ?? "",
      description: `An event. ${docs.events?.[name]?.description ?? ""}`,
    })),
    ...(spec.slots ?? []).map((name) => ({
      name: `slot="${name}"`,
      type: "Element",
      description: docs.slots?.[name]?.description ?? "",
    })),
  ];
  if (sections) {
    const unplaced = rows.filter(
      (row) => !sections.some((section) => section.props.includes(row.prop!)),
    );
    if (unplaced.length)
      throw new Error(
        `ApiReference: <${spec.tag}>'s ${unplaced.map((row) => `${row.name} (${row.prop ?? "no prop"})`).join(", ")} in none of the page's sections: list each prop in one of its React tables`,
      );
  }
  return (
    <>
      <H3 id={`element-${spec.tag}`}>
        <Code>{`<${spec.tag}>`}</Code>
      </H3>
      <P>{docs.description}</P>
      {sections ? (
        sections.map((section) => {
          const order = (row: Row) => section.props.indexOf(row.prop!);
          const shown = rows
            .filter((row) => order(row) !== -1)
            .sort((a, b) => order(a) - order(b));
          return shown.length ? (
            <React.Fragment key={section.title}>
              <H4 id={`element-${spec.tag}-${slug(section.title)}`}>
                {section.title}
              </H4>
              <RowsTable rows={shown} md={md} />
            </React.Fragment>
          ) : null;
        })
      ) : (
        <RowsTable rows={rows} md={md} />
      )}
    </>
  );
}

/** Rows as a table: Name, Type, Default and Description. */
function RowsTable({
  rows,
  md,
}: {
  rows: Row[];
  md: Record<string, React.ElementType>;
}) {
  const { code: Code, table: Table, tr: Tr, th: Th, td: Td } = md;
  return (
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
              {typeof row.type === "string" ? (
                <Code>{row.type}</Code>
              ) : (
                <ValuesCell values={row.type} Code={Code} />
              )}
            </Td>
            <Td>{row.fallback ? <Code>{row.fallback}</Code> : "—"}</Td>
            <Td>{row.description}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
