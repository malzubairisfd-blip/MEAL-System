"use client";

import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

/**
 * Upload Page + Web Worker client
 *
 * - Creates an inline Web Worker containing the full clustering engine
 * - Sends parsed rows to the worker (mapping applied)
 * - Receives progress events and final clusters
 * - Exports final clusters to Excel with formatting (ExcelJS)
 *
 * NOTE: Install dependencies:
 *   npm install xlsx exceljs file-saver
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type Mapping = {
  womanName: string;
  husbandName: string;
  nationalId: string;
  phone: string;
  village: string;
  subdistrict: string;
  children: string;
  cluster_id?: string;
};

export default function UploadPage() {
  const [columns, setColumns] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "",
    husbandName: "",
    nationalId: "",
    phone: "",
    village: "",
    subdistrict: "",
    children: "",
    cluster_id: "",
  });
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [clusters, setClusters] = useState<any[][]>([]);
  const workerRef = useRef<Worker | null>(null);
  const rowsRef = useRef<any[]>([]);

  useEffect(() => {
    // create worker on mount
    const workerScript = createWorkerScript();
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    workerRef.current = w;

    w.onmessage = (ev: MessageEvent) => {
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
          break;
        case "log":
          // optional internal logging
          // console.log("worker:", msg.data);
          break;
        case "error":
          setWorkerStatus("error");
          alert("Worker error: " + msg.error);
          break;
      }
    };

    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  // file input handler
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    // use XLSX to parse many spreadsheet types
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    rowsRef.current = json;
    setRowsPreview(json.slice(0, 10));
    setColumns(Object.keys(json[0] || {}));
  }

  function handleMappingChange(field: keyof Mapping, colName: string) {
    setMapping((m) => ({ ...m, [field]: colName }));
  }

  // start clustering: send mapping and rows to worker in chunks
  async function startClustering() {
    if (!workerRef.current) return alert("Worker not ready");
    if (!rowsRef.current.length) return alert("Upload data first");
    // validate mapping
    const required = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
    for (const r of required) {
      if (!mapping[r as keyof Mapping]) return alert(`Please map "${r}"`);
    }

    // send initial message
    workerRef.current.postMessage({
      type: "start",
      payload: {
        mapping,
        options: {
          minPairScore: 0.75,
          minInternalScore: 0.65,
          blockChunkSize: 1200,
        },
      },
    });

    // stream rows in chunks to avoid flame of memory/bandwidth
    const CHUNK = 2000; // chunk rows to worker (tuneable)
    let sent = 0;
    const rows = rowsRef.current;
    while (sent < rows.length) {
      const chunk = rows.slice(sent, sent + CHUNK);
      workerRef.current.postMessage({ type: "data", payload: { rows: chunk } });
      sent += CHUNK;
      // small delay to keep UI responsive
      await new Promise((r) => setTimeout(r, 10));
    }
    // tell worker data done
    workerRef.current.postMessage({ type: "end" });
    setWorkerStatus("processing");
    setProgress(1);
  }

  // Export Excel with color formatting
  async function exportExcelWithFormatting() {
    if (!clusters || !clusters.length) return alert("No clusters to export");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clusters");

    ws.addRow(["ClusterID","Woman Name","Husband Name","National ID","Phone","Village","Subdistrict","Children","Similarity%"]);

    // header formatting
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "4B0082" } // Indigo
      };
    });

    let cid = 1;
    for (const cluster of clusters) {
      // compute cluster similarity score approximate (average pairwise within cluster)
      for (const rec of cluster) {
        const sim = Math.round((rec._sim || 100) * 100) / 100; // already between 0..1 maybe, adjust in worker
        const childrenStr = Array.isArray(rec.children) ? rec.children.join(", ") : String(rec.children || "");
        const row = ws.addRow([cid, rec.womanName, rec.husbandName, rec.nationalId, rec.phone, rec.village, rec.subdistrict, childrenStr, Math.round((rec._sim || 1) * 100)]);
        const score = Math.round((rec._sim || 1) * 100);

        let bg = "FFFFFFFF";
        let text = "000000";
        if (score >= 95) { bg = "FF0000"; text = "FFFFFFFF"; }
        else if (score >= 85) { bg = "8B0000"; text = "000000"; }
        else if (score >= 75) { bg = "FFA500"; text = "000000"; }
        else if (score >= 60) { bg = "FFFF00"; text = "000000"; }

        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font = { color: { argb: text }, bold: true };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });
      }
      cid++;
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/octet-stream" });
    saveAs(blob, `clusters_${fileName || "data"}.xlsx`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Upload &amp; Cluster (Client-side, Web Worker)
      </h1>

      <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt" onChange={handleFile} className="mb-4" />

      {columns.length > 0 && (
        <div className="border p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">Map Columns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["womanName","husbandName","nationalId","phone","village","subdistrict","children","cluster_id"] as (keyof Mapping)[]).map((f) => (
              <label key={f} className="block">
                <div className="text-sm font-medium">{f}</div>
                <select value={mapping[f] || ""} onChange={(e) => handleMappingChange(f, e.target.value)} className="border p-2 rounded w-full">
                  <option value="">-- select column --</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={startClustering} className="bg-indigo-600 text-white px-4 py-2 rounded">Start Clustering</button>
            <button onClick={() => { setColumns([]); setRowsPreview([]); rowsRef.current = []; setClusters([]); }} className="px-4 py-2 border rounded">Reset</button>
            <button onClick={exportExcelWithFormatting} className="px-4 py-2 border rounded">Export Excel</button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div>Status: <b>{workerStatus}</b></div>
        <div>Progress: <b>{progress}%</b></div>
      </div>

      <div>
        <h3 className="font-semibold">Preview (first 10 rows)</h3>
        <pre className="bg-gray-100 p-3 rounded max-h-48 overflow-auto text-xs">{JSON.stringify(rowsPreview, null, 2)}</pre>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Clusters ({clusters.length})</h3>
        {clusters.slice(0, 200).map((c, i) => (
          <div key={i} className="border p-3 rounded mb-2">
            <div className="font-bold">Cluster {i+1} ({c.length})</div>
            {c.slice(0,10).map((r:any, idx:number) => <div key={idx} className="text-sm">{r.womanName} — {r.husbandName} — {r.phone}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------
   Inline worker creation: returns the worker JS code
   ------------------------------------------------- */
function createWorkerScript(): string {
  // The worker code is plain JS. It contains the clustering engine (normalized & lighter).
  // Keep it compact but full-featured (advanced Arabic rules included).
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

  function levDist(a,b){
    a = safeString(a); b = safeString(b);
    if(a===b) return 0;
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    const v0 = new Array(b.length+1), v1 = new Array(b.length+1);
    for(let j=0;j<=b.length;j++) v0[j]=j;
    for(let i=0;i<a.length;i++){
      v1[0]=i+1;
      for(let j=0;j<b.length;j++){
        const cost = a[i]===b[j] ? 0 : 1;
        v1[j+1] = Math.min(v1[j]+1, v0[j+1]+1, v0[j]+cost);
      }
      for(let j=0;j<=b.length;j++) v0[j]=v1[j];
    }
    return v1[b.length];
  }
  function normalizedLev(a,b){ const d=levDist(a,b); const maxLen=Math.max(1,a.length,b.length); return 1 - d/maxLen; }

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

  function extractPaternal(fullName){
    const parts = tokensOfName(fullName);
    return { father: parts[1]||"", grandfather: parts[2]||"" };
  }
  function extractMaternal(fullName){
    const parts = tokensOfName(fullName); const L = parts.length;
    return { mother: parts[L-2]||"", grandmother: parts[L-3]||"" };
  }
  function extractTribal(fullName){
    const parts = tokensOfName(fullName);
    for(let i=parts.length-1;i>=0;i--) if(parts[i].startsWith("ال")) return parts[i];
    return "";
  }
  function reduceRoot(fullName){
    const parts = tokensOfName(fullName);
    return parts.map(p=>p.slice(0,3)).join(" ");
  }

  // pairwise scoring (lighter but feature-full)
  function pairwiseScore(a,b){
    const aName = normalizeArabic(a.womanName||"");
    const bName = normalizeArabic(b.womanName||"");
    const aT = tokensOfName(aName), bT = tokensOfName(bName);
    const firstA = aT[0]||"", firstB = bT[0]||"";
    const familyA = aT.slice(1).join(" "), familyB = bT.slice(1).join(" ");
    const firstScore = jaroWinkler(firstA, firstB);
    const familyScore = jaroWinkler(familyA, familyB);

    const aRoot = reduceRoot(aName), bRoot = reduceRoot(bName);
    let advancedNameScore = 0;
    if(aRoot && bRoot && aRoot===bRoot) advancedNameScore+=0.35;
    if(aRoot && bRoot && (aRoot.startsWith(bRoot)||bRoot.startsWith(aRoot))) advancedNameScore+=0.20;
    const inter = aRoot.split(" ").filter(x=>bRoot.split(" ").includes(x));
    if(inter.length>=2) advancedNameScore+=0.25; if(advancedNameScore>0.40) advancedNameScore=0.40;

    const hA = normalizeArabic(a.husbandName||""), hB = normalizeArabic(b.husbandName||"");
    const husbandScore = Math.max(jaroWinkler(hA,hB), tokenJaccard(tokensOfName(hA), tokensOfName(hB)));
    const idScore = (a.nationalId && b.nationalId && String(a.nationalId)===String(b.nationalId)) ? 1 : 0;
    const phoneScore = phoneSim(a.phone,b.phone);
    const loc = (a.village && b.village && normalizeArabic(a.village)===normalizeArabic(b.village)) ? 1 : (a.subdistrict && b.subdistrict && normalizeArabic(a.subdistrict)===normalizeArabic(b.subdistrict) ? 0.8 : 0);
    const chA = (a.children||[]).map(x=>normalizeArabic(x)); const chB = (b.children||[]).map(x=>normalizeArabic(x));
    const childrenScore = tokenJaccard(chA,chB);
    const aPat = extractPaternal(aName), bPat = extractPaternal(bName);
    let patronym = 0; if(aPat.father && aPat.father===bPat.father) patronym+=0.35; if(aPat.grandfather && aPat.grandfather===bPat.grandfather) patronym+=0.25; if(patronym>0.5) patronym=0.5;
    let sharedHusbandPat = 0; if(jaroWinkler(hA,hB)>=0.92){ if(aPat.father===bPat.father && aPat.father) sharedHusbandPat+=0.25; if(aPat.grandfather===bPat.grandfather && aPat.grandfather) sharedHusbandPat+=0.20; if(sharedHusbandPat>=0.40) sharedHusbandPat=0.55;}
    const tribalScore = (extractTribal(aName) && extractTribal(bName) && extractTribal(aName)===extractTribal(bName)) ? 0.40 : 0;

    let score = 0;
    score += 0.15*firstScore + 0.35*familyScore + 0.15*husbandScore + 0.15*idScore + 0.08*phoneScore + 0.02*loc + 0.10*childrenScore;
    score += patronym*0.9; score += sharedHusbandPat*1.2; score += advancedNameScore*1.1; score += tribalScore*1.1;
    if(score>1) score=1; if(score<0) score=0;

    return { score, breakdown:{ firstScore, familyScore, advancedNameScore, husbandScore, idScore, phoneScore, loc, childrenScore, patronym, sharedHusbandPat, tribalScore } };
  }

  // simple blocking (multi-key)
  function buildBlocks(rows){
    const blocks = new Map();
    for(let i=0;i<rows.length;i++){
      const r = rows[i];
      const toks = tokensOfName(r.womanName||"");
      const first = toks[0] ? toks[0].slice(0,4) : "";
      const last = toks.length? toks[toks.length-1].slice(0,4) : "";
      const ph = digitsOnly(r.phone||"").slice(-6);
      const vg = normalizeArabic(r.village||"").slice(0,6);
      const keys=[];
      if(first) keys.push('fn:'+first);
      if(last) keys.push('ln:'+last);
      if(ph) keys.push('ph:'+ph);
      if(vg) keys.push('vl:'+vg);
      if(keys.length===0) keys.push('blk:all');
      for(const k of keys){ if(!blocks.has(k)) blocks.set(k,[]); blocks.get(k).push(i); }
    }
    return Array.from(blocks.values());
  }

  // union-find
  function UF(n){
    this.p = Array.from({length:n},(_,i)=>i);
    this.size = Array(n).fill(1);
  }
  UF.prototype.find = function(x){ if(this.p[x]===x) return x; this.p[x]=this.find(this.p[x]); return this.p[x]; };
  UF.prototype.merge = function(a,b){ a=this.find(a); b=this.find(b); if(a===b) return a; if(this.size[a]<this.size[b]){ const t=a; a=b; b=t; } this.p[b]=a; this.size[a]+=this.size[b]; return a; };

  // worker state: we will receive data chunks which we append; when "end" received we process
  let inbound = [];
  let mapping = null;
  let options = null;

// ---------------------- REPLACEMENT MERGE + REFINEMENT LOGIC ----------------------
/**
 * Helper: build adjacency list from thresholded edges
 */
function buildAdjacency(n, edges) {
  const adj = new Map();
  for (let i = 0; i < n; i++) adj.set(i, []);
  for (const e of edges) {
    adj.get(e.a).push({ to: e.b, score: e.score });
    adj.get(e.b).push({ to: e.a, score: e.score });
  }
  return adj;
}

/**
 * Helper: find connected components via BFS
 */
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

/**
 * Computes all pairwise scores within a list of indices (returns matrix and list)
 */
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

/**
 * Split component by removing weakest edge repeatedly until subcomponents are coherent
 */
function refineComponent(rows, idxs, minInternal) {
  // base
  if (idxs.length <= 4) return [idxs];

  const { scores, pairs } = computePairwiseMatrix(rows, idxs);
  const m = idxs.length;

  // compute average internal similarity (pairwise average)
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

  // otherwise, remove the weakest edge and re-compute components
  pairs.sort((a, b) => a.score - b.score); // ascending
  const localAdj = new Map();
  for (let i = 0; i < m; i++) localAdj.set(i, new Set());
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) continue;
      if (scores[i][j] > 0) localAdj.get(i).add(j);
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
        if (global.length <= 4) result.push(global);
        else result.push(...refineComponent(rows, global, minInternal));
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


  function processAll(){
    // build normalized records (map fields)
    const rows = inbound.map(r=>{
      return {
        womanName: r[mapping.womanName] || r.womanName || "",
        husbandName: r[mapping.husbandName] || r.husbandName || "",
        nationalId: r[mapping.nationalId] || r.nationalId || "",
        phone: r[mapping.phone] || r.phone || "",
        village: r[mapping.village] || r.village || "",
        subdistrict: r[mapping.subdistrict] || r.subdistrict || "",
        children: Array.isArray(r[mapping.children]||r.children) ? (r[mapping.children]||r.children) : (String(r[mapping.children]||r.children||"").split(/[;,،|]/).map(x=>x.trim()).filter(Boolean)),
        cluster_id: r[mapping.cluster_id] || r.cluster_id || r.clusterId || ""
      };
    });

    postMessage({type:'progress', progress:5, status:'building-blocks'});

    const blocks = buildBlocks(rows);

    postMessage({type:'progress', progress:15, status:'building-edges'});

    const minPair = options?.minPairScore || 0.75;
    const minInternal = options?.minInternalScore || 0.65;
    const blockChunkSize = options?.blockChunkSize || 1200;

    const edges=[];
    const seen = new Set();
    for(let bIdx=0;bIdx<blocks.length;bIdx++){
      const block = blocks[bIdx];
      const CH = blockChunkSize;
      for(let s=0;s<block.length;s+=CH){
        const part = block.slice(s, s+CH);
        for(let i=0;i<part.length;i++){
          for(let j=i+1;j<part.length;j++){
            const a = part[i], bb = part[j];
            const key = a<bb ? a+'_'+bb : bb+'_'+a;
            if(seen.has(key)) continue;
            seen.add(key);
            const p = pairwiseScore(rows[a], rows[bb]);
            if(p.score >= minPair) edges.push({a, b: bb, score: p.score, breakdown: p.breakdown});
          }
        }
      }
      if(bIdx%10===0) postMessage({type:'progress', progress:15 + Math.round(50*(bIdx/blocks.length)), status:'building-edges'});
    }

    edges.sort((x,y)=>y.score-x.score);

    postMessage({type:'progress', progress:70, status:'refining-components'});
    
    // NEW LOGIC
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

    const clustersAnnotated = clustersFiltered.map(cluster=>{
      const annotated = cluster.map(rec => ({...rec, _sim:1}));
      return annotated;
    });

    postMessage({type:'done', clusters: clustersAnnotated});
  }

  onmessage = function(e){
    const msg = e.data;
    if(!msg || !msg.type) return;
    if(msg.type==='start'){
      mapping = msg.payload.mapping;
      options = msg.payload.options || {};
      inbound = [];
    } else if(msg.type==='data'){
      const chunk = msg.payload.rows || [];
      inbound.push(...chunk);
      postMessage({type:'progress', progress: Math.min(5 + Math.round(10*(inbound.length/ (options.estimatedRows||50000))), 25), status:'receiving'});
    } else if(msg.type==='end'){
      setTimeout(()=>{
        try{ processAll(); }catch(err){ postMessage({type:'error', error: String(err)}); }
      }, 50);
    }
  };

  `; // end worker string
}
