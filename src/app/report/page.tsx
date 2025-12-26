
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
import { Loader2, ChevronsUpDown, Camera, Upload, Microscope, ClipboardList } from "lucide-react";
import { ColumnMapping, MAPPING_FIELDS } from '@/components/report/ColumnMapping';
import { KeyFigures } from '@/components/report/KeyFigures';
import { BeneficiariesByVillageChart, BeneficiariesByDayChart, WomenAndChildrenDonut } from '@/components/report/TableBarCharts';
import { GenderVisual } from '@/components/report/GenderVisual';
import { BubbleStats } from '@/components/report/BubbleStats';
import type { Feature, FeatureCollection } from 'geojson';
import { loadCachedResult } from '@/lib/cache';
import { openDB } from 'idb';
import type L from 'leaflet';
import { useTranslation } from "@/hooks/use-translation";


// Global Dashboard State
export const DashboardContext = React.createContext<{
  mapInstance: L.Map | null;
  setMapInstance: React.Dispatch<React.SetStateAction<L.Map | null>>;
  selectedFeatures: Feature[];
  miniChartLayerRef: React.RefObject<L.LayerGroup | null>;
}>({
  mapInstance: null,
  setMapInstance: () => {},
  selectedFeatures: [],
  miniChartLayerRef: React.createRef(),
});

export const useDashboard = () => React.useContext(DashboardContext);

const WestAfricaMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-muted"><p>Loading map...</p></div>,
});

const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-report-mapping-";

async function saveReportDataToCache(data: { chartImages: Record<string, string>, processedDataForReport: any }) {
    const db = await openDB('beneficiary-insights-cache', 1);
    const tx = db.transaction('results', 'readwrite');
    const store = tx.objectStore('results');
    const currentData = await store.get('FULL_RESULT');
    if (currentData) {
        const newData = { ...currentData, ...data };
        await store.put(newData, 'FULL_RESULT');
    }
    await tx.done;
}

export default function ReportPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const miniChartLayerRef = useRef<L.LayerGroup | null>(null);

  const [loadingState, setLoadingState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [columns, setColumns] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<RecordRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [processedData, setProcessedData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [admin3Data, setAdmin3Data] = useState<FeatureCollection | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);

  const byVillageChartRef = useRef<HTMLDivElement>(null);
  const byDayChartRef = useRef<HTMLDivElement>(null);
  const womenDonutRef = useRef<HTMLDivElement>(null);
  const genderVisualRef = useRef<HTMLDivElement>(null);
  const bubbleStatsRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/yemen_admin3.geojson').then(res => res.json()).then(setAdmin3Data);
  }, []);

  useEffect(() => {
    const loadData = async () => {
        setLoadingState('LOADING');
        const data = await loadCachedResult();
        
        if (data && data.rows) {
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
                 toast({title: t('report.toasts.noRecords.title'), description: t('report.toasts.noRecords.description'), variant: "destructive"});
            }
            setLoadingState("READY");
        } else {
             toast({ title: t('report.toasts.loadError.title'), description: t('report.toasts.loadError.description'), variant: "destructive" });
             setLoadingState("ERROR");
        }
    };

    loadData();
  }, [toast, t]);
  
  const handleMappingChange = useCallback((newMapping: Record<string, string>) => {
    setMapping(newMapping);
    if(columns.length > 0){
        const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
        localStorage.setItem(key, JSON.stringify(newMapping));
    }
  }, [columns]);


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
            { name: t('report.womenStats.pregnant'), value: getSum('Pregnant woman') },
            { name: t('report.womenStats.mother'), value: getSum('Mothers having a child under 5 years old') },
            { name: t('report.womenStats.handicappedChild'), value: getSum('Women have handicapped children from 5 to 17 years old') },
          ],
          gender: {
            male: maleChildren,
            female: femaleChildren,
            total: maleChildren + femaleChildren
          },
        },
        bubbles: [
          { label: t('report.bubbles.hhRegistered'), value: getUnique('Household registered'), icon: 'home' as const },
          { label: t('report.bubbles.maleHH'), value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 1).length, icon: 'male' as const },
          { label: t('report.bubbles.femaleHH'), value: allRows.filter(r => Number(r[mapping['Household Gender']]) === 2).length, icon: 'female' as const },
          { label: t('report.bubbles.dislocatedHH'), value: getSum('Dislocated household'), icon: 'move' as const },
          { label: t('report.bubbles.hhWithGuest'), value: getSum('Household having dislocated guest'), icon: 'users' as const },
          { label: t('report.bubbles.beneficiaries'), value: getUnique('Beneficiaries registered'), icon: 'group' as const },
          { label: t('report.bubbles.pregnantWoman'), value: getSum('Pregnant woman'), icon: 'pregnant' as const },
          { label: t('report.bubbles.lactatingMother'), value: getSum('Mothers having a child under 5 years old'), icon: 'lactating' as const },
          { label: t('report.bubbles.handicappedWoman'), value: getSum('Handicapped Woman'), icon: 'handicapped' as const },
          { label: t('report.bubbles.womanWithHandicappedChild'), value: getSum('Women have handicapped children from 5 to 17 years old'), icon: 'child' as const },
          { label: t('report.bubbles.dislocatedWoman'), value: getSum('Dislocated Woman'), icon: 'move' as const },
        ]
      };
      setProcessedData(data);
    }
  }, [allRows, mapping, t]);

  useEffect(() => {
    if (!admin3Data || allRows.length === 0 || !mapping['Government'] || !mapping['District'] || !mapping['Subdistrict']) {
        setSelectedFeatures([]);
        return;
    }

    const dataLocations = new Map<string, number>();
    allRows.forEach(row => {
        const gov = row[mapping['Government']];
        const dist = row[mapping['District']];
        const sub = row[mapping['Subdistrict']];
        if (gov && dist && sub) {
            const key = `${String(gov).trim()}-${String(dist).trim()}-${String(sub).trim()}`;
            dataLocations.set(key, (dataLocations.get(key) || 0) + 1);
        }
    });

    if (dataLocations.size > 0) {
        const matchedFeatures = admin3Data.features.map(feature => {
            const adm1 = feature.properties?.ADM1_AR;
            const adm2 = feature.properties?.ADM2_AR;
            const adm3 = feature.properties?.ADM3_AR;
            if (adm1 && adm2 && adm3) {
                const featureLocationKey = `${String(adm1).trim()}-${String(adm2).trim()}-${String(adm3).trim()}`;
                if (dataLocations.has(featureLocationKey)) {
                    return {
                        ...feature,
                        properties: {
                            ...feature.properties,
                            total_beneficiaries: dataLocations.get(featureLocationKey) || 0,
                        },
                    };
                }
            }
            return null;
        }).filter((f): f is Feature => f !== null);
        
        setSelectedFeatures(matchedFeatures);
    } else {
        setSelectedFeatures([]);
    }

  }, [allRows, admin3Data, mapping]);

  const handleCaptureAndExport = async () => {
    if (!processedData) {
        toast({ title: t('report.toasts.cannotExport.title'), description: t('report.toasts.cannotExport.description'), variant: "destructive" });
        return;
    }
    
    setIsExporting(true);
    toast({ title: t('report.toasts.preparingExport.title'), description: t('report.toasts.preparingExport.description') });
    
    try {
        const refs = {
            byVillageChart: byVillageChartRef,
            byDayChart: byDayChartRef,
            womenDonut: womenDonutRef,
            genderVisual: genderVisualRef,
            bubbleStats: bubbleStatsRef,
            map: mapContainerRef,
        };
        
        const images: Record<string, string> = {};

        for (const [key, ref] of Object.entries(refs)) {
            if (ref.current) {
                try {
                    images[key] = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, style: { background: 'white' } });
                } catch (e) {
                    console.error(`Failed to capture ${key}`, e);
                    toast({ title: t('report.toasts.captureFailed.title', { key: key }), description: t('report.toasts.captureFailed.description', { key: key }), variant: "destructive" });
                }
            }
        }
        
        await saveReportDataToCache({
            chartImages: images,
            processedDataForReport: processedData
        });

        toast({ title: t('report.toasts.dashboardCached.title'), description: t('report.toasts.dashboardCached.description') });
        router.push('/export');

    } catch (error: any) {
        console.error("Export preparation failed:", error);
        toast({ title: t('report.toasts.exportError.title'), description: t('report.toasts.exportError.description', { message: error.message }), variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };
  
    if (loadingState === 'LOADING') {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">{t('report.loading')}</span></div>;
    }
    
    if(loadingState === 'ERROR') {
        return <div className="flex items-center justify-center h-64"><p>{t('report.toasts.loadError.description')}</p></div>;
    }

  return (
    <DashboardContext.Provider value={{ mapInstance, setMapInstance, selectedFeatures, miniChartLayerRef }}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('report.title')}</CardTitle>
            <CardDescription>{t('report.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/upload"><Upload className="mr-2"/>{t('sidebar.upload')}</Link></Button>
            <Button variant="outline" asChild><Link href="/review"><Microscope className="mr-2"/>{t('sidebar.review')}</Link></Button>
            <Button variant="outline" asChild><Link href="/audit"><ClipboardList className="mr-2"/>{t('sidebar.audit')}</Link></Button>
            <Button onClick={handleCaptureAndExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              {isExporting ? t('report.buttons.capturing') : t('report.buttons.captureAndExport')}
            </Button>
          </CardContent>
        </Card>

        <Collapsible defaultOpen={true}>
          <Card>
            <CollapsibleTrigger asChild>
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                    <div>
                        <CardTitle>{t('report.mapping.title')}</CardTitle>
                        <CardDescription>{t('report.mapping.description')}</CardDescription>
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
                            <CardTitle>{t('report.keyFigures.title')}</CardTitle>
                            <CardDescription>{t('report.keyFigures.description')}</CardDescription>
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
                            <CardTitle>{t('report.charts.title')}</CardTitle>
                            <CardDescription>{t('report.charts.description')}</CardDescription>
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
                                <CardTitle>{t('report.map.title')}</CardTitle>
                                <CardDescription>{t('report.map.description')}</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-6 pt-0 space-y-4">
                        <div ref={mapContainerRef} className="h-[600px] w-full rounded-md border" id="map-container">
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
