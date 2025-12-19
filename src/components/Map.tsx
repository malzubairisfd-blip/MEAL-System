'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";

export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, layerState } = useDashboard();
  const adminLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [13, 2],
      zoom: 4,
      preferCanvas: true,
    });
    mapRef.current = map;
    setMapInstance(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [setMapInstance]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (layerState.admin && !adminLayerRef.current) {
      adminLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
        attribution: '© OpenStreetMap contributors, © CARTO',
        pane: 'shadowPane' // to render labels above other layers
      }).addTo(mapRef.current);
    } else if (!layerState.admin && adminLayerRef.current) {
      mapRef.current.removeLayer(adminLayerRef.current);
      adminLayerRef.current = null;
    }
  }, [layerState.admin]);

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
