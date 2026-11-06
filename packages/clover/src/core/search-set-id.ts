/**
 * The id of a search's hits as an annotation set, so hosts and parts can tell search
 * hotspots from annotations. A module of its own, so what only needs the id (the
 * annotation sets a Canvas alone reads) never loads the search service's reader with it.
 */
export const SEARCH_SET_ID = "content-search";
