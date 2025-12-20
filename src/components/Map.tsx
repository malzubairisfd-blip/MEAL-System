'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import type { Feature, FeatureCollection } from 'geojson';


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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [15.55, 48.52], // Centered on Yemen
      zoom: 6,
      preferCanvas: true,
    });
    mapRef.current = map;
    setMapInstance(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
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
      styles: { default: L.PathOptions, highlight: L.PathOptions, selected: L.PathOptions },
      nameProperty: string,
      isSelectable: boolean
  ) => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (visible && data) {
      layerRef.current = L.geoJSON(data, {
        style: (feature?: Feature) => {
          if (feature?.properties[nameProperty] === selectedRegion) {
            return styles.selected;
          }
          return styles.default;
        },
        onEachFeature: (feature, layer) => {
          // Always bind a tooltip, but don't make it permanent
          if (feature.properties && feature.properties[nameProperty]) {
            layer.bindTooltip(feature.properties[nameProperty], {
              direction: 'center', 
              className: 'admin-label',
              permanent: false // This is the key change
            });
          }
          
          layer.on({
            mouseover: (e) => {
              if (feature.properties[nameProperty] !== selectedRegion) {
                e.target.setStyle(styles.highlight);
              }
              e.target.bringToFront();
            },
            mouseout: (e) => {
              // Let the main style function handle resetting the style based on selection
               if (layerRef.current) {
                layerRef.current.resetStyle(e.target);
               }
            },
            click: () => {
              if(isSelectable) {
                const regionName = feature.properties[nameProperty];
                setSelectedRegion(current => (current === regionName ? null : regionName));
              }
            }
          });
        }
      }).addTo(map);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    
    // Refresh layers to apply new styles when selectedRegion changes or layer visibility changes
    manageGeoJsonLayer(mapRef.current, admin1LayerRef, admin1, layerState.admin1, 
        { default: { color: "#4a5568", weight: 2, opacity: 0.8, fillOpacity: 0.1 },
          highlight: { weight: 3, color: '#333', fillOpacity: 0.3 },
          selected: { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.5 } },
        'ADM1_EN',
        false // Not selectable
    );
    manageGeoJsonLayer(mapRef.current, admin2LayerRef, admin2, layerState.admin2, 
        { default: { color: "#718096", weight: 1.5, opacity: 0.7, fillOpacity: 0.1 },
          highlight: { weight: 3, color: '#333', fillOpacity: 0.3 },
          selected: { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.5 } },
        'ADM2_EN',
        false // Not selectable
    );
    manageGeoJsonLayer(mapRef.current, admin3LayerRef, admin3, layerState.admin3, 
        { default: { color: "#A0AEC0", weight: 1, opacity: 0.6, fillOpacity: 0.1 },
          highlight: { weight: 3, color: '#333', fillOpacity: 0.3 },
          selected: { color: '#d97706', weight: 3, opacity: 1, fillOpacity: 0.5 } },
        'ADM3_EN',
        true // This is the selectable layer
    );
    
  }, [layerState, admin1, admin2, admin3, selectedRegion, setSelectedRegion]);
  
  useEffect(() => {
    if (!admin3LayerRef.current) return;
    
    // Handle opening/closing tooltips based on selection
    admin3LayerRef.current.eachLayer(layer => {
      const feature = (layer as L.GeoJSON).feature as Feature;
      if (feature?.properties?.ADM3_EN === selectedRegion) {
        layer.openTooltip();
      } else {
        layer.closeTooltip();
      }
    });

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
