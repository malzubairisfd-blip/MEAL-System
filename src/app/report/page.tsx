
"use client";

import React, { useState, createContext, useContext, useEffect } from 'react';
import dynamic from 'next/dynamic';
import leafletImage from 'leaflet-image';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { KPISection, TrendSection, SideIndicators, BottomDonuts, DataTable } from '@/components/dashboard-components';
import { Button } from '@/components/ui/button';
import { ClusterLayer, HeatmapLayer } from '@/components/leaflet-layers';
import type { FeatureCollection } from 'geojson';
import { useToast } from "@/hooks/use-toast";

// 1. Global Dashboard State
const DashboardContext = createContext<{
  selectedRegion: string | null;
  setSelectedRegion: React.Dispatch<React.SetStateAction<string | null>>;
  layerState: any;
  setLayerState: React.Dispatch<React.SetStateAction<any>>;
  mapInstance: L.Map | null;
  setMapInstance: React.Dispatch<React.SetStateAction<L.Map | null>>;
}>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  layerState: {},
  setLayerState: () => {},
  mapInstance: null,
  setMapInstance: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

// Dynamically import the map component to ensure it only runs on the client side
const WestAfricaMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});


export default function ReportPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [layerState, setLayerState] = useState({
    clusters: true,
    heatmap: false,
    incidents: true,
    admin: true,
  });
  const { toast } = useToast();

  const [clusterData, setClusterData] = useState<FeatureCollection | null>(null);
  const [incidentData, setIncidentData] = useState<FeatureCollection | null>(null);
  const [yemenGeoJSON, setYemenGeoJSON] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/data/clusters.geojson')
        .then(res => res.json())
        .then(data => setClusterData(data));
    fetch('/data/incidents.geojson')
        .then(res => res.json())
        .then(data => setIncidentData(data));
    fetch('/data/yemen.geojson')
        .then(res => res.json())
        .then(data => setYemenGeoJSON(data));
  }, []);

  const exportAction = (exportFn: () => void, format: string) => {
    toast({
      title: `Exporting ${format}`,
      description: "Your map image is being generated...",
    });
    try {
      exportFn();
    } catch(err: any) {
      toast({
        title: `Export Failed`,
        description: `Could not export map to ${format}. ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const exportPNG = () => {
    if (!mapInstance) return;
    leafletImage(mapInstance, (err: any, canvas: HTMLCanvasElement) => {
        if (err) {
            console.error('Error exporting map to PNG:', err);
            return;
        }
        const link = document.createElement('a');
        link.download = 'dashboard-map.png';
        link.href = canvas.toDataURL();
        link.click();
    });
  };

  const exportPDF = () => {
    if (!mapInstance) return;
    leafletImage(mapInstance, (err: any, canvas: HTMLCanvasElement) => {
        if (err) {
            console.error('Error exporting map to PDF:', err);
            return;
        }
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("landscape", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const width = pdfWidth - 20;
        const height = width / ratio;

        pdf.addImage(imgData, "PNG", 10, 10, width, height > pdfHeight - 20 ? pdfHeight - 20 : height);
        pdf.save("dashboard-map.pdf");
    });
  };

  return (
    <DashboardContext.Provider value={{ selectedRegion, setSelectedRegion, layerState, setLayerState, mapInstance, setMapInstance }}>
        <div className="dashboard">
            <div className="kpis">
                <KPISection />
            </div>
            <div className="map relative" id="map-container">
                <WestAfricaMap yemenGeoJSON={yemenGeoJSON} />
                <LayerToggles />
                {mapInstance && clusterData && <ClusterLayer data={clusterData} enabled={layerState.clusters}/>}
                {mapInstance && incidentData && <HeatmapLayer points={incidentData.features.map(f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], intensity: f.properties.confidence ?? 0.5 }))} enabled={layerState.heatmap}/>}
            </div>
            <div className="side">
                <SideIndicators />
            </div>
            <div className="trends">
                <TrendSection />
            </div>
            <div className="donuts">
                <BottomDonuts />
            </div>
             <div className="data-table">
                <DataTable />
            </div>
             <div className="export-buttons">
                <Button onClick={() => exportAction(exportPNG, 'PNG')}>Export Map as PNG</Button>
                <Button onClick={() => exportAction(exportPDF, 'PDF')}>Export Map as PDF</Button>
            </div>
      </div>
    </DashboardContext.Provider>
  );
}

function LayerToggles() {
  const { layerState, setLayerState } = useDashboard();
  return (
    <div className="absolute top-4 right-4 bg-white p-3 rounded shadow-lg z-[1000]">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.clusters}
            onChange={() => setLayerState(s => ({ ...s, clusters: !s.clusters }))} />
          Clusters
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.heatmap}
            onChange={() => setLayerState(s => ({ ...s, heatmap: !s.heatmap }))} />
          Security Heatmap
        </label>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.admin}
            onChange={() => setLayerState(s => ({ ...s, admin: !s.admin }))} />
          Admin Boundaries
        </label>
      </div>
    </div>
  );
}
