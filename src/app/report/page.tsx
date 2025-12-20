
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import leafletImage from 'leaflet-image';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from '@/lib/types';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronUp, ChevronsUpDown, FileDown, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { ColumnMapping, MAPPING_FIELDS } from '@/components/report/ColumnMapping';
import { KeyFigures } from '@/components/report/KeyFigures';
import { BeneficiariesByVillageChart, BeneficiariesByDayChart, WomenAndChildrenDonut } from '@/components/report/TableBarCharts';
import { GenderVisual } from '@/components/report/GenderVisual';
import { BubbleStats } from '@/components/report/BubbleStats';

// Global Dashboard State
export const DashboardContext = React.createContext<{
  mapInstance: L.Map | null;
  setMapInstance: React.Dispatch<React.SetStateAction<L.Map | null>>;
}>({
  mapInstance: null,
  setMapInstance: () => {},
});

export const useDashboard = () => React.useContext(DashboardContext);

// Dynamically import the map component
const WestAfricaMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

export default function ReportPage() {
  const { toast } = useToast();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Data and Mapping State
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<RecordRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [processedData, setProcessedData] = useState<any>(null);

  // Load data from cache on initial render
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const cacheId = sessionStorage.getItem('cacheId');
      if (!cacheId) {
        toast({ title: "No Data", description: "Please upload data first.", variant: "destructive" });
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
        if (!res.ok) throw new Error("Failed to load data from server cache");
        const data = await res.json();
        setAllRows(data.rows || []);
        if (data.rows && data.rows.length > 0) {
            setColumns(Object.keys(data.rows[0]));
        } else {
            toast({title: "No Records", description: "The cached data contains no records.", variant: "destructive"});
        }
      } catch (error: any) {
        toast({ title: "Error loading data", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);

  // Process data whenever mapping or rows change
  useEffect(() => {
    if (allRows.length > 0 && Object.keys(mapping).length > 0) {
      const getUnique = (field: string) => new Set(allRows.map(r => r[mapping[field]]).filter(Boolean)).size;
      const getSum = (field: string) => allRows.reduce((acc, r) => acc + (Number(r[mapping[field]]) === 1 ? 1 : 0), 0);
      const getUniqueCount = (field: string) => new Set(allRows.map(r => r[mapping[field]]).filter(Boolean)).size;
      
      const benefByVillage = allRows.reduce((acc, r) => {
        const village = r[mapping['Village targeted']];
        if (village) {
            acc[village] = (acc[village] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const benefByDay = allRows.reduce((acc, r) => {
        const day = r[mapping['Registration days']];
        if(day) {
            const date = new Date(day).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const data = {
        keyFigures: {
          teamLeaders: getUnique('Team Leaders'),
          surveyors: getUnique('Surveyor'),
          registrationDays: getUnique('Registration days'),
          villages: getUnique('Village targeted'),
        },
        charts: {
          beneficiariesByVillage: Object.entries(benefByVillage).map(([name, value]) => ({name, value})),
          beneficiariesByDay: Object.entries(benefByDay).map(([name, value]) => ({name, value})),
          womenStats: [
            { name: 'Pregnant', value: getSum('Pregnant woman') },
            { name: 'Mother <5', value: getSum('Mothers having a child under 5 years old') },
            { name: 'Handicapped Child', value: getSum('Women have handicapped children from 5 to 17 years old') },
          ],
          gender: {
            male: getSum('Household Gender'),
            female: allRows.length - getSum('Household Gender'),
          },
        },
        bubbles: [
          { label: 'HH Registered', value: getUniqueCount('Household registered'), icon: 'home' },
          { label: 'Male HH', value: getSum('Household Gender'), icon: 'male' },
          { label: 'Female HH', value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 2).length, icon: 'female' },
          { label: 'Dislocated HH', value: getSum('Dislocated household'), icon: 'move' },
          { label: 'HH with Guest', value: getSum('Household having dislocated guest'), icon: 'users' },
          { label: 'Beneficiaries', value: getUniqueCount('Beneficiaries registered'), icon: 'users' },
          { label: 'Pregnant', value: getSum('Pregnant woman'), icon: 'female' },
          { label: 'Handicapped Woman', value: getSum('Handicapped Woman'), icon: 'female' },
          { label: 'Dislocated Woman', value: getSum('Dislocated Woman'), icon: 'move' },
        ]
      };
      setProcessedData(data);
    }
  }, [allRows, mapping]);

  const exportAction = (exportFn: () => void, format: string) => {
    toast({ title: `Exporting ${format}`, description: "Your map image is being generated..." });
    try { exportFn(); } catch (err: any) {
      toast({ title: `Export Failed`, description: `Could not export map to ${format}. ${err.message}`, variant: "destructive" });
    }
  };

  const exportPNG = () => {
    if (!mapInstance) return;
    leafletImage(mapInstance, (err: any, canvas: HTMLCanvasElement) => {
      if (err) { console.error('Error exporting map to PNG:', err); return; }
      const link = document.createElement('a');
      link.download = 'dashboard-map.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const exportPDF = () => {
    if (!mapInstance) return;
    leafletImage(mapInstance, (err: any, canvas: HTMLCanvasElement) => {
      if (err) { console.error('Error exporting map to PDF:', err); return; }
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const width = pdfWidth - 20;
      const height = width / ratio;
      pdf.addImage(imgData, "PNG", 10, 10, width, height > pdfHeight - 20 ? pdfHeight - 20 : height);
      pdf.save("dashboard-map.pdf");
    });
  };
  
    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading Report Data...</span></div>;
    }

  return (
    <DashboardContext.Provider value={{ mapInstance, setMapInstance }}>
      <div className="space-y-6">
        <Collapsible defaultOpen={true}>
          <Card>
            <CollapsibleTrigger asChild>
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                    <div>
                        <CardTitle>Mapping</CardTitle>
                        <CardDescription>Map your data columns to the fields required for the report.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ColumnMapping columns={columns} mapping={mapping} setMapping={setMapping} />
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        {processedData && (
          <>
            <Collapsible defaultOpen={true}>
              <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                        <div>
                            <CardTitle>Key Figures</CardTitle>
                            <CardDescription>Top-line statistics from your data.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                   <KeyFigures data={processedData.keyFigures} />
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <Collapsible defaultOpen={true}>
              <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                        <div>
                            <CardTitle>Tables and Charts</CardTitle>
                            <CardDescription>Detailed breakdowns of beneficiary data.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-6 pt-0 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <BeneficiariesByVillageChart data={processedData.charts.beneficiariesByVillage} />
                        <BeneficiariesByDayChart data={processedData.charts.beneficiariesByDay} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <WomenAndChildrenDonut data={processedData.charts.womenStats} />
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                            <GenderVisual gender="male" value={processedData.charts.gender.male} total={processedData.charts.gender.male + processedData.charts.gender.female} />
                            <GenderVisual gender="female" value={processedData.charts.gender.female} total={processedData.charts.gender.male + processedData.charts.gender.female} />
                        </div>
                    </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <BubbleStats data={processedData.bubbles} />

            <Collapsible defaultOpen={true}>
                <Card>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                            <div>
                                <CardTitle>Geospatial View</CardTitle>
                                <CardDescription>Interactive map of administrative boundaries.</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-6 pt-0">
                        <div className="h-[600px] w-full rounded-md border" id="map-container">
                            <WestAfricaMap />
                        </div>
                         <div className="flex gap-2 mt-4">
                            <Button onClick={() => exportAction(exportPNG, 'PNG')}><ImageIcon className="mr-2"/>Export Map as PNG</Button>
                            <Button onClick={() => exportAction(exportPDF, 'PDF')}><FileIcon className="mr-2"/>Export Map as PDF</Button>
                        </div>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
          </>
        )}

      </div>
    </DashboardContext.Provider>
  );
}
