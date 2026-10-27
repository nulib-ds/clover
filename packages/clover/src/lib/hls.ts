/**
 * HLS's MIME types: Apple's (`application/vnd.apple.mpegurl`, and `vnd.apple.mpegurl`),
 * and the common `mpegurl` and `x-mpegurl`, under `application/`, `audio/` or `video/`.
 * MIME types are read without regard to case.
 */
const HLS_TYPE = /^((application|audio|video)\/)?(vnd\.apple\.|x-)?mpegurl$/i;

/**
 * Whether a content resource's id and format are an HLS playlist: a `.m3u8` path, its
 * query or fragment set aside (a tokenized `…/playlist.m3u8?token=…`), or one of HLS's
 * MIME types.
 */
export const isHls = (id?: string, format?: string): boolean =>
  Boolean(id && /\.m3u8$/i.test(id.split(/[?#]/)[0])) ||
  Boolean(format && HLS_TYPE.test(format));
