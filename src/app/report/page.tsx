

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { toPng } from 'html-to-image';
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronsUpDown, FileDown, Upload, Microscope, ClipboardList, Camera } from "lucide-react";
import { ColumnMapping, MAPPING_FIELDS } from '@/components/report/ColumnMapping';
import { KeyFigures } from '@/components/report/KeyFigures';
import { BeneficiariesByVillageChart, BeneficiariesByDayChart, WomenAndChildrenDonut } from '@/components/report/TableBarCharts';
import { GenderVisual } from '@/components/report/GenderVisual';
import { BubbleStats } from '@/components/report/BubbleStats';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, PlusCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import type { Feature, FeatureCollection } from 'geojson';


// Global Dashboard State
export const DashboardContext = React.createContext<{
  mapInstance: L.Map | null;
  setMapInstance: React.Dispatch<React.SetStateAction<L.Map | null>>;
  selectedFeatures: Feature[];
}>({
  mapInstance: null,
  setMapInstance: () => {},
  selectedFeatures: [],
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
  const [loadingState, setLoadingState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [columns, setColumns] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<RecordRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [processedData, setProcessedData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Map State
  const [admin3Data, setAdmin3Data] = useState<FeatureCollection | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);


  // Refs for capturing components
  const byVillageChartRef = useRef<HTMLDivElement>(null);
  const byDayChartRef = useRef<HTMLDivElement>(null);
  const womenDonutRef = useRef<HTMLDivElement>(null);
  const genderVisualRef = useRef<HTMLDivElement>(null);
  const bubbleStatsRef = useRef<HTMLDivElement>(null);

  // Load geojson data
  useEffect(() => {
    fetch('/data/yemen_admin3.geojson').then(res => res.json()).then(data => setAdmin3Data(data));
  }, []);

  // Fetch cached data on initial render
  useEffect(() => {
    const loadData = async () => {
        const cacheId = sessionStorage.getItem('cacheId');
        if (!cacheId) {
            toast({ title: "No Data", description: "Please upload data first.", variant: "destructive" });
            setLoadingState("ERROR");
            return;
        }

        try {
            const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch cached data. Please try the upload process again.');
            }
            const data = await res.json();
            
            setAllRows(data.rows || []);
            if (data.rows && data.rows.length > 0) {
                const fileColumns = data.originalHeaders || Object.keys(data.rows[0]);
                setColumns(fileColumns);
                
                const storageKey = LOCAL_STORAGE_KEY_PREFIX + fileColumns.join(',');
                const saved = localStorage.getItem(storageKey);
                const initialMapping = MAPPING_FIELDS.reduce((acc, field) => {
                    acc[field] = "";
                    return acc;
                }, {} as Record<string, string>);
                
                if (saved) {
                    try {
                        const savedMapping = JSON.parse(saved);
                        for(const field of MAPPING_FIELDS) {
                            initialMapping[field] = savedMapping[field] || "";
                        }
                    } catch {}
                }
                setMapping(initialMapping);
            } else {
                 toast({title: "No Records", description: "The cached data contains no records.", variant: "destructive"});
            }
            setLoadingState("READY");
        } catch (error: any) {
             toast({ title: "Error loading data", description: error.message, variant: "destructive" });
             setLoadingState("ERROR");
        }
    };

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
          { label: 'HH Registered', value: getUnique('Household registered'), icon: 'home' as const },
          { label: 'Male HH', value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 1).length, icon: 'male' as const },
          { label: 'Female HH', value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 2).length, icon: 'female' as const },
          { label: 'Dislocated HH', value: getSum('Dislocated household'), icon: 'move' as const },
          { label: 'HH with Guest', value: getSum('Household having dislocated guest'), icon: 'users' as const },
          { label: 'Beneficiaries', value: getUnique('Beneficiaries registered'), icon: 'group' as const },
          { label: 'Pregnant Woman', value: getSum('Pregnant woman'), icon: 'pregnant' as const },
          { label: 'Lactating/Mother <5', value: getSum('Mothers having a child under 5 years old'), icon: 'lactating' as const },
          { label: 'Handicapped Woman', value: getSum('Handicapped Woman'), icon: 'handicapped' as const },
          { label: 'Woman w/ Handicapped Child', value: getSum('Women have handicapped children from 5 to 17 years old'), icon: 'child' as const },
          { label: 'Dislocated Woman', value: getSum('Dislocated Woman'), icon: 'move' as const },
        ]
      };
      setProcessedData(data);
    }
  }, [allRows, mapping]);

  const handleCaptureAndExport = async () => {
    const cacheId = sessionStorage.getItem('cacheId');
    if (!cacheId || !processedData) {
        toast({ title: "Cannot Export", description: "Data is not ready or no cache ID found. Please process data first.", variant: "destructive" });
        return;
    }
    
    setIsExporting(true);
    toast({ title: "Preparing Export", description: "Capturing dashboard components as images..." });
    
    try {
        const refs = {
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
                    images[key] = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, style: { background: 'white' } });
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

        await fetch('/api/cluster-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cacheId, chartImages: images, processedDataForReport: processedData }),
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
  
    if (loadingState === 'LOADING') {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading Report Data...</span></div>;
    }
    
    if(loadingState === 'ERROR') {
        return <div className="flex items-center justify-center h-64"><p>Could not load data. Please start by uploading a file.</p></div>;
    }

  return (
    <DashboardContext.Provider value={{ mapInstance, setMapInstance, selectedFeatures }}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Dashboard</CardTitle>
            <CardDescription>
              Visualize your data and navigate to other sections. Use the button below to capture this view for your final Excel export.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/upload"><Upload className="mr-2"/>To Upload</Link></Button>
            <Button variant="outline" asChild><Link href="/review"><Microscope className="mr-2"/>To Review</Link></Button>
            <Button variant="outline" asChild><Link href="/audit"><ClipboardList className="mr-2"/>To Audit</Link></Button>
            <Button onClick={handleCaptureAndExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              {isExporting ? 'Capturing...' : 'Capture and Go to Export'}
            </Button>
          </CardContent>
        </Card>

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
                   <div>
                    <KeyFigures data={processedData.keyFigures} />
                   </div>
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
                        <div ref={byDayChartRef}><BeneficiariesByDayChart data={processedData.charts.beneficiariesByDay} /></div>
                        <div ref={byVillageChartRef}><BeneficiariesByVillageChart data={processedData.charts.beneficiariesByVillage} /></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1" ref={womenDonutRef}>
                            <WomenAndChildrenDonut data={processedData.charts.womenStats} />
                        </div>
                        <div className="lg:col-span-2" ref={genderVisualRef}>
                            <div className="grid grid-cols-2 gap-6">
                                <GenderVisual gender="male" value={processedData.charts.gender.male} total={processedData.charts.gender.total} />
                                <GenderVisual gender="female" value={processedData.charts.gender.female} total={processedData.charts.gender.total} />
                            </div>
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
                    <CollapsibleContent className="p-6 pt-0 space-y-4">
                         {admin3Data && (
                            <div className="flex items-center gap-4">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start"
                                        >
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Select Regions
                                            {selectedFeatures.length > 0 && (
                                                <>
                                                    <div className="mx-2 h-4 w-px bg-muted-foreground" />
                                                    <div className="space-x-1">
                                                        {selectedFeatures.length > 2 ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className="rounded-sm px-1 font-normal"
                                                            >
                                                                {selectedFeatures.length} selected
                                                            </Badge>
                                                        ) : (
                                                            selectedFeatures.map((feature) => (
                                                                <Badge
                                                                    key={feature.properties?.ADM3_AR}
                                                                    variant="secondary"
                                                                    className="rounded-sm px-1 font-normal"
                                                                >
                                                                    {feature.properties?.ADM3_AR}
                                                                </Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search regions..." />
                                            <CommandList>
                                                <CommandEmpty>No results found.</CommandEmpty>
                                                <CommandGroup>
                                                    {admin3Data.features.map((feature) => {
                                                        const isSelected = selectedFeatures.some(sf => sf.properties?.ADM3_PCODE === feature.properties?.ADM3_PCODE);
                                                        return (
                                                            <CommandItem
                                                                key={feature.properties?.ADM3_PCODE}
                                                                onSelect={() => {
                                                                    if (isSelected) {
                                                                        setSelectedFeatures(selectedFeatures.filter(sf => sf.properties?.ADM3_PCODE !== feature.properties?.ADM3_PCODE));
                                                                    } else {
                                                                        setSelectedFeatures([...selectedFeatures, feature]);
                                                                    }
                                                                }}
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                        isSelected
                                                                            ? "bg-primary text-primary-foreground"
                                                                            : "opacity-50 [&_svg]:invisible"
                                                                    )}
                                                                >
                                                                    <Check className={cn("h-4 w-4")} />
                                                                </div>
                                                                <span>{feature.properties?.ADM3_AR}</span>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                        <div className="h-[600px] w-full rounded-md border" id="map-container">
                            <WestAfricaMap />
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
