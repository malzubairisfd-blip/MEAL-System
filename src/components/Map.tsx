'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { FeatureCollection } from 'geojson';


interface MapProps {
    admin1: FeatureCollection | null;
    admin2: FeatureCollection | null;
    admin3: FeatureCollection | null;
}

export default function WestAfricaMap({ admin1, admin2, admin3 }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, layerState, selectedRegion, setSelectedRegion } = useDashboard();
  
  const admin1LayerRef = useRef<L.GeoJSON | null>(null);
  const admin2LayerRef = useRef<L.GeoJSON | null>(null);
  const admin3LayerRef = useRef<L.GeoJSON | null>(null);
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

  const manageGeoJsonLayer = (
      map: L.Map, 
      layerRef: React.MutableRefObject<L.GeoJSON | null>, 
      data: FeatureCollection | null, 
      visible: boolean, 
      defaultStyle: L.PathOptions,
      highlightStyle: L.PathOptions,
      selectedStyle: L.PathOptions,
      nameProperty: string
  ) => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (visible && data) {
      layerRef.current = L.geoJSON(data, {
        style: feature => {
          if (feature?.properties[nameProperty] === selectedRegion) {
            return selectedStyle;
          }
          return defaultStyle;
        },
        onEachFeature: (feature, layer) => {
          layer.on({
            mouseover: (e) => {
              if (feature.properties[nameProperty] !== selectedRegion) {
                e.target.setStyle(highlightStyle);
                e.target.bringToFront();
              }
            },
            mouseout: (e) => {
               if (feature.properties[nameProperty] !== selectedRegion) {
                 layerRef.current?.resetStyle(e.target);
               }
            },
            click: () => {
              const regionName = feature.properties[nameProperty];
              setSelectedRegion(current => (current === regionName ? null : regionName));
            }
          });
          if (feature.properties && feature.properties[nameProperty]) {
            layer.bindTooltip(feature.properties[nameProperty], {
              permanent: true, direction: 'center', className: 'admin-label'
            }).openTooltip();
          }
        }
      }).addTo(map);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    
    // Refresh layers to apply new styles when selectedRegion changes
    if (admin1LayerRef.current) mapRef.current.removeLayer(admin1LayerRef.current);
    if (admin2LayerRef.current) mapRef.current.removeLayer(admin2LayerRef.current);
    if (admin3LayerRef.current) mapRef.current.removeLayer(admin3LayerRef.current);
    
    manageGeoJsonLayer(mapRef.current, admin1LayerRef, admin1, layerState.admin1, 
        { color: "#4a5568", weight: 2, opacity: 0.8, fillOpacity: 0.1 }, // Default
        { weight: 3, color: '#333', fillOpacity: 0.3 }, // Highlight
        { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.7 }, // Selected
        'ADM1_EN'
    );
    manageGeoJsonLayer(mapRef.current, admin2LayerRef, admin2, layerState.admin2, 
        { color: "#718096", weight: 1.5, opacity: 0.7, fillOpacity: 0.1 },
        { weight: 3, color: '#333', fillOpacity: 0.3 },
        { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.7 },
        'ADM2_EN'
    );
    manageGeoJsonLayer(mapRef.current, admin3LayerRef, admin3, layerState.admin3, 
        { color: "#A0AEC0", weight: 1, opacity: 0.6, fillOpacity: 0.1 },
        { weight: 3, color: '#333', fillOpacity: 0.3 },
        { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.7 },
        'ADM3_EN'
    );
    
  }, [layerState, admin1, admin2, admin3, selectedRegion, setSelectedRegion]);


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
