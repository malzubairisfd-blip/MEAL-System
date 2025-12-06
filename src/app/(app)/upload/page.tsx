
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
import { Upload, FileText, CheckCircle, XCircle, Settings, ChevronRight } from "lucide-react";
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
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const SETTINGS_KEY = 'beneficiary-insights-settings';

export default function UploadPage() {
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName: "", nationalId: "", phone: "",
    village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: ""
  });
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [clusters, setClusters] = useState<any[][]>([]);
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
          setProgress(msg.progress || 0);
          setWorkerStatus(msg.status || "working");
          break;
        case "done":
          setWorkerStatus("done");
          setProgress(100);
          setClusters(msg.clusters || []);
          toast({ title: "Clustering Complete", description: `Found ${msg.clusters.length} potential duplicate clusters.` });

          // Save results to server-side cache
          try {
            const cacheRes = await fetch('/api/cluster-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clusters: msg.clusters,
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
  }, [mapping, columns]);

  // File input handler
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFile(file);
    setWorkerStatus('idle');
    setProgress(0);
    setClusters([]);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

    rowsRef.current = json;
    const parsedColumns = Object.keys(json[0] || {});
    setColumns(parsedColumns);
    
    const storageKey = LOCAL_STORAGE_KEY_PREFIX + parsedColumns.join(',');
    const savedMapping = localStorage.getItem(storageKey);
    if(savedMapping) {
      setMapping(JSON.parse(savedMapping));
    } else {
      setMapping({ womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: "" });
    }
  }

  function handleMappingChange(field: keyof Mapping, value: string) {
    setMapping((m) => ({ ...m, [field]: value }));
  }

  async function startClustering() {
    if (!workerRef.current) return alert("Worker not ready");
    if (!rowsRef.current.length) return alert("Upload data first");
    
    const required: (keyof Mapping)[] = ["womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children"];
    for (const r of required) {
      if (!mapping[r]) {
        toast({ title: "Mapping Incomplete", description: `Please map the "${r}" field before clustering.`, variant: "destructive"});
        return;
      }
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
    setWorkerStatus("processing");
    setProgress(1);
  }
  
  function resetState() {
      setFile(null);
      setColumns([]);
      rowsRef.current = [];
      setClusters([]);
      setWorkerStatus('idle');
      setProgress(0);
      setMapping({ womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", cluster_id: "", beneficiaryId: "" });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
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
            <CardDescription>Match your spreadsheet columns to the required data fields.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MAPPING_FIELDS.map((field) => (
              <Card key={field}>
                <CardHeader className="p-4">
                  <CardTitle className="text-base capitalize flex justify-between items-center">
                    {field.replace(/_/g, ' ')}
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

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>3. Run Clustering</CardTitle>
            <CardDescription>Start the AI-powered analysis to find potential duplicates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button onClick={startClustering} disabled={workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error'}>
               Start Clustering
             </Button>
             
             {workerStatus !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                      <span>Status: <span className="capitalize font-semibold">{workerStatus.replace(/-/g, ' ')}</span></span>
                      <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
             )}
          </CardContent>
        </Card>
      )}

      {clusters.length > 0 && workerStatus === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>4. Results</CardTitle>
             <CardDescription>
              Clustering complete. {clusters.length} potential duplicate clusters found. Proceed to the review page to analyze the results.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

function createWorkerScript(): string {
  return `
  // Web Worker: receives chunks and performs clustering client-side

  // Utilities
  function safeString(x){ return x==null ? "" : String(x); }
  function digitsOnly(s){ return safeString(s).replace(/\\D/g,""); }

  const arabicMap = {
    "أ":"ا","إ":"ا","آ":"ا","ى":"ي","ئ":"ي","ؤ":"و","ة":"ه",
    "ق":"ك","ك":"ق","ط":"ت","ت":"ط","ه":"ح","ح":"ه","ظ":"ض","ض":"ظ","ز":"ذ","ذ":"ز","ج":"ق","ث":"س"
  };
  function normalizeChar(c){ return arabicMap[c] || c; }

  function normalizeArabic(text){
    if(!text) return "";
    let t = safeString(text).trim()
      .replace(/[^\\u0600-\\u06FF0-9\\s]/g,"")
      .replace(/\\s+/g," ")
      .replace(/ابن|بن|ولد/g,"بن")
      .replace(/بنت|ابنة/g,"بنت")
      .replace(/آل|ال/g,"ال")
      .replace(/[.,·•-]/g,"")
      .replace(/ـ/g,"");
    t = t.split("").map(normalizeChar).join("");
    return t;
  }

  function tokensOfName(s){ const n = normalizeArabic(s||""); if(!n) return []; return n.split(" ").filter(Boolean); }
  const tokens = tokensOfName;

  // Jaro-Winkler
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

  function pairwiseScore(a,b){
    const aName = normalizeArabic(a.womanName||"");
    const bName = normalizeArabic(b.womanName||"");
    const aT = tokensOfName(aName), bT = tokensOfName(bName);
    const firstA = aT[0]||"", firstB = bT[0]||"";
    const familyA = aT.slice(1).join(" "), familyB = bT.slice(1).join(" ");
    const firstScore = jaroWinkler(firstA, firstB);
    const familyScore = jaroWinkler(familyA, familyB);
    
    const hA = normalizeArabic(a.husbandName||""), hB = normalizeArabic(b.husbandName||"");
    const husbandScore = Math.max(jaroWinkler(hA,hB), tokenJaccard(tokensOfName(hA), tokensOfName(hB)));
    const idScore = (a.nationalId && b.nationalId && String(a.nationalId)===String(b.nationalId)) ? 1 : 0;
    const phoneScore = phoneSim(a.phone,b.phone);
    const loc = (a.village && b.village && normalizeArabic(a.village)===normalizeArabic(b.village)) ? 1 : (a.subdistrict && b.subdistrict && normalizeArabic(a.subdistrict)===normalizeArabic(b.subdistrict) ? 0.8 : 0);
    const chA = (a.children||[]).map(x=>normalizeArabic(x)); const chB = (b.children||[]).map(x=>normalizeArabic(x));
    const childrenScore = tokenJaccard(chA,chB);

    let score = 0.15*firstScore + 0.35*familyScore + 0.15*husbandScore + 0.15*idScore + 0.08*phoneScore + 0.02*loc + 0.10*childrenScore;
    if(score>1) score=1; if(score<0) score=0;

    return { score, breakdown:{ firstScore, familyScore, husbandScore, idScore, phoneScore, loc, childrenScore } };
  }

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

    // Each record will participate in 6–8 overlapping blocks.
    const keys = [
      \`wf:\${first}\`,             // Woman first name
      \`ff:\${father}\`,            // Woman father name
      \`wl:\${last}\`,              // Woman last name
      \`hf:\${hFirst}\`,            // Husband first name
      \`hl:\${hLast}\`,             // Husband last name
      \`v:\${village}\`,            // Village
      \`sd:\${subdistrict}\`,       // Subdistrict
      \`ffhf:\${father}-\${hFirst}\`,// Woman father + Husband first
      \`wfhf:\${first}-\${hFirst}\`, // Woman first + Husband first
    ];

    for (const k of keys) {
      if (!blocks.has(k)) blocks.set(k, []);
      blocks.get(k).push(i);
    }
  }

  // Convert to array
  return Array.from(blocks.values()).filter(b => b.length > 1);
}


function buildEdges(rows, minScore, options) {
  const edges = [];
  const seen = new Set();
  const CH = options?.blockChunkSize || 1200;

  // The 'rows' here is already a pre-filtered block
  for (let s = 0; s < rows.length; s += CH) {
    const part = rows.slice(s, s + CH);
    for (let i = 0; i < part.length; i++) {
      for (let j = i + 1; j < part.length; j++) {
        const a = part[i]; // The actual row object, not an index
        const b = part[j]; // The actual row object, not an index
        
        // We need original indices to build a global graph, so we need to pass them down
        // Or, assume indices passed into buildEdges are local to the sub-array
        // Let's go with local indices and map them back up.
        
        // This won't work as-is because 'a' and 'b' are objects, not indices.
        // And seen keys would be wrong.
        
        const p = pairwiseScore(a, b);
        if (p.score >= minScore) {
          // 'a' and 'b' are row objects, but the rest of the algo needs indices
          // We need to pass the original indices to buildEdges or do a lookup.
          // Let's assume the calling function will handle index mapping.
           edges.push({ a: i, b: j, score: p.score, breakdown: p.breakdown });
        }
      }
    }
  }
  edges.sort((x, y) => y.score - x.score);
  return edges;
}



function buildAdjacency(n, edges) {
  const adj = new Map();
  for (let i = 0; i < n; i++) adj.set(i, []);
  for (const e of edges) {
    adj.get(e.a).push({ to: e.b, score: e.score });
    adj.get(e.b).push({ to: e.a, score: e.score });
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
      for (const nb of adj.get(u) || []) {
        if (!seen[nb.to]) {
          seen[nb.to] = true;
          q.push(nb.to);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

function computePairwiseMatrix(rows, idxs) {
  const m = idxs.length;
  const scores = Array.from({ length: m }, () => Array(m).fill(0));
  const pairs = [];
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const { score } = pairwiseScore(rows[idxs[i]], rows[idxs[j]]);
      scores[i][j] = scores[j][i] = score;
      pairs.push({ i, j, score });
    }
  }
  return { scores, pairs };
}

function refineComponent(rows, idxs, minInternal) {
  if (idxs.length <= 4) return [idxs];

  const { scores, pairs } = computePairwiseMatrix(rows, idxs);
  const m = idxs.length;

  let total = 0;
  let count = 0;
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      total += scores[i][j];
      count++;
    }
  }
  const avg = count > 0 ? total / count : 0;

  if (avg >= minInternal) {
    return [idxs];
  }

  pairs.sort((a, b) => a.score - b.score);
  const localAdj = new Map();
  for (let i = 0; i < m; i++) localAdj.set(i, new Set());
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i !== j && scores[i][j] > 0) localAdj.get(i).add(j);
    }
  }

  for (const p of pairs) {
    localAdj.get(p.i).delete(p.j);
    localAdj.get(p.j).delete(p.i);

    const visited = new Array(m).fill(false);
    const subcomps = [];
    for (let s = 0; s < m; s++) {
      if (visited[s]) continue;
      const q = [s];
      visited[s] = true;
      const sub = [];
      while (q.length) {
        const u = q.shift();
        sub.push(u);
        for (const nb of Array.from(localAdj.get(u))) {
          if (!visited[nb]) {
            visited[nb] = true;
            q.push(nb);
          }
        }
      }
      subcomps.push(sub);
    }

    if (subcomps.length > 1) {
      const result = [];
      for (const sc of subcomps) {
        const global = sc.map((li) => idxs[li]);
        if (global.length < idxs.length) { // Ensure progress
            result.push(...refineComponent(rows, global, minInternal));
        } else {
            result.push(global);
        }
      }
      return result;
    }
  }
  
  const assigned = new Set();
  const fallbackResult = [];
  const SIM_THRESH = Math.max(minInternal, 0.6);
  for (let i = 0; i < m; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);
    for (let j = 0; j < m; j++) {
      if (assigned.has(j)) continue;
      const avgToGroup = group.reduce((acc, gi) => acc + scores[gi][j], 0) / group.length;
      if (avgToGroup >= SIM_THRESH && group.length < 4) {
        group.push(j);
        assigned.add(j);
      }
    }
    fallbackResult.push(group.map(li => idxs[li]));
  }
  return fallbackResult;
}

  let inbound = [];
  let mapping = null;
  let options = null;

  function processAll(){
    const rows = inbound.map((r, i) => {
      const mappedRow = { _internalId: \`row_\${i}\` };
      for (const key in mapping) {
        mappedRow[key] = r[mapping[key]];
      }
      if (mappedRow.children && typeof mappedRow.children === 'string') {
          mappedRow.children = mappedRow.children.split(/[;,،|]/).map(x=>x.trim()).filter(Boolean);
      } else if (!mappedRow.children) {
          mappedRow.children = [];
      }
      return mappedRow;
    });

    postMessage({type:'progress', progress:5, status:'building-blocks'});

    const minPair = options?.minPairScore || 0.75;
    const minInternal = options?.minInternalScore || 0.65;
    const blockChunkSize = options?.blockChunkSize || 1200;

    const blocks = buildBalancedBlocks(rows);

    const edges = [];
    for (const block of blocks) {
      if (block.length > 1) {
        const sub = block.map(i => rows[i]);
        const subEdges = buildEdges(sub, minPair, { blockChunkSize: 500 });
        // remap to global index
        for (const e of subEdges) {
          edges.push({
            a: block[e.a],
            b: block[e.b],
            score: e.score
          });
        }
      }
    }

    postMessage({type:'progress', progress:15, status:'building-edges'});


    postMessage({type:'progress', progress:70, status:'refining-components'});
    
    const n = rows.length;
    const adj = buildAdjacency(n, edges);
    const comps = connectedComponents(n, adj);

    const finalClustersIdx = [];

    for (const comp of comps) {
        if (comp.length <= 4) {
            finalClustersIdx.push(comp);
            continue;
        }
        
        const { scores } = computePairwiseMatrix(rows, comp);
        let tot = 0, cnt = 0;
        for (let i = 0; i < scores.length; i++) for (let j = i + 1; j < scores.length; j++) { tot += scores[i][j]; cnt++; }
        const avg = cnt ? tot / cnt : 0;

        if (avg >= minInternal) {
            finalClustersIdx.push(comp);
        } else {
            const parts = refineComponent(rows, comp, minInternal);
            for (const p of parts) finalClustersIdx.push(p);
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
      postMessage({type:'progress', progress: Math.min(5 + Math.round(10*(inbound.length/50000)), 15), status:'receiving'});
    } else if(msg.type==='end'){
      setTimeout(()=>{
        try{ processAll(); }catch(err){ postMessage({type:'error', error: String(err)}); }
      }, 50);
    }
  };
  `;
}
