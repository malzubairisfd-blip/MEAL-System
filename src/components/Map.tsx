
'use client';

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { Feature, FeatureCollection } from 'geojson';

// Helper function to create an SVG pie chart
const createPieChartIcon = (percentage: number, size: number) => {
    const r = 20; // radius of the circle
    const circumference = 2 * Math.PI * r;
    const arcLength = (percentage / 100) * circumference;

    const x = r + Math.sin(2 * Math.PI * (percentage / 100)) * r;
    const y = r - Math.cos(2 * Math.PI * (percentage / 100)) * r;
    const largeArcFlag = percentage > 50 ? 1 : 0;

    const pathData = `M ${r},${r} L ${r},0 A ${r},${r} 0 ${largeArcFlag},1 ${x},${y} z`;

    return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${2*r} ${2*r}" style="transform-origin: center;">
            <circle cx="${r}" cy="${r}" r="${r}" fill="#e5e7eb" />
            <path d="${pathData}" fill="#16a34a" />
        </svg>
    `;
};


export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, selectedFeatures, miniChartLayerRef } = useDashboard();
  
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

      // Initialize the layer group for mini charts
      if (!miniChartLayerRef.current) {
        miniChartLayerRef.current = L.layerGroup().addTo(mapRef.current);
      }
    }
  }, [setMapInstance, miniChartLayerRef]);
  
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
          return { color: '#fefefe', weight: 3, opacity: 1, fillColor: '#005999', fillOpacity: 0.6 };
        }
        return { color: "#787878", weight: 1, opacity: 0.6, fillColor: '#eeeeef', fillOpacity: 0.5 };
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

  // Effect to draw mini charts
  useEffect(() => {
    if (!mapRef.current || !miniChartLayerRef.current) return;
    
    const layer = miniChartLayerRef.current;
    layer.clearLayers();

    if (!selectedFeatures || selectedFeatures.length === 0) return;

    // 1. Calculate grand total of beneficiaries across all selected subdistricts
    const grandTotal = selectedFeatures.reduce(
        (sum: number, f: any) => sum + Number(f.properties?.total_beneficiaries ?? 0), 0
    );

    if (grandTotal === 0) return;

    // 2. Create one pie chart marker per selected subdistrict
    selectedFeatures.forEach((feature: any) => {
        const value = Number(feature.properties?.total_beneficiaries ?? 0);
        if (value <= 0) return;

        const bounds = L.geoJSON(feature).getBounds();
        if (!bounds.isValid()) return;

        const center = bounds.getCenter();
        const percentage = (value / grandTotal) * 100;
        
        // Scale icon size based on value, with min and max
        const iconSize = Math.max(30, Math.min(80, value / 10)); 

        const pieIcon = L.divIcon({
            html: createPieChartIcon(percentage, iconSize),
            className: 'leaflet-pie-icon', // Use a class for potential styling
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2]
        });

        const marker = L.marker(center, { icon: pieIcon });
        marker.bindTooltip(`Beneficiaries: ${value.toLocaleString()}`);
        layer.addLayer(marker);
    });

  }, [selectedFeatures]);

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
