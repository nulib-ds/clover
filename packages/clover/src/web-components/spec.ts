/*
 * What an element is, as one table: the attributes it reads, the properties it takes and
 * the events it sends, each named once (`specs/`). The base element reads it to define the
 * element; `build/custom-elements.mjs` reads it, with its docs, to write the types and the
 * Custom Elements Manifest. Its docs are a second export beside it, which no page loads.
 */

/**
 * How an attribute is read: as written (`string`); a number; a boolean (present is true,
 * as HTML's are, and `"false"` turns it off); data (a URL as written, or JSON); or one of
 * a list of words, in any case (`"false"` among them turns the prop off).
 */
export type AttributeType =
  | "string"
  | "number"
  | "boolean"
  | "data"
  | readonly string[];

export interface AttributeSpec {
  /** The prop it sets on the part. */
  prop: string;
  type: AttributeType;
  /** A number's least value: below it, the attribute is warned of and ignored. */
  min?: number;
}

export interface EventSpec {
  /** The part's callback it answers. */
  prop: string;
  /** Its `detail`: the callback's arguments, named in order, or its first as it is. */
  detail: readonly string[] | "first";
  /**
   * The page can cancel it, which prevents the default of the event the part handed the
   * callback last (a link's, say).
   */
  cancelable?: boolean;
}

export interface ElementSpec {
  tag: string;
  /**
   * `root` provides for the parts inside it. A `part` is drawn inside its nearest root, or
   * by itself outside one. One `alone` is always drawn by itself, wherever it is. A
   * `config` element draws nothing and loads nothing: the element around it reads it (a
   * panel its tabs).
   */
  kind: "root" | "part" | "alone" | "config";
  /**
   * A part that reads its root's state and has nothing to show without one: outside a
   * `<clover-root>` it draws nothing, and says so in the console.
   */
  needsRoot?: boolean;
  /** Attributes by name. */
  attributes: Record<string, AttributeSpec>;
  /** Props set as properties: what an attribute cannot carry. */
  properties?: readonly string[];
  /** Events by name, each sent when the part calls its callback. */
  events?: Record<string, EventSpec>;
  /**
   * The names of the children it reads by their `slot` (`<span slot="label">`), shown as a
   * copy where the part draws them.
   */
  slots?: readonly string[];
  /**
   * The element is the part's own box (a pane, a handle): its role and its name are on
   * the element itself, so ARIA on it is the page's to give.
   */
  native?: boolean;
}

/** What the types and the manifest say of an element. Never loaded by a page. */
export interface ElementDocs {
  /** Its class's name in the types. */
  name: string;
  description: string;
  attributes: Record<string, { description: string; default?: string }>;
  /** Each property's TypeScript type, and what it is. */
  properties?: Record<string, { type: string; description: string }>;
  /** Each event's `detail` as a TypeScript type, and when it is sent. */
  events?: Record<string, { detail: string; description: string }>;
  /** What each slot holds. */
  slots?: Record<string, { description: string }>;
}
