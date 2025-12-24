
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


type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const SETTINGS_ENDPOINT = "/api/settings";

type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }

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
  
  // New refs for multi-worker setup
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
        
        json.forEach((row, index) => {
            row._internalId = `row_${index}`;
        });

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
    setProgressInfo({ status: 'merging-edges', progress: 80 });
    
    await new Promise(r => setTimeout(r, 50)); // Allow UI to update

    const edges = allEdgesRef.current;
    
    // CRITICAL: Deterministic global sort
    edges.sort((a,b) => b.score - a.score || a.a - b.a || a.b - b.b);
    
    const dsu = new DSU();
    // CRITICAL: Initialize DSU with all record IDs
    rawRowsRef.current.forEach(r => dsu.make(r._internalId));
    
    for(const edge of edges) {
        const idA = rawRowsRef.current[edge.a]?._internalId;
        const idB = rawRowsRef.current[edge.b]?._internalId;

        if (!idA || !idB) continue;
        
        // Correctly union the string IDs
        dsu.union(idA, idB);
    }
    
    const groups = dsu.getGroups();
    const finalClusters: any[] = [];
    for (const members of groups.values()) {
      if (members.length > 1) {
        finalClusters.push({ 
          records: members.map(id => rawRowsRef.current.find(r => r._internalId === id)),
          reasons: [] // Reasons are derived from edges, can be added here if needed
        });
      }
    }

    setClusters(finalClusters);
    
    setWorkerStatus('caching');
    setProgressInfo({ status: 'caching', progress: 98 });
    
    try {
      const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
      sessionStorage.setItem('cacheId', cacheId);
      
      const dataToCache = {
          rows: rawRowsRef.current,
          clusters: finalClusters,
          originalHeaders: columns,
      };

      await fetch('/api/cluster-cache', { 
          method:'POST', 
          headers:{'Content-Type':'application/json'}, 
          body: JSON.stringify({ cacheId, ...dataToCache }) 
      });

      sessionStorage.setItem('cacheTimestamp', Date.now().toString());
      setWorkerStatus('done');
      setProgressInfo({ status: 'done', progress: 100 });
      toast({ title: "Clustering complete", description: `Found ` + finalClusters.length + ` clusters.` });
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
    
    const numCores = navigator.hardwareConcurrency || 4;
    const n = rawRowsRef.current.length;
    totalPairsRef.current = (n * (n - 1)) / 2;
    const pairsPerWorker = Math.ceil(totalPairsRef.current / numCores);
    
    for (let i = 0; i < numCores; i++) {
        const worker = new Worker(new URL('@/workers/cluster.worker.ts', import.meta.url));
        workersRef.current.push(worker);

        const startPair = i * pairsPerWorker;
        const endPair = Math.min(startPair + pairsPerWorker, totalPairsRef.current);
        
        if (startPair >= endPair) {
            completedWorkersRef.current++;
            if (completedWorkersRef.current === numCores) {
                finalizeClustering();
            }
            continue;
        };

        worker.postMessage({
            rows: rawRowsRef.current,
            mapping,
            options: settings,
            startPair,
            endPair
        });

        worker.onmessage = (e) => {
            const { type, edges, processed } = e.data;

            if (type === 'progress') {
                processedPairsRef.current += processed;
                const percent = totalPairsRef.current > 0 ? Math.floor((processedPairsRef.current / totalPairsRef.current) * 70) + 10 : 10;
                 setProgressInfo({
                    status: 'building-edges',
                    progress: percent,
                    completed: processedPairsRef.current,
                    total: totalPairsRef.current,
                });
            } else if (type === 'done') {
                allEdgesRef.current.push(...edges);
                completedWorkersRef.current++;
                if (completedWorkersRef.current === workersRef.current.length) {
                    finalizeClustering();
                }
            }
        };

        worker.onerror = (e) => {
            console.error('Worker error:', e);
            toast({ title: "Worker Error", description: e.message, variant: "destructive" });
            setWorkerStatus('error');
        }
    }
  }

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    let statusText = s.replace(/-/g, ' '); // a bit nicer looking
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
      case 'blocking':
      case 'building-edges':
      case 'merging-edges':
      case 'annotating':
        return 'Processing...';
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
                            {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{field.replace(/_/g,' ')}{REQUIRED_MAPPING_FIELDS.includes(field) && <span className="text-destructive">*</span>}</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field]} onValueChange={(v)=> handleMappingChange(field as keyof Mapping, v)} className="p-4 grid grid-cols-2 gap-2">
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
                {(workerStatus === 'processing' || workerStatus === 'caching' || workerStatus === 'building-edges' || workerStatus === 'merging-edges') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
