// app/(app)/upload/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Settings, CheckCircle, XCircle, Loader2, ChevronRight, Users, Group, Unlink, BoxSelect, Sigma, ChevronsUpDown } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DSU } from "@/lib/dsu";
import { openDB } from "idb";
import { useTranslation } from "@/hooks/use-translation";
import { similarityScoreDetailed } from "@/lib/scoring-server";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";


type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const SETTINGS_ENDPOINT = "/api/settings";

type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }

function normalizeChildrenField(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

function mapIncomingRowsToInternal(rowsChunk: any[], mapping: Mapping) {
  return rowsChunk.map((originalRecord, i) => {
        const mapped: Record<string, any> = { ...originalRecord };

        for (const key in mapping) {
            const fieldKey = key as keyof Mapping;
            const col = mapping[fieldKey];
            if (col && originalRecord[col] !== undefined) {
                mapped[fieldKey] = originalRecord[col];
            } else {
                // Ensure the key exists even if not mapped
                mapped[fieldKey] = "";
            }
        }
        
        mapped.children = normalizeChildrenField(mapped.children);
        
        return mapped as RecordRow;
    });
}

function hierarchicalRecluster(records: RecordRow[]): RecordRow[][] {
    if (!records || records.length <= 5) {
        return records.length > 1 ? [records] : [];
    }

    const normalizeArabic = (s: string) => {
        if (!s) return "";
        return s.normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
    };

    const getTokens = (name: string) => normalizeArabic(name).split(" ");

    const getSignature = (rec: RecordRow) => {
        const womanTokens = getTokens(rec.womanName || "");
        const first = womanTokens[0] || "";
        const father = womanTokens[1] || "";
        const grandfather = womanTokens[2] || "";
        const lastName = womanTokens[womanTokens.length - 1] || "";

        return {
            record: rec,
            womanTokens,
            coreSignature: `${first} ${father} ${grandfather}`.trim(),
            fullSignature: `${first} ${father} ${grandfather} ${lastName}`.trim(),
            normalizedFullName: normalizeArabic(rec.womanName || ""),
            surname: lastName
        };
    };

    let processedRecords = new Set<RecordRow>();
    let subClusters: RecordRow[][] = [];

    const signatures = records.map(getSignature);

    // Rule 1: Exact Dominant Full Match
    const exactMatchGroups = new Map<string, RecordRow[]>();
    signatures.forEach(sig => {
        if (processedRecords.has(sig.record)) return;
        const key = sig.normalizedFullName || sig.fullSignature;
        if (!key) return; // Skip if no valid key
        if (!exactMatchGroups.has(key)) exactMatchGroups.set(key, []);
        exactMatchGroups.get(key)!.push(sig.record);
    });

    exactMatchGroups.forEach(group => {
        if (group.length > 1) {
            subClusters.push(group);
            group.forEach(r => processedRecords.add(r));
        }
    });

    // Rule 2: Shared Surname + Partial Lineage
    const remainingSignatures = signatures.filter(sig => !processedRecords.has(sig.record));
    const surnameGroups = new Map<string, (typeof signatures)[0][]>();
    remainingSignatures.forEach(sig => {
        if (sig.surname) {
            if (!surnameGroups.has(sig.surname)) surnameGroups.set(sig.surname, []);
            surnameGroups.get(sig.surname)!.push(sig);
        }
    });

    surnameGroups.forEach(group => {
        if (group.length > 1) {
            while (group.length > 0) {
                const current = group.shift()!;
                if (processedRecords.has(current.record)) continue;
                const matches = [current];

                for (let i = group.length - 1; i >= 0; i--) {
                    const other = group[i];
                    if (processedRecords.has(other.record)) continue;
                    
                    const lineageTokensA = current.womanTokens.slice(1, 4);
                    const lineageTokensB = other.womanTokens.slice(1, 4);
                    let sharedTokens = 0;
                    if (lineageTokensA[0] && lineageTokensA[0] === lineageTokensB[0]) sharedTokens++;
                    if (lineageTokensA[1] && lineageTokensA[1] === lineageTokensB[1]) sharedTokens++;
                    if (lineageTokensA[2] && lineageTokensA[2] === lineageTokensB[2]) sharedTokens++;

                    if (sharedTokens >= 2) {
                        matches.push(other);
                        group.splice(i, 1);
                    }
                }
                if (matches.length > 1) {
                    subClusters.push(matches.map(m => m.record));
                    matches.forEach(m => processedRecords.add(m.record));
                }
            }
        }
    });
    
    // Any remaining records not clustered yet become their own "cluster" of 1
    // to be handled by the outer loop (which will discard them).
    signatures.forEach(sig => {
        if (!processedRecords.has(sig.record)) {
            // Do not create clusters of 1 record
            processedRecords.add(sig.record);
        }
    });

    return subClusters.filter(sc => sc.length > 1);
}


async function cacheFinalResult(result: any) {
  const db = await openDB('beneficiary-insights-cache', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results');
      }
    }
  });

  const tx = db.transaction('results', 'readwrite');
  await tx.objectStore('results').put(result, 'FULL_RESULT');
  await tx.done;
}


export default function UploadPage(){
  const { t } = useTranslation();
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", beneficiaryId:""
  });
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status:"idle", progress:0 });
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [clusters, setClusters] = useState<any[][]>([]);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const rawRowsRef = useRef<any[]>([]);
  const workersRef = useRef<Worker[]>([]);
  const completedWorkersRef = useRef(0);
  const allEdgesRef = useRef<any[]>([]);
  const totalPairsRef = useRef(0);
  const processedPairsRef = useRef(0);
  
  const { toast } = useToast();
  const router = useRouter();


  useEffect(()=>{
    const allRequiredMapped = REQUIRED_MAPPING_FIELDS.every(f => !!mapping[f]);
    setIsMappingComplete(allRequiredMapped);
    if(columns.length > 0){
      const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
      localStorage.setItem(key, JSON.stringify(mapping));
    }
  }, [mapping, columns]);

  async function handleFile(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if(!f) return;
    setFile(f);
    setWorkerStatus('idle'); setProgressInfo({ status:'idle', progress:0 }); setClusters([]);
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
        rawRowsRef.current = json; // Store raw rows
        setColumns(Object.keys(json[0] || {}));
        const storageKey = LOCAL_STORAGE_KEY_PREFIX + Object.keys(json[0]||{}).join(',');
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
  
  const enrichAndCacheResults = async (finalClusters: any[], mappedRows: RecordRow[], columns: string[]) => {
    setWorkerStatus('caching');
    setProgressInfo({ status: 'caching', progress: 98 });
    
    const enrichedClusters = finalClusters.map(cluster => {
        const pairs = [];
        for (let i = 0; i < cluster.records.length; i++) {
            for (let j = i + 1; j < cluster.records.length; j++) {
                pairs.push(similarityScoreDetailed(cluster.records[i], cluster.records[j]));
            }
        }
        
        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const nameScores = pairs.map(p => p.breakdown.nameScore || 0);
        const husbandScores = pairs.map(p => p.breakdown.husbandScore || 0);
        const finalScores = pairs.map(p => p.score || 0);

        const avgWomanNameScore = avg(nameScores);
        const avgHusbandNameScore = avg(husbandScores);
        const avgFinalScore = avg(finalScores);
        const confidence = calculateClusterConfidence(avgWomanNameScore, avgHusbandNameScore);
        
        return {
            ...cluster,
            avgWomanNameScore,
            avgHusbandNameScore,
            avgFinalScore,
            confidence,
            Max_PairScore: Math.max(...finalScores, 0),
            size: cluster.records.length
        };
    });

    try {
      const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
      sessionStorage.setItem('cacheId', cacheId);
      
      const dataToCache = {
          rows: mappedRows,
          clusters: enrichedClusters,
          originalHeaders: columns,
      };

      await cacheFinalResult(dataToCache);

      sessionStorage.setItem('cacheTimestamp', Date.now().toString());
      setWorkerStatus('done');
      setProgressInfo({ status: 'done', progress: 100 });
      toast({ title: t('upload.toasts.clusteringComplete.title'), description: t('upload.toasts.clusteringComplete.description', { count: enrichedClusters.length }) });
    } catch(err:any){
      setWorkerStatus('error');
      toast({ title: t('upload.toasts.cacheError.title'), description: String(err), variant:"destructive" });
    }
  };


  const finalizeClustering = async () => {
    setWorkerStatus('merging-edges');
    setProgressInfo({ status: 'merging-edges', progress: 95, completed: processedPairsRef.current, total: totalPairsRef.current });

    await new Promise(r => setTimeout(r, 50)); // UI update tick
    
    const edges = allEdgesRef.current;
    
    edges.sort((a,b) => b.score - a.score || a.a - b.a || a.b - b.b);
    
    const mappedRows = mapIncomingRowsToInternal(rawRowsRef.current, mapping);
    
    // Stable ID generation
    const textEncoder = new TextEncoder();
    for (const row of mappedRows) {
        const raw = `${row.beneficiaryId}|${row.womanName}|${row.husbandName}|${row.nationalId}|${row.phone}`;
        const data = textEncoder.encode(raw);
        const buffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(buffer));
        row._internalId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const dsu = new DSU();
    mappedRows.forEach(r => dsu.make(r._internalId!));
    
    const edgeReasons = new Map<string, Set<string>>();

    const MERGE_THRESHOLD = 0.72;
    let weakEdgeCount = 0;

    for (const edge of edges) {
      if (edge.score < MERGE_THRESHOLD) {
        weakEdgeCount++;
        continue;
      }
    }
    console.log("Weak edges skipped:", weakEdgeCount);
    
    for(const edge of edges) {
        if (edge.score < MERGE_THRESHOLD) continue;

        const idA = mappedRows[edge.a]?._internalId;
        const idB = mappedRows[edge.b]?._internalId;
        if (!idA || !idB) continue;

        const rootA = dsu.find(idA);
        const rootB = dsu.find(idB);

        dsu.union(idA, idB);
        const newRoot = dsu.find(idA);

        const reasonsA = edgeReasons.get(rootA) || new Set();
        const reasonsB = edgeReasons.get(rootB) || new Set();
        const combinedReasons = new Set([...reasonsA, ...reasonsB, ...(edge.reasons || [])]);

        edgeReasons.set(newRoot, combinedReasons);
        if (rootA !== newRoot) edgeReasons.delete(rootA);
        if (rootB !== newRoot) edgeReasons.delete(rootB);
    }
    
    const groups = dsu.getGroups();
    let currentClusters: any[] = [];
    for (const [root, members] of groups.entries()) {
      if (members.length > 1) {
        const clusterRecords = members.map(id => mappedRows.find(r => r._internalId === id)).filter(Boolean) as RecordRow[];
        if (clusterRecords.length > 1) {
          currentClusters.push({ 
            records: clusterRecords,
            reasons: Array.from(edgeReasons.get(root) || []),
            refinePass: 0,
          });
        }
      }
    }
    
    const MAX_RECLUSTER_PASSES = 10;
    let pass = 1;
    while (true) {
        // Stable cluster order before reclustering
        currentClusters.sort((a, b) =>
            a.records[0]._internalId.localeCompare(b.records[0]._internalId)
        );

        const oversized = currentClusters.filter(c => c.records.length > 5 && c.refinePass < MAX_RECLUSTER_PASSES);
        const normalSized = currentClusters.filter(c => c.records.length <= 5 || c.refinePass >= MAX_RECLUSTER_PASSES);

        if (oversized.length === 0) {
            currentClusters = normalSized.filter(c => c.records.length > 1);
            break;
        }
        
        setWorkerStatus('re-clustering');
        setProgressInfo({
            status: `re-clustering pass ${pass}`,
            progress: 95,
            completed: 0,
            total: oversized.length
        });
        
        let nextPassClusters: any[] = [...normalSized];
        
        for (let i = 0; i < oversized.length; i++) {
            const clusterToSplit = oversized[i];
            const subClusters = hierarchicalRecluster(clusterToSplit.records);
            
            subClusters.forEach(sub => {
                nextPassClusters.push({
                    records: sub,
                    reasons: clusterToSplit.reasons,
                    refinePass: clusterToSplit.refinePass + 1,
                });
            });
            
            setProgressInfo(prev => ({ ...prev, completed: (prev.completed ?? 0) + 1 }));
            await new Promise(r => setTimeout(r, 10)); // UI tick
        }
        
        currentClusters = nextPassClusters;
        pass++;
        
        if (pass > MAX_RECLUSTER_PASSES * 2) { // Additional safety break
            console.warn("Exceeded maximum total passes, breaking re-cluster loop.");
            break;
        }
    }
    
    setClusters(currentClusters);
    await enrichAndCacheResults(currentClusters, mappedRows, columns);

  };


  async function startClustering(){
    if(!rawRowsRef.current.length){ toast({ title: t('upload.toasts.noData') }); return; }
    if(!isMappingComplete){ toast({ title: t('upload.toasts.mappingIncomplete'), variant:"destructive"}); return; }

    setIsMappingOpen(false);
    setWorkerStatus('processing'); 
    setProgressInfo({ status:'processing', progress:1 });

    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
    completedWorkersRef.current = 0;
    allEdgesRef.current = [];
    processedPairsRef.current = 0;

    let settings = {};
    try {
      const res = await fetch(SETTINGS_ENDPOINT);
      const d = await res.json();
      if(d.ok) settings = d.settings || {};
    } catch(_) {}
    
    const mappedRows = mapIncomingRowsToInternal(rawRowsRef.current, mapping);

    // Sort records before worker dispatch
    mappedRows.sort((a, b) =>
        String(a.beneficiaryId || "").localeCompare(
            String(b.beneficiaryId || "")
        )
    );

    const numCores = navigator.hardwareConcurrency || 4;
    const n = mappedRows.length;
    const numPairs = (n * (n - 1)) / 2;
    totalPairsRef.current = numPairs;

    if (totalPairsRef.current === 0) {
        toast({ title: "No pairs to compare", description: "Not enough data to perform clustering." });
        setWorkerStatus('done');
        return;
    }

    const pairsPerWorker = Math.ceil(numPairs / numCores);
    let currentPair = 0;

    for (let i = 0; i < numCores; i++) {
        const worker = new Worker(new URL('@/workers/cluster.worker.ts', import.meta.url));
        workersRef.current.push(worker);

        const startPair = currentPair;
        const endPair = Math.min(startPair + pairsPerWorker, numPairs);
        currentPair = endPair;
        
        if (startPair >= endPair) {
            completedWorkersRef.current++;
            if (completedWorkersRef.current === numCores) {
                finalizeClustering();
            }
            continue;
        };

        worker.onmessage = (e) => {
            const { type, edges, processed, error } = e.data;
            if (type === 'error') {
                console.error('Worker error:', error?.message);
                toast({ title: "Worker Error", description: error?.message || 'An unknown error occurred in the worker.', variant: "destructive" });
                setWorkerStatus('error');
                workersRef.current.forEach(w => w.terminate());
                return;
            }

            if (type === 'progress') {
                processedPairsRef.current += processed;
                const percent = totalPairsRef.current > 0 ? Math.round((processedPairsRef.current / totalPairsRef.current) * 90) : 0;
                 setProgressInfo({
                    status: 'building-edges',
                    progress: Math.min(90, 10 + percent),
                    completed: processedPairsRef.current,
                    total: totalPairsRef.current,
                });
            } else if (type === 'done') {
                processedPairsRef.current += processed; // Add final count
                allEdgesRef.current.push(...edges);
                completedWorkersRef.current++;
                if (completedWorkersRef.current === workersRef.current.length) {
                    finalizeClustering();
                }
            }
        };

        worker.onerror = (e) => {
            console.error('Worker uncaught error:', e);
            toast({ title: "Worker Error", description: e.message || 'An uncaught error occurred. Check console for details.', variant: "destructive" });
            setWorkerStatus('error');
        };

        worker.postMessage({
            rows: mappedRows,
            options: settings,
            startPair,
            endPair
        });
    }
  }

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    let statusText = t(`upload.status.${s.replace(/-/g, '_')}`) || s.replace(/-/g, ' ');
    
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
    switch (workerStatus) {
      case 'processing':
      case 'building-edges':
      case 'merging-edges':
        return t('upload.buttons.processing');
      case 're-clustering':
        return t('upload.buttons.re-clustering') || 'Refining Clusters...';
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
            <CardTitle>{t('upload.steps.1.title')}</CardTitle>
            <CardDescription>{t('upload.steps.1.description')}</CardDescription>
          </div>
          <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {t('upload.buttons.settings')}
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
                  setWorkerStatus('idle');
                  setProgressInfo({ status: 'idle', progress: 0 });
                  setFileReadProgress(0);
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
                  <CardTitle>{t('upload.steps.2.title')}</CardTitle>
                  <CardDescription>{t('upload.steps.2.description')}</CardDescription>
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
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{t(`upload.mappingFields.${field}`)}{REQUIRED_MAPPING_FIELDS.includes(field as keyof Mapping) && <span className="text-destructive">*</span>}</Label>
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

      {file && isMappingComplete && (
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.steps.3.title')}</CardTitle>
            <CardDescription>{t('upload.steps.3.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={startClustering} disabled={workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error'}>
                {(workerStatus === 'processing' || workerStatus === 'caching' || workerStatus === 'building-edges' || workerStatus === 'merging-edges' || workerStatus.startsWith('re-clustering')) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {getButtonText()}
              </Button>

              {(workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error') && (
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {workerStatus === 'done' && (
        <Card>
          <CardHeader><CardTitle>{t('upload.steps.4.title')}</CardTitle><CardDescription>{t('upload.steps.4.description')}</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.totalRecords')} value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusteredRecords')} value={clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.unclusteredRecords')} value={rawRowsRef.current.length - clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusterCount')} value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.avgClusterSize')} value={clusters.length > 0 ? (clusters.flatMap(c => c.records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>{t('upload.buttons.goToReview')} <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
