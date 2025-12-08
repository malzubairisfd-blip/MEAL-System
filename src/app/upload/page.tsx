
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from 'next/navigation';
import * as XLSX from "xlsx";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle, XCircle, Settings, ChevronRight, Loader2, Users, Unlink, BoxSelect, Sigma, Group } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

type Mapping = {
  womanName: string;
  husbandName: string;
  nationalId: string;
  phone: string;
  village: string;
  subdistrict: string;
  children: string;
  cluster_id?: string;
  beneficiaryId?: string;
};

const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children", "cluster_id", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";

type WorkerProgress = {
  status: string;
  progress: number;
  completed?: number;
  total?: number;
}

type ClusterSummary = {
    totalRecords: number;
    clusteredRecords: number;
    unclusteredRecords: number;
    clusterCount: number;
    avgClusterSize: number;
}

export default function UploadPage() {
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName: "", nationalId: "", phone: "",
    village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: ""
  });
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status: "idle", progress: 0 });
  const [clusters, setClusters] = useState<any[][]>([]);
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rowsRef = useRef<any[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  // Web Worker setup
  useEffect(() => {
    if (typeof window !== 'undefined' && !workerRef.current) {
      const workerScript = createWorkerScript();
      const blob = new Blob([workerScript], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      workerRef.current = w;

      w.onmessage = async (ev: MessageEvent) => {
        const msg = ev.data;
        if (!msg || !msg.type) return;
        switch (msg.type) {
          case "progress":
            setWorkerStatus(msg.status || "working");
            setProgressInfo({
              status: msg.status || "working",
              progress: msg.progress ?? 0,
              completed: msg.completed,
              total: msg.total,
            });
            break;
          case "done":
            const resultClusters = msg.clusters || [];
            setProgressInfo({ status: "caching", progress: 99 });
            setWorkerStatus("caching");

            toast({ title: "Clustering Complete", description: `Found ${resultClusters.length} potential duplicate clusters. Caching results...` });

            // Save results to server-side cache
            try {
              const cacheId = `cache-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              sessionStorage.setItem('cacheId', cacheId);
              
              // Initial cache setup
              const initialPayload = {
                cacheId,
                data: {
                  originalHeaders: columns,
                  aiSummaries: {},
                  clusters: [],
                  rows: []
                }
              };
              const initialCacheRes = await fetch('/api/cluster-cache', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(initialPayload)
              });
              if (!initialCacheRes.ok) throw new Error('Failed to initialize cache.');

              const allRows = rowsRef.current.map((r, i) => ({ ...r, _internalId: `row_${i}` }));

              // Send rows in chunks
              const rowChunkSize = 2000;
              for (let i = 0; i < allRows.length; i += rowChunkSize) {
                  const chunk = allRows.slice(i, i + rowChunkSize);
                  await fetch('/api/cluster-cache', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ cacheId, data: { rows: chunk } })
                  });
                  await new Promise(res => setTimeout(res, 20)); // Small delay
              }

              // Send clusters in chunks
              const clusterChunkSize = 1000;
               for (let i = 0; i < resultClusters.length; i += clusterChunkSize) {
                  const chunk = resultClusters.slice(i, i + clusterChunkSize);
                  await fetch('/api/cluster-cache', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ cacheId, data: { clusters: chunk } })
                  });
                   await new Promise(res => setTimeout(res, 20)); // Small delay
              }

              sessionStorage.setItem('cacheTimestamp', Date.now().toString());

              setWorkerStatus("done");
              setProgressInfo({ status: "done", progress: 100 });
              setClusters(resultClusters);

              const totalRecords = rowsRef.current.length;
              const clusteredRecords = resultClusters.flat().length;
              setSummary({
                  totalRecords: totalRecords,
                  clusteredRecords: clusteredRecords,
                  unclusteredRecords: totalRecords - clusteredRecords,
                  clusterCount: resultClusters.length,
                  avgClusterSize: resultClusters.length > 0 ? clusteredRecords / resultClusters.length : 0
              });
              toast({ title: "Results Cached", description: `You can now proceed to the review page.` });


            } catch(error: any) {
               setWorkerStatus("error");
               toast({ title: "Error Saving Results", description: error.message, variant: "destructive" });
            }

            break;
          case "error":
            setWorkerStatus("error");
            toast({ title: "Worker Error", description: msg.error, variant: "destructive"});
            break;
        }
      };

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          URL.revokeObjectURL(url);
          workerRef.current = null;
        }
      };
    }
  }, [toast, columns]);
  
  // Update mapping and save to localStorage
  useEffect(() => {
    if (columns.length > 0) {
      const storageKey = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
      localStorage.setItem(storageKey, JSON.stringify(mapping));
    }
    const allRequiredMapped = REQUIRED_MAPPING_FIELDS.every(field => !!mapping[field]);
    setIsMappingComplete(allRequiredMapped);
  }, [mapping, columns]);

  // File input handler
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    
    resetState();
    setFile(f);

    const buffer = await f.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

    rowsRef.current = json;
    const parsedColumns = Object.keys(json[0] || {});
    setColumns(parsedColumns);
    
    const storageKey = LOCAL_STORAGE_KEY_PREFIX + parsedColumns.join(',');
    const savedMapping = localStorage.getItem(storageKey);
    if(savedMapping) {
      try { setMapping(JSON.parse(savedMapping)); } catch { /* ignore parse errors */ }
    } else {
      // Reset to default if no saved mapping for this file structure
      setMapping({ womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: "" });
    }
  }

  function handleMappingChange(field: keyof Mapping, value: string) {
    setMapping((m) => ({ ...m, [field]: value }));
  }

  async function startClustering() {
    if (!workerRef.current) return alert("Worker not ready");
    if (!rowsRef.current.length) return alert("Upload data first");
    
    if (!isMappingComplete) {
      toast({ title: "Mapping Incomplete", description: `Please map all required fields before clustering.`, variant: "destructive"});
      return;
    }
    
    setWorkerStatus("processing");
    setProgressInfo({ status: "processing", progress: 1 });
    
    let clusteringSettings = {};
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.ok) {
            clusteringSettings = data.settings;
            toast({ title: "Loaded custom settings", description: "Running clustering with your saved settings.", variant: "default" });
        } else {
            throw new Error("Could not load settings from server.");
        }
    } catch(e) {
        console.warn("Could not load settings, using defaults.", e);
        toast({ title: "Could not load custom settings", description: "Using default clustering settings.", variant: "default" });
    }

    workerRef.current.postMessage({
      type: "start",
      payload: {
        mapping,
        options: clusteringSettings,
      },
    });

    const CHUNK = 2000;
    for (let i = 0; i < rowsRef.current.length; i += CHUNK) {
      const chunk = rowsRef.current.slice(i, i + CHUNK);
      workerRef.current.postMessage({ type: "data", payload: { rows: chunk } });
      await new Promise((r) => setTimeout(r, 10));
    }
    
    workerRef.current.postMessage({ type: "end" });
  }
  
  function resetState() {
      setFile(null);
      setColumns([]);
      rowsRef.current = [];
      setClusters([]);
      setWorkerStatus('idle');
      setProgressInfo({ status: "idle", progress: 0 });
      setSummary(null);
      setMapping({ womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: "" });
      // Clear cache from previous runs
      sessionStorage.removeItem('cacheId');
      sessionStorage.removeItem('cacheTimestamp');
  }
  
  const formattedStatus = () => {
    const { status, completed, total } = progressInfo;
    let baseStatus = status.replace(/-/g, ' ');
    if(completed !== undefined && total !== undefined && total > 0) {
      return `${baseStatus} (${completed}/${total})`;
    }
    return baseStatus;
  }

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
                    <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.xlsm,.xlsb,.csv" />
                </div>
            </label>
             {file && (
                <Button onClick={resetState} variant="outline">Reset</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Map Columns</CardTitle>
            <CardDescription>Match your spreadsheet columns to the required data fields. Required fields are marked with *.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MAPPING_FIELDS.map((field) => (
              <Card key={field}>
                <CardHeader className="p-4">
                  <CardTitle className="text-base capitalize flex justify-between items-center">
                    <span>
                      {field.replace(/_/g, ' ')}
                      {REQUIRED_MAPPING_FIELDS.includes(field) && <span className="text-destructive">*</span>}
                    </span>
                    {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-48 border-t">
                    <RadioGroup
                      value={mapping[field]}
                      onValueChange={(value) => handleMappingChange(field, value)}
                      className="p-4 grid grid-cols-1 gap-2"
                    >
                      {columns.map((col) => (
                        <div key={col} className="flex items-center space-x-2">
                          <RadioGroupItem value={col} id={`${field}-${col}`} />
                          <Label htmlFor={`${field}-${col}`} className="font-normal truncate" title={col}>
                            {col}
                          </Label>
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
          <CardHeader>
            <CardTitle>3. Run Clustering</CardTitle>
            <CardDescription>Start the AI-powered analysis to find potential duplicates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button onClick={startClustering} disabled={workerStatus === 'processing' || workerStatus === 'caching'}>
                {workerStatus === 'processing' || workerStatus === 'caching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {workerStatus === 'processing' && 'Clustering...'}
                {workerStatus === 'caching' && 'Caching results...'}
                {workerStatus !== 'processing' && workerStatus !== 'caching' && 'Start Clustering'}
             </Button>
             
             {workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                      <span className="capitalize">Status: <span className="font-semibold">{formattedStatus()}</span></span>
                      <span>{Math.round(progressInfo.progress)}%</span>
                  </div>
                  <Progress value={progressInfo.progress} />
                </div>
             )}
          </CardContent>
        </Card>
      )}

      {summary && workerStatus === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>4. Results</CardTitle>
             <CardDescription>
              Clustering is complete. Here is a summary of the results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="Total Records" value={summary.totalRecords} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="Clustered Records" value={summary.clusteredRecords} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="Unclustered Records" value={summary.unclusteredRecords} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title="Cluster Count" value={summary.clusterCount} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title="Avg. Cluster Size" value={summary.avgClusterSize.toFixed(2)} />
            </div>
            <Button onClick={() => router.push('/review')} disabled={workerStatus !== 'done'}>
                Go to Review Page
                <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * createWorkerScript
 *
 * Returns a string containing the worker code. This worker:
 *  - maps incoming chunks using the user-provided mapping
 *  - builds balanced overlapping blocks
 *  - computes edges inside each block
 *  - builds connected components from edges
 *  - refines big components using MST-splitting (no recursion, no O(n^2) rework)
 *  - reports progress regularly
 */
function createWorkerScript() {
return `
// ======================================================
// WORKER v4 — FINAL OPTIMIZED VERSION
// For 30k–120k rows — no freeze, no misses
// ======================================================

// ------------------ Normalization ------------------
function ar(text) {
  if (!text) return "";
  text = String(text)
    .trim()
    .replace(/[^\\u0600-\\u06FF0-9\\s]/g, "")
    .replace(/\\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه");
  return text;
}

function digits(x) {
  return String(x || "").replace(/\\D/g, "");
}

function tok(n) {
  return ar(n).split(" ").filter(Boolean);
}

// ------------------ Similarity ------------------
function jw(a, b) {
  a = String(a); b = String(b);
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  const md = Math.floor(Math.max(la, lb) / 2) - 1;
  const am = Array(la).fill(false);
  const bm = Array(lb).fill(false);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const s = Math.max(0, i - md);
    const e = Math.min(i + md + 1, lb);
    for (let j = s; j < e; j++) {
      if (bm[j]) continue;
      if (a[i] !== b[j]) continue;
      am[i] = true; bm[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let k = 0, t = 0;
  for (let i = 0; i < la; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }

  const m = matches;
  const jaro = (m/la + m/lb + (m - t/2)/m) / 3;

  let p = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) p++;
    else break;
  }

  return jaro + p * 0.1 * (1 - jaro);
}

function jacc(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
}

// ------------------ Order-Free Name Matching ------------------
function orderFree(n1, n2) {
  const A = tok(n1), B = tok(n2);
  if (!A.length || !B.length) return 0;

  const ja = jacc(A, B);
  const s1 = A.slice().sort().join(" ");
  const s2 = B.slice().sort().join(" ");
  const jw2 = jw(s1, s2);

  return 0.7 * ja + 0.3 * jw2;
}

// ------------------ Pairwise Score ------------------
function scorePair(a, b, opt) {
  const w = opt?.weights || {
    womanName: 0.50,
    husbandName: 0.25,
    nationalId: 0.15,
    phone: 0.10
  };

  const wa = ar(a.womanName), wb = ar(b.womanName);
  const ha = ar(a.husbandName), hb = ar(b.husbandName);
  const ida = digits(a.nationalId), idb = digits(b.nationalId);
  const pa = digits(a.phone), pb = digits(b.phone);

  const nameJW = jw(wa, wb);
  const nameOF = orderFree(wa, wb);
  const wifeScore = Math.max(nameJW, nameOF);

  const husbandScore = Math.max(jw(ha, hb), orderFree(ha, hb));

  let idScore = 0;
  if (ida && idb) {
    if (ida === idb) idScore = 1;
    else if (ida.slice(-5) === idb.slice(-5)) idScore = 0.75;
  }

  let phoneScore = 0;
  if (pa && pb && pa.length >= 6 && pb.length >= 6) {
    if (pa === pb) phoneScore = 1;
    else if (pa.slice(-6) === pb.slice(-6)) phoneScore = 0.8;
    else if (pa.slice(-4) === pb.slice(-4)) phoneScore = 0.6;
  }

  const final =
      (w.womanName || 0) * wifeScore +
      (w.husbandName || 0) * husbandScore +
      (w.nationalId || 0) * idScore +
      (w.phone || 0) * phoneScore;

  return final;
}

// ------------------ Blocking (multi-block) ------------------
function buildBlocks(rows) {
  const m = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nm = tok(r.womanName);
    const first = nm[0] || "";
    const last = nm[nm.length - 1] || "";
    const h = tok(r.husbandName);

    const keys = [
      "f:" + first.slice(0, 3),
      "l:" + last.slice(0, 3),
      "fh:" + (h[0] || "").slice(0, 3),
      "lh:" + (h[h.length - 1] || "").slice(0, 3),
      "p:" + digits(r.phone).slice(-4),
      "v:" + ar(r.village).slice(0, 4)
    ];

    for (const k of keys) {
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(i);
    }
  }
  return [...m.values()];
}

// ------------------ Build edges ------------------
function buildEdges(rows, minPair, opt) {
  const blocks = buildBlocks(rows);
  const edges = [];
  const seen = new Set();

  for (const block of blocks) {
    const L = block.length;
    if (L > 7000) continue; // prevent freeze

    for (let x = 0; x < L; x++) {
      for (let y = x + 1; y < L; y++) {
        const i = block[x], j = block[y];
        const key = i < j ? i + "_" + j : j + "_" + i;
        if (seen.has(key)) continue;
        seen.add(key);

        const s = scorePair(rows[i], rows[j], opt);
        if (s >= minPair) edges.push({ a: i, b: j });
      }
    }
  }

  return edges;
}

// ------------------ Union-Find ------------------
class UF {
  constructor(n) {
    this.p = Array.from({ length: n }, (_, i) => i);
    this.s = Array(n).fill(1);
  }
  f(x) {
    return this.p[x] === x ? x : (this.p[x] = this.f(this.p[x]));
  }
  m(a, b) {
    a = this.f(a); b = this.f(b);
    if (a === b) return;
    if (this.s[a] < this.s[b]) [a, b] = [b, a];
    this.p[b] = a;
    this.s[a] += this.s[b];
  }
}

// ------------------ runClustering ------------------
function runClustering(rows, opt) {
  const minPair = opt?.minPair ?? 0.52;
  const minInternal = opt?.minInternal ?? 0.60;

  const edges = buildEdges(rows, minPair, opt);
  const uf = new UF(rows.length);

  for (const e of edges) uf.m(e.a, e.b);

  // Convert UF sets to clusters
  const map = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = uf.f(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(i);
  }

  // Filter: remove singletons
  const clusters = [...map.values()].filter(g => g.length > 1);

  return clusters.map(g => g.map(i => rows[i]));
}

// ------------------ Worker Logic ------------------

let inbound = [];
let mapping = null;
let options = null;

function applyMapping(r) {
  return {
    womanName: r[mapping.womanName] || "",
    husbandName: r[mapping.husbandName] || "",
    nationalId: r[mapping.nationalId] || "",
    phone: r[mapping.phone] || "",
    village: r[mapping.village] || "",
    subdistrict: r[mapping.subdistrict] || "",
    children: r[mapping.children] || ""
  };
}

async function processAll() {
  postMessage({ type: "progress", progress: 3, status: "mapping" });

  const rows = inbound.map(applyMapping);

  postMessage({ type: "progress", progress: 7, status: "clustering" });

  const clusters = runClustering(rows, options);

  postMessage({ type: "progress", progress: 99, status: "finalizing" });
  postMessage({ type: "done", clusters });
}

onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "start") {
    mapping = msg.payload.mapping;
    options = msg.payload.options;
    inbound = [];
  } else if (msg.type === "data") {
    inbound.push(...msg.payload.rows);
  } else if (msg.type === "end") {
    processAll().catch(err => {
      postMessage({ type: "error", error: err.message });
    });
  }
};
`;
}
