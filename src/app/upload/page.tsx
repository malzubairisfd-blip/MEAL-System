

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
// WorkerScript v7 — fuzzy clustering (self-contained)
// Use as a web worker. Listens for messages: {type:'start', payload:{mapping, options}}, {type:'data', payload:{rows}}, {type:'end'}
// Emits progress and final payload: postMessage({ type:'done', payload:{ rows, clusters, edgesUsed } })

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s) {
  if (!s) return "";
  try { s = String(s); } catch { s = "";}
  s = s.normalize("NFKC");
  // basic Arabic normalization and common equivalences
  s = s.replace(/[ًٌٍَُِْـ]/g, ""); // diacritics
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/گ/g, "ك");
  s = s.replace(/[^ء-ي0-9a-zA-Z\\s]/g, " "); // keep Arabic letters, numbers, ascii, spaces
  s = s.replace(/\\s+/g, " ").trim();
  return s.toLowerCase();
}

function tokens(s) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\\s+/).filter(Boolean);
}

function digitsOnly(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\\D/g, "");
}

function normalizeChildrenField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aM = Array(la).fill(false), bM = Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bM[j]) continue;
      if (a[i] !== b[j]) continue;
      aM[i] = true; bM[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let k = 0, trans = 0;
  for (let i = 0; i < la; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }
  trans = trans / 2;
  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;
  let prefix = 0, maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenJaccard(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName, bName) {
  const aT = tokens(aName), bT = tokens(bName);
  if (!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
}

/* -------------------------
   Component compare
   - splits combined woman+husband into parts and compares part-by-part
   ------------------------- */
function splitParts(name) {
  if (!name) return [];
  return tokens(name);
}

function compareNameComponents(aName, bName) {
  // returns { partsA, partsB, partScores: [..], orderFree }
  const A = splitParts(aName);
  const B = splitParts(bName);
  const minLen = Math.min(A.length, B.length);
  const partScores = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const pA = A[i] || "";
    const pB = B[i] || "";
    partScores.push(jaroWinkler(pA, pB));
  }
  const orderFree = nameOrderFreeScore(aName, bName);
  return { partsA: A, partsB: B, partScores, orderFree };
}

/* -------------------------
   Additional Rules (0..5) - includes your 5 rules and token-based rule
   Returns boosted score (>= minPair) or null
   ------------------------- */
function applyAdditionalRules(a, b, opts) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a.womanName_normalized || "");
  const B = splitParts(b.womanName_normalized || "");
  const HA = splitParts(a.husbandName_normalized || "");
  const HB = splitParts(b.husbandName_normalized || "");

  // RULE 0: strong token match (80%+ tokens overlap)
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.80) return Math.min(1, minPair + 0.22);
  }

  // Helper thresholds
  const s90 = (x, y) => jw(x || "", y || "") >= 0.90;
  const s93 = (x, y) => jw(x || "", y || "") >= 0.93;
  const s95 = (x, y) => jw(x || "", y || "") >= 0.95;

  // Normalize accessors for first, father, grandfather, 4th/last
  const getPart = (arr, idx) => (arr && arr.length > idx) ? arr[idx] : "";

  const F1 = getPart(A, 0), Fa1 = getPart(A, 1), G1 = getPart(A, 2), L1 = getPart(A, 3);
  const F2 = getPart(B, 0), Fa2 = getPart(B, 1), G2 = getPart(B, 2), L2 = getPart(B, 3);

  const HF1 = getPart(HA, 0), HFa1 = getPart(HA, 1), HG1 = getPart(HA, 2);
  const HF2 = getPart(HB, 0), HFa2 = getPart(HB, 1), HG2 = getPart(HB, 2);

  // RULE 1:
  // If first/father/grandfather >= 93% and 4th/last differs, and husbands different => boost
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
    // ensure husbands are not similar (different husbands)
    if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.18);
  }

  // RULE 2:
  // first 93%+, father/grandfather 93%+, lastname high similar (few chars diff), husbands different
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
    if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.18);
  }

  // RULE 3:
  // 4 vs 5 parts (length mismatch acceptable) with first 93+, same father & grandfather, lastname 93+ similar, different husbands
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
      if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.17);
    }
  }

  // RULE 4:
  // 4 vs 5 parts, first >=95%, same father but different grandfather and lastname.
  // Husband names 95%+ in first name, father different, grandfather differ, lastname 93+ same
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2)) {
      // father same?
      if (s93(Fa1, Fa2) && !s93(G1, G2)) {
        return Math.min(1, minPair + 0.20);
      }
    }
  }

  // RULE 5:
  // 4 vs 5 parts, first/father/grandfather 93+ similar, husbands different parts but first/father/grandfather 93+ => boost
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2)) {
      // if husbands differ in many parts (different husband tokens)
      if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.16);
    }
  }

  return null;
}

/* -------------------------
   pairwiseScore: tiered approach
   1) High confidence (exact id or strong polygamy)
   2) Component-based weighted score
   3) Fallback order-free / token rules
   ------------------------- */
function pairwiseScore(aRaw, bRaw, opts) {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.10,
      phoneScore: 0.05,
      childrenScore: 0.03,
      locationScore: 0.08
    },
    thresholds: {
      minPair: 0.62,
      minInternal: 0.50,
      blockChunkSize: 3000
    },
    rules: {
      enablePolygamyRules: true
    }
  };
  const o = Object.assign({}, optsDefaults, opts || {});
  o.finalScoreWeights = Object.assign({}, optsDefaults.finalScoreWeights, (opts && opts.finalScoreWeights) || {});
  o.thresholds = Object.assign({}, optsDefaults.thresholds, (opts && opts.thresholds) || {});
  o.rules = Object.assign({}, optsDefaults.rules, (opts && opts.rules) || {});

  // Map and normalize fields
  const a = {
    womanName: aRaw.womanName || "",
    husbandName: aRaw.husbandName || "",
    nationalId: String(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(aRaw.phone || ""),
    village: aRaw.village || "",
    subdistrict: aRaw.subdistrict || "",
    children: aRaw.children || []
  };
  const b = {
    womanName: bRaw.womanName || "",
    husbandName: bRaw.husbandName || "",
    nationalId: String(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(bRaw.phone || ""),
    village: bRaw.village || "",
    subdistrict: bRaw.subdistrict || "",
    children: bRaw.children || []
  };

  // normalized helper fields
  a.womanName_normalized = normalizeArabicRaw(a.womanName);
  b.womanName_normalized = normalizeArabicRaw(b.womanName);
  a.husbandName_normalized = normalizeArabicRaw(a.husbandName);
  b.husbandName_normalized = normalizeArabicRaw(b.husbandName);
  a.village_normalized = normalizeArabicRaw(a.village);
  b.village_normalized = normalizeArabicRaw(b.village);
  a.children_normalized = (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
  b.children_normalized = (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);

  // --------------- Tier 1: High confidence rules ---------------
  // Exact national ID match => immediate high score
  if (a.nationalId && b.nationalId && a.nationalId === b.nationalId) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" } };
  }

  // Strong polygamy signal: same husband (very high) + shared paternal line => immediate high
  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const aParts = splitParts(a.womanName_normalized), bParts = splitParts(b.womanName_normalized);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" } };
  }

  // --------------- Additional rules (0..5) ---------------
  const ruleBoost = applyAdditionalRules(a, b, o);
  if (ruleBoost !== null) {
    return { score: Math.min(1, ruleBoost), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleBoost } };
  }

  // --------------- Tier 2: Component-based score ---------------
  // Compare first name, father, grandfather, rest
  const A = splitParts(a.womanName_normalized), B = splitParts(b.womanName_normalized);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    // root-like signature: first 3 chars of each token
    const root = s => splitParts(s).map(t => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized), rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    const jwroot = jaroWinkler(rA, rB);
    return Math.min(0.5, jwroot); // cap
  })();

  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);

  // husband similarity (score)
  const husbandScore = Math.max(jaroWinkler(a.husbandName_normalized, b.husbandName_normalized), nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized));

  // phone/id/children/location scores
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children_normalized || [], b.children_normalized || []);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  // Compose weighted score
  const W = o.finalScoreWeights;
  let score = 0;
  score += (W.firstNameScore || 0) * firstNameScore;
  score += (W.familyNameScore || 0) * familyNameScore;
  score += (W.advancedNameScore || 0) * advancedNameScore;
  score += (W.tokenReorderScore || 0) * tokenReorderScore;
  score += (W.husbandScore || 0) * husbandScore;
  score += (W.idScore || 0) * idScore;
  score += (W.phoneScore || 0) * phoneScoreVal;
  score += (W.childrenScore || 0) * childrenScore;
  score += (W.locationScore || 0) * locationScore;

  // Tier 3 fallback boosts: if many components are strong, boost slightly
  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = {
    firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore,
    husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore
  };

  return { score, breakdown };
}

/* -------------------------
   Blocking, edges, union-find, splitting
   ------------------------- */
function buildBlocks(rows, opts) {
  const blocks = new Map();
  const prefix = 3;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const wTokens = splitParts(r.womanName_normalized || "");
    const hTokens = splitParts(r.husbandName_normalized || "");
    const wFirst = wTokens[0] ? wTokens[0].slice(0, prefix) : "";
    const hFirst = hTokens[0] ? hTokens[0].slice(0, prefix) : "";
    const idLast4 = digitsOnly(r.nationalId || "").slice(-4) || "";
    const phoneLast4 = digitsOnly(r.phone || "").slice(-4) || "";
    const village = (r.village_normalized || "").slice(0, 6);

    const keys = new Set();
    if (wFirst && hFirst && idLast4 && phoneLast4) keys.add('full:' + wFirst + ':' + hFirst + ':' + idLast4 + ':' + phoneLast4);
    if (wFirst && phoneLast4) keys.add('wp:' + wFirst + ':' + phoneLast4);
    if (wFirst && idLast4) keys.add('wi:' + wFirst + ':' + idLast4);
    if (wFirst && hFirst) keys.add('wh:' + wFirst + ':' + hFirst);
    if (wFirst) keys.add('w:' + wFirst);
    if (village) keys.add('v:' + village);
    if (keys.size === 0) keys.add("blk:all");

    for (const k of keys) {
      const arr = blocks.get(k) || [];
      arr.push(i);
      blocks.set(k, arr);
    }
  }
  return Array.from(blocks.values());
}

function pushEdgesForList(list, rows, minScore, seen, edges, opts) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = pairwiseScore(rows[a], rows[b], opts);
      const score = result.score ?? 0;
      const breakdown = result.breakdown || {};
      if (score >= minScore) edges.push({ a, b, score, breakdown });
    }
  }
}

function buildEdges(rows, minScore = 0.62, opts) {
  const blocks = buildBlocks(rows, opts);
  const seen = new Set();
  const edges = [];
  const chunk = opts?.thresholds?.blockChunkSize ?? 3000;
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (block.length > chunk) {
      for (let s = 0; s < block.length; s += chunk) {
        const part = block.slice(s, s + chunk);
        pushEdgesForList(part, rows, minScore, seen, edges, opts);
      }
    } else {
      pushEdgesForList(block, rows, minScore, seen, edges, opts);
    }
    if (bi % 25 === 0 || bi === blocks.length - 1) {
      const pct = Math.round(10 + 40 * (bi / Math.max(1, blocks.length)));
      postMessage({ type: "progress", status: "building-edges", progress: pct, completed: bi + 1, total: blocks.length });
    }
  }
  edges.sort((x, y) => y.score - x.score);
  return edges;
}

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
    const mb = this.members.get(b), ma = this.members.get(a);
    for (const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }
  rootMembers(x) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}

/* Split cluster so each piece <= 4 */
function splitCluster(rowsSubset, minInternal = 0.50, opts) {
  if (rowsSubset.length <= 4) return [rowsSubset];
  const localEdges = [];
  for (let i = 0; i < rowsSubset.length; i++) {
    for (let j = i + 1; j < rowsSubset.length; j++) {
      const r = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
      if ((r.score || 0) >= minInternal) localEdges.push({ a: i, b: j, score: r.score });
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
    const arr = groups.get(r) || [];
    arr.push(i);
    groups.set(r, arr);
  }
  const result = [];
  for (const idxs of groups.values()) {
    const subset = idxs.map(i => rowsSubset[i]);
    if (subset.length <= 4) result.push(subset);
    else result.push(...splitCluster(subset, Math.max(minInternal, 0.45), opts));
  }
  return result;
}

/* Main clustering pipeline */
async function runClustering(rows, opts) {
  // ensure internal ids
  rows.forEach((r, i) => r._internalId = r._internalId || 'row_' + i);

  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.50;
  const blockChunkSize = opts?.thresholds?.blockChunkSize ?? 3000;

  postMessage({ type: "progress", status: "blocking", progress: 5, completed: 0, total: rows.length });

  const edges = buildEdges(rows, minPair, Object.assign({}, opts, { thresholds: { ...((opts && opts.thresholds) || {}), blockChunkSize } }));

  postMessage({ type: "progress", status: "edges-built", progress: 60, completed: edges.length, total: Math.max(1, rows.length) });

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClustersIdx = [];
  const edgesUsed = [];

  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    if (finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    if (ra === rb) { edgesUsed.push(e); continue; }
    const sizeA = uf.size[ra], sizeB = uf.size[rb];
    if (sizeA + sizeB <= 4) {
      uf.merge(ra, rb); edgesUsed.push(e); continue;
    }
    // need to split combined component
    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    if (combinedIdx.length > 500) {
      for (let s = 0; s < combinedIdx.length; s += 500) {
        const chunkIdx = combinedIdx.slice(s, s + 500);
        const chunkRows = chunkIdx.map(i => rows[i]);
        const parts = splitCluster(chunkRows, minInternal, opts);
        for (const p of parts) {
          const globalIdxs = p.map(r => chunkIdx.find(i => rows[i]._internalId === r._internalId)).filter(x => x !== undefined);
          if (globalIdxs.length) { finalClustersIdx.push(globalIdxs); globalIdxs.forEach(i => finalized.add(i)); }
        }
      }
    } else {
      const combinedRows = combinedIdx.map(i => rows[i]);
      const parts = splitCluster(combinedRows, minInternal, opts);
      for (const p of parts) {
        const globalIdxs = [];
        for (const r of p) {
          const idx = combinedIdx.find(i => rows[i]._internalId === r._internalId);
          if (idx !== undefined) { globalIdxs.push(idx); finalized.add(idx); }
          else {
            const fallback = combinedIdx.find(i => rows[i].womanName_normalized === r.womanName_normalized || digitsOnly(rows[i].phone) === digitsOnly(r.phone));
            if (fallback !== undefined) { globalIdxs.push(fallback); finalized.add(fallback); }
          }
        }
        if (globalIdxs.length) finalClustersIdx.push(globalIdxs);
      }
    }
    edgesUsed.push(e);
    if (ei % 200 === 0) postMessage({ type: "progress", status: "merging-edges", progress: 60 + Math.round(20 * (ei / edges.length)), completed: ei + 1, total: edges.length });
  }

  // leftovers
  const leftovers = new Map();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r, arr);
  }
  for (const arr of leftovers.values()) {
    if (arr.length <= 4) finalClustersIdx.push(arr);
    else {
      const subRows = arr.map(i => rows[i]);
      const parts = splitCluster(subRows, minInternal, opts);
      for (const p of parts) {
        const idxs = p.map(pr => arr.find(i => rows[i]._internalId === pr._internalId)).filter(x => x !== undefined);
        if (idxs.length) finalClustersIdx.push(idxs);
      }
    }
  }

  const clusters = finalClustersIdx.map(g => g.map(i => rows[i])).filter(c => c.length > 1);
  postMessage({ type: "progress", status: "annotating", progress: 95 });
  return { clusters, edgesUsed, rows };
}

/* -------------------------
   Worker message handling
   ------------------------- */
let inbound = [];
let mapping = {};
let options = {};

function mapIncomingRowsToInternal(rowsChunk, mapping) {
  return rowsChunk.map((orig, idx) => {
    const mapped = Object.assign({}, orig);
    // apply mapping keys if provided (mapping maps desired field -> column name)
    for (const k in mapping) {
      const col = mapping[k];
      if (col && orig[col] !== undefined) mapped[k] = orig[col];
    }
    // ensure fields exist
    mapped.womanName = mapped.womanName || mapped.woman || "";
    mapped.husbandName = mapped.husbandName || mapped.husband || "";
    mapped.nationalId = mapped.nationalId || mapped.id || "";
    mapped.phone = mapped.phone || "";
    mapped.village = mapped.village || "";
    mapped.subdistrict = mapped.subdistrict || "";
    mapped.children = mapped.children || [];
    // normalized versions
    mapped.womanName_normalized = normalizeArabicRaw(mapped.womanName);
    mapped.husbandName_normalized = normalizeArabicRaw(mapped.husbandName);
    mapped.village_normalized = normalizeArabicRaw(mapped.village);
    mapped.subdistrict_normalized = normalizeArabicRaw(mapped.subdistrict);
    mapped.children_normalized = (Array.isArray(mapped.children) ? mapped.children : normalizeChildrenField(mapped.children)).map(normalizeArabicRaw);
    mapped._internalId = mapped._internalId || "row_" + (inbound.length + idx);
    return mapped;
  });
}

self.addEventListener('message', function (ev) {
  const msg = ev.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'start') {
    mapping = msg.payload.mapping || {};
    options = msg.payload.options || {};
    inbound = [];
    postMessage({ type: 'progress', status: 'worker-ready', progress: 1 });
  } else if (msg.type === 'data') {
    const rows = Array.isArray(msg.payload.rows) ? msg.payload.rows : [];
    const mapped = mapIncomingRowsToInternal(rows, mapping);
    inbound.push(...mapped);
    postMessage({ type: 'progress', status: 'receiving', progress: Math.min(5, 1 + Math.floor(inbound.length / 1000)), completed: inbound.length, total: msg.payload.total || undefined });
  } else if (msg.type === 'end') {
    setTimeout(async () => {
      try {
        postMessage({ type: 'progress', status: 'mapping-rows', progress: 5, completed: 0, total: inbound.length });
        const result = await runClustering(inbound, options);
        postMessage({ type: 'done', payload: { rows: result.rows, clusters: result.clusters, edgesUsed: result.edgesUsed } });
      } catch (err) {
        postMessage({ type: 'error', error: String(err && err.message ? err.message : err) });
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
  const rawRowsRef = useRef<any[]>([]);
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
          const resultPayload = msg.payload || {};
          const resultClusters = resultPayload.clusters || [];
          setClusters(resultClusters);
          
          try {
            const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
            sessionStorage.setItem('cacheId', cacheId);
            
            const allRows = resultPayload.rows || [];
            
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
        rawRowsRef.current = json; // Store raw rows
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
    if(!rawRowsRef.current.length){ toast({ title: "Upload data first" }); return; }
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
    for(let i=0;i<rawRowsRef.current.length;i+=CHUNK){
      const chunk = rawRowsRef.current.slice(i,i+CHUNK);
      workerRef.current!.postMessage({ type:'data', payload:{ rows: chunk, total: rawRowsRef.current.length } });
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
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="Total Records" value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="Clustered Records" value={clusters.flat().length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="Unclustered Records" value={rawRowsRef.current.length - clusters.flat().length} />
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
