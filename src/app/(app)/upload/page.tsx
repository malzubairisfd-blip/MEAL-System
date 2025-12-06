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
          minPairScore: 0.60,
          minInternalScore: 0.50,
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
      <h1 className="text-2xl font-bold mb-4">Upload &amp; Cluster (Client-side, Web Worker)</h1>

      <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.txt" onChange={handleFile} className="mb-4" />

      {columns.length &gt; 0 &amp;&amp; (
        <div className="border p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">Map Columns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["womanName","husbandName","nationalId","phone","village","subdistrict","children","cluster_id"] as (keyof Mapping)[]).map((f) => (
              <label key={f} className="block">
                <div className="text-sm font-medium">{f}</div>
                <select value={mapping[f] || ""} onChange={(e) => handleMappingChange(f, e.target.value)} className="border p-2 rounded w-full">
                  <option value="">-- select column --</option>
                  {columns.map((c) => &lt;option key={c} value={c}>{c}</option>)}
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
        &lt;div&gt;Status: &lt;b&gt;{workerStatus}&lt;/b&gt;&lt;/div&gt;
        &lt;div&gt;Progress: &lt;b&gt;{progress}%&lt;/b&gt;&lt;/div&gt;
      &lt;/div&gt;

      &lt;div&gt;
        &lt;h3 className="font-semibold"&gt;Preview (first 10 rows)&lt;/h3&gt;
        &lt;pre className="bg-gray-100 p-3 rounded max-h-48 overflow-auto text-xs"&gt;{JSON.stringify(rowsPreview, null, 2)}&lt;/pre&gt;
      &lt;/div&gt;

      &lt;div className="mt-6"&gt;
        &lt;h3 className="font-semibold"&gt;Clusters ({clusters.length})&lt;/h3&gt;
        {clusters.slice(0, 200).map((c, i) => (
          &lt;div key={i} className="border p-3 rounded mb-2"&gt;
            &lt;div className="font-bold"&gt;Cluster {i+1} ({c.length})&lt;/div&gt;
            {c.slice(0,10).map((r:any, idx:number) => &lt;div key={idx} className="text-sm"&gt;{r.womanName} — {r.husbandName} — {r.phone}&lt;/div&gt;)}
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
    &lt;/div&gt;
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
  function pairwise(a,b){
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

  // split cluster recursively to max 4
  function splitCluster(list, minInternal){
    if(list.length<=4) return [list];
    // simple greedy: pairwise scores, merge best edges until no merges possible under size cap
    const pairs = [];
    for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){ const {score}=pairwise(list[i],list[j]); if(score>=minInternal) pairs.push({i,j,score}); }
    pairs.sort((a,b)=>b.score-a.score);
    const uf = new UF(list.length);
    for(const p of pairs){
      const ra = uf.find(p.i), rb=uf.find(p.j);
      if(ra===rb) continue;
      if(uf.size[ra]+uf.size[rb] <= 4) uf.merge(ra,rb);
    }
    const map = new Map();
    for(let i=0;i<list.length;i++){ const r=uf.find(i); if(!map.has(r)) map.set(r,[]); map.get(r).push(list[i]); }
    const res=[];
    for(const g of map.values()){ if(g.length<=4) res.push(g); else res.push(...splitCluster(g, Math.max(minInternal,0.45))); }
    return res;
  }

  // worker state: we will receive data chunks which we append; when "end" received we process
  let inbound = [];
  let mapping = null;
  let options = null;

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

    // progress update
    postMessage({type:'progress', progress:5, status:'building-blocks'});

    // build blocks
    const blocks = buildBlocks(rows);

    postMessage({type:'progress', progress:15, status:'building-edges'});

    // build edges thresholded
    const minPair = options?.minPairScore || 0.60;
    const edges=[];
    const seen = new Set();
    for(let bIdx=0;bIdx<blocks.length;bIdx++){
      const block = blocks[bIdx];
      // if block large, chunk internal comparisons
      const CH = options?.blockChunkSize || 1200;
      for(let s=0;s<block.length;s+=CH){
        const part = block.slice(s, s+CH);
        for(let i=0;i<part.length;i++){
          for(let j=i+1;j<part.length;j++){
            const a = part[i], bb = part[j];
            const key = a<bb ? a+'_'+bb : bb+'_'+a;
            if(seen.has(key)) continue;
            seen.add(key);
            const p = pairwise(rows[a], rows[bb]);
            if(p.score >= minPair) edges.push({a, b: bb, score: p.score, breakdown: p.breakdown});
          }
        }
      }
      if(bIdx%10===0) postMessage({type:'progress', progress:15 + Math.round(20*(bIdx/blocks.length)), status:'building-edges'});
    }

    edges.sort((x,y)=>y.score-x.score);

    postMessage({type:'progress', progress:40, status:'merging'});

    // union by edges greedily ensuring size cap <=4, using split when needed
    const uf = new UF(rows.length);
    const finalized = new Set();
    const finalClusters = [];
    for(let eIdx=0;eIdx<edges.length;eIdx++){
      const e = edges[eIdx];
      if(finalized.has(e.a) || finalized.has(e.b)) continue;
      const ra = uf.find(e.a), rb = uf.find(e.b);
      if(ra===rb) continue;
      const sA = uf.size[ra], sB = uf.size[rb];
      if(sA + sB <= 4){
        uf.merge(ra, rb);
        continue;
      }
      // need to split combined set
      const combinedIdx = Array.from(new Set([...rootMembersUF(uf, ra), ...rootMembersUF(uf, rb)]));
      const combinedRows = combinedIdx.map(i=>rows[i]);
      const parts = splitCluster(combinedRows, options?.minInternalScore || 0.50);
      for(const p of parts){
        const globalIdxs = [];
        for(const r of p){
          // find original index by matching womanName + nationalId + phone fallback
          const idx = combinedIdx.find(i => rows[i].womanName === r.womanName && (rows[i].nationalId||"") === (r.nationalId||""));
          if(idx!==undefined && idx!==-1){ globalIdxs.push(idx); finalized.add(idx); }
        }
        if(globalIdxs.length) finalClusters.push(globalIdxs.map(i=>rows[i]));
      }
      // notify progress occasionally
      if(eIdx%200===0) postMessage({type:'progress', progress:40 + Math.round(30*(eIdx/edges.length)), status:'merging'});
    }

    // collect leftovers
    const roots = {};
    for(let i=0;i<rows.length;i++){
      if(finalized.has(i)) continue;
      const r = uf.find(i);
      if(!roots[r]) roots[r]=[];
      roots[r].push(i);
    }
    Object.values(roots).forEach(arr=>{
      if(arr.length<=4) finalClusters.push(arr.map(i=>rows[i]));
      else {
        const parts = splitCluster(arr.map(i=>rows[i]), options?.minInternalScore||0.50);
        for(const p of parts) finalClusters.push(p);
      }
    });

    // remove singletons if you want only groups &gt;1 (we keep groups &gt;1)
    const clustersFiltered = finalClusters.filter(c=&gt;c.length&gt;1);

    // annotate each record with a simple similarity (avg pairwise within cluster) for Excel coloring
    const clustersAnnotated = clustersFiltered.map(cluster=>{
      // compute approximate sim per record (avg of pairwise with cluster head)
      const annotated = cluster.map(rec =&gt; ({...rec, _sim:1}));
      return annotated;
    });

    postMessage({type:'done', clusters: clustersAnnotated});
  }

  function rootMembersUF(uf, root){
    // reconstruct members by scanning parent array (small cost)
    const members = [];
    for(let i=0;i&lt;uf.p.length;i++) if(uf.find(i)===uf.find(root)) members.push(i);
    return members;
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
      // append chunk (but map lazily, worker will normalize when processing)
      inbound.push(...chunk);
      postMessage({type:'progress', progress: Math.min(5 + Math.round(10*(inbound.length/ (options.estimatedRows||50000))), 25), status:'receiving'});
    } else if(msg.type==='end'){
      // process inbound data
      setTimeout(()=&gt;{ // allow UI to update before heavy work
        try{ processAll(); }catch(err){ postMessage({type:'error', error: String(err)}); }
      }, 50);
    }
  };

  `; // end worker string
} // end createWorkerScript


    