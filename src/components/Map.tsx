
'use client';

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { Feature, FeatureCollection } from 'geojson';

export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance } = useDashboard();
  
  const admin1LayerRef = useRef<L.GeoJSON | null>(null);
  const admin2LayerRef = useRef<L.GeoJSON | null>(null);
  const admin3LayerRef = useRef<L.GeoJSON | null>(null);
  const selectionLayerRef = useRef<L.GeoJSON | null>(null);

  const [admin1, setAdmin1] = useState<FeatureCollection | null>(null);
  const [admin2, setAdmin2] = useState<FeatureCollection | null>(null);
  const [admin3, setAdmin3] = useState<FeatureCollection | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<any | null>(null);

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

  const createLayer = (
    data: FeatureCollection | null, 
    style: L.PathOptions, 
    nameProperty: string, 
    isSelectable: boolean
  ) => {
    if (!mapRef.current || !data) return null;
    
    const layer = L.geoJSON(data, {
      style: (feature?: Feature) => feature?.properties?.[nameProperty] === selectedRegion?.properties?.[nameProperty] ? { ...style, color: '#d97706', weight: 3 } : style,
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => e.target.setStyle({ weight: 3, color: '#333' }),
          mouseout: () => geoJsonLayer?.resetStyle(layer),
          click: () => {
            if (isSelectable) {
              setSelectedRegion(feature);
            }
          }
        });
      }
    });
    const geoJsonLayer = layer.addTo(mapRef.current);
    return geoJsonLayer;
  };
  
  useEffect(() => {
    if (admin1LayerRef.current) mapRef.current?.removeLayer(admin1LayerRef.current);
    admin1LayerRef.current = createLayer(admin1, { color: "#4a5568", weight: 2, opacity: 0.8, fillOpacity: 0.1 }, 'ADM1_EN', false);

    if (admin2LayerRef.current) mapRef.current?.removeLayer(admin2LayerRef.current);
    admin2LayerRef.current = createLayer(admin2, { color: "#718096", weight: 1.5, opacity: 0.7, fillOpacity: 0.1 }, 'ADM2_EN', false);

    if (admin3LayerRef.current) mapRef.current?.removeLayer(admin3LayerRef.current);
    admin3LayerRef.current = createLayer(admin3, { color: "#A0AEC0", weight: 1, opacity: 0.6, fillOpacity: 0.1 }, 'ADM3_EN', true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin1, admin2, admin3, selectedRegion]);

  useEffect(() => {
    if (selectionLayerRef.current) {
        mapRef.current?.removeLayer(selectionLayerRef.current);
    }
    if (selectedRegion && mapRef.current) {
        selectionLayerRef.current = L.geoJSON(selectedRegion, {
            style: {
                color: '#d97706',
                weight: 3,
                opacity: 1,
                fillColor: '#fde047',
                fillOpacity: 0.5
            }
        }).addTo(mapRef.current);
        
        selectionLayerRef.current.bindTooltip(selectedRegion.properties.ADM3_EN, {
            permanent: true,
            direction: 'center',
            className: 'admin-label'
        }).openTooltip();
    }
  }, [selectedRegion]);


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
