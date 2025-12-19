"use client";

import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { useEffect } from "react";

export function HeatmapLayer({ points, enabled }: {
  points: { lat: number; lng: number; intensity?: number }[];
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !points || points.length === 0) return;

    const heat = (L as any).heatLayer(
      points.map(p => [p.lat, p.lng, p.intensity ?? 0.6]),
      {
        radius: 25,
        blur: 15,
        maxZoom: 6,
        gradient: {
          0.2: "blue",
          0.4: "cyan",
          0.6: "yellow",
          0.8: "orange",
          1.0: "red"
        }
      }
    ).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [enabled, points, map]);

  return null;
}