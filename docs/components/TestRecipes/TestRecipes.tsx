import CloverCanvas from "docs/components/DynamicImports/Canvas";
import { cookbookRecipes } from "docs/components/CookbookRecipes/cookbookRecipes";
import { useEffect, useState } from "react";

/**
 * THROWAWAY (2026-10-19): ten Cookbook recipes chosen at random, each in a standalone
 * Canvas loading its Manifest's first Canvas (`iiifContent`), to catch what shows while
 * many load at once. Lists any image that fails, with what it asked for. Delete with
 * `pages/test/recipes.mdx` once the issue is found.
 */
export default function TestRecipes() {
  const [picked, setPicked] = useState<typeof cookbookRecipes>([]);
  const [broken, setBroken] = useState<string[]>([]);
  useEffect(() => {
    const pool = cookbookRecipes.filter((recipe) => recipe.resource);
    // `?ids=0019,0022` for those recipes, else ten at random.
    const ids = new URLSearchParams(window.location.search).get("ids");
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setPicked(
      ids
        ? pool.filter((recipe) =>
            ids.split(",").some((id) => recipe.id.includes(`/${id}-`)),
          )
        : shuffled.slice(0, 10),
    );
    const onError = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target?.tagName !== "IMG") return;
      const image = target as HTMLImageElement;
      setBroken((list) => [
        ...list,
        `${image.currentSrc || image.src || "(no src)"} · ${image.className || "(no class)"} · alt=${JSON.stringify(image.getAttribute("alt"))}`,
      ]);
    };
    document.addEventListener("error", onError, true);
    return () => document.removeEventListener("error", onError, true);
  }, []);
  return (
    <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.25rem" }}>Ten recipes, at random</h1>
      <p>
        Reload for another ten. Broken images:{" "}
        <strong data-testid="broken-count">{broken.length}</strong>
      </p>
      {broken.length > 0 && (
        <ol style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
          {broken.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
        }}
      >
        {picked.map((recipe) => (
          <section key={recipe.id}>
            <h2 style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>
              {recipe.id}
            </h2>
            <div
              style={{
                position: "relative",
                height: "320px",
                backgroundColor: "#f0f0f0",
              }}
            >
              <CloverCanvas
                iiifContent={recipe.resource}
                label={recipe.title}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
