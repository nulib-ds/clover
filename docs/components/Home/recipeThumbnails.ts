"use client";

import { useEffect, useState } from "react";

import { thumbnailFrom } from "docs/lib/iiif-image-sizes";

/*
 * The Natural story's recipe (Cookbook 0032, a Collection, until another is chosen from
 * its list) publishes no thumbnails for its members. For this example alone (Mat,
 * 2026-10-22; never `Collection` in general), each
 * member's is made from its first image's service, at a size its `info.json` allows
 * (`thumbnailFrom`): twice the thumbnail's drawn size where the server makes any, else
 * the smallest it keeps that is still that size, else the largest.
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
  const sized = thumbnailFrom(
    base,
    await fetchJson(`${base}/info.json`),
    WANTED,
  );
  return sized && { ...sized, type: "Image", format: "image/jpeg" };
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
