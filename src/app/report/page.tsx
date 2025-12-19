"use client";

import React, { useState, createContext, useContext } from 'react';
import dynamic from 'next/dynamic';
import { KPISection, TrendSection, SideIndicators, BottomDonuts, LayerToggles } from '@/components/dashboard-components';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 1. Global Dashboard State
const DashboardContext = createContext<{
  selectedRegion: string | null;
  setSelectedRegion: React.Dispatch<React.SetStateAction<string | null>>;
  layerState: any;
  setLayerState: React.Dispatch<React.SetStateAction<any>>;
}>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  layerState: {},
  setLayerState: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

// Dynamically import the map component to ensure it only runs on the client side
const WestAfricaMap = dynamic(() => import('@/components/Map').then(mod => mod.WestAfricaMap), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});


export default function ReportPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [layerState, setLayerState] = useState({
    bubbles: true,
    heatmap: false,
    incidents: true,
  });

  const exportPNG = async () => {
    const el = document.getElementById("map-container");
    if (!el) return;

    const canvas = await html2canvas(el, { useCORS: true });
    const link = document.createElement("a");
    link.download = "dashboard-map.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const exportPDF = async () => {
    const el = document.getElementById("map-container");
    if (!el) return;

    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("landscape", "mm", "a4");
    pdf.addImage(img, "PNG", 10, 10, 280, 160);
    pdf.save("dashboard-map.pdf");
  };

  return (
    <DashboardContext.Provider value={{ selectedRegion, setSelectedRegion, layerState, setLayerState }}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridColumn: 'span 12' }}>
            <Button onClick={exportPNG}>Export Map as PNG</Button>
            <Button onClick={exportPDF}>Export Map as PDF</Button>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}