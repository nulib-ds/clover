import React, { useEffect, useRef, useState } from "react";

import type { Clover } from "../../core/clover";
import {
  selectCanvas,
  selectPosition,
  selectSequence,
} from "../../core/selectors";
import { localize } from "../../core/value";
import { useCloverTranslation } from "../../i18n/useCloverTranslation";
import { visuallyHidden } from "../../ui/visuallyHidden";

/**
 * Says where the reader has moved to — the Canvas's label and its position — in a polite
 * live region. Silent on the first view: arriving is not moving. A `Root` renders it last
 * inside its element; `<clover-root>` puts it last inside itself.
 */
export function Announcer({
  clover,
  language,
}: {
  clover: Clover;
  language?: string;
}) {
  const { t, langOf } = useCloverTranslation();
  // The label keeps its own language; the position is in Clover's.
  const [message, setMessage] = useState<{
    label: string;
    lang?: string;
    position: string;
  } | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let last: string | null = null;
    return clover.store.subscribe(() => {
      const { manifest, canvasId, status } = clover.store.get();
      if (status !== "ready" || canvasId === last) return;
      const first = last === null;
      last = canvasId;
      if (first) return;
      const canvas = selectCanvas(manifest, canvasId);
      const label = localize(canvas?.label as any, language);
      const position = tRef.current("canvasPosition", {
        index: selectPosition(manifest, canvasId) + 1,
        total: selectSequence(manifest).views.length,
      });
      setMessage({
        label: label.text,
        lang: label.lang,
        position,
      });
    });
  }, [clover, language]);

  // Atomic, so the whole message is read even when only one of its parts changed.
  return (
    <div
      className="clover-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={visuallyHidden}
    >
      {message?.label ? (
        <>
          <span lang={message.lang}>{message.label}</span>,{" "}
        </>
      ) : null}
      {message && (
        <span lang={langOf("canvasPosition")}>{message.position}</span>
      )}
    </div>
  );
}
