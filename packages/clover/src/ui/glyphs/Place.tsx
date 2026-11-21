import React from "react";

/**
 * A map pin, a teardrop standing on its point, round and friendly, a hole through its head
 * (`evenodd`, as the bubble's lines are): the map control.
 */
export const PlaceGlyph = () => (
  <path
    fill="currentColor"
    fillRule="evenodd"
    stroke="none"
    d="M256 40C166 40 100 108 100 196C100 300 216 420 246 452A14 14 0 0 0 266 452C296 420 412 300 412 196C412 108 346 40 256 40Z M256 136A60 60 0 1 1 256 256A60 60 0 1 1 256 136Z"
  />
);
