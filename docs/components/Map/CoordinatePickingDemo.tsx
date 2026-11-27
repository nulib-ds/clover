"use client";

import CloverMap from "docs/components/DynamicImports/Map";
import { useId, useState } from "react";

/** A field's number, where it holds one in range; else nothing. */
const within = (value: string, most: number): number | null => {
  const number = Number(value);
  return value.trim() !== "" &&
    Number.isFinite(number) &&
    Math.abs(number) <= most
    ? number
    : null;
};

/**
 * 3.x's Map picking a coordinate: a click on the map, or the two fields under it, which
 * the keyboard reaches, set the same marker (WCAG 2.1.1; ACCESSIBILITY.md D14). A click
 * fills the fields in, and a coordinate typed in moves the marker.
 */
const CoordinatePickingDemo = () => {
  const id = useId();
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [typed, setTyped] = useState({ lat: "", lng: "" });

  const pick = (lat: number, lng: number) => {
    setCoordinates({ lat, lng });
    setTyped({ lat: String(lat), lng: String(lng) });
  };
  const type = (field: "lat" | "lng", value: string) => {
    const next = { ...typed, [field]: value };
    setTyped(next);
    const lat = within(next.lat, 90);
    const lng = within(next.lng, 180);
    if (lat !== null && lng !== null) setCoordinates({ lat, lng });
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ position: "relative", height: "400px" }}>
        <CloverMap
          center={{ latitude: 42.045, longitude: -87.688, zoom: 11 }}
          markers={
            coordinates
              ? [
                  {
                    latitude: coordinates.lat,
                    longitude: coordinates.lng,
                    label: "Selected coordinate",
                  },
                ]
              : []
          }
          onMapClick={([lng, lat]) => pick(lat, lng)}
          useCrosshairCursor
        />
      </div>
      <fieldset
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          border: 0,
          margin: 0,
          padding: 0,
        }}
      >
        <legend style={{ marginBottom: "0.5rem" }}>Or type a coordinate</legend>
        {(
          [
            ["lat", "Latitude", 90],
            ["lng", "Longitude", 180],
          ] as const
        ).map(([field, label, most]) => (
          <label
            key={field}
            htmlFor={`${id}-${field}`}
            style={{ display: "grid", gap: "0.25rem" }}
          >
            {label}
            <input
              id={`${id}-${field}`}
              type="number"
              inputMode="decimal"
              step="any"
              min={-most}
              max={most}
              value={typed[field]}
              onChange={(event) => type(field, event.target.value)}
              style={{
                fontFamily: "monospace",
                padding: "0.25rem 0.5rem",
                border:
                  "1px solid color-mix(in srgb, var(--gray-11) 75%, var(--color-background))",
                borderRadius: "0.375rem",
                minHeight: "24px",
              }}
            />
          </label>
        ))}
      </fieldset>
      <output
        style={{
          display: "block",
          minHeight: "1.5rem",
          fontFamily: "monospace",
          fontSize: "0.875rem",
        }}
      >
        {coordinates
          ? `longitude: ${coordinates.lng}, latitude: ${coordinates.lat}`
          : "Click the map, or type a coordinate, to pick one."}
      </output>
    </div>
  );
};

export default CoordinatePickingDemo;
