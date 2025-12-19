"use client";

import { useMap } from "react-leaflet";
import { useEffect } from "react";
import { geoJsonToLeafletLayer, createHeatmapLayer, createClusterLayer } from "@/lib/geojson-utils";
import { useDashboard } from "@/app/report/page";

export function ClusterLayer({ data }: { data: any }) {
  const map = useMap();
  const { setSelectedRegion } = useDashboard();

  useEffect(() => {
    if (!data) return;

    const layer = createClusterLayer(data.features);
    
    layer.on('click', (e: any) => {
        if (e.layer.feature?.properties?.region) {
            setSelectedRegion(e.layer.feature.properties.region);
        }
    });

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [data, map, setSelectedRegion]);

  return null;
}

export function HeatmapLayer({ data }: { data: any }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;

    const layer = createHeatmapLayer(data.features);

    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [data, map]);

  return null;
}
