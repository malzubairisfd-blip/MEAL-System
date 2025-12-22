
// app/(app)/upload/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Settings, CheckCircle, XCircle, Loader2, ChevronRight, Users, Group, Unlink, BoxSelect, Sigma, ChevronsUpDown, Clock } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";
import { openDB } from "@/lib/cache";

type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const PROGRESS_KEY_PREFIX = "progress-";


type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }
type TimeInfo = { elapsed: number; remaining?: number };

export default function UploadPage(){
  const { t, isLoading: isTranslationLoading } = useTranslation();
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", beneficiaryId:""
  });
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status:"idle", progress:0 });
  const [processingStatus, setProcessingStatus] = useState<string>("idle");
  const [clusters, setClusters] = useState<any[][]>([]);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const [timeInfo, setTimeInfo] = useState<TimeInfo>({ elapsed: 0 });
  const rawRowsRef = useRef<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout|null>(null);
  const startTimeRef = useRef<number|null>(null);
  const dbRef = useRef<IDBDatabase|null>(null);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.error("Service Worker registration failed:", err);
        });
    }
  }, []);

  useEffect(()=>{
    const allRequiredMapped = REQUIRED_MAPPING_FIELDS.every(f => !!mapping[f]);
    setIsMappingComplete(allRequiredMapped);
    if(columns.length > 0){
      const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
      localStorage.setItem(key, JSON.stringify(mapping));
    }
  }, [mapping, columns]);

  // Timer effect
  useEffect(() => {
    if (processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error' && startTimeRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTimeRef.current!) / 1000;
            let remaining;
            if (progressInfo.progress > 0 && progressInfo.progress < 100) {
                remaining = (elapsed / progressInfo.progress) * (100 - progressInfo.progress);
            }
            setTimeInfo({ elapsed, remaining });
        }, 1000);
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [processingStatus, progressInfo.progress]);

  async function handleFile(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if(!f) return;
    setFile(f);
    setProcessingStatus('idle'); setProgressInfo({ status:'idle', progress:0 }); setClusters([]);
    setTimeInfo({ elapsed: 0 });
    if(timerRef.current) clearInterval(timerRef.current);
    setFileReadProgress(0);
    setIsMappingOpen(true);
    
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = (event.loaded / event.total) * 100;
        setFileReadProgress(percentage);
      }
    };
    reader.onload = (e) => {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates:true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        rawRowsRef.current = json;
        const fileColumns = Object.keys(json[0] || {});
        setColumns(fileColumns);
        
        const storageKey = LOCAL_STORAGE_KEY_PREFIX + fileColumns.join(',');
        const saved = localStorage.getItem(storageKey);
        if(saved) {
          try { setMapping(JSON.parse(saved)); } catch {}
        } else {
          setMapping({ womanName:"", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", beneficiaryId:"" });
        }
        setFileReadProgress(100);
    };
    reader.readAsArrayBuffer(f);
  }

  function handleMappingChange(field:keyof Mapping, value:string){
    setMapping(m => ({ ...m, [field]: value }));
  }

  async function startClustering() {
    if (!rawRowsRef.current.length) { toast({ title: t('upload.toasts.noData') }); return; }
    if (!isMappingComplete) { toast({ title: t('upload.toasts.mappingIncomplete'), variant: "destructive" }); return; }
    if (!file) { toast({ title: "No file selected."}); return; }

    setIsMappingOpen(false);
    setProcessingStatus('processing');
    setProgressInfo({ status: 'processing', progress: 1 });
    setTimeInfo({ elapsed: 0 });
    startTimeRef.current = Date.now();
    
    const db = await openDB();
    dbRef.current = db;

    const clearStores = (storeNames: string[]) => {
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            storeNames.forEach(storeName => {
                tx.objectStore(storeName).clear();
            });
        });
    };

    await clearStores(['rows', 'clusters', 'edges', 'meta']);
    
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    const progressKey = `${PROGRESS_KEY_PREFIX}${fileKey}`;
    const savedProgressRaw = localStorage.getItem(progressKey);
    let resumeState = null;
    if (savedProgressRaw) {
        try {
            resumeState = JSON.parse(savedProgressRaw);
            if (resumeState) {
              toast({ title: "Resuming Process", description: "Found saved progress for this file and will resume clustering."});
            }
        } catch {}
    }


    try {
        const settingsRes = await fetch("/api/settings");
        const settingsData = await settingsRes.json();
        const settings = settingsData.ok ? settingsData.settings : {};

        const response = await fetch('/api/cluster-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rows: rawRowsRef.current,
                mapping,
                options: settings,
                resumeState,
                progressKey,
            }),
        });

        if (!response.body) {
            throw new Error("Response body is missing.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const put = (store: string, key: string, value: any) => {
          return new Promise<void>((resolve, reject) => {
            if (!dbRef.current) return reject("DB not available");
            const tx = dbRef.current.transaction(store, "readwrite");
            tx.objectStore(store).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ""; 

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        
                         if (data.type === 'save_progress') {
                            if (data.value) {
                                localStorage.setItem(data.key, JSON.stringify(data.value));
                            } else {
                                localStorage.removeItem(data.key);
                            }
                            continue;
                        }

                        if (navigator.serviceWorker.controller && data.type === 'progress') {
                            navigator.serviceWorker.controller.postMessage({
                                type: 'PROGRESS_NOTIFICATION',
                                percent: Math.round(data.progress),
                                status: data.status
                            });
                        }
                        
                        if (data.type === 'progress' || data.type === 'status') {
                            setProcessingStatus(data.status || 'working');
                            setProgressInfo({ status: data.status || 'working', progress: data.progress ?? 0, completed: data.completed, total: data.total });
                        } else if (data.type === 'cache_rows') {
                            await put("rows", "all", data.payload);
                        } else if (data.type === 'cache_clusters') {
                            await put("clusters", `c_${data.index}`, data.payload);
                        } else if (data.type === 'cache_edges') {
                            await put("edges", `e_${data.index}`, data.payload);
                        } else if (data.type === 'cache_done') {
                            await put("meta", "ready", true);
                            await put("meta", "timestamp", Date.now());
                             await put("meta", "originalHeaders", columns);


                            if (timerRef.current) clearInterval(timerRef.current);
                            startTimeRef.current = null;
                            
                            if (navigator.serviceWorker.controller) {
                                navigator.serviceWorker.controller.postMessage({ type: 'DONE_NOTIFICATION' });
                            }

                            setProcessingStatus('caching');
                            setProgressInfo({ status: 'caching', progress: 98 });
                            
                            const readAll = (store: string) =>
                              new Promise<any[]>((resolve, reject) => {
                                if (!dbRef.current) return resolve([]);
                                const tx = dbRef.current.transaction(store);
                                const storeReq = tx.objectStore(store);
                                const req = storeReq.getAll();
                                req.onsuccess = () => resolve(req.result.flat());
                                req.onerror = () => reject(req.error);
                              });

                            const allRowsFromDB = (await readAll("rows"))[0];
                            const resultClusters = (await readAll("clusters"));
                            
                            setClusters(resultClusters);
                            
                            const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
                            sessionStorage.setItem('cacheId', cacheId);
                            
                            await fetch('/api/cluster-cache', { 
                                method:'POST', 
                                headers:{'Content-Type':'application/json'}, 
                                body: JSON.stringify({ cacheId, rows: allRowsFromDB, clusters: resultClusters, originalHeaders: columns }) 
                            });

                            sessionStorage.setItem('cacheTimestamp', Date.now().toString());
                            setProcessingStatus('done');
                            setProgressInfo({ status: 'done', progress: 100 });
                            toast({ title: t('upload.toasts.clusteringComplete.title'), description: t('upload.toasts.clusteringComplete.description', {count: resultClusters.length}) });
                            return; 
                        } else if (data.type === 'error') {
                            throw new Error(data.error || 'Unknown server error');
                        }
                    } catch (e: any) {
                        console.error('Failed to parse SSE message:', e.message, 'Raw data:', `"${dataStr}"`);
                    }
                }
            }
        }
    } catch (err: any) {
        console.error("Clustering process failed:", err);
        setProcessingStatus('error');
        if (timerRef.current) clearInterval(timerRef.current);
        toast({ title: "Processing Error", description: err.message || "Failed to run clustering on the server.", variant: "destructive" });
    }
  }


  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
        h > 0 ? `${h}h` : '',
        m > 0 ? `${m}m` : '',
        `${s}s`
    ].filter(Boolean).join(' ');
  };

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    let statusText = isTranslationLoading ? "" : t(`upload.status.${s}`);
    
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `${t('upload.status.label')}: ${statusText} (${progressInfo.completed.toLocaleString()}/${progressInfo.total.toLocaleString()})`;
    }
    return `${t('upload.status.label')}: ${statusText}`;
  };
  
    const SummaryCard = ({ icon, title, value, total }: { icon: React.ReactNode, title: string, value: string | number, total?: number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {total !== undefined && <p className="text-xs text-muted-foreground">{t('upload.results.outOf')} {total}</p>}
      </CardContent>
    </Card>
  );

  const getButtonText = () => {
     if(isTranslationLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
     switch (processingStatus) {
      case 'processing':
      case 'blocking':
      case 'building-edges':
      case 'merging-edges':
      case 'annotating':
        return t('upload.buttons.processing');
      case 'caching':
        return t('upload.buttons.caching');
      case 'done':
        return t('upload.buttons.done');
      case 'error':
        return t('upload.buttons.error');
      default:
        return t('upload.buttons.idle');
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.1.title')}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.1.description')}</CardDescription>
          </div>
          <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {isTranslationLoading ? <Skeleton className="h-5 w-20"/> : t('upload.buttons.settings')}
              </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
             <label htmlFor="file-upload" className="flex-1">
                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        {file ? (
                          <>
                            <p className="font-semibold text-primary">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} ${t('upload.file.rowsDetected')}` : t('upload.file.reading')}</p>
                          </>
                        ) : (
                          <>
                           <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">{t('upload.file.clickToUpload')}</span> {t('upload.file.orDragAndDrop')}</p>
                           <p className="text-xs text-muted-foreground">{t('upload.file.fileTypes')}</p>
                          </>
                        )}
                    </div>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.csv,.xlsm,.xlsb" />
                </div>
            </label>
             {file && (
                <Button onClick={() => {
                  setFile(null);
                  setColumns([]);
                  rawRowsRef.current = [];
                  setClusters([]);
                  setProcessingStatus('idle');
                  setProgressInfo({ status: 'idle', progress: 0 });
                  setFileReadProgress(0);
                  setTimeInfo({elapsed: 0});
                  if(timerRef.current) clearInterval(timerRef.current);
                }} variant="outline">{t('upload.buttons.reset')}</Button>
            )}
          </div>
          {file && fileReadProgress > 0 && fileReadProgress < 100 && (
            <div className="mt-4">
              <Label>{t('upload.file.reading')}</Label>
              <Progress value={fileReadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Collapsible open={isMappingOpen} onOpenChange={setIsMappingOpen} asChild>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.2.title')}</CardTitle>
                  <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.2.description')}</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MAPPING_FIELDS.map(field => (
                  <Card key={field}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            {mapping[field as keyof Mapping] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{t(`upload.mappingFields.${field}`)}{REQUIRED_MAPPING_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field as keyof Mapping]} onValueChange={(v)=> handleMappingChange(field as keyof Mapping, v)} className="p-4 grid grid-cols-2 gap-2">
                          {columns.map(col => (
                            <div key={col} className="flex items-center space-x-2">
                              <RadioGroupItem value={col} id={`${field}-${col}`} />
                              <Label htmlFor={`${field}-${col}`} className="truncate font-normal" title={col}>{col}</Label>
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

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.3.title')}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.3.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={startClustering} 
                disabled={!isMappingComplete || (processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error')}
              >
                {(processingStatus === 'processing' || processingStatus === 'caching' || processingStatus === 'building-edges' || processingStatus === 'merging-edges' || processingStatus === 'annotating' || processingStatus === 'blocking') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {getButtonText()}
              </Button>

              {(processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error') && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>{formattedStatus()}</span>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <Progress value={progressInfo.progress} className="absolute h-full w-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-foreground mix-blend-difference">{Math.round(progressInfo.progress)}%</span>
                    </div>
                  </div>
                   <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(timeInfo.elapsed)}</span>
                      {timeInfo.remaining !== undefined && (
                        <span className="text-xs">(est. {formatTime(timeInfo.remaining)} left)</span>
                      )}
                    </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {processingStatus === 'done' && (
        <Card>
          <CardHeader><CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.4.title')}</CardTitle><CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.4.description')}</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.totalRecords')} value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusteredRecords')} value={clusters.flatMap(c => (c as any).records).length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.unclusteredRecords')} value={rawRowsRef.current.length - clusters.flatMap(c => (c as any).records).length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusterCount')} value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.avgClusterSize')} value={clusters.length > 0 ? (clusters.flatMap(c => (c as any).records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>{t('upload.buttons.goToReview')} <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    