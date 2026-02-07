"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Link as LinkIcon, Loader2, Settings, ListChecks, Microscope, ChevronDown, ChevronsUpDown, XCircle, CheckCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { cacheRawData, cacheFinalResult } from '@/lib/cache';
import { useTranslation } from '@/hooks/use-translation';
import { setupWakeLockListener } from '@/lib/wakeLock';

type RecordRow = { [key: string]: any };
type Mapping = { [key: string]: string | undefined };
type WorkerStatus = 'idle' | 'worker-ready' | 'receiving' | 'mapping-rows' | 'blocking' | 'building-edges' | 'merging-edges' | 're-clustering' | 'annotating' | 'calculating_scores' | 'caching' | 'done' | 'error';


const REQUIRED_FIELDS = ['womanName', 'husbandName', 'nationalId', 'phone', 'village', 'subdistrict', 'children', 'beneficiaryId'];
const LOCAL_STORAGE_MAPPING_PREFIX = "beneficiary-mapping-";

export default function UploadPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const { toast } = useToast();

    const [file, setFile] = useState<File | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<RecordRow[]>([]);
    const [mapping, setMapping] = useState<Mapping>({});
    
    const [workerStatus, setWorkerStatus] = useState<WorkerStatus>('idle');
    const [progress, setProgress] = useState({ value: 0, status: "", completed: 0, total: 0 });
    const [results, setResults] = useState<any>(null);

    const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);

    const workerRef = useRef<Worker>();

    useEffect(() => {
        const cleanup = setupWakeLockListener();
        return cleanup;
    }, []);

    useEffect(() => {
        workerRef.current = new Worker(new URL('@/workers/cluster.worker.ts', import.meta.url));

        workerRef.current.onmessage = (event) => {
            const { type, status, progress: p, completed, total, payload, error } = event.data;
            if (type === 'progress') {
                setProgress({ status, value: p, completed: completed || 0, total: total || 0 });
                setWorkerStatus(status);
            } else if (type === 'done') {
                setWorkerStatus('caching');
                setProgress(prev => ({...prev, status: 'caching', value: 99}));
                cacheFinalResult({ clusters: payload.clusters }).then(() => {
                    setResults(payload);
                    setWorkerStatus('done');
                    setProgress(prev => ({...prev, status: 'done', value: 100}));
                    toast({ title: t('upload.toasts.clusteringComplete.title'), description: t('upload.toasts.clusteringComplete.description', { count: payload.clusters.length }) });
                    setIsCollapsibleOpen(false);
                }).catch(err => {
                    toast({ title: t('upload.toasts.cacheError.title'), description: err.message, variant: "destructive" });
                    setWorkerStatus('error');
                });
            } else if (type === 'error') {
                toast({ title: t('upload.toasts.workerError.title'), description: error, variant: "destructive" });
                setWorkerStatus('error');
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [toast, t]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleReset();
            setFile(e.target.files[0]);
        }
    };

    const handleReset = () => {
        setFile(null);
        setColumns([]);
        setRows([]);
        setMapping({});
        setWorkerStatus('idle');
        setProgress({ value: 0, status: "", completed: 0, total: 0 });
        setResults(null);
        setIsCollapsibleOpen(true);
    };

    useEffect(() => {
        if (!file) return;

        setProgress({ value: 5, status: t('upload.file.reading'), completed: 0, total: 0 });
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows = XLSX.utils.sheet_to_json<RecordRow>(worksheet);

            const fileColumns = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];

            setRows(jsonRows);
            setColumns(fileColumns);
            setProgress({ value: 10, status: 'Ready to map', completed: jsonRows.length, total: jsonRows.length });

            const storageKey = LOCAL_STORAGE_MAPPING_PREFIX + fileColumns.join(',');
            const savedMapping = localStorage.getItem(storageKey);
            if (savedMapping) {
                try {
                    setMapping(JSON.parse(savedMapping));
                } catch {}
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, t]);

    const handleMappingChange = (field: string, value: string) => {
        const newMapping = { ...mapping, [field]: value };
        setMapping(newMapping);
        const storageKey = LOCAL_STORAGE_MAPPING_PREFIX + columns.join(',');
        localStorage.setItem(storageKey, JSON.stringify(newMapping));
    };

    const runClustering = async () => {
        if (!workerRef.current) {
             toast({ title: t('upload.toasts.workerStartError.title'), description: t('upload.toasts.workerNotReady'), variant: "destructive" });
            return;
        }
        if (rows.length === 0) {
            toast({ title: t('upload.toasts.noData'), variant: "destructive" });
            return;
        }
         const isMappingComplete = REQUIRED_FIELDS.every(f => mapping[f] && columns.includes(mapping[f]!));
        if (!isMappingComplete) {
            toast({ title: t('upload.toasts.mappingIncomplete'), description: "Please map all required fields.", variant: "destructive" });
            return;
        }

        setWorkerStatus('receiving');
        setProgress({ value: 15, status: 'receiving', completed: 0, total: rows.length });
        setResults(null);
        setIsCollapsibleOpen(false);

        try {
            await cacheRawData({ rows, originalHeaders: columns });

            const settingsRes = await fetch('/api/settings');
            const settings = await settingsRes.json();
            
            const rulesRes = await fetch('/api/rules');
            const autoRules = await rulesRes.json();
            
            const startPayload = {
                mapping,
                options: settings.settings,
                autoRules,
                total: rows.length,
                progressKey: `${file?.name}-${file?.size}-${Date.now()}`
            };

            workerRef.current.postMessage({ type: "start", payload: startPayload });

            const CHUNK_SIZE = 5000;
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                workerRef.current.postMessage({ type: "data", payload: { rows: chunk, total: rows.length } });
            }

            workerRef.current.postMessage({ type: "end" });

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            setWorkerStatus('error');
        }
    };
    
    const isProcessing = ['receiving', 'mapping-rows', 'blocking', 'building-edges', 'merging-edges', 're-clustering', 'annotating', 'caching'].includes(workerStatus);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-2xl">{t('dashboard.features.upload.title')}</CardTitle>
                            <CardDescription>{t('dashboard.features.upload.description')}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button asChild variant="outline"><Link href="/meal-system/settings"><Settings className="mr-2"/>{t('sidebar.settings')}</Link></Button>
                            <Button onClick={handleReset}>{t('upload.buttons.reset')}</Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                     <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
                        <Card>
                             <CollapsibleTrigger asChild>
                                <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                                     <div>
                                        <CardTitle>{t('upload.steps.1.title')}</CardTitle>
                                        <CardDescription>{t('upload.steps.1.description')}</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent>
                                    <label htmlFor="file-upload" className="flex-1">
                                        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                                <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                                                {file ? (
                                                <p className="font-semibold text-primary">{file.name} ({rows.length} {t('upload.file.rowsDetected')})</p>
                                                ) : (
                                                <>
                                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">{t('upload.file.clickToUpload')}</span> {t('upload.file.orDragAndDrop')}</p>
                                                    <p className="text-xs text-muted-foreground">{t('upload.file.fileTypes')}</p>
                                                </>
                                                )}
                                            </div>
                                            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                                        </div>
                                    </label>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>

                        {columns.length > 0 && (
                            <Collapsible defaultOpen>
                                <Card>
                                     <CollapsibleTrigger asChild>
                                        <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                                            <div>
                                                <CardTitle>{t('upload.steps.2.title')}</CardTitle>
                                                <CardDescription>{t('upload.steps.2.description')}</CardDescription>
                                            </div>
                                            <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /></Button>
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {REQUIRED_FIELDS.map(fieldKey => (
                                                <Card key={fieldKey}>
                                                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                                                        <Label htmlFor={fieldKey} className="font-semibold">{t(`upload.mappingFields.${fieldKey}`)}</Label>
                                                        {mapping[fieldKey] ? <CheckCircle className="h-5 w-5 text-green-500"/> : <XCircle className="h-5 w-5 text-red-500" />}
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <ScrollArea className="h-48 border-t">
                                                            <RadioGroup value={mapping[fieldKey]} onValueChange={(v) => handleMappingChange(fieldKey, v)} className="p-4 grid grid-cols-2 gap-2">
                                                                {columns.map(col => (
                                                                    <div key={col} className="flex items-center space-x-2">
                                                                        <RadioGroupItem value={col} id={`${fieldKey}-${col}`} />
                                                                        <Label htmlFor={`${fieldKey}-${col}`} className="truncate font-normal" title={col}>{col}</Label>
                                                                    </div>
                                                                ))}
                                                            </RadioGroup>
                                                        </ScrollArea>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        )}
                    </Collapsible>
                </div>
                
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('upload.steps.3.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Button size="lg" className="w-full" onClick={runClustering} disabled={isProcessing || !file}>
                                {isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <LinkIcon className="mr-2" />}
                                {t(workerStatus === 'done' ? 'upload.buttons.done' : isProcessing ? 'upload.buttons.processing' : 'upload.buttons.idle')}
                            </Button>
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('upload.status.label')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <Progress value={progress.value} />
                             <div className="text-sm text-muted-foreground text-center">
                                 {t(`upload.status.${workerStatus}`)}
                                 {isProcessing && ` (${progress.completed}/${progress.total})`}
                            </div>
                        </CardContent>
                    </Card>
                    
                    {results && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('upload.steps.4.title')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                               <p>{t('upload.results.totalRecords')}: {rows.length}</p>
                               <p>{t('upload.results.clusteredRecords')}: {new Set(results.clusters.flatMap((c:any) => c.records.map((r:any) => r._internalId))).size} / {rows.length}</p>
                               <p>{t('upload.results.clusterCount')}: {results.clusters.length}</p>
                               <p>{t('upload.results.avgClusterSize')}: {(new Set(results.clusters.flatMap((c:any) => c.records.map((r:any) => r._internalId))).size / (results.clusters.length || 1)).toFixed(2)}</p>
                               <Button asChild className="w-full mt-4"><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review"><Microscope className="mr-2"/>{t('upload.buttons.goToReview')}</Link></Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}