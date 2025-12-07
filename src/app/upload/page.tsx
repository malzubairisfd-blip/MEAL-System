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
              sessionStorage.setItem('cacheTimestamp', Date.now().toString());
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
          minPairScore: 0.45,
          minInternalScore: 0.67,
          blockChunkSize: 5000,
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
             <Button onClick={startClustering} disabled={workerStatus === 'processing'}>
                {workerStatus === 'processing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {workerStatus === 'processing' ? 'Clustering...' : 'Start Clustering'}
             </Button>
             
             {workerStatus !== 'idle' && workerStatus !== 'done' && (
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
// ===================== fuzzyCluster.ts — PART 1 =====================
// Paste PART 1 first
// Arabic normalization, character equivalences, and utility helpers.
const arabicEquivalenceMap = {
  "أ": "ا", "إ": "ا", "آ": "ا",
  "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه",
  // phonetic approximations (bidirectional)
  "ق": "ك", "ك": "ق",
  "ط": "ت", "ت": "ط",
  "ه": "ح", "ح": "ه",
  "ظ": "ض", "ض": "ظ",
  "ز": "ذ", "ذ": "ز",
  "ج": "ق",
  "ث": "س"
};

function normalizeChar(ch) {
  return arabicEquivalenceMap[ch] || ch;
}

function normalizeArabic(text) {
  if (!text) return "";
  const raw = String(text);
  // Keep Arabic script, numbers (for IDs), and spaces. Remove extraneous punctuation.
  let t = raw
    .trim()
    .replace(/[^\\u0600-\\u06FF0-9\\s]/g, "")
    .replace(/\\s+/g, " ")
    .replace(/ابن|بن|ولد/g, "بن")
    .replace(/بنت|ابنة/g, "بنت")
    .replace(/آل|ال/g, "ال")
    .replace(/[.,·•\\u200C\\u200B]/g, "")
    .replace(/ـ/g, "");
  // apply char map
  return t.split("").map(normalizeChar).join("").trim();
}

function safeString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

function digitsOnly(x) {
  if (!x) return "";
  return String(x).replace(/\\D/g, "");
}

function tokens(s) {
  const n = normalizeArabic(s || "");
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

// small utility to normalize arrays of children names
function normalizeChildrenField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((c) => normalizeArabic(String(c))).filter(Boolean);
  const raw = String(val);
  // split on comma, semicolon, Arabic comma, pipe
  return raw.split(/[;,،|]/).map(x => normalizeArabic(x)).filter(Boolean);
}
// ===================== fuzzyCluster.ts — PART 2 =====================
// Name root engine, family-line extractors, and similarity primitives.

// ---------------------- Name root / reduction ----------------------
function reduceNameRoot(full) {
  const parts = tokens(full);
  // Use trimmed first 3 letters for each token to get root-like signatures
  return parts.map(p => p.substring(0, 3)).join(" ");
}

// ---------------------- Extractors ----------------------
function extractPaternal(full) {
  const parts = tokens(full);
  return {
    father: parts[1] || "",
    grandfather: parts[2] || ""
  };
}

function extractMaternal(full) {
  const parts = tokens(full);
  const L = parts.length;
  return {
    mother: parts[L - 2] || "",
    grandmother: parts[L - 3] || ""
  };
}

function extractTribal(full) {
  const parts = tokens(full);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].startsWith("ال")) return parts[i];
  }
  return "";
}

// ---------------------- Jaro-Winkler (pure TS) ----------------------
function jaroWinkler(s1, s2) {
  s1 = safeString(s1);
  s2 = safeString(s2);
  if (!s1 || !s2) return 0;
  const len1 = s1.length, len2 = s2.length;
  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0, transpositions = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / len1 + m / len2 + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ---------------------- Levenshtein (normalized similarity) ----------------------
function levenshtein(a, b) {
  a = safeString(a);
  b = safeString(b);
  if (a === b) return 1;
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const la = a.length, lb = b.length;
  const v0 = new Array(lb + 1);
  const v1 = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) v0[j] = j;
  for (let i = 0; i < la; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < lb; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= lb; j++) v0[j] = v1[j];
  }
  const dist = v1[lb];
  const maxLen = Math.max(la, lb);
  return 1 - dist / maxLen;
}

// ---------------------- Token Jaccard ----------------------
function tokenJaccard(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

// ---------------------- Name order-free score (handles 4 vs 5 parts and reordering) ----------------------
function nameOrderFreeScore(aName, bName) {
  const aT = tokens(aName);
  const bT = tokens(bName);
  if (!aT.length || !bT.length) return 0;
  // exact token set equality (strong)
  const A = new Set(aT), B = new Set(bT);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  // also use root-based Jaro on sorted tokens string
  const aSorted = aT.slice().sort().join(" ");
  const bSorted = bT.slice().sort().join(" ");
  const sortedJaro = jaroWinkler(aSorted, bSorted);
  // weight token-set higher for reorder detection
  return 0.7 * jacc + 0.3 * sortedJaro;
}

// ===================== fuzzyCluster.ts — PART 3 =====================
// Pairwise scoring implementing the 11 requested rules and producing breakdowns.

function pairwiseScore(aRaw, bRaw) {
  // Map fields and normalize important fields
  const a = {
    womanName: normalizeArabic(aRaw.womanName || ""),
    husbandName: normalizeArabic(aRaw.husbandName || ""),
    nationalId: safeString(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(safeString(aRaw.phone || "")),
    village: normalizeArabic(aRaw.village || ""),
    subdistrict: normalizeArabic(aRaw.subdistrict || ""),
    children: normalizeChildrenField(aRaw.children),
    raw: aRaw
  };
  const b = {
    womanName: normalizeArabic(bRaw.womanName || ""),
    husbandName: normalizeArabic(bRaw.husbandName || ""),
    nationalId: safeString(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(safeString(bRaw.phone || "")),
    village: normalizeArabic(bRaw.village || ""),
    subdistrict: normalizeArabic(bRaw.subdistrict || ""),
    children: normalizeChildrenField(bRaw.children),
    raw: bRaw
  };

  // Base name similarities
  const firstA = tokens(a.womanName)[0] || "";
  const firstB = tokens(b.womanName)[0] || "";
  const familyA = tokens(a.womanName).slice(1).join(" ");
  const familyB = tokens(b.womanName).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);

  // ORDER-FREE detection (handles 4 vs 5 part names & reshuffles)
  const orderFree = nameOrderFreeScore(a.womanName, b.womanName);

  // Advanced root match
  const rootA = reduceNameRoot(a.womanName);
  const rootB = reduceNameRoot(b.womanName);
  let advancedNameScore = 0;
  if (rootA && rootB && rootA === rootB) advancedNameScore += 0.35;
  if (rootA && rootB && (rootA.startsWith(rootB) || rootB.startsWith(rootA))) advancedNameScore += 0.2;
  if (advancedNameScore > 0.4) advancedNameScore = 0.4;

  // husband similarity
  const husbandJW = jaroWinkler(a.husbandName, b.husbandName);
  const husbandToken = tokenJaccard(tokens(a.husbandName), tokens(b.husbandName));
  const husbandScore = Math.max(husbandJW, husbandToken);

  // phone and id
  const phoneScore = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  // children overlap
  const childrenScore = tokenJaccard(a.children, b.children);

  // location
  let locationScore = 0;
  if (a.village && b.village && a.village === b.village) locationScore += 0.4;
  if (a.subdistrict && b.subdistrict && a.subdistrict === b.subdistrict) locationScore += 0.25;
  if (locationScore > 0.5) locationScore = 0.5;

  // patronym detection (shared father/grandfather)
  const aPat = extractPaternal(a.womanName);
  const bPat = extractPaternal(b.womanName);
  let patronymScore = 0;
  if (aPat.father && bPat.father && aPat.father === bPat.father) patronymScore += 0.35;
  if (aPat.grandfather && bPat.grandfather && aPat.grandfather === bPat.grandfather) patronymScore += 0.25;
  if (patronymScore > 0.5) patronymScore = 0.5;

  // maternal detection
  const aMat = extractMaternal(a.womanName);
  const bMat = extractMaternal(b.womanName);
  let maternalScore = 0;
  if (aMat.mother && bMat.mother && aMat.mother === bMat.mother) maternalScore += 0.18;
  if (aMat.grandmother && bMat.grandmother && aMat.grandmother === bMat.grandmother) maternalScore += 0.12;
  if (maternalScore > 0.3) maternalScore = 0.3;

  // tribal score
  const tribalScore = (extractTribal(a.womanName) && extractTribal(b.womanName) && extractTribal(a.womanName) === extractTribal(b.womanName)) ? 0.4 : 0;

  // RULE: Shared husband + wives share paternal line (very strong)
  let sharedHusbandPatronym = 0;
  const husbandSimilar = jaroWinkler(a.husbandName, b.husbandName) >= 0.92;
  if (husbandSimilar) {
    if (aPat.father && bPat.father && aPat.father === bPat.father) sharedHusbandPatronym += 0.25;
    if (aPat.grandfather && bPat.grandfather && aPat.grandfather === bPat.grandfather) sharedHusbandPatronym += 0.2;
    if (sharedHusbandPatronym >= 0.40) sharedHusbandPatronym = 0.55; // force strong indicator
  }

  // RULE: token reorder (detect same tokens but different order)
  const tokenReorderScore = orderFree;

  // RULE: duplicate woman/husband detection (exact or fuzzy)
  const womanExact = (a.womanName && b.womanName && a.womanName === b.womanName);
  const husbandExact = (a.husbandName && b.husbandName && a.husbandName === b.husbandName);

  const womanFuzzy = (firstNameScore + familyNameScore + advancedNameScore + tokenReorderScore) / 4;
  const husbandFuzzy = husbandScore;

  // RULE: Same person with different husband/ID/phone (multiple registrations)
  // If name matches strongly but ID/phone/husband mismatch => flag multi-registration
  const strongNameMatch = (womanExact || womanFuzzy >= 0.85 || (tokenReorderScore >= 0.85));
  const multiRegistrationFlag = strongNameMatch && (idScore < 0.5 && phoneScore < 0.5 && husbandScore < 0.5) ? 1 : 0;

  // RULE: name rearrangement detection for cases like "نوريه علي عبدالله هواش" vs "نوريه علي هواش عبدالله"
  const reorderBoost = tokenReorderScore * 0.7;

  // RULE: Similarity across many parts (first, second, third)
  // compute overlap on first 3 tokens
  const aTok = tokens(a.womanName).slice(0, 3).join(" ");
  const bTok = tokens(b.womanName).slice(0, 3).join(" ");
  const firstThreeScore = jaroWinkler(aTok, bTok);

  // Compose final weighted score
  let score =
    0.15 * firstNameScore +
    0.25 * familyNameScore +
    0.12 * advancedNameScore +
    0.10 * tokenReorderScore +
    0.12 * husbandScore +
    0.08 * idScore +
    0.05 * phoneScore +
    0.04 * childrenScore +
    0.04 * locationScore;

  score += patronymScore * 0.9;
  score += sharedHusbandPatronym * 1.2;
  score += tribalScore * 1.0;
  score += maternalScore * 0.7;
  score += reorderBoost * 0.8;
  score += firstThreeScore * 0.15;

  // clamp
  score = Math.max(0, Math.min(1, score));

  // produce detailed breakdown to help reviewer UI
  const breakdown = {
    firstNameScore,
    familyNameScore,
    advancedNameScore,
    tokenReorderScore,
    husbandScore,
    idScore,
    phoneScore,
    childrenScore,
    locationScore,
    patronymScore,
    sharedHusbandPatronym,
    tribalScore,
    maternalScore,
    multiRegistrationFlag,
    strongNameMatch: strongNameMatch ? 1 : 0,
    firstThreeScore
  };

  return { score, breakdown };
}
// ===================== fuzzyCluster.ts — PART 4 =====================
// Blocking, edge building, and union-find helpers to scale to 30k–100k rows.

// ---------------------- Build blocks (multi-key) ----------------------
function buildBlocks(rows, opts) {
  const blocks = new Map();
  const prefix = opts?.blockPrefixSize ?? 4;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nameTokens = tokens(r.womanName);
    const first = nameTokens[0]?.slice(0, prefix) || "";
    const last = nameTokens[nameTokens.length - 1]?.slice(0, prefix) || "";
    const phone = digitsOnly(r.phone || "").slice(-6);
    const village = normalizeArabic(r.village || "").slice(0, 6);
    const clusterKey = r.cluster_id ? \`cid:\${String(r.cluster_id)}\` : "";

    const keys = [
      first ? \`fn:\${first}\` : "",
      last ? \`ln:\${last}\` : "",
      phone ? \`ph:\${phone}\` : "",
      village ? \`vl:\${village}\` : "",
      clusterKey
    ].filter(Boolean);

    if (keys.length === 0) keys.push("blk:all");

    for (const k of keys) {
      if (!blocks.has(k)) blocks.set(k, []);
      blocks.get(k).push(i);
    }
  }

  return Array.from(blocks.values());
}

// ---------------------- Build edges (thresholded) ----------------------
function buildEdges(rows, minScore = 0.6, opts) {
  const blocks = buildBlocks(rows);
  const seen = new Set();
  const edges = [];
  const chunk = opts?.blockChunkSize ?? 1200;

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    // chunk big blocks
    if (block.length > chunk) {
      for (let s = 0; s < block.length; s += chunk) {
        const part = block.slice(s, s + chunk);
        pushEdgesForList(part, rows, minScore, seen, edges);
      }
    } else {
      pushEdgesForList(block, rows, minScore, seen, edges);
    }
  }

  edges.sort((x, y) => y.score - x.score);
  return edges;
}

function pushEdgesForList(list, rows, minScore, seen, edges) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const key = a < b ? \`\${a}_\${b}\` : \`\${b}_\${a}\`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { score, breakdown } = pairwiseScore(rows[a], rows[b]);
      if (score >= minScore) edges.push({ a, b, score, breakdown });
    }
  }
}

// ---------------------- Union-Find with member tracking ----------------------
class UF {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) this.members.set(i, new Set([i]));
  }

  find(x) {
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  merge(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return a;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const mb = this.members.get(b);
    const ma = this.members.get(a);
    for (const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }

  rootMembers(x) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}
// ===================== fuzzyCluster.ts — PART 5 =====================
// Recursive splitting, main runClustering(), and export helpers.

// ---------------------- Recursive split to enforce max cluster size 4 ----------------------
function splitCluster(rowsSubset, minInternal = 0.5) {
  if (rowsSubset.length <= 4) return [rowsSubset];

  // build pairwise local edges
  const localEdges = [];
  for (let i = 0; i < rowsSubset.length; i++) {
    for (let j = i + 1; j < rowsSubset.length; j++) {
      const { score } = pairwiseScore(rowsSubset[i], rowsSubset[j]);
      if (score >= minInternal) localEdges.push({ a: i, b: j, score });
    }
  }
  localEdges.sort((x, y) => y.score - x.score);

  const uf = new UF(rowsSubset.length);
  for (const e of localEdges) {
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if (ra === rb) continue;
    if (uf.size[ra] + uf.size[rb] <= 4) uf.merge(ra, rb);
  }

  const groups = new Map();
  for (let i = 0; i < rowsSubset.length; i++) {
    const r = uf.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }

  const result = [];
  for (const idxs of groups.values()) {
    const subset = idxs.map(i => rowsSubset[i]);
    if (subset.length <= 4) result.push(subset);
    else result.push(...splitCluster(subset, Math.max(minInternal, 0.45)));
  }
  return result;
}

// ---------------------- Main runClustering ----------------------
async function runClustering(
  rows,
  opts
) {
  // normalize internal id
  rows.forEach((r, i) => r._internalId = r._internalId || \`r_\${i}\`);

  const minPair = opts?.minPairScore ?? 0.60;
  const minInternal = opts?.minInternalScore ?? 0.50;
  const blockChunkSize = opts?.blockChunkSize ?? 5000;

  // Build edges (thresholded)
  const edges = buildEdges(rows, minPair, { blockChunkSize });

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClustersIdx = [];
  const edgesUsed = [];

  for (const e of edges) {
    if (finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if (ra === rb) { edgesUsed.push(e); continue; }

    const sizeA = uf.size[ra], sizeB = uf.size[rb];
    if (sizeA + sizeB <= 4) {
      uf.merge(ra, rb);
      edgesUsed.push(e);
      continue;
    }

    // need to split combined set and finalize groups
    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    if (combinedIdx.length > 500) { // Optimization for very large components
        for(let i = 0; i < combinedIdx.length; i += 500) {
            const chunk = combinedIdx.slice(i, i + 500).map(idx => rows[idx]);
            const parts = splitCluster(chunk, minInternal);
            for(const p of parts) {
                const globalIdxs = p.map(r => rows.findIndex(row => row._internalId === r._internalId)).filter(idx => idx !== -1);
                if(globalIdxs.length) finalClustersIdx.push(globalIdxs);
                globalIdxs.forEach(idx => finalized.add(idx));
            }
        }
    } else {
        const combinedRows = combinedIdx.map(i => rows[i]);
        const parts = splitCluster(combinedRows, minInternal);

        for (const p of parts) {
          const globalIdxs = [];
          for (const r of p) {
            // find index mapping by internal id
            const idx = combinedIdx.find(i => rows[i]._internalId === r._internalId);
            if (idx !== undefined) {
              globalIdxs.push(idx);
              finalized.add(idx);
            } else {
              // fallback: match by normalized name + phone or id
              const fallback = combinedIdx.find(i => normalizeArabic(rows[i].womanName) === normalizeArabic(r.womanName) || digitsOnly(rows[i].phone) === digitsOnly(r.phone));
              if (fallback !== undefined) { globalIdxs.push(fallback); finalized.add(fallback); }
            }
          }
          if (globalIdxs.length) finalClustersIdx.push(globalIdxs);
        }
    }
    edgesUsed.push(e);
  }

  // leftovers
  const leftovers = new Map();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    if (!leftovers.has(r)) leftovers.set(r, []);
    leftovers.get(r).push(i);
  }

  for (const arr of leftovers.values()) {
    if (arr.length <= 4) finalClustersIdx.push(arr);
    else {
      const subRows = arr.map(i => rows[i]);
      const parts = splitCluster(subRows, minInternal);
      for (const p of parts) {
        const idxs = p.map(pr => arr.find(i => rows[i]._internalId === pr._internalId)).filter((x) => x !== undefined);
        if (idxs.length) finalClustersIdx.push(idxs);
      }
    }
  }

  // map to clusters of actual rows (and filter singletons)
  const clusters = finalClustersIdx.map(group => group.map(i => rows[i])).filter(c => c.length > 1);

  return { clusters, edgesUsed };
}

// ===================== Worker Logic =====================

let inbound = [];
let mapping = null;
let options = null;

async function processAll() {
    postMessage({type: 'progress', progress: 1, status: 'mapping-rows'});
    const rows = inbound.map((r, i) => {
        const mapped = {
            _internalId: \`row_\${i}\`,
            womanName: "", husbandName: "", nationalId: "", phone: "",
            village: "", subdistrict: "", children: [], cluster_id: ""
        };
        for (const key in mapping) {
            const col = mapping[key];
            if (col && r[col] !== undefined) {
                mapped[key] = r[col];
            }
        }
        return mapped;
    });

    postMessage({type: 'progress', progress: 5, status: 'starting-clustering'});

    const { clusters } = await runClustering(rows, options);

    postMessage({type: 'progress', progress: 99, status: 'finishing-up'});
    postMessage({type: 'done', clusters: clusters});
}


onmessage = function(e) {
    const msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'start') {
        mapping = msg.payload.mapping;
        options = msg.payload.options || {};
        inbound = [];
    } else if (msg.type === 'data') {
        inbound.push(...(msg.payload.rows || []));
        postMessage({type: 'progress', progress: 2, status: 'receiving-data'});
    } else if (msg.type === 'end') {
        processAll().catch(err => {
            postMessage({type: 'error', error: err.message || 'An unknown error occurred in the worker.'});
        });
    }
};
`;
}
