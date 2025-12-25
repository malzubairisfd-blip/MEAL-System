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

function hierarchicalRecluster(records: RecordRow[]) {
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
            _internalId: rec._internalId,
            record: rec,
            womanTokens,
            coreSignature: `${first} ${father} ${grandfather}`.trim(),
            fullSignature: `${first} ${father} ${grandfather} ${lastName}`.trim(),
            normalizedFullName: normalizeArabic(rec.womanName || ""),
            surname: lastName
        };
    };

    let processedIds = new Set<string>();
    let finalClusters: RecordRow[][] = [];

    const signatures = records.map(getSignature);

    // Rule 1: Exact Dominant Full Match
    const exactMatchGroups = new Map<string, RecordRow[]>();
    signatures.forEach(sig => {
        if (processedIds.has(sig._internalId!)) return;

        const key = sig.normalizedFullName || sig.fullSignature;
        if (!exactMatchGroups.has(key)) exactMatchGroups.set(key, []);
        exactMatchGroups.get(key)!.push(sig.record);
    });

    exactMatchGroups.forEach(group => {
        if (group.length > 1) {
            finalClusters.push(group);
            group.forEach(r => processedIds.add(r._internalId!));
        }
    });

    // Rule 2: Shared Surname + Partial Lineage
    const remainingSignatures = signatures.filter(sig => !processedIds.has(sig._internalId!));
    const surnameGroups = new Map<string, typeof remainingSignatures>();
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
                const matches = [current];

                for (let i = group.length - 1; i >= 0; i--) {
                    const other = group[i];
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
                    finalClusters.push(matches.map(m => m.record));
                    matches.forEach(m => processedIds.add(m._internalId!));
                }
            }
        }
    });
    
    // Rule 3: Core 3 + Same Tribe
    const finalRemainingSigs = signatures.filter(sig => !processedIds.has(sig._internalId!));
    const tribeGroups = new Map<string, typeof finalRemainingSigs>();
    finalRemainingSigs.forEach(sig => {
        const tribeKey = sig.coreSignature;
        if (!tribeGroups.has(tribeKey)) tribeGroups.set(tribeKey, []);
        tribeGroups.get(tribeKey)!.push(sig);
    });

    tribeGroups.forEach(group => {
        if (group.length > 1) {
            finalClusters.push(group.map(g => g.record));
            group.forEach(g => processedIds.add(g._internalId!));
        }
    });

    // Add any remaining ungrouped records as individual clusters to ensure no data is lost
    const leftovers = signatures.filter(sig => !processedIds.has(sig._internalId!));
    leftovers.forEach(sig => finalClusters.push([sig.record]));

    return finalClusters.filter(c => c.length > 0);
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

  const finalizeClustering = async () => {
    setWorkerStatus('merging-edges');
    setProgressInfo({ status: 'merging-edges', progress: 95, completed: processedPairsRef.current, total: totalPairsRef.current });

    await new Promise(r => setTimeout(r, 50)); // UI update tick
    
    const edges = allEdgesRef.current;
    
    edges.sort((a,b) => b.score - a.score || a.a - b.a || a.b - b.b);
    
    const mappedRows = mapIncomingRowsToInternal(rawRowsRef.current, mapping);
    mappedRows.forEach((row, i) => row._internalId = `row_${i}`);

    const dsu = new DSU();
    mappedRows.forEach(r => dsu.make(r._internalId!));
    
    for(const edge of edges) {
        const idA = mappedRows[edge.a]?._internalId;
        const idB = mappedRows[edge.b]?._internalId;
        if (!idA || !idB) continue;
        dsu.union(idA, idB);
    }
    
    const groups = dsu.getGroups();
    let currentClusters: any[] = [];
    for (const members of groups.values()) {
      if (members.length > 1) {
        const clusterRecords = members.map(id => mappedRows.find(r => r._internalId === id)).filter(Boolean);
        if (clusterRecords.length > 1) {
          currentClusters.push({ 
            records: clusterRecords,
            reasons: []
          });
        }
      }
    }
    
    let pass = 1;
    while (true) {
        const oversized = currentClusters.filter(c => c.records.length > 5);
        const normal = currentClusters.filter(c => c.records.length <= 5);

        if (oversized.length === 0) {
            currentClusters = normal;
            break;
        }
        
        setWorkerStatus('re-clustering');
        setProgressInfo({
            status: `re-clustering pass ${pass}`,
            progress: 95,
            completed: 0,
            total: oversized.length
        });
        
        let refinedNextPass: any[] = [...normal];
        
        for (let i = 0; i < oversized.length; i++) {
            const cluster = oversized[i];
            const subClusters = hierarchicalRecluster(cluster.records);
            
            subClusters.forEach(sub => {
                if (sub.length > 0) {
                    refinedNextPass.push({
                        records: sub,
                        reasons: cluster.reasons, // Carry over original reasons
                        parentCluster: i + 1
                    });
                }
            });
            
            setProgressInfo(prev => ({ ...prev, completed: i + 1 }));
            await new Promise(r => setTimeout(r, 10)); // UI tick
        }
        currentClusters = refinedNextPass;
        pass++;
    }


    setClusters(currentClusters);
    
    setWorkerStatus('caching');
    setProgressInfo({ status: 'caching', progress: 98 });
    
    try {
      const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
      sessionStorage.setItem('cacheId', cacheId);
      
      const dataToCache = {
          rows: mappedRows,
          clusters: currentClusters,
          originalHeaders: columns,
      };

      await cacheFinalResult(dataToCache);

      sessionStorage.setItem('cacheTimestamp', Date.now().toString());
      setWorkerStatus('done');
      setProgressInfo({ status: 'done', progress: 100 });
      toast({ title: "Clustering complete", description: `Found ` + currentClusters.length + ` clusters.` });
    } catch(err:any){
      setWorkerStatus('error');
      toast({ title: "Failed to cache results", description: String(err), variant:"destructive" });
    }
  };


  async function startClustering(){
    if(!rawRowsRef.current.length){ toast({ title: "Upload data first" }); return; }
    if(!isMappingComplete){ toast({ title: "Mapping incomplete", variant:"destructive"}); return; }

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
    let statusText = s.replace(/-/g, ' ');
    statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
    
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `Status: ${statusText} (${progressInfo.completed.toLocaleString()}/${progressInfo.total.toLocaleString()})`;
    }
    return `Status: ${statusText}`;
  };
  
    const SummaryCard = ({ icon, title, value, total }: { icon: React.ReactNode, title: string, value: string | number, total?: number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {total !== undefined && <p className="text-xs text-muted-foreground">out of {total}</p>}
      </CardContent>
    </Card>
  );

  const getButtonText = () => {
    switch (workerStatus) {
      case 'processing':
      case 'building-edges':
      case 'merging-edges':
        return 'Processing...';
      case 're-clustering':
        return 'Refining Clusters...';
      case 'caching':
        return 'Caching Results...';
      case 'done':
        return 'Clustering Done!';
      case 'error':
        return 'Error! Retry?';
      default:
        return 'Start Clustering';
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>1. Upload File</CardTitle>
            <CardDescription>Select a file from your device to begin the analysis.</CardDescription>
          </div>
          <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
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
                            <p className="text-xs text-muted-foreground">{rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} rows detected` : 'Reading file...'}</p>
                          </>
                        ) : (
                          <>
                           <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                           <p className="text-xs text-muted-foreground">XLSX, XLS, CSV, etc.</p>
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
                }} variant="outline">Reset</Button>
            )}
          </div>
          {file && fileReadProgress > 0 && fileReadProgress < 100 && (
            <div className="mt-4">
              <Label>Reading File...</Label>
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
                  <CardTitle>2. Map Columns</CardTitle>
                  <CardDescription>Map your sheet columns to the required fields for analysis.</CardDescription>
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
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{field.replace(/_/g,' ')}{REQUIRED_MAPPING_FIELDS.includes(field as keyof Mapping) && <span className="text-destructive">*</span>}</Label>
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
            <CardTitle>3. Run Clustering</CardTitle>
            <CardDescription>Start the AI-powered analysis to find potential duplicates.</CardDescription>
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
          <CardHeader><CardTitle>4. Results</CardTitle><CardDescription>Summary of the clustering process.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="Total Records" value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="Clustered Records" value={clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="Unclustered Records" value={rawRowsRef.current.length - clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title="Cluster Count" value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title="Avg. Cluster Size" value={clusters.length > 0 ? (clusters.flatMap(c => c.records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>Go to Review Page <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}