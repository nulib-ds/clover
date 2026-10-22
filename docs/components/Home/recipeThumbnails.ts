"use client";

import { useEffect, useState } from "react";

/*
 * Coverage's recipe (Cookbook 0032, a Collection) publishes no thumbnails for its
 * members. For this example alone (Mat, 2026-10-22; never `Collection` in general), each
 * member's is made from its first image's service, at a size its `info.json` prescribes:
 * one of its `sizes`, else the whole image at one of its tiles' scale factors, a level
 * the server keeps. Of those, the smallest that is still twice the thumbnail's drawn
 * size, else the largest.
 */

type Json = Record<string, any>;

/** Twice the size a member's thumbnail is drawn at, so it is sharp on a dense screen. */
const WANTED = 96;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

async function fetchJson(url: string): Promise<Json> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

interface Size {
  width: number;
  height: number;
}

/** The sizes an image's `info.json` prescribes. */
function prescribedSizes(info: Json): Size[] {
  const listed = (asArray(info.sizes) as Json[]).filter(
    (size) => size?.width > 0 && size?.height > 0,
  ) as Size[];
  if (listed.length) return listed;
  const { width, height } = info;
  if (!(width > 0 && height > 0)) return [];
  return (asArray(info.tiles) as Json[]).flatMap((tile) =>
    (asArray(tile?.scaleFactors) as number[]).map((scale) => ({
      width: Math.ceil(width / scale),
      height: Math.ceil(height / scale),
    })),
  );
}

/** Of the prescribed sizes, the smallest still `WANTED` wide, else the largest. */
function chooseSize(sizes: Size[]): Size | undefined {
  const byWidth = [...sizes].sort((a, b) => a.width - b.width);
  return (
    byWidth.find((size) => Math.min(size.width, size.height) >= WANTED) ??
    byWidth.at(-1)
  );
}

/** A thumbnail for a member Manifest, from its first Canvas's first image's service. */
async function thumbnailOf(manifestId: string): Promise<Json | undefined> {
  const manifest = await fetchJson(manifestId);
  const canvas = asArray(manifest.items)[0] as Json | undefined;
  const page = asArray(canvas?.items)[0] as Json | undefined;
  const annotation = asArray(page?.items)[0] as Json | undefined;
  const body = asArray(annotation?.body)[0] as Json | undefined;
  const service = asArray(body?.service)[0] as Json | undefined;
  const serviceId: string | undefined = service?.id ?? service?.["@id"];
  if (!serviceId) return undefined;
  const base = serviceId.replace(/\/$/, "");
  const size = chooseSize(
    prescribedSizes(await fetchJson(`${base}/info.json`)),
  );
  if (!size) return undefined;
  return {
    id: `${base}/full/${size.width},${size.height}/0/default.jpg`,
    type: "Image",
    format: "image/jpeg",
    width: size.width,
    height: size.height,
  };
}

/** The Collection, each member given a thumbnail where it has none. */
async function withThumbnails(url: string): Promise<Json> {
  const collection = await fetchJson(url);
  const items = await Promise.all(
    (asArray(collection.items) as Json[]).map(async (member) => {
      if (member?.thumbnail || member?.type !== "Manifest") return member;
      const thumbnail = await thumbnailOf(member.id).catch(() => undefined);
      return thumbnail ? { ...member, thumbnail: [thumbnail] } : member;
    }),
  );
  return { ...collection, items };
}

/** One read per page, however often the recipe is shown. */
const loaded = new Map<string, Promise<Json | string>>();

/**
 * The recipe's content: its Collection with its members' thumbnails once they are
 * known, or its address as published if they cannot be; `null` meanwhile.
 */
export function useRecipeContent(url: string): Json | string | null {
  const [content, setContent] = useState<Json | string | null>(null);
  useEffect(() => {
    let live = true;
    let read = loaded.get(url);
    if (!read) {
      read = withThumbnails(url).catch(() => url);
      loaded.set(url, read);
    }
    void read.then((value) => {
      if (live) setContent(value);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return content;
}
