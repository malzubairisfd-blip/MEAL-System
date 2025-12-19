
"use client";

import { useDashboard } from "@/app/report/page";
import { useEffect } from "react";
import { geoJsonToLeafletLayer, createHeatmapLayer, createClusterLayer } from "@/lib/geojson-utils";
import type { FeatureCollection } from 'geojson';

export function ClusterLayer({ data }: { data: FeatureCollection }) {
  const { mapInstance, setSelectedRegion } = useDashboard();

  useEffect(() => {
    if (!data || !mapInstance) return;

    const layer = geoJsonToLeafletLayer(data, {
      colorByConfidence: true,
      onClick: (props) => {
        if(props.region) setSelectedRegion(props.region);
      },
    });

    layer.addTo(mapInstance);

    return () => {
      mapInstance.removeLayer(layer);
    };
  }, [data, mapInstance, setSelectedRegion]);

  return null;
}

export function HeatmapLayer({ data }: { data: FeatureCollection }) {
  const { mapInstance } = useDashboard();

  useEffect(() => {
    if (!data || !mapInstance) return;

    const layer = createHeatmapLayer(data.features);

    layer.addTo(mapInstance);

    return () => {
      mapInstance.removeLayer(layer);
    };
  }, [data, mapInstance]);

  return null;
}
