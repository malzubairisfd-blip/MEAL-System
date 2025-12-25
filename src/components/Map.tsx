

'use client';

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { Feature, FeatureCollection } from 'geojson';

export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, selectedFeatures } = useDashboard();
  
  const admin1LayerRef = useRef<L.GeoJSON | null>(null);
  const admin2LayerRef = useRef<L.GeoJSON | null>(null);
  const admin3LayerRef = useRef<L.GeoJSON | null>(null);

  const [admin1, setAdmin1] = useState<FeatureCollection | null>(null);
  const [admin2, setAdmin2] = useState<FeatureCollection | null>(null);
  const [admin3, setAdmin3] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/data/yemen_admin1.geojson').then(res => res.json()).then(data => setAdmin1(data));
    fetch('/data/yemen_admin2.geojson').then(res => res.json()).then(data => setAdmin2(data));
    fetch('/data/yemen_admin3.geojson').then(res => res.json()).then(data => setAdmin3(data));
  }, []);

  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [15.55, 48.52],
        zoom: 6,
        preferCanvas: true,
      });
      mapRef.current = map;
      setMapInstance(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

    }
  }, [setMapInstance]);
  
  useEffect(() => {
    if (!mapRef.current || !admin1 || !admin2 || !admin3) return;

    // Clear existing layers
    if (admin1LayerRef.current) mapRef.current.removeLayer(admin1LayerRef.current);
    if (admin2LayerRef.current) mapRef.current.removeLayer(admin2LayerRef.current);
    if (admin3LayerRef.current) mapRef.current.removeLayer(admin3LayerRef.current);

    // Get P-codes of selected features for efficient lookup
    const selectedPcodes = new Set(selectedFeatures.map(f => f.properties?.ADM3_PCODE));

    // Draw base layers
    admin1LayerRef.current = L.geoJSON(admin1, { style: { color: "#4a5568", weight: 2, opacity: 0.8, fillOpacity: 0.1 } }).addTo(mapRef.current);
    admin2LayerRef.current = L.geoJSON(admin2, { style: { color: "#718096", weight: 1.5, opacity: 0.7, fillOpacity: 0.1 } }).addTo(mapRef.current);

    // Draw Admin3 layer with conditional styling and labels
    const highlightedLayers: L.Layer[] = [];
    admin3LayerRef.current = L.geoJSON(admin3, {
      style: (feature) => {
        if (feature && selectedPcodes.has(feature.properties.ADM3_PCODE)) {
          return { color: '#d97706', weight: 3, opacity: 1, fillColor: '#fde047', fillOpacity: 0.5 };
        }
        return { color: "#A0AEC0", weight: 1, opacity: 0.6, fillOpacity: 0.1 };
      },
      onEachFeature: (feature, layer) => {
        if (feature && selectedPcodes.has(feature.properties.ADM3_PCODE)) {
          highlightedLayers.push(layer);
          const label = feature.properties.ADM3_AR;
          if (label) {
            layer.bindTooltip(label, {
              permanent: true,
              direction: 'center',
              className: 'admin-label' // Custom class for styling
            });
          }
        }
      }
    }).addTo(mapRef.current);

    // Zoom to highlighted features
    if (highlightedLayers.length > 0) {
      const group = L.featureGroup(highlightedLayers);
      mapRef.current.fitBounds(group.getBounds(), { padding: [30, 30] });
    } else {
      // Reset view if no features are selected
      mapRef.current.setView([15.55, 48.52], 6);
    }

  }, [admin1, admin2, admin3, selectedFeatures]);


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
