

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

function createWorkerScript() {
  return `
// workers/cluster.worker.ts
// Module web worker. Self-contained fuzzy clustering engine v5.
// Receives messages: { type: 'start', payload: { mapping, options } }, { type: 'data', payload: { rows } }, { type: 'end' }
// Returns progress and final clusters via postMessage.

/* -------------------------
   Utilities & Normalizers
   ------------------------- */
function normalizeArabic(text){
  if(!text) return "";
  let s = String(text);

  // Character replacements
  s = s.replace(/ط/g, "د");
  s = s.replace(/ق/g, "ف");
  s = s.replace(/[جخ]/g, "ح");
  s = s.replace(/ذ/g, "د");
  s = s.replace(/[تث]/g, "ب");
  s = s.replace(/ش/g, "س");
  s = s.replace(/ز/g, "ر");
  s = s.replace(/[ضظ]/g, "ص");
  s = s.replace(/غ/g, "ع");
  s = s.replace(/ن/g, "ب");
  
  // Character deletions
  s = s.replace(/[يىئوؤءاأإآةه]/g, "");

  // Normalize whitespace
  s = s.replace(/\\s+/g, " ").trim();

  return s;
}
function tokens(s){ const n = s || ""; if(!n) return []; return n.split(" ").filter(Boolean); }
function digitsOnly(s){ if(!s) return ""; return String(s).replace(/\\D/g,""); }
function normalizeChildrenField(val){
  if(!val) return [];
  if(Array.isArray(val)) return val.map(x=>String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x=>String(x)).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(s1, s2){
  s1 = String(s1 || ""); s2 = String(s2 || "");
  if(!s1 || !s2) return 0;
  const len1=s1.length, len2=s2.length;
  const matchDist = Math.floor(Math.max(len1,len2)/2)-1;
  const s1m = Array(len1).fill(false), s2m = Array(len2).fill(false);
  let matches=0;
  for(let i=0;i<len1;i++){
    const start=Math.max(0,i-matchDist), end=Math.min(i+matchDist+1,len2);
    for(let j=start;j<end;j++){
      if(s2m[j]) continue;
      if(s1[i] !== s2[j]) continue;
      s1m[i]=true; s2m[j]=true; matches++; break;
    }
  }
  if(matches===0) return 0;
  let k=0, trans=0;
  for(let i=0;i<len1;i++){
    if(!s1m[i]) continue;
    while(!s2m[k]) k++;
    if(s1[i] !== s2[k]) trans++;
    k++;
  }
  trans = trans/2.0;
  const m = matches;
  const jaro = (m/len1 + m/len2 + (m-trans)/m)/3.0;
  let prefix=0, maxPrefix=4;
  for(let i=0;i<Math.min(maxPrefix,len1,len2);i++){
    if(s1[i]===s2[i]) prefix++; else break;
  }
  return jaro + prefix*0.1*(1-jaro);
}
function tokenJaccard(a, b){
  if(!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const uni = new Set([...A,...B]).size;
  return uni === 0 ? 0 : inter/uni;
}

/* -------------------------
   Name helpers
   ------------------------- */
function reduceNameRoot(full){
  const parts = tokens(full);
  return parts.map(p => p.slice(0,3)).join(" ");
}
function extractPaternal(full){
  const parts = tokens(full);
  return { father: parts[1] || "", grandfather: parts[2] || "" };
}
function extractMaternal(full){
  const parts = tokens(full);
  const L = parts.length;
  return { mother: parts[L-2]||"", grandmother: parts[L-3]||"" };
}
function extractTribal(full){
  const parts = tokens(full);
  for(let i=parts.length-1;i>=0;i--) if(parts[i].startsWith("ال")) return parts[i];
  return "";
}
function nameOrderFreeScore(aName,bName){
  const aT = tokens(aName), bT = tokens(bName);
  if(!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const union = new Set([...A,...B]).size; const jacc = union===0?0:inter/union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted,bSorted);
  return 0.7*jacc + 0.3*sj;
}

function splitParts(name) {
  if (!name) return [];
  return name.trim().split(/\\s+/).filter(Boolean);
}

function applyAdditionalRules(a, b, jw, minPair) {
  const wA = a.womanName_normalized || "";
  const wB = b.womanName_normalized || "";
  const hA = a.husbandName_normalized || "";
  const hB = b.husbandName_normalized || "";

  const WA = splitParts(wA);
  const WB = splitParts(wB);
  const HA = splitParts(hA);
  const HB = splitParts(hB);

  const lenWA = WA.length;
  const lenWB = WB.length;
  const lenHA = HA.length;
  const lenHB = HB.length;

  // Components
  const [F1, Fa1, G1, L1] = WA;
  const [F2, Fa2, G2, L2] = WB;

  // Husband components
  const [HF1, HFa1, HG1, HL1] = HA;
  const [HF2, HFa2, HG2, HL2] = HB;

  // Jaro-Winkler helpers
  const sc = (x, y) => jw(x || "", y || "");
  const s93 = (x, y) => sc(x, y) >= 0.93;
  const s95 = (x, y) => sc(x, y) >= 0.95;

  const diffHusband = sc(hA, hB) < 0.60;
  const diffHusbandFirstName = sc(HF1, HF2) < 0.90;


  // RULE 1
  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    sc(L1, L2) < 0.80 &&
    diffHusband
  ) {
    return minPair + 0.10;
  }

  // RULE 2
  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    s93(L1, L2) &&
    diffHusband
  ) {
    return minPair + 0.12;
  }

  // RULE 3
  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    s93(L1, L2) &&
    diffHusband
  ) {
    return minPair + 0.14;
  }

  // RULE 4
  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s95(F1, F2) &&
    s93(Fa1, Fa2) &&
    sc(G1, G2) < 0.93 &&
    sc(L1, L2) < 0.93 &&
    s95(HF1, HF2) &&
    sc(HFa1, HFa2) < 0.93 &&
    s93(HL1, HL2)
  ) {
    return minPair + 0.15;
  }

  // RULE 5
  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    sc(L1, L2) < 0.93 &&
    ((lenHA === 4 && lenHB === 5) || (lenHA === 5 && lenHB === 4)) &&
    s93(HF1, HF2) &&
    s93(HFa1, HFa2) &&
    s93(HG1, HG2)
  ) {
    return minPair + 0.12;
  }
  
  // RULE 6
  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    diffHusbandFirstName
  ) {
    return minPair + 0.08;
  }


  return null;
}

/* -------------------------
   Pairwise scoring (rules implemented)
   ------------------------- */
function pairwiseScore(a,b, opts){
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.04,
      locationScore: 0.04
    },
    rules: {
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enablePolygamyRules: true
    },
    thresholds: {
        minPair: 0.62
    }
  };
  const o = { ...optsDefaults, ...(opts||{}),
    finalScoreWeights: {...optsDefaults.finalScoreWeights, ...(opts?.finalScoreWeights || {})},
    rules: {...optsDefaults.rules, ...(opts?.rules || {})},
    thresholds: {...optsDefaults.thresholds, ...(opts?.thresholds || {})},
   };
  const FSW = o.finalScoreWeights;

  const a_norm = {
    womanName_normalized: a.womanName_normalized,
    husbandName_normalized: a.husbandName_normalized,
    nationalId: String(a.nationalId||a.id||""),
    phone: digitsOnly(a.phone||""),
    village_normalized: a.village_normalized,
    subdistrict_normalized: a.subdistrict_normalized,
    children_normalized: a.children_normalized || []
  };
  const b_norm = {
    womanName_normalized: b.womanName_normalized,
    husbandName_normalized: b.husbandName_normalized,
    nationalId: String(b.nationalId||b.id||""),
    phone: digitsOnly(b.phone||""),
    village_normalized: b.village_normalized,
    subdistrict_normalized: b.subdistrict_normalized,
    children_normalized: b.children_normalized || []
  };
  
  // Calculate all individual field scores first
  const firstA = tokens(a_norm.womanName_normalized)[0]||"";
  const firstB = tokens(b_norm.womanName_normalized)[0]||"";
  const familyA = tokens(a_norm.womanName_normalized).slice(1).join(" ");
  const familyB = tokens(b_norm.womanName_normalized).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);
  const tokenReorderScore = nameOrderFreeScore(a_norm.womanName_normalized, b_norm.womanName_normalized);

  const rootA = reduceNameRoot(a_norm.womanName_normalized), rootB = reduceNameRoot(b_norm.womanName_normalized);
  let advancedNameScore = 0;
  if(rootA && rootB && rootA === rootB) advancedNameScore += 0.35;
  if(rootA && rootB && (rootA.startsWith(rootB) || rootB.startsWith(rootA))) advancedNameScore += 0.2;
  advancedNameScore = Math.min(0.4, advancedNameScore);

  const husbandJW = jaroWinkler(a_norm.husbandName_normalized, b_norm.husbandName_normalized);
  const husbandToken = tokenJaccard(tokens(a_norm.husbandName_normalized), tokens(b_norm.husbandName_normalized));
  const husbandScore = Math.max(husbandJW, husbandToken);

  const phoneScoreVal = (a_norm.phone && b_norm.phone) ? (a_norm.phone===b_norm.phone ? 1 : (a_norm.phone.slice(-6)===b_norm.phone.slice(-6) ? 0.85 : (a_norm.phone.slice(-4)===b_norm.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a_norm.nationalId && b_norm.nationalId) ? (a_norm.nationalId===b_norm.nationalId ? 1 : (a_norm.nationalId.slice(-5)===b_norm.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  const childrenScore = tokenJaccard(a_norm.children_normalized, b_norm.children_normalized);

  let locationScore = 0;
  if(a_norm.village_normalized && b_norm.village_normalized && a_norm.village_normalized===b_norm.village_normalized) locationScore += 0.4;
  if(a_norm.subdistrict_normalized && b_norm.subdistrict_normalized && a_norm.subdistrict_normalized===b_norm.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const aPat = extractPaternal(a_norm.womanName_normalized), bPat = extractPaternal(b_norm.womanName_normalized);
  let patronymScore = 0;
  if(aPat.father && bPat.father && aPat.father===bPat.father) patronymScore += 0.35;
  if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) patronymScore += 0.25;
  patronymScore = Math.min(0.5, patronymScore);

  const aMat = extractMaternal(a_norm.womanName_normalized), bMat = extractMaternal(b_norm.womanName_normalized);
  let maternalScore = 0;
  if(aMat.mother && bMat.mother && aMat.mother===bMat.mother) maternalScore += 0.18;
  if(aMat.grandmother && bMat.grandmother && aMat.grandmother===bMat.grandmother) maternalScore += 0.12;
  maternalScore = Math.min(0.3, maternalScore);

  const tribalScore = (extractTribal(a_norm.womanName_normalized) && extractTribal(b_norm.womanName_normalized) && extractTribal(a_norm.womanName_normalized)===extractTribal(b_norm.womanName_normalized)) ? 0.4 : 0;

  let sharedHusbandPatronym = 0;
  const husbandSimilar = jaroWinkler(a_norm.husbandName_normalized,b_norm.husbandName_normalized) >= 0.92;
  if(husbandSimilar){
    if(aPat.father && bPat.father && aPat.father===bPat.father) sharedHusbandPatronym += 0.25;
    if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) sharedHusbandPatronym += 0.2;
    if(sharedHusbandPatronym >= 0.4) sharedHusbandPatronym = 0.55;
  }

  const womanExact = (a_norm.womanName_normalized && b_norm.womanName_normalized && a_norm.womanName_normalized===b_norm.womanName_normalized);
  const womanFuzzy = (firstNameScore + familyNameScore + advancedNameScore + tokenReorderScore) / 4;
  const strongNameMatch = (womanExact || womanFuzzy >= 0.85 || tokenReorderScore >= 0.85);
  const multiRegistrationFlag = strongNameMatch && (idScore < 0.5 && phoneScoreVal < 0.5 && husbandScore < 0.5) ? 1 : 0;
  
  const breakdown = {
    firstNameScore,
    familyNameScore,
    advancedNameScore,
    tokenReorderScore,
    husbandScore,
    idScore,
    phoneScore: phoneScoreVal,
    childrenScore,
    locationScore,
    patronymScore,
    sharedHusbandPatronym,
    tribalScore,
    maternalScore,
    multiRegistrationFlag,
    strongNameMatch,
    additionalRuleTriggered: false
  };

  const ruleScore = applyAdditionalRules(a, b, jaroWinkler, o.thresholds.minPair);
  if (ruleScore !== null) {
    breakdown.additionalRuleTriggered = true;
    return {
      score: ruleScore,
      breakdown: breakdown
    };
  }

  // If no rule matched, calculate the final weighted score
  let score = 0;
  score += FSW.firstNameScore * firstNameScore;
  score += FSW.familyNameScore * familyNameScore;
  score += FSW.advancedNameScore * advancedNameScore;
  score += FSW.tokenReorderScore * tokenReorderScore;
  score += FSW.husbandScore * husbandScore;
  score += FSW.idScore * idScore;
  score += FSW.phoneScore * phoneScoreVal;
  score += FSW.childrenScore * childrenScore;
  score += FSW.locationScore * locationScore;

  if(o.rules.enableNameRootEngine) score += advancedNameScore * 0.12;
  if(o.rules.enableTribalLineage) score += tribalScore * 1.0;
  if(o.rules.enableMaternalLineage) score += maternalScore * 0.7;
  if(o.rules.enablePolygamyRules) score += sharedHusbandPatronym * 1.2;

  score = Math.max(0, Math.min(1, score));

  return { score, breakdown };
}

/* -------------------------
   LSH Blocking for scale
   ------------------------- */
function buildBlocks(rows, opts){
  const blocks = new Map();
  for(let i=0; i<rows.length; i++){
    const r = rows[i];
    const womanNameTokens = tokens(r.womanName_normalized || "");
    const husbandNameTokens = tokens(r.husbandName_normalized || "");
    const keys = new Set();
    
    const womanFirst = womanNameTokens[0] ? womanNameTokens[0].slice(0,3) : null;
    const husbandFirst = husbandNameTokens[0] ? husbandNameTokens[0].slice(0,3) : null;
    
    // Key 1: Woman's first name
    if(womanFirst) keys.add(\`fn:\${womanFirst}\`);
    
    // Key 2: Woman's first name + Husband's first name
    if(womanFirst && husbandFirst) keys.add(\`whn:\${womanFirst}:\${husbandFirst}\`);

    // Key 3: Husband's first name
    if(husbandFirst) keys.add(\`hn:\${husbandFirst}\`);

    if(keys.size === 0) keys.add("blk:all");

    for(const k of keys){
      const arr = blocks.get(k) || [];
      arr.push(i);
      blocks.set(k,arr);
    }
  }
  return Array.from(blocks.values());
}


function pushEdgesForList(list, rows, minScore, seen, edges, opts){
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const a = list[i], b = list[j];
      const key = a<b? a + '_' + b : b + '_' + a;
      if(seen.has(key)) continue;
      seen.add(key);
      const { score, breakdown } = pairwiseScore(rows[a], rows[b], opts);
      if(score >= minScore) edges.push({ a, b, score, breakdown });
    }
  }
}

function buildEdges(rows, minScore=0.6, opts){
  const blocks = buildBlocks(rows, opts);
  const seen = new Set();
  const edges = [];
  const chunk = opts?.blockChunkSize ?? 3000;
  for(let bi=0; bi<blocks.length; bi++){
    const block = blocks[bi];
    if(block.length > chunk){
      for(let s=0;s<block.length;s+=chunk){
        const part = block.slice(s,s+chunk);
        pushEdgesForList(part, rows, minScore, seen, edges, opts);
      }
    } else {
      pushEdgesForList(block, rows, minScore, seen, edges, opts);
    }
    if(bi % 200 === 0) postMessage({ type:'progress', status:'building-edges', progress: 10 + Math.round(40 * (bi/blocks.length)), completed: bi+1, total: blocks.length });
  }
  edges.sort((x,y)=>y.score-x.score);
  return edges;
}

/* Union-Find (with members set) */
class UF {
  constructor(n){
    this.parent = Array.from({length:n},(_,i)=>i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for(let i=0;i<n;i++) this.members.set(i,new Set([i]));
  }
  find(x){
    if(this.parent[x]===x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  merge(a,b){
    a = this.find(a); b = this.find(b);
    if(a===b) return a;
    if(this.size[a] < this.size[b]) [a,b] = [b,a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const mb = this.members.get(b); const ma = this.members.get(a);
    for(const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }
  rootMembers(x){ return Array.from(this.members.get(this.find(x)) || []); }
}

/* splitCluster enforces max cluster size (<=4) using local pairwise edges */
function splitCluster(rowsSubset, minInternal=0.5, opts){
  if(rowsSubset.length <= 4) return [rowsSubset];
  const localEdges = [];
  for(let i=0;i<rowsSubset.length;i++){
    for(let j=i+1;j<rowsSubset.length;j++){
      const { score } = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
      if(score >= minInternal) localEdges.push({ a:i, b:j, score });
    }
  }
  localEdges.sort((a,b)=>b.score-a.score);
  const uf = new UF(rowsSubset.length);
  for(const e of localEdges){
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if(ra===rb) continue;
    if(uf.size[ra] + uf.size[rb] <= 4) uf.merge(ra, rb);
  }
  const groups = new Map();
  for(let i=0;i<rowsSubset.length;i++){ const r = uf.find(i); const arr = groups.get(r) || []; arr.push(i); groups.set(r,arr); }
  const result = [];
  for(const idxs of groups.values()){
    const subset = idxs.map(i=>rowsSubset[i]);
    if(subset.length <= 4) result.push(subset);
    else result.push(...splitCluster(subset, Math.max(minInternal,0.45), opts));
  }
  return result;
}

/* runClustering - main function used by worker */
async function runClustering(rows, opts){
  rows.forEach((r,i)=> r._internalId = r._internalId || 'row_' + i);
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.54;
  const blockChunkSize = opts?.thresholds?.blockChunkSize ?? 3000;

  const edges = buildEdges(rows, minPair, { ...opts, blockChunkSize });

  postMessage({ type:'progress', status:'edges-built', progress:60, completed: edges.length, total: Math.max(1, rows.length) });

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClustersIdx = [];
  const edgesUsed = [];

  for(let ei=0; ei<edges.length; ei++){
    const e = edges[ei];
    if(finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if(ra===rb){ edgesUsed.push(e); continue; }
    const sizeA = uf.size[ra], sizeB = uf.size[rb];
    if(sizeA + sizeB <= 4){
      uf.merge(ra,rb); edgesUsed.push(e); continue;
    }

    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    if(combinedIdx.length > 500){
      for(let start=0; start<combinedIdx.length; start+=500){
        const chunkIdx = combinedIdx.slice(start, start+500);
        const chunkRows = chunkIdx.map(i=>rows[i]);
        const parts = splitCluster(chunkRows, minInternal, opts);
        for(const p of parts){
          const globalIdxs = p.map((r)=> chunkIdx.find(i=> rows[i]._internalId === r._internalId)).filter(i=> i!== undefined);
          if(globalIdxs.length) { finalClustersIdx.push(globalIdxs); globalIdxs.forEach(i=>finalized.add(i)); }
        }
      }
    } else {
      const combinedRows = combinedIdx.map(i=>rows[i]);
      const parts = splitCluster(combinedRows, minInternal, opts);
      for(const p of parts){
        const globalIdxs = [];
        for(const r of p){
          const idx = combinedIdx.find(i=> rows[i]._internalId === r._internalId);
          if(idx !== undefined){ globalIdxs.push(idx); finalized.add(idx); }
          else {
            const fallback = combinedIdx.find(i => (rows[i].womanName_normalized) === (r.womanName_normalized) || digitsOnly(rows[i].phone) === digitsOnly(r.phone));
            if(fallback !== undefined){ globalIdxs.push(fallback); finalized.add(fallback); }
          }
        }
        if(globalIdxs.length) finalClustersIdx.push(globalIdxs);
      }
    }
    edgesUsed.push(e);
    if(ei % 200 === 0) postMessage({ type:'progress', status:'merging-edges', progress: 60 + Math.round(20 * (ei/edges.length)), completed: ei+1, total: edges.length });
  }

  // leftovers
  const leftovers = new Map();
  for(let i=0;i<rows.length;i++){
    if(finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r,arr);
  }
  for(const arr of leftovers.values()){
    if(arr.length <= 4) finalClustersIdx.push(arr);
    else {
      const subRows = arr.map(i=>rows[i]);
      const parts = splitCluster(subRows, minInternal, opts);
      for(const p of parts){
        const idxs = p.map((pr)=> arr.find(i=> rows[i]._internalId === pr._internalId)).filter(x=> x !== undefined);
        if(idxs.length) finalClustersIdx.push(idxs);
      }
    }
  }

  // map to clusters of rows
  const clusters = finalClustersIdx.map(g => g.map(i => rows[i])).filter(c => c.length > 1);
  return { clusters, edgesUsed };
}

/* -------------------------
   Worker message handling
   ------------------------- */
let inbound = [];
let mapping = null;
let options = null;

function mapIncomingRowsToInternal(rows, mapping){
  return rows.map((r,i)=>{
    const mapped = { 
        _internalId: 'row_' + i, 
        womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: [],
        womanName_normalized: "", husbandName_normalized: "", village_normalized: "", subdistrict_normalized: "", children_normalized: [],
        cluster_id:"" 
    };
    for(const k in mapping){
      const col = mapping[k];
      if(col && r[col]!==undefined){
        mapped[k] = r[col];
        if (k === 'womanName' || k === 'husbandName' || k === 'village' || k === 'subdistrict') {
            mapped[k+'_normalized'] = normalizeArabic(r[col]);
        } else if (k === 'children') {
            mapped.children = normalizeChildrenField(r[col]);
            mapped.children_normalized = mapped.children.map(normalizeArabic);
        }
      }
    }
    return mapped;
  });
}


self.addEventListener('message', function(e){
  const msg = e.data;
  if(!msg || !msg.type) return;
  if(msg.type === 'start'){
    mapping = msg.payload.mapping || {};
    options = msg.payload.options || {};
    inbound = [];
    postMessage({ type:'progress', status:'worker-ready', progress:1 });
  } else if(msg.type === 'data'){
    inbound.push(...(msg.payload.rows || []));
    postMessage({ type:'progress', status:'receiving', progress: Math.min(5, 1 + Math.floor(inbound.length/1000)) });
  } else if(msg.type === 'end'){
    setTimeout(async ()=>{
      try{
        postMessage({ type:'progress', status:'mapping-rows', progress:5 });
        const rows = mapIncomingRowsToInternal(inbound, mapping);
        postMessage({ type:'progress', status:'starting-clustering', progress:8, completed:0, total: rows.length });
        const res = await runClustering(rows, options);
        postMessage({ type:'progress', status:'annotating', progress:95 });
        postMessage({ type:'done', clusters: res.clusters, edgesUsed: res.edgesUsed });
      } catch(err){
        postMessage({ type:'error', error: String(err && err.message ? err.message : err) });
      }
    }, 50);
  }
});
`;
}

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
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const rowsRef = useRef<any[]>([]);
  const workerRef = useRef<Worker|null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(()=>{
    // create module worker
    if(typeof window === "undefined") return;
    if(workerRef.current) return;
    try {
      const workerScript = createWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const w = new Worker(blobUrl);

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
          
          try {
            const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
            sessionStorage.setItem('cacheId', cacheId);
            
            const allRows = rowsRef.current.map((r,i)=> ({ ...r, _internalId: 'row_' + i }));
            
            // The entire dataset is now sent in one go to be cached.
            const dataToCache = {
                rows: allRows,
                clusters: resultClusters,
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
            toast({ title: "Clustering complete", description: `Found ` + resultClusters.length + ` clusters.` });
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
  }, [columns]); // Re-create worker if columns change, just in case.

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
        rowsRef.current = json;
        setColumns(Object.keys(json[0] || {}));
        const storageKey = LOCAL_STORAGE_KEY_PREFIX + Object.keys(json[0]||{}).join(',');
        const saved = localStorage.getItem(storageKey);
        if(saved) {
          try { setMapping(JSON.parse(saved)); } catch {}
        } else {
          setMapping({ womanName:"", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", cluster_id:"", beneficiaryId:"" });
        }
        setFileReadProgress(100);
    };
    reader.readAsArrayBuffer(f);
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
    let statusText = s.replace(/-/g, ' '); // a bit nicer looking
    statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
    
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `Status: ${statusText} (${progressInfo.completed}/${progressInfo.total})`;
    }
    return `Status: ${statusText}`;
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
                            <p className="text-xs text-muted-foreground">{rowsRef.current.length > 0 ? `${rowsRef.current.length} rows detected` : 'Reading file...'}</p>
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
        <Card>
          <CardHeader><CardTitle>2. Map Columns</CardTitle><CardDescription>Map your sheet columns to the required fields for analysis.</CardDescription></CardHeader>
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
        </Card>
      )}

      {file && isMappingComplete && (
        <Card>
          <CardHeader>
            <CardTitle>3. Run Clustering</CardTitle>
            <CardDescription>Start the AI-powered analysis to find potential duplicates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={startClustering} disabled={workerStatus === 'processing' || workerStatus === 'caching'}>
                {workerStatus === 'processing' || workerStatus === 'caching' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Clustering
              </Button>

              {(workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error') && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>{formattedStatus()}</span>
                    <span>{Math.round(progressInfo.progress)}%</span>
                  </div>
                  <Progress value={progressInfo.progress} />
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
