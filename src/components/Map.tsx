'use client';

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function WestAfricaMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // 🔒 Initialize ONCE
    mapRef.current = L.map(containerRef.current, {
      center: [13, 2],
      zoom: 4,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(mapRef.current);

    // ✅ CLEANUP — THIS IS THE KEY
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();   // 🔥 destroys Leaflet instance
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "12px",
      }}
    />
  );
}
