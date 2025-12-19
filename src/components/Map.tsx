
'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDashboard } from "@/app/report/page";
import { ClusterLayer, HeatmapLayer } from "./leaflet-layers";

// Dummy data for demonstration
const clusterData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "cluster": false, "confidence": 0.92, "clusterId": 12, "region": "Nigeria" },
      "geometry": { "type": "Point", "coordinates": [8.6753, 9.0820] }
    },
    {
      "type": "Feature",
      "properties": { "cluster": false, "confidence": 0.75, "clusterId": 13, "region": "Mali" },
      "geometry": { "type": "Point", "coordinates": [-4.0, 17.0] }
    },
     {
      "type": "Feature",
      "properties": { "cluster": false, "confidence": 0.6, "clusterId": 14, "region": "Niger" },
      "geometry": { "type": "Point", "coordinates": [8.0, 17.5] }
    }
  ]
};

const incidentData = {
    "type": "FeatureCollection",
    "features": [
        { "type": "Feature", "properties": { "confidence": 0.9 }, "geometry": { "type": "Point", "coordinates": [9, 10] } },
        { "type": "Feature", "properties": { "confidence": 0.8 }, "geometry": { "type": "Point", "coordinates": [-3, 16] } },
        { "type": "Feature", "properties": { "confidence": 0.85 }, "geometry": { "type": "Point", "coordinates": [7, 18] } }
    ]
};


export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setMapInstance, layerState } = useDashboard();

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
    >
        {mapRef.current && (
            <>
                {layerState.clusters && <ClusterLayer data={clusterData} />}
                {layerState.heatmap && <HeatmapLayer data={incidentData} />}
            </>
        )}
    </div>
  );
}
