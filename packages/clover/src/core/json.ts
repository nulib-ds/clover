/**
 * A IIIF resource as JSON, read loosely. One declaration for the modules whose `Json`
 * reaches Clover's types: the bundled declarations (`build:types`) would hold one per
 * module, under the one name, which TypeScript rejects.
 */
export type Json = Record<string, any>;
