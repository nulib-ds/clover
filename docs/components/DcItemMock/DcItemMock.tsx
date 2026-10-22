"use client";

import { FULL_WIDTH } from "docs/lib/full-width";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "docs/components/DcItemMock/DcItemMock.module.css";
import { useRouter } from "docs/lib/router";

/**
 * A rough mock of a Northwestern Digital Collections item page, for trying Clover 4 in a
 * host page like the one it is written for. The page around them is plain markup filled
 * from the DC API, as dc.library.northwestern.edu fills it; the Viewer (the Default
 * template) and the Explore Further rows (`Items`, where the site has 3.x's Slider) are
 * Clover's. `?id=<work id>` opens another work, and choosing a work in a row opens it here.
 */

const API = "https://api.dc.library.northwestern.edu/api/v2";
const DEFAULT_ID = "e81ee20f-5901-424f-862b-8b395e7e22e7";

/** At most this many subject rows, so a work with many subjects keeps a short page. */
const SUBJECT_ROWS = 3;

const Viewer = dynamic(
  () =>
    import("@nulib/clover").then(
      (clover) => clover.default as React.ComponentType<any>,
    ),
  { ssr: false },
);

const Items = dynamic(
  () =>
    import("@nulib/clover").then(
      (clover) => clover.Items as React.ComponentType<any>,
    ),
  { ssr: false },
);

interface Work {
  title: string;
  description?: string[];
  iiif_manifest: string;
  collection?: { id: string; title: string; description?: string };
  subject?: { label: string }[];
}

type LanguageMap = Record<string, string[]> | undefined;

interface Manifest {
  metadata?: { label: LanguageMap; value: LanguageMap }[];
  requiredStatement?: { label: LanguageMap; value: LanguageMap };
}

/** Every value of a language map, whatever the language. */
const values = (map: LanguageMap): string[] => Object.values(map ?? {}).flat();

const iiif = (params: Record<string, string>) =>
  new URLSearchParams({ ...params, as: "iiif" }).toString();

/** The rows the site's Explore Further shows: the work's collection, similar works, subjects. */
function exploreFurther(id: string, work: Work): string[] {
  const rows: string[] = [];
  if (work.collection)
    rows.push(
      `${API}/search?${iiif({
        query: `collection.id:"${work.collection.id}"`,
        collectionLabel: work.collection.title,
        collectionSummary: "Collection",
      })}`,
    );
  rows.push(
    `${API}/works/${id}/similar?${iiif({
      collectionLabel: "More Like This",
      collectionSummary: `Similar to ${work.title}`,
    })}`,
  );
  for (const subject of (work.subject ?? []).slice(0, SUBJECT_ROWS))
    rows.push(
      `${API}/search?${iiif({
        query: `subject.label:"${subject.label}"`,
        collectionLabel: subject.label,
        collectionSummary: "Subject",
      })}`,
    );
  return rows;
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

const DcItemMock: React.FC = () => {
  const router = useRouter();
  const id = router.isReady ? String(router.query.id || DEFAULT_ID) : null;

  const [work, setWork] = useState<Work | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [whole, setWhole] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    setWork(null);
    setManifest(null);
    setCount(null);
    setError(null);
    setMore(false);
    setWhole(false);
    json<{ data: Work }>(`${API}/works/${id}`)
      .then(async ({ data }) => {
        if (!live) return;
        setWork(data);
        json<Manifest>(data.iiif_manifest).then((m) => live && setManifest(m));
        if (data.collection)
          json<{ pagination: { total_hits: number } }>(
            `${API}/search?${new URLSearchParams({
              query: `collection.id:"${data.collection.id}"`,
              size: "0",
            })}`,
          ).then((r) => live && setCount(r.pagination.total_hits));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id]);

  /** A plain press on a work in a row opens it here, not on the live site. */
  const stayHere = (item: { id: string }, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if ((event.button ?? 0) !== 0) return;
    const next = item.id.match(/\/works\/([0-9a-f-]{36})/)?.[1];
    if (!next) return;
    event.preventDefault();
    router.push({ query: { id: next } }, undefined, { shallow: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={styles.page}>
      <style>{FULL_WIDTH}</style>
      <p className={styles.notice}>
        Mock Digital Collections item page, for testing Clover 4
      </p>

      <div className={styles.bar}>
        <div className={styles.wide}>
          <span className={styles.wordmark}>Northwestern</span>
          <nav className={styles.barLinks} aria-label="University">
            <span>Libraries</span>
            <span>About</span>
            <span>Contact</span>
            <span>Sign in</span>
          </nav>
        </div>
      </div>

      <header className={styles.site}>
        <div className={styles.contained}>
          <p className={styles.siteTitle}>
            <span>Libraries</span> | <span>Digital Collections</span>
          </p>
          <form
            className={styles.search}
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="search"
              aria-label="Search"
              placeholder="Search by keyword or phrase"
            />
            <button type="submit">Search</button>
            <span className={styles.browse}>Browse Collections</span>
          </form>
        </div>
      </header>

      {/* A `div`, where the host's page has its `main`: Nextra's layout holds this one. */}
      <div>
        {/* An alert, so a screen reader announces a failed load. */}
        {error && (
          <p className={styles.contained} role="alert">
            Could not load: {error}
          </p>
        )}

        {work && (
          <div className={styles.viewer}>
            {/* As Digital Collections has it: no title over the stage, no information panel. */}
            <Viewer
              key={id}
              iiifContent={work.iiif_manifest}
              header={false}
              panel={false}
            />
          </div>
        )}

        {work && (
          <div className={styles.contained}>
            <section className={styles.summary}>
              <div>
                <h1 className={styles.title}>{work.title}</h1>
                {work.description?.map((text) => (
                  <p key={text} className={styles.description}>
                    {text}
                  </p>
                ))}
              </div>
              <div className={styles.share}>
                <span>Share</span>
                <a href={work.iiif_manifest}>View as IIIF</a>
              </div>
            </section>

            <div className={styles.actions}>
              <button type="button">Find this item</button>
              <button type="button">Cite this item</button>
              <button type="button">Download and share</button>
            </div>

            {manifest && (
              <section
                className={styles.metadata}
                data-expanded={more || undefined}
              >
                <dl>
                  {manifest.metadata?.map(({ label, value }) => (
                    <div key={values(label).join()}>
                      <dt>{values(label).join(", ")}</dt>
                      {values(value).map((text, index) => (
                        <dd key={index}>{text}</dd>
                      ))}
                    </div>
                  ))}
                  {manifest.requiredStatement && (
                    <div>
                      <dt>
                        {values(manifest.requiredStatement.label).join(", ")}
                      </dt>
                      {values(manifest.requiredStatement.value).map(
                        (text, index) => (
                          <dd key={index}>{text}</dd>
                        ),
                      )}
                    </div>
                  )}
                </dl>
                <button
                  type="button"
                  className={styles.more}
                  onClick={() => setMore(!more)}
                >
                  {more ? "Show Less" : "Show More"}
                </button>
              </section>
            )}

            {work.collection && (
              <section className={styles.collection}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API}/collections/${work.collection.id}/thumbnail?aspect=square`}
                  alt=""
                  width={128}
                  height={128}
                />
                <div>
                  <h2>{work.collection.title}</h2>
                  {count !== null && (
                    <p className={styles.count}>
                      {count.toLocaleString()} Works
                    </p>
                  )}
                  {/* Clamped to three lines until Show More, so none of it is out of reach. */}
                  {work.collection.description && (
                    <>
                      <p
                        className={styles.clamp}
                        data-expanded={whole || undefined}
                      >
                        {work.collection.description}
                      </p>
                      <button
                        type="button"
                        className={styles.more}
                        aria-expanded={whole}
                        onClick={() => setWhole(!whole)}
                      >
                        {whole ? "Show Less" : "Show More"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            <section className={styles.explore} aria-labelledby="explore">
              <h2 id="explore">Explore Further</h2>
              {id &&
                exploreFurther(id, work).map((url) => (
                  <Items
                    key={url}
                    iiifContent={url}
                    // Each row's title under "Explore Further".
                    headingLevel={3}
                    className={styles.row}
                    onSelect={stayHere}
                  />
                ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default DcItemMock;
