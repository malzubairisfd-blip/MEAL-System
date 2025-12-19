"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { useDashboard } from '@/app/report/page';
import { ClusterLayer, HeatmapLayer as IncidentsHeatmapLayer } from '@/components/leaflet-layers';

export function WestAfricaMap() {
  const { setMapInstance, layerState } = useDashboard();
  const [clusterData, setClusterData] = useState(null);
  const [incidentsData, setIncidentsData] = useState(null);

  useEffect(() => {
    fetch('/data/clusters.geojson').then(res => res.json()).then(setClusterData);
    fetch('/data/incidents.geojson').then(res => res.json()).then(setIncidentsData);
  }, []);

  return (
    <MapContainer
      key="west-africa-map"
      center={[13, 2]}
      zoom={4}
      style={{ height: '100%', width: "100%", borderRadius: "12px" }}
      whenCreated={setMapInstance}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {layerState.clusters && clusterData && <ClusterLayer data={clusterData} />}
      {layerState.heatmap && incidentsData && <IncidentsHeatmapLayer data={incidentsData} />}
      
    </MapContainer>
  );
}
