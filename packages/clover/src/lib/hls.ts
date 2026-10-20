/**
 * Detect whether a content resource id / format pair represents an HLS
 * playlist. Strips any query string before checking the file extension so
 * tokenized URLs like `…/playlist.m3u8?token=…` are matched, then falls
 * back to a list of common HLS MIME types.
 */
export const isHls = (id?: string, format?: string): boolean => {
  if (id) {
    const path = id.split("?")[0];
    if (path.split(".").pop()?.toLowerCase() === "m3u8") return true;
  }
  if (format && hlsMimeTypes.includes(format)) return true;
  return false;
};

export const hlsMimeTypes = [
  // Apple santioned
  "application/vnd.apple.mpegurl",
  "vnd.apple.mpegurl",
  // Apple sanctioned for backwards compatibility
  "audio/mpegurl",
  // Very common
  "audio/x-mpegurl",
  // Very common
  "application/x-mpegurl",
  // Included for completeness
  "video/x-mpegurl",
  "video/mpegurl",
  "application/mpegurl",
];
