
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toPng } from 'html-to-image';
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from '@/lib/types';
import { useRouter } from 'next/navigation';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronsUpDown, FileDown } from "lucide-react";
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

const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-report-mapping-";

export default function ReportPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Data and Mapping State
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<RecordRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [processedData, setProcessedData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Refs for capturing components
  const keyFiguresRef = useRef<HTMLDivElement>(null);
  const byVillageChartRef = useRef<HTMLDivElement>(null);
  const byDayChartRef = useRef<HTMLDivElement>(null);
  const womenDonutRef = useRef<HTMLDivElement>(null);
  const genderVisualRef = useRef<HTMLDivElement>(null);
  const bubbleStatsRef = useRef<HTMLDivElement>(null);

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
            const fileColumns = Object.keys(data.rows[0]);
            setColumns(fileColumns);
            
            // Load saved mapping from localStorage
            const storageKey = LOCAL_STORAGE_KEY_PREFIX + fileColumns.join(',');
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              try { 
                const savedMapping = JSON.parse(saved);
                // Ensure all required fields have a value from the saved mapping
                const initialMapping = MAPPING_FIELDS.reduce((acc, field) => {
                    acc[field] = savedMapping[field] || "";
                    return acc;
                }, {} as Record<string, string>);
                setMapping(initialMapping);
              } catch {}
            } else {
              // Initialize empty mapping if nothing is saved
              const initialMapping = MAPPING_FIELDS.reduce((acc, field) => {
                  acc[field] = "";
                  return acc;
              }, {} as Record<string, string>);
              setMapping(initialMapping);
            }
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
  
  const handleMappingChange = useCallback((newMapping: Record<string, string>) => {
    setMapping(newMapping);
    if(columns.length > 0){
        const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
        localStorage.setItem(key, JSON.stringify(newMapping));
    }
  }, [columns]);


  // Process data whenever mapping or rows change
  useEffect(() => {
    if (allRows.length > 0 && MAPPING_FIELDS.every(field => mapping[field])) {
      const getUnique = (field: string) => new Set(allRows.map(r => r[mapping[field]]).filter(Boolean)).size;
      const getSum = (field: string) => allRows.reduce((acc, r) => acc + (Number(r[mapping[field]]) || 0), 0);
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
      
      const maleChildren = getSum('Male Children');
      const femaleChildren = getSum('Female Children');

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
            male: maleChildren,
            female: femaleChildren,
            total: maleChildren + femaleChildren
          },
        },
        bubbles: [
          { label: 'HH Registered', value: getUniqueCount('Household registered'), icon: 'home' },
          { label: 'Male HH', value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 1).length, icon: 'male' },
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

  const handleExport = async () => {
    const cacheId = sessionStorage.getItem('cacheId');
    if (!cacheId || !processedData) {
        toast({ title: "Cannot Export", description: "Data is not ready or no cache ID found. Please process data first.", variant: "destructive" });
        return;
    }
    
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Capturing dashboard components as images..." });
    
    try {
        const refs = {
            keyFigures: keyFiguresRef,
            byVillageChart: byVillageChartRef,
            byDayChart: byDayChartRef,
            womenDonut: womenDonutRef,
            genderVisual: genderVisualRef,
            bubbleStats: bubbleStatsRef,
        };
        
        const images: Record<string, string> = {};

        for (const [key, ref] of Object.entries(refs)) {
            if (ref.current) {
                try {
                    images[key] = await toPng(ref.current, { cacheBust: true, pixelRatio: 2 });
                } catch (e) {
                    console.error(`Failed to capture ${key}`, e);
                    toast({ title: `Capture Failed`, description: `Could not capture the ${key} component.`, variant: "destructive" });
                }
            }
        }
        
        if (mapInstance) {
            images['map'] = await new Promise((resolve, reject) => {
                const leafletImage = require('leaflet-image');
                leafletImage(mapInstance, (err: any, canvas: HTMLCanvasElement) => {
                    if (err) {
                        reject(new Error("Failed to capture map image."));
                        return;
                    }
                    resolve(canvas.toDataURL());
                });
            });
        }

        await fetch('/api/chart-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cacheId, images }),
        });

        toast({ title: "Dashboard Cached", description: "Visuals have been saved. Proceeding to export page." });
        router.push('/export');

    } catch (error: any) {
        console.error("Export preparation failed:", error);
        toast({ title: "Export Error", description: `An error occurred while preparing the export: ${error.message}`, variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
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
              <ColumnMapping columns={columns} mapping={mapping} onMappingChange={handleMappingChange} />
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        {processedData && (
          <>
            <Collapsible defaultOpen={true}>
              <Card ref={keyFiguresRef}>
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
                        <div ref={byVillageChartRef}><BeneficiariesByVillageChart data={processedData.charts.beneficiariesByVillage} /></div>
                        <div ref={byDayChartRef}><BeneficiariesByDayChart data={processedData.charts.beneficiariesByDay} /></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1" ref={womenDonutRef}>
                            <WomenAndChildrenDonut data={processedData.charts.womenStats} />
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-2 gap-6" ref={genderVisualRef}>
                            <GenderVisual gender="male" value={processedData.charts.gender.male} total={processedData.charts.gender.total} />
                            <GenderVisual gender="female" value={processedData.charts.gender.female} total={processedData.charts.gender.total} />
                        </div>
                    </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <div ref={bubbleStatsRef}>
              <BubbleStats data={processedData.bubbles} />
            </div>

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
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            <Card>
                <CardHeader>
                    <CardTitle>Export</CardTitle>
                    <CardDescription>Generate and download the full Excel report including a dashboard sheet.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        {isExporting ? 'Preparing...' : 'Go to Export Page'}
                    </Button>
                </CardContent>
            </Card>
          </>
        )}

      </div>
    </DashboardContext.Provider>
  );
}
