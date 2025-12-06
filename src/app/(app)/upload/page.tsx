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
import { Upload, FileText, CheckCircle, XCircle, Settings, ChevronRight, Loader2, Users, Unlink, BoxSelect, Sigma, Group } from "lucide-react";
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
const SETTINGS_KEY = 'beneficiary-insights-settings';

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
          setWorkerStatus("done");
          setProgressInfo({ status: "done", progress: 100 });
          setClusters(resultClusters);
          toast({ title: "Clustering Complete", description: `Found ${resultClusters.length} potential duplicate clusters.` });

          const totalRecords = rowsRef.current.length;
          const clusteredRecords = resultClusters.flat().length;
          setSummary({
              totalRecords: totalRecords,
              clusteredRecords: clusteredRecords,
              unclusteredRecords: totalRecords - clusteredRecords,
              clusterCount: resultClusters.length,
              avgClusterSize: resultClusters.length > 0 ? clusteredRecords / resultClusters.length : 0
          });


          // Save results to server-side cache (best-effort)
          try {
            const cacheRes = await fetch('/api/cluster-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clusters: resultClusters,
                    rows: rowsRef.current.map((r, i) => ({ ...r, _internalId: `row_${i}` })),
                    originalHeaders: columns
                })
            });
            const cacheData = await cacheRes.json();
            if (!cacheData.ok) throw new Error(cacheData.error || 'Failed to save to cache');
            sessionStorage.setItem('cacheId', cacheData.cacheId);
          } catch(error: any) {
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
      w.terminate();
      URL.revokeObjectURL(url);
    };
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
    
    let clusteringSettings = {};
    try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            clusteringSettings = JSON.parse(savedSettings);
        }
    } catch(e) {
        console.warn("Could not load settings, using defaults.");
    }
    
    setWorkerStatus("processing");
    setProgressInfo({ status: "processing", progress: 1 });

    workerRef.current.postMessage({
      type: "start",
      payload: {
        mapping,
        options: {
          minPairScore: 0.75,
          minInternalScore: 0.65,
          blockChunkSize: 1200,
          ...clusteringSettings
        },
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
             <Button onClick={startClustering} disabled={workerStatus === 'processing'}>
                {workerStatus === 'processing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {workerStatus === 'processing' ? 'Clustering...' : 'Start Clustering'}
             </Button>
             
             {workerStatus !== 'idle' && (
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
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="إجمالي السجلات" value={summary.totalRecords} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="السجلات المجمعة" value={summary.clusteredRecords} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="السجلات غير المجمعة" value={summary.unclusteredRecords} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title="عدد المجموعات" value={summary.clusterCount} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title="متوسط حجم المجموعة" value={summary.avgClusterSize.toFixed(2)} />
            </div>
            <Button onClick={() => router.push('/review')}>
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
function createWorkerScript(): string {
  return `

  // ---------- Utilities ----------
  function safeString(x){ return x==null ? "" : String(x); }
  function digitsOnly(s){ return safeString(s).replace(/\\D/g,""); }

  // Arabic normalization (keeps Arabic letters + digits + spaces)
  function normalizeArabic(text){
    if(!text) return "";
    let t = safeString(text).trim().replace(/\\s+/g," ");
    t = t.replace(/[أإآٱ]/g,"ا")
         .replace(/ة/g,"ه")
         .replace(/ى/g,"ي")
         .replace(/[ؤئ]/g,"ي")
         .replace(/[^\\u0600-\\u06FF0-9 ]/g,"")
         .replace(/ـ/g,"");
    return t;
  }

  function tokens(s){ const n = normalizeArabic(s||""); if(!n) return []; return n.split(" ").filter(Boolean); }

  // Jaro-Winkler (pure JS)
  function jaroWinkler(s1,s2){
    s1 = safeString(s1); s2 = safeString(s2);
    if(!s1 || !s2) return 0;
    const len1=s1.length,len2=s2.length;
    const matchDist = Math.floor(Math.max(len1,len2)/2)-1;
    const s1m = Array(len1).fill(false), s2m = Array(len2).fill(false);
    let matches=0;
    for(let i=0;i<len1;i++){
      const start=Math.max(0,i-matchDist), end=Math.min(i+matchDist+1,len2);
      for(let j=start;j<end;j++){
        if(s2m[j]) continue;
        if(s1[i]!==s2[j]) continue;
        s1m[i]=true; s2m[j]=true; matches++; break;
      }
    }
    if(matches===0) return 0;
    let k=0, trans=0;
    for(let i=0;i<len1;i++){
      if(!s1m[i]) continue;
      while(!s2m[k]) k++;
      if(s1[i]!==s2[k]) trans++;
      k++;
    }
    trans = trans/2.0;
    const m = matches;
    const jaro = (m/len1 + m/len2 + (m-trans)/m)/3.0;
    let prefix=0, maxPrefix=4;
    for(let i=0;i<Math.min(maxPrefix,len1,len2);i++){ if(s1[i]===s2[i]) prefix++; else break; }
    return jaro + prefix*0.1*(1-jaro);
  }

  function tokenJaccard(a,b){
    if(!a||!b) return 0;
    const A=new Set(a), B=new Set(b);
    let inter=0; for(const x of A) if(B.has(x)) inter++;
    const uni = new Set([...A,...B]).size;
    if(uni===0) return 0; return inter/uni;
  }

  function phoneSim(a,b){
    const A = digitsOnly(a), B = digitsOnly(b);
    if(!A||!B) return 0;
    if(A===B) return 1;
    if(A.slice(-6)===B.slice(-6)) return 0.85;
    if(A.slice(-4)===B.slice(-4)) return 0.6;
    return 0;
  }

  // Pairwise scoring (lightweight)
  function pairwiseScore(a,b){
    const wTokensA = tokens(a.womanName);
    const wTokensB = tokens(b.womanName);

    const firstNameA = wTokensA[0] || "";
    const firstNameB = wTokensB[0] || "";
    const familyNameA = wTokensA.slice(1).join(" ");
    const familyNameB = wTokensB.slice(1).join(" ");

    const firstNameScore = jaroWinkler(firstNameA, firstNameB);
    const familyNameScore = jaroWinkler(familyNameA, familyNameB);

    const hA = normalizeArabic(a.husbandName || "");
    const hB = normalizeArabic(b.husbandName || "");
    const hJW = jaroWinkler(hA, hB);
    const hPerm = tokenJaccard(tokens(hA), tokens(hB));
    const husbandScore = Math.max(hJW, hPerm);

    const idMatch = (a.nationalId && b.nationalId && String(a.nationalId) === String(b.nationalId)) ? 1 : 0;
    const phone = phoneSim(a.phone, b.phone);
    const loc = (a.village && b.village && normalizeArabic(a.village) === normalizeArabic(b.village)) ? 1 : (a.subdistrict && b.subdistrict && normalizeArabic(a.subdistrict) === normalizeArabic(b.subdistrict) ? 0.8 : 0);
    const chA = Array.isArray(a.children) ? a.children.map(normalizeArabic) : [];
    const chB = Array.isArray(b.children) ? b.children.map(normalizeArabic) : [];
    const children = tokenJaccard(chA, chB);

    const score = 0.15 * firstNameScore + 0.35 * familyNameScore + 0.15 * husbandScore + 0.15 * idMatch + 0.08 * phone + 0.02 * loc + 0.10 * children;

    return { score: Math.max(0, Math.min(1, score)) };
  }

  // ---- Balanced blocking (overlapping keys) ----
  function buildBalancedBlocks(rows) {
    const blocks = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const w = tokens(r.womanName);
      const h = tokens(r.husbandName);
      const first = w[0] || "";
      const father = w[1] || "";
      const last = w[w.length - 1] || "";
      const hFirst = h[0] || "";
      const hLast = h[h.length - 1] || "";
      const village = normalizeArabic(r.village || "");
      const subdistrict = normalizeArabic(r.subdistrict || "");
      const keys = [
        \`wf:\${first}\`,
        \`ff:\${father}\`,
        \`wl:\${last}\`,
        \`hf:\${hFirst}\`,
        \`hl:\${hLast}\`,
        \`v:\${village}\`,
        \`sd:\${subdistrict}\`,
        \`ffhf:\${father}-\${hFirst}\`,
        \`wfhf:\${first}-\${hFirst}\`,
      ];
      for (const k of keys) {
        if (!blocks.has(k)) blocks.set(k, []);
        blocks.get(k).push(i);
      }
    }
    return Array.from(blocks.values()).filter(b => b.length > 1);
  }

  // ---- Build edges inside a list of indices (simple pairwise but limited per-block) ----
  function buildEdgesInBlock(rows, idxList, minScore) {
    const edges = [];
    const n = idxList.length;
    const seenPairs = new Set();
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = idxList[i], v = idxList[j];
        const key = u < v ? \`\${u}-\${v}\` : \`\${v}-\${u}\`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        
        const p = pairwiseScore(rows[u], rows[v]);
        if (p.score >= minScore) edges.push({ a: u, b: v, score: p.score });
      }
    }
    return edges;
  }

  // ---- adjacency + connected components ----
  function buildAdjacency(n, edges) {
    const adj = new Array(n).fill(0).map(() => []);
    for (const e of edges) {
      adj[e.a].push({ to: e.b, score: e.score });
      adj[e.b].push({ to: e.a, score: e.score });
    }
    return adj;
  }

  function connectedComponents(n, adj) {
    const seen = new Array(n).fill(false);
    const comps = [];
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      const q = [i];
      seen[i] = true;
      const comp = [];
      while (q.length) {
        const u = q.shift();
        comp.push(u);
        for (const nb of adj[u] || []) {
          if (!seen[nb.to]) { seen[nb.to] = true; q.push(nb.to); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  // ---- Build local edges for a given component (re-uses global edges array to avoid recompute) ----
  function buildLocalEdgesForComp(compSet, globalEdges) {
    const set = new Set(compSet);
    const local = [];
    for (const e of globalEdges) {
      if (set.has(e.a) && set.has(e.b)) local.push({ u: e.a, v: e.b, score: e.score });
    }
    return local;
  }

  // ---- Build maximum spanning tree (Kruskal) ----
  function buildMST(nodes, edges) {
    // edges descending by score
    edges.sort((a,b)=>b.score-a.score);
    const parent = new Map();
    const rk = new Map();
    for (const n of nodes) { parent.set(n,n); rk.set(n,0); }
    function find(x){ while(parent.get(x)!==x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; }
    function union(a,b){
      a = find(a); b = find(b); if(a===b) return false;
      const ra = rk.get(a)||0, rb = rk.get(b)||0;
      if(ra<rb) parent.set(a,b); else if(rb<ra) parent.set(b,a); else { parent.set(b,a); rk.set(a, ra+1); }
      return true;
    }
    const mst = [];
    for (const e of edges) {
      if (union(e.u,e.v)) mst.push(e);
      if (mst.length === nodes.length - 1) break;
    }
    return mst;
  }

  // ---- split MST by cutting edges below threshold ----
  function splitByThreshold(nodes, mst, threshold) {
    const adj = new Map();
    for (const n of nodes) adj.set(n, []);
    for (const e of mst) {
      if (e.score >= threshold) {
        adj.get(e.u).push(e.v);
        adj.get(e.v).push(e.u);
      }
    }
    const seen = new Set();
    const comps = [];
    for (const n of nodes) {
      if (seen.has(n)) continue;
      const q = [n]; seen.add(n); const comp = [];
      while (q.length) {
        const x = q.shift();
        comp.push(x);
        for (const nb of adj.get(x) || []) {
          if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  // ---- Main processing state ----
  let inbound = [];
  let mapping = null;
  let options = null;

  function processAll(){
    // Map inbound rows to standardized shape according to mapping
    const rows = inbound.map((r, i) => {
      const mapped = { _internalId: \`row_\${i}\` , womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: [] };
      // safe mapping: mapping keys may point to column names
      for (const key in mapping) {
        const col = mapping[key];
        if (!col) continue;
        mapped[key] = r[col];
      }
      // ensure children is array
      if (mapped.children && typeof mapped.children === "string") {
        mapped.children = mapped.children.split(/[;,،|]/).map(x=>x.trim()).filter(Boolean);
      } else if (!Array.isArray(mapped.children)) {
        mapped.children = [];
      }
      // normalize strings
      mapped.womanName = mapped.womanName ? String(mapped.womanName) : "";
      mapped.husbandName = mapped.husbandName ? String(mapped.husbandName) : "";
      mapped.nationalId = mapped.nationalId ? String(mapped.nationalId) : "";
      mapped.phone = mapped.phone ? String(mapped.phone) : "";
      mapped.village = mapped.village ? String(mapped.village) : "";
      mapped.subdistrict = mapped.subdistrict ? String(mapped.subdistrict) : "";
      return mapped;
    });

    postMessage({type:'progress', progress:5, status:'building-blocks', completed: 0, total: 0 });

    const minPair = options?.minPairScore ?? 0.75;
    const minInternal = options?.minInternalScore ?? 0.65;
    const blockChunkSize = options?.blockChunkSize ?? 1200;

    // 1) build blocks (balanced)
    const blocks = buildBalancedBlocks(rows);
    postMessage({type:'progress', progress:10, status:'building-blocks', completed: blocks.length, total: blocks.length });

    // 2) for each block, build edges (global edges array)
    const globalEdges = [];
    const seenPairs = new Set();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const blockEdges = buildEdgesInBlock(rows, block, minPair);

      for (const e of blockEdges) {
          const key = e.a < e.b ? \`\${e.a}-\${e.b}\` : \`\${e.b}-\${e.a}\`;
          if(!seenPairs.has(key)){
              globalEdges.push(e);
              seenPairs.add(key);
          }
      }

      if (i % 50 === 0 || i === blocks.length - 1) {
         postMessage({type:'progress', progress: 10 + Math.round(45 * (i / blocks.length)), status:'building-edges', completed: i + 1, total: blocks.length });
      }
    }

    // 3) adjacency + connected components across whole dataset
    postMessage({type:'progress', progress:60, status:'finding-components'});
    const n = rows.length;
    const adj = buildAdjacency(n, globalEdges);
    const comps = connectedComponents(n, adj);

    postMessage({type:'progress', progress:70, status:'refining-components', completed: 0, total: comps.length});
    const finalClustersIdx = [];

    // 4) refine each component using MST splitting (no recursion heavy)
    for (let ci = 0; ci < comps.length; ci++) {
      const comp = comps[ci];
      if (comp.length <= 1) { /* skip singletons */ }
      else if (comp.length <= 4) {
        finalClustersIdx.push(comp);
      } else {
        // build local edges for this component (re-using globalEdges to avoid recomputing all pairwise)
        const localEdges = buildLocalEdgesForComp(comp, globalEdges);
        if (localEdges.length < comp.length - 1) {
          const cappedEdges = [];
          const K = 25; 
          for (let i = 0; i < comp.length; i++) {
            const u = comp[i];
            const neigh = [];
            for (let j = 0; j < comp.length; j++) {
              if (i === j) continue;
              const v = comp[j];
              const { score } = pairwiseScore(rows[u], rows[v]);
              if (score > minInternal) {
                neigh.push({ u, v, score });
              }
            }
            neigh.sort((a,b)=>b.score-a.score);
            for (let k = 0; k < Math.min(K, neigh.length); k++) cappedEdges.push(neigh[k]);
          }
          const edgeMap = new Map();
          for (const e of cappedEdges) {
            const key = e.u < e.v ? \`\${e.u}_\${e.v}\` : \`\${e.v}_\${e.u}\`;
            if (!edgeMap.has(key) || edgeMap.get(key).score < e.score) edgeMap.set(key, e);
          }
          localEdges.push(...edgeMap.values());
        }

        // build MST and split by threshold
        const mst = buildMST(comp, localEdges);
        const parts = splitByThreshold(comp, mst, minInternal);

        for (const p of parts) {
          if (p.length > 1) finalClustersIdx.push(p);
        }
      }

      if (ci % 10 === 0 || ci === comps.length - 1) {
        postMessage({type:'progress', progress: 70 + Math.round(25 * (ci / comps.length)), status:'refining-components', completed: ci + 1, total: comps.length});
      }
    }

    postMessage({type:'progress', progress:95, status:'annotating'});

    const clustersFiltered = finalClustersIdx.map(g => g.map(i => rows[i])).filter(c => c.length > 1);

    postMessage({type:'done', clusters: clustersFiltered});
  }

  onmessage = function(e){
    const msg = e.data;
    if(!msg || !msg.type) return;
    if(msg.type==='start'){
      mapping = msg.payload.mapping;
      options = msg.payload.options || {};
      inbound = [];
    } else if(msg.type==='data'){
      inbound.push(...(msg.payload.rows || []));
      postMessage({type:'progress', progress: 5, status:'receiving'});
    } else if(msg.type==='end'){
      setTimeout(()=>{
        try{ processAll(); }catch(err){ postMessage({type:'error', error: String(err)}); }
      }, 50);
    }
  };
  `;
}
