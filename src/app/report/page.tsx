"use client";

import React, { useState, createContext, useContext, useEffect } from 'react';
import dynamic from 'next/dynamic';
import leafletImage from 'leaflet-image';
import jsPDF from 'jspdf';
import { KPISection, TrendSection, SideIndicators, BottomDonuts, LayerToggles, DataTable } from '@/components/dashboard-components';
import { Button } from '@/components/ui/button';

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
  });

  const exportPNG = () => {
    if (!mapInstance) return;
    leafletImage(mapInstance, (err, canvas) => {
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
    leafletImage(mapInstance, (err, canvas) => {
        if (err) {
            console.error('Error exporting map to PDF:', err);
            return;
        }
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF("landscape", "mm", "a4");
        pdf.addImage(img, "PNG", 10, 10, 280, 160);
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
                <WestAfricaMap />
                <LayerToggles />
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridColumn: 'span 4' }}>
                <DataTable />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridColumn: 'span 4' }}>
                <Button onClick={exportPNG}>Export Map as PNG</Button>
                <Button onClick={exportPDF}>Export Map as PDF</Button>
            </div>
      </div>
    </DashboardContext.Provider>
  );
}
