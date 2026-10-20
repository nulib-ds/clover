"use client";

import CloverMap from "docs/components/DynamicImports/Map";
import { useState } from "react";

const CoordinatePickingDemo = () => {
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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
          onMapClick={([lng, lat]) => setCoordinates({ lng, lat })}
          useCrosshairCursor
        />
      </div>
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
          : "Click the map to pick coordinates."}
      </output>
    </div>
  );
};

export default CoordinatePickingDemo;
