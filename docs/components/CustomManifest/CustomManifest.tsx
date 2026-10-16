import React, { useEffect, useId, useRef, useState } from "react";

import styles from "docs/components/CustomManifest/CustomManifest.module.css";
import { IIIF_CONTENT_PARAM, pushIiifContent } from "docs/lib/iiif-content";
import { useRouter } from "next/router";

interface CustomManifestProps {
  placeholder: string;
  /**
   * Returns a message when `value` should not be accepted. The field then shows it and
   * leaves the URL alone. Left out, any value is accepted, as it always was.
   */
  validate?: (value: string) => string | undefined;
  /** Adds a submit button with this label. Pressing Enter in the field submits either way. */
  submitLabel?: string;
  className?: string;
}

/**
 * A field that puts a IIIF resource in the page's `iiif-content` parameter. The component
 * the page renders reads it from there, and so does the field itself: it always shows what
 * the URL says, whether that came from this field, a link, a button elsewhere or the
 * browser's history.
 *
 * The input is uncontrolled. Typing costs React nothing; the value is read once, on submit,
 * and only an error message ever causes a render.
 */
const CustomManifest = ({
  placeholder,
  validate,
  submitLabel,
  className,
}: CustomManifestProps) => {
  const router = useRouter();
  const id = useId();
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string>();

  const queryValue = router.query[IIIF_CONTENT_PARAM];
  const param = typeof queryValue === "string" ? queryValue : "";

  /*
   * Written to the DOM rather than remounting the input with a `key`, so a field that is
   * focused when it submits stays focused.
   */
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = param;
    setSubmitError(undefined);
  }, [param]);

  // A link can arrive carrying a value that cannot be loaded; say so before anyone submits.
  const message = submitError ?? (param ? validate?.(param) : undefined);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = (inputRef.current?.value ?? "").trim();
    const problem = value ? validate?.(value) : undefined;

    if (problem) {
      setSubmitError(problem);
      return;
    }

    setSubmitError(undefined);
    // An empty field clears the parameter, which hands the page back its default content.
    pushIiifContent(router, value || undefined);
  };

  return (
    <div
      className={`${styles.customManifest} nextra-search nx-relative ${className ?? ""}`}
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* The placeholder is the only text naming the field on screen, so the name repeats it. */}
        <label htmlFor={id} className={styles.label}>
          {placeholder}
        </label>
        <div className={styles.row}>
          <input
            ref={inputRef}
            id={id}
            name="iiifContent"
            type="text"
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={placeholder}
            defaultValue={param}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            onInput={submitError ? () => setSubmitError(undefined) : undefined}
            className="nx-block nx-w-full nx-appearance-none nx-rounded-lg nx-px-3 nx-py-2 nx-transition-colors nx-text-base nx-leading-tight md:nx-text-sm nx-bg-black/[.05] dark:nx-bg-gray-50/10 focus:nx-bg-white dark:focus:nx-bg-dark placeholder:nx-text-gray-500 dark:placeholder:nx-text-gray-400 contrast-more:nx-border contrast-more:nx-border-current"
          />
          {submitLabel && (
            <button type="submit" className={styles.submit}>
              {submitLabel}
            </button>
          )}
        </div>
        {message && (
          <p id={errorId} role="alert" className={styles.error}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
};

export default CustomManifest;
