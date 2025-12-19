'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { FeatureCollection } from 'geojson';


export default function WestAfricaMap({ yemenGeoJSON }: { yemenGeoJSON: FeatureCollection | null }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, layerState } = useDashboard();
  const adminLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [15.55, 48.52], // Centered on Yemen
      zoom: 6,
      preferCanvas: true,
    });
    mapRef.current = map;
    setMapInstance(map);

    tileLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [setMapInstance]);

  useEffect(() => {
    if (!mapRef.current || !yemenGeoJSON) return;

    if (layerState.admin && !adminLayerRef.current) {
      adminLayerRef.current = L.geoJSON(yemenGeoJSON, {
        style: {
          color: "#4a5568",
          weight: 1,
          opacity: 0.6,
          fillColor: "#CBD5E0",
          fillOpacity: 0.1
        }
      }).addTo(mapRef.current);
    } else if (!layerState.admin && adminLayerRef.current) {
      mapRef.current.removeLayer(adminLayerRef.current);
      adminLayerRef.current = null;
    }
  }, [layerState.admin, yemenGeoJSON]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "12px",
        position: 'relative',
        zIndex: 0
      }}
    />
  );
}
