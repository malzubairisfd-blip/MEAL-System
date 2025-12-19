"use client";

import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useDashboard } from '@/app/report/page';
import { HeatmapLayer } from './HeatmapLayer';

// Dummy data as specified
const bubbles = [
  { lat: 14.7, lng: -17.4, value: 500000, label: "Dakar", region: "Senegal" },
  { lat: 9.0, lng: 8.0, value: 2500000, label: "Abuja", region: "Nigeria" },
  { lat: 12.6, lng: -8.0, value: 1800000, label: "Bamako", region: "Mali" },
  { lat: 13.5, lng: 2.1, value: 1500000, label: "Niamey", region: "Niger" },
];

const incidents = [
  { lat: 13.0, lng: -7.5 }, { lat: 14.0, lng: -6.0 }, { lat: 12.5, lng: -1.5 },
  { lat: 11.0, lng: 9.0 }, { lat: 10.0, lng: 12.0 }, { lat: 13.8, lng: 3.0 },
];

export function WestAfricaMap() {
  const { setSelectedRegion, layerState } = useDashboard();
  
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <MapContainer 
      key="west-africa-map" // Stable key to prevent re-initialization issues
      center={[13, 2]} 
      zoom={4} 
      style={{ height: '100%', width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {layerState.bubbles && bubbles.map((b, i) => (
        <CircleMarker
          key={`bubble-${i}`}
          center={[b.lat, b.lng]}
          radius={Math.sqrt(b.value) / 200}
          fillColor="#2b8cbe"
          fillOpacity={0.7}
          stroke={false}
          eventHandlers={{
            click: () => setSelectedRegion(b.region)
          }}
        >
          <Popup>{b.label}: {b.value.toLocaleString()}</Popup>
        </CircleMarker>
      ))}

      {layerState.incidents && incidents.map((p, i) => (
        <CircleMarker
          key={`incident-${i}`}
          center={[p.lat, p.lng]}
          radius={2}
          fillColor="#e34a33"
          fillOpacity={0.6}
          stroke={false}
        />
      ))}

      <HeatmapLayer points={incidents} enabled={layerState.heatmap} />
    </MapContainer>
  );
}