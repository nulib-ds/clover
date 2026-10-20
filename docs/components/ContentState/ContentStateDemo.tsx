"use client";

import { encodeContentState } from "@iiif/helpers";
import type React from "react";

import CustomManifest from "docs/components/CustomManifest/CustomManifest";
import Viewer from "docs/components/DynamicImports/Viewer";
import { iiifContentError } from "docs/lib/iiif-content";

/*
 * The 3.x content-state page's demo: a Viewer whose content state fills the fields under
 * it, and a body text field that rewrites it with a note and updates the preview link.
 * Drawn in the browser: the page is drawn on the server, which cannot hand these
 * handlers to the Viewer or the field. The pieces find each other by id, as they did
 * when the page held the handlers.
 */

const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

const withBody = ({ json, value }: { json: any; value: string }) => ({
  ...json,
  body: value
    ? [
        {
          type: "TextualBody",
          value: value,
          format: "text/plain",
        },
      ]
    : [],
});

const onContentState = (contentState: any) => {
  const encoded = byId<HTMLTextAreaElement>("content-state-encoded");
  const json = byId<HTMLTextAreaElement>("content-state-json");
  const body = byId<HTMLTextAreaElement>("content-state-body");
  const preview = withBody({
    json: contentState?.json,
    value: body?.value || "",
  });
  if (encoded && contentState)
    encoded.value = encodeContentState(JSON.stringify(preview));
  if (json && contentState) json.value = JSON.stringify(preview);
};

const onBodyChange = () => {
  const encoded = byId<HTMLTextAreaElement>("content-state-encoded");
  const json = byId<HTMLTextAreaElement>("content-state-json");
  const body = byId<HTMLTextAreaElement>("content-state-body");
  const link = byId<HTMLAnchorElement>("content-state-preview");
  if (!link || !body || !json || !encoded) return;
  const href = new URL(window.location.href);
  const preview = withBody({
    json: JSON.parse(json.value),
    value: body.value || "",
  });
  href.searchParams.set(
    "iiif-content",
    encodeContentState(JSON.stringify(preview)),
  );
  link.href = href.toString();
  encoded.value = encodeContentState(JSON.stringify(preview));
  json.value = JSON.stringify(preview);
};

/** The resource field and the Viewer, which reports its content state. */
export function ContentStateViewer() {
  return (
    <>
      <CustomManifest
        placeholder="IIIF Manifest or Collection"
        validate={iiifContentError}
      />
      <Viewer
        contentStateCallback={onContentState}
        options={{
          canvasHeight: "640px",
          openSeadragon: {
            gestureSettingsMouse: {
              scrollToZoom: false,
            },
          },
          showIIIFBadge: false,
        }}
      />
    </>
  );
}

/** The body text field, which writes its text into the content state as a note. */
export function ContentStateBody({ style }: { style?: React.CSSProperties }) {
  return (
    <textarea
      id="content-state-body"
      aria-describedby="content-state-body-help"
      onChange={onBodyChange}
      style={style}
    ></textarea>
  );
}
