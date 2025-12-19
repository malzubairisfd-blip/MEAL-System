
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
    admin1: true,
    admin2: false,
    admin3: false,
  });
  const { toast } = useToast();

  const [clusterData, setClusterData] = useState<FeatureCollection | null>(null);
  const [incidentData, setIncidentData] = useState<FeatureCollection | null>(null);
  const [yemenAdmin1, setYemenAdmin1] = useState<FeatureCollection | null>(null);
  const [yemenAdmin2, setYemenAdmin2] = useState<FeatureCollection | null>(null);
  const [yemenAdmin3, setYemenAdmin3] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/data/clusters.geojson')
        .then(res => res.json())
        .then(data => setClusterData(data));
    fetch('/data/incidents.geojson')
        .then(res => res.json())
        .then(data => setIncidentData(data));
    fetch('/data/yemen_admin1.geojson')
        .then(res => res.json())
        .then(data => setYemenAdmin1(data));
    fetch('/data/yemen_admin2.geojson')
        .then(res => res.json())
        .then(data => setYemenAdmin2(data));
    fetch('/data/yemen_admin3.geojson')
        .then(res => res.json())
        .then(data => setYemenAdmin3(data));
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
                <WestAfricaMap 
                  admin1={yemenAdmin1}
                  admin2={yemenAdmin2}
                  admin3={yemenAdmin3}
                />
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
        <h4 className="font-bold text-sm mb-1">Data Layers</h4>
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
        <hr className="my-2"/>
        <h4 className="font-bold text-sm mb-1">Admin Boundaries</h4>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.admin1}
            onChange={() => setLayerState(s => ({ ...s, admin1: !s.admin1 }))} />
          Admin Level 1
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.admin2}
            onChange={() => setLayerState(s => ({ ...s, admin2: !s.admin2 }))} />
          Admin Level 2
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.admin3}
            onChange={() => setLayerState(s => ({ ...s, admin3: !s.admin3 }))} />
          Admin Level 3
        </label>
      </div>
    </div>
  );
}
