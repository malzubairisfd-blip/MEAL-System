// app/(app)/upload/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Settings, CheckCircle, XCircle, Loader2, ChevronRight, Users, Group, Unlink, BoxSelect, Sigma } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import Worker from '@/workers/cluster.worker.ts?worker';


type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; cluster_id?: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children","cluster_id","beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const SETTINGS_ENDPOINT = "/api/settings";

type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }

export default function UploadPage(){
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", cluster_id:"", beneficiaryId:""
  });
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status:"idle", progress:0 });
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [clusters, setClusters] = useState<any[][]>([]);
  const rowsRef = useRef<any[]>([]);
  const workerRef = useRef<Worker|null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(()=>{
    // create module worker
    if(typeof window === "undefined") return;
    if(workerRef.current) return;
    try {
      const w = new Worker();
      workerRef.current = w;
      w.onmessage = async (ev) => {
        const msg = ev.data;
        if(!msg || !msg.type) return;
        if(msg.type === 'progress'){
          setWorkerStatus(msg.status || 'working');
          setProgressInfo({ status: msg.status || 'working', progress: msg.progress ?? 0, completed: msg.completed, total: msg.total });
        } else if(msg.type === 'done'){
          setWorkerStatus('caching');
          setProgressInfo({ status: 'caching', progress: 98 });
          const resultClusters = msg.clusters || [];
          setClusters(resultClusters);
          // cache to server in chunks (like earlier)
          try {
            const cacheId = `cache-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
            sessionStorage.setItem('cacheId', cacheId);
            // initialize
            await fetch('/api/cluster-cache', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cacheId, data:{ originalHeaders: columns } }) });
            const allRows = rowsRef.current.map((r,i)=> ({ ...r, _internalId: `row_${i}` }));
            for(let i=0;i<allRows.length;i+=2000){
              const chunk = allRows.slice(i,i+2000);
              await fetch('/api/cluster-cache', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cacheId, data:{ rows: chunk } }) });
            }
            for(let i=0;i<resultClusters.length;i+=1000){
              const chunk = resultClusters.slice(i,i+1000);
              await fetch('/api/cluster-cache', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cacheId, data:{ clusters: chunk } }) });
            }
            sessionStorage.setItem('cacheTimestamp', Date.now().toString());
            setWorkerStatus('done');
            setProgressInfo({ status: 'done', progress: 100 });
            toast({ title: "Clustering complete", description: `Found ${resultClusters.length} clusters.` });
          } catch(err:any){
            setWorkerStatus('error');
            toast({ title: "Failed to cache results", description: String(err), variant:"destructive" });
          }
        } else if(msg.type === 'error'){
          setWorkerStatus('error');
          toast({ title: "Worker error", description: msg.error || 'Unknown', variant:"destructive" });
        }
      };
    } catch(err:any){
      console.error('Worker spawn failed', err);
      toast({ title: "Unable to start worker", description: String(err), variant:"destructive" });
    }
    return () => {
      if(workerRef.current){ workerRef.current.terminate(); workerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const buffer = await f.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates:true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
    rowsRef.current = json;
    setColumns(Object.keys(json[0] || {}));
    const storageKey = LOCAL_STORAGE_KEY_PREFIX + Object.keys(json[0]||{}).join(',');
    const saved = localStorage.getItem(storageKey);
    if(saved) {
      try { setMapping(JSON.parse(saved)); } catch {}
    } else {
      setMapping({ womanName:"", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", cluster_id:"", beneficiaryId:"" });
    }
  }

  function handleMappingChange(field:keyof Mapping, value:string){
    setMapping(m => ({ ...m, [field]: value }));
  }

  async function startClustering(){
    if(!workerRef.current) { toast({ title: "Worker not ready" }); return; }
    if(!rowsRef.current.length){ toast({ title: "Upload data first" }); return; }
    if(!isMappingComplete){ toast({ title: "Mapping incomplete", variant:"destructive"}); return; }

    setWorkerStatus('processing'); setProgressInfo({ status:'processing', progress:1 });

    // load settings from server (if any): includes finalScoreWeights and thresholds
    let settings = {};
    try {
      const res = await fetch(SETTINGS_ENDPOINT);
      const d = await res.json();
      if(d.ok) settings = d.settings || {};
    } catch(_) {}

    workerRef.current!.postMessage({ type:'start', payload: { mapping, options: settings } });

    // stream rows in chunks
    const CHUNK = 2000;
    for(let i=0;i<rowsRef.current.length;i+=CHUNK){
      const chunk = rowsRef.current.slice(i,i+CHUNK);
      workerRef.current!.postMessage({ type:'data', payload:{ rows: chunk } });
      // give event loop a tiny break to avoid lockups
      await new Promise(r => setTimeout(r, 8));
    }
    workerRef.current!.postMessage({ type:'end' });
  }

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    if(progressInfo.completed !== undefined && progressInfo.total) return `${s} (${progressInfo.completed}/${progressInfo.total})`;
    return s;
  };
  
    const SummaryCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );


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
                            <p className="text-xs text-muted-foreground">{rowsRef.current.length} rows detected</p>
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
                  rowsRef.current = [];
                  setClusters([]);
                  setWorkerStatus('idle');
                  setProgressInfo({ status: 'idle', progress: 0 });
                }} variant="outline">Reset</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Card>
          <CardHeader><CardTitle>2. Map Columns</CardTitle><CardDescription>Map your sheet columns to fields.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MAPPING_FIELDS.map(field => (
              <Card key={field}>
                <CardHeader className="p-3">
                  <div className="flex justify-between items-center w-full">
                    <div className="capitalize">{field.replace(/_/g,' ')}{REQUIRED_MAPPING_FIELDS.includes(field) && <span className="text-destructive">*</span>}</div>
                    {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-40">
                    <RadioGroup value={mapping[field]} onValueChange={(v)=> handleMappingChange(field as keyof Mapping, v)} className="p-3">
                      {columns.map(col => (
                        <div key={col} className="flex items-center space-x-2">
                          <RadioGroupItem value={col} id={`${field}-${col}`} />
                          <Label htmlFor={`${field}-${col}`} className="truncate" title={col}>{col}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {file && isMappingComplete && (
        <Card>
          <CardHeader><CardTitle>3. Run Clustering</CardTitle><CardDescription>Start the analysis</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={startClustering} disabled={workerStatus === 'processing' || workerStatus === 'caching'}>
                {workerStatus === 'processing' || workerStatus === 'caching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {workerStatus === 'caching' ? 'Caching...' : (workerStatus === 'processing' ? 'Clustering...' : 'Start Clustering')}
              </Button>

              {(workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error') && (
                <div>
                  <div className="flex justify-between text-sm"><span>Status: <b>{formattedStatus()}</b></span><span>{Math.round(progressInfo.progress)}%</span></div>
                  <Progress value={progressInfo.progress} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {workerStatus === 'done' && (
        <Card>
          <CardHeader><CardTitle>4. Results</CardTitle><CardDescription>Summary</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="Total Records" value={rowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="Clustered Records" value={clusters.flat().length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="Unclustered Records" value={rowsRef.current.length - clusters.flat().length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title="Cluster Count" value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title="Avg. Cluster Size" value={clusters.length > 0 ? (clusters.flat().length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>Go to Review Page <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
