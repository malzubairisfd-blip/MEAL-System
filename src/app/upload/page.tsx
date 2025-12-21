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
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";

function createWorkerScript() {
  return `
// WorkerScript v10 — Resumable Cursor-based Clustering
// Use as a web worker. Listens for messages: {type:'start', payload:{...}}, {type:'data', payload:{...}}, {type:'end'}, {type:'resume'}
// Emits progress and final payload: postMessage({ type:'done', payload:{...} })

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s) {
  if (!s) return "";
  try { s = String(s); } catch { s = "";}
  s = s.normalize("NFKC");
  s = s.replace(/يحيي/g, "يحي");
  s = s.replace(/يحيى/g, "يحي");
  s = s.replace(/عبد /g, "عبد");
  s = s.replace(/[ًٌٍََُِّْـء]/g, "");
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

function yieldToEventLoop() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
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
   ------------------------- */
function splitParts(name) {
  if (!name) return [];
  return tokens(name);
}

function compareNameComponents(aName, bName) {
  // returns { partsA, partsB, partScores: [..], orderFree }
  const A = splitParts(aName);
  const B = splitParts(bName);
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
   Additional Rules
   ------------------------- */
function applyAdditionalRules(a, b, opts) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a.womanName_normalized || "");
  const B = splitParts(b.womanName_normalized || "");
  const HA = splitParts(a.husbandName_normalized || "");
  const HB = splitParts(b.husbandName_normalized || "");
  const reasons = [];

  // RULE 0: strong token match (80%+ tokens overlap)
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.80) {
      reasons.push("TOKEN_REORDER");
      return { score: Math.min(1, minPair + 0.22), reasons };
    }
  }

  /* ----------------------------------------------------
     RULE 6 — STRONG HOUSEHOLD + CHILDREN MATCH (CRITICAL)
  ---------------------------------------------------- */
  {
    const A_parts = splitParts(a.womanName_normalized);
    const B_parts = splitParts(b.womanName_normalized);

    const firstNameMatch =
      A_parts.length > 0 && B_parts.length > 0 && jw(A_parts[0], B_parts[0]) >= 0.93;

    const husbandStrong =
      jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.90 ||
      nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized) >= 0.90;

    const childrenMatch =
      tokenJaccard(
        a.children_normalized || [],
        b.children_normalized || []
      ) >= 0.90;

    if (firstNameMatch && husbandStrong && childrenMatch) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: minPair + 0.25, reasons }; // HARD FORCE DUPLICATE
    }
  }

  const s93 = (x, y) => jw(x || "", y || "") >= 0.93;
  const s95 = (x, y) => jw(x || "", y || "") >= 0.95;

  const getPart = (arr, idx) => (arr && arr.length > idx) ? arr[idx] : "";

  const F1 = getPart(A, 0), Fa1 = getPart(A, 1), G1 = getPart(A, 2), L1 = getPart(A, 3);
  const F2 = getPart(B, 0), Fa2 = getPart(B, 1), G2 = getPart(B, 2), L2 = getPart(B, 3);

  const HF1 = getPart(HA, 0);
  const HF2 = getPart(HB, 0);
  
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
    if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }

  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
    if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
      if (jw(HF1, HF2) < 0.7) {
          reasons.push("WOMAN_LINEAGE_MATCH");
          return { score: Math.min(1, minPair + 0.17), reasons };
      }
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2)) {
      if (s93(Fa1, Fa2) && !s93(G1, G2)) {
          reasons.push("DUPLICATED_HUSBAND_LINEAGE");
          return { score: Math.min(1, minPair + 0.20), reasons };
      }
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2)) {
      if (jw(HF1, HF2) < 0.7) {
          reasons.push("WOMAN_LINEAGE_MATCH");
          return { score: Math.min(1, minPair + 0.16), reasons };
      }
    }
  }

  /* ============================================================
     RULE — DOMINANT LINEAGE MATCH (WOMAN + HUSBAND)
     ============================================================ */
  {
    if (A.length >= 3 && B.length >= 3 && HA.length >= 3 && HB.length >= 3) {
      const womanFatherOK = jw(A[1], B[1]) >= 0.93;
      const womanGrandOK = jw(A[2], B[2]) >= 0.93;
      const womanFamilyOK = jw(A[A.length - 1], B[B.length - 1]) >= 0.90;
      const womanLineageStrong = womanFatherOK && womanGrandOK && womanFamilyOK;
      const husbandFirstOK  = jw(HA[0], HB[0]) >= 0.93;
      const husbandFatherOK = jw(HA[1], HB[1]) >= 0.93;
      const husbandGrandOK  = jw(HA[2], HB[2]) >= 0.93;
      const husbandFamilyOK = jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.90;
      const husbandIsSamePerson = husbandFirstOK && husbandFatherOK && husbandGrandOK && husbandFamilyOK;
      const womanFirstSupport = jw(A[0], B[0]) >= 0.55 || jw(A[0], B[0]) === 0;

      if (womanLineageStrong && husbandIsSamePerson && womanFirstSupport) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: Math.min(1, minPair + 0.23), reasons };
      }
    }
  }

  return null;
}

/* -------------------------
   pairwiseScore: tiered approach
   ------------------------- */
function pairwiseScore(aRaw, bRaw, opts) {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.06,
      locationScore: 0.04
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

  const a = {
    womanName: aRaw.womanName || "", husbandName: aRaw.husbandName || "", nationalId: String(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(aRaw.phone || ""), village: aRaw.village || "", subdistrict: aRaw.subdistrict || "", children: aRaw.children || []
  };
  const b = {
    womanName: bRaw.womanName || "", husbandName: bRaw.husbandName || "", nationalId: String(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(bRaw.phone || ""), village: bRaw.village || "", subdistrict: bRaw.subdistrict || "", children: bRaw.children || []
  };

  a.womanName_normalized = normalizeArabicRaw(a.womanName);
  b.womanName_normalized = normalizeArabicRaw(b.womanName);
  a.husbandName_normalized = normalizeArabicRaw(a.husbandName);
  b.husbandName_normalized = normalizeArabicRaw(b.husbandName);
  a.village_normalized = normalizeArabicRaw(a.village);
  b.village_normalized = normalizeArabicRaw(b.village);
  a.children_normalized = (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
  b.children_normalized = (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);

  if (a.nationalId && b.nationalId && a.nationalId === b.nationalId) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" }, reasons: ["EXACT_ID"] };
  }

  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const aParts = splitParts(a.womanName_normalized), bParts = splitParts(b.womanName_normalized);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" }, reasons: ["POLYGAMY_PATTERN"] };
  }

  const ruleResult = applyAdditionalRules(a, b, o);
  if (ruleResult) {
    return { score: Math.min(1, ruleResult.score), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleResult.score }, reasons: ruleResult.reasons };
  }

  const A = splitParts(a.womanName_normalized), B = splitParts(b.womanName_normalized);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");
  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = s => splitParts(s).map(t => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized), rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
  const husbandScore = Math.max(jaroWinkler(a.husbandName_normalized, b.husbandName_normalized), nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized));
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children_normalized || [], b.children_normalized || []);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const W = o.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore +
              (W.phoneScore || 0) * phoneScoreVal + (W.childrenScore || 0) * childrenScore +
              (W.locationScore || 0) * locationScore;

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  
  const reasons = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");

  return { score, breakdown, reasons };
}

/* --------------------------------------
   Resumable Edge Building Logic
   -------------------------------------- */
function pairIndexToIJ(k, n) {
  const i = Math.floor(
    n - 2 - Math.floor(Math.sqrt(-8 * k + 4 * n * (n - 1) - 7) / 2 - 0.5)
  );
  const j = k - ((n - 1 - i) * (n - 2 - i)) / 2 + i + 1;
  return [i, j];
}

async function buildEdges(rows, minScore = 0.62, opts, resumeState = null) {
  const n = rows.length;
  if (n <= 1) return [];

  const totalPairs = (n * (n - 1)) / 2;
  const edges = [];
  
  let i = resumeState?.i ?? 0;
  let j = resumeState?.j ?? i + 1;
  let processed = 0; // Simple counter for reporting

  for (; i < n; i++) {
    for (; j < n; j++) {
      const result = pairwiseScore(rows[i], rows[j], opts);
      const score = result.score ?? 0;
      if (score >= minScore) {
        edges.push({ a: i, b: j, score, reasons: result.reasons || [] });
      }
      
      processed++;

      if (processed % 5000 === 0) {
        postMessage({
          type: "progress",
          status: "building-edges",
          progress: 10 + Math.round(40 * (processed / totalPairs)),
          completed: processed,
          total: totalPairs
        });

        postMessage({
          type: "save_progress",
          key: progressKey,
          value: { i, j }
        });

        await yieldToEventLoop();
      }
    }
    j = i + 2; // Next iteration of outer loop starts j at i+1. But inner loop increments `j` first.
  }

  postMessage({ type: "progress", status: "edges-built", progress: 50, completed: totalPairs, total: totalPairs });
  postMessage({ type: 'save_progress', key: progressKey, value: null }); // Mark as complete by clearing progress
  
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
    if (rowsSubset.length <= 1) return []; // Return empty if not a potential cluster
    if (rowsSubset.length <= 4) {
        const localEdges = [];
        for (let i = 0; i < rowsSubset.length; i++) {
            for (let j = i + 1; j < rowsSubset.length; j++) {
                const r = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
                if ((r.score || 0) >= minInternal) localEdges.push({ score: r.score, reasons: r.reasons || [], breakdown: r.breakdown });
            }
        }
        const reasons = Array.from(new Set(localEdges.flatMap(e => e.reasons)));
        const pairScores = localEdges.map(e => ({ finalScore: e.score, womanNameScore: e.breakdown.firstNameScore, husbandNameScore: e.breakdown.husbandScore }));
        return [{ records: rowsSubset, reasons, pairScores }];
    }

    const localEdges = [];
    for (let i = 0; i < rowsSubset.length; i++) {
        for (let j = i + 1; j < rowsSubset.length; j++) {
            const r = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
            if ((r.score || 0) >= minInternal) localEdges.push({ a: i, b: j, score: r.score, reasons: r.reasons || [], breakdown: r.breakdown });
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
        if (idxs.length <= 1) continue; // Ignore single-record groups
        const subset = idxs.map(i => rowsSubset[i]);
        const subEdges = localEdges.filter(e => idxs.includes(e.a) && idxs.includes(e.b));
        const reasons = Array.from(new Set(subEdges.flatMap(e => e.reasons)));
        const pairScores = subEdges.map(e => ({ finalScore: e.score, womanNameScore: e.breakdown.firstNameScore, husbandNameScore: e.breakdown.husbandScore }));

        if (subset.length <= 4) {
            result.push({ records: subset, reasons, pairScores });
        } else {
            result.push(...splitCluster(subset, Math.max(minInternal, 0.45), opts));
        }
    }
    return result;
}


/* Main clustering pipeline */
async function runClustering(rows, opts, resumeState) {
  // ensure internal ids
  rows.forEach((r, i) => r._internalId = r._internalId || 'row_' + i);

  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.50;

  postMessage({ type: "progress", status: "blocking", progress: 5, completed: 0, total: rows.length });

  const edges = await buildEdges(rows, minPair, opts, resumeState);

  postMessage({ type: "progress", status: "edges-built", progress: 60, completed: edges.length, total: Math.max(1, rows.length) });

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClusters = [];
  const edgesUsed = [];
  const rootReasons = new Map();

  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    if (finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    
    const currentReasons = rootReasons.get(ra) || new Set();
    (e.reasons || []).forEach(r => currentReasons.add(r));
    rootReasons.set(ra, currentReasons);

    if (ra === rb) { edgesUsed.push(e); continue; }

    const otherReasons = rootReasons.get(rb) || new Set();
    (e.reasons || []).forEach(r => otherReasons.add(r));
    rootReasons.set(rb, otherReasons);

    if (uf.size[ra] + uf.size[rb] <= 4) {
      const mergedRoot = uf.merge(ra, rb);
      const allReasons = new Set([...(rootReasons.get(ra) || []), ...(rootReasons.get(rb) || [])]);
      rootReasons.set(mergedRoot, allReasons);
      edgesUsed.push(e);
      continue;
    }
    
    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    const combinedRows = combinedIdx.map(i => rows[i]);
    const parts = splitCluster(combinedRows, minInternal, opts);

    for (const p of parts) {
       if (p.records.length <= 1) continue;
       finalClusters.push(p);
       p.records.forEach(r => {
           const originalIndex = rows.findIndex(row => row._internalId === r._internalId);
           if (originalIndex !== -1) finalized.add(originalIndex);
       });
    }
    edgesUsed.push(e);
    if (ei % 200 === 0) {
        postMessage({ type: "progress", status: "merging-edges", progress: 60 + Math.round(35 * (ei / edges.length)), completed: ei + 1, total: edges.length });
        await yieldToEventLoop();
    }
  }

  // leftovers
  const leftovers = new Map();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r, arr);
  }
  for (const [root, arr] of leftovers.entries()) {
    if (arr.length <= 1) continue;
    const subRows = arr.map(i => rows[i]);
    const parts = splitCluster(subRows, minInternal, opts);
     for (const p of parts) {
        if (p.records.length > 1) {
            const allPartReasons = new Set([...p.reasons, ...(rootReasons.get(root) || [])]);
            p.reasons = Array.from(allPartReasons);
            finalClusters.push(p);
        }
    }
  }

  const clustersWithRecords = finalClusters
    .map(c => ({
        ...c,
        records: c.records.map(r => rows.find(row => row._internalId === r._internalId))
    }))
    .filter(c => c.records.length > 1);

  postMessage({ type: "progress", status: "annotating", progress: 95 });

  postMessage({ type: 'save_progress', key: progressKey, value: null });

  return { clusters: clustersWithRecords, edgesUsed, rows };
}

/* -------------------------
   Worker message handling
   ------------------------- */
let inbound = [];
let mapping = {};
let options = {};
let resumeState = null;
let progressKey = ''; // Holds the file-specific progress key

function mapIncomingRowsToInternal(rowsChunk, mapping) {
  return rowsChunk.map((originalRecord, i) => {
        const mapped = {
            ...originalRecord,
            _internalId: "row_" + (inbound.length + i),
            womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: [],
        };

        for (const key in mapping) {
            if (key === 'cluster_id') continue;
            
            const col = mapping[key];
            if (col && originalRecord[col] !== undefined) {
                mapped[key] = originalRecord[col];
            }
        }
        
        mapped.children = normalizeChildrenField(mapped.children);
        
        mapped.womanName_normalized = normalizeArabicRaw(mapped.womanName);
        mapped.husbandName_normalized = normalizeArabicRaw(mapped.husbandName);
        mapped.village_normalized = normalizeArabicRaw(mapped.village);
        mapped.subdistrict_normalized = normalizeArabicRaw(mapped.subdistrict);
        mapped.children_normalized = mapped.children.map(normalizeArabicRaw);

        return mapped;
    });
}

self.addEventListener('message', function (ev) {
  const msg = ev.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'start') {
    mapping = msg.payload.mapping || {};
    options = msg.payload.options || {};
    resumeState = msg.payload.resumeState || null;
    progressKey = msg.payload.progressKey || '';
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
        const result = await runClustering(inbound, options, resumeState);
        postMessage({ type: 'done', payload: { rows: result.rows, clusters: result.clusters, edgesUsed: result.edgesUsed } });
      } catch (err) {
        postMessage({ type: 'error', error: String(err && err.message ? err.message : err) });
      }
    }, 50);
  } else if (msg.type === 'resume') {
    resumeState = msg.payload;
    postMessage({ type: "status", message: "Resuming edge building…" });
  }
});
`;
}

type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const PROGRESS_KEY_PREFIX = "progress-";


type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }

export default function UploadPage(){
  const { t, isLoading: isTranslationLoading } = useTranslation();
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
  const workerRef = useRef<Worker|null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(()=>{
    if(typeof window === "undefined") return;

    const workerScript = createWorkerScript();
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const w = new Worker(blobUrl);

    workerRef.current = w;
    w.onmessage = async (ev) => {
      const msg = ev.data;
      if(!msg || !msg.type) return;
      
      if (msg.type === 'save_progress') {
          if (msg.value) {
            localStorage.setItem(msg.key, JSON.stringify(msg.value));
          } else {
            localStorage.removeItem(msg.key);
          }
          return;
      }

      if(msg.type === 'progress' || msg.type === 'status'){
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
          toast({ title: t('upload.toasts.clusteringComplete.title'), description: t('upload.toasts.clusteringComplete.description', {count: resultClusters.length}) });
        } catch(err:any){
          setWorkerStatus('error');
          toast({ title: t('upload.toasts.cacheError.title'), description: String(err), variant:"destructive" });
        }
      } else if(msg.type === 'error'){
        setWorkerStatus('error');
        toast({ title: t('upload.toasts.workerError.title'), description: msg.error || 'Unknown', variant:"destructive" });
      }
    };

    const handleVisibility = () => {
        if (document.visibilityState === "visible" && workerRef.current && file) {
            const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
            const progressKey = `${PROGRESS_KEY_PREFIX}${fileKey}`;
            const savedProgressRaw = localStorage.getItem(progressKey);
            if (savedProgressRaw) {
                try {
                    const savedProgress = JSON.parse(savedProgressRaw);
                    if(savedProgress) {
                       workerRef.current.postMessage({ type: "resume", payload: savedProgress });
                    }
                } catch {}
            }
        }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if(workerRef.current){ workerRef.current.terminate(); workerRef.current = null; }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, t, file]);

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
        rawRowsRef.current = json;
        const fileColumns = Object.keys(json[0] || {});
        setColumns(fileColumns);
        
        const storageKey = LOCAL_STORAGE_KEY_PREFIX + fileColumns.join(',');
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

  async function startClustering(){
    if(!workerRef.current) { toast({ title: t('upload.toasts.workerNotReady') }); return; }
    if(!rawRowsRef.current.length){ toast({ title: t('upload.toasts.noData') }); return; }
    if(!isMappingComplete){ toast({ title: t('upload.toasts.mappingIncomplete'), variant:"destructive"}); return; }
    if(!file) { toast({ title: "No file selected." }); return; }


    setIsMappingOpen(false);
    setWorkerStatus('processing'); setProgressInfo({ status:'processing', progress:1 });

    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    const progressKey = `${PROGRESS_KEY_PREFIX}${fileKey}`;
    const savedProgressRaw = localStorage.getItem(progressKey);
    let resumeState = null;
    if (savedProgressRaw) {
        try {
            resumeState = JSON.parse(savedProgressRaw);
        } catch {}
    }

    let settings = {};
    try {
      const res = await fetch("/api/settings");
      const d = await res.json();
      if(d.ok) settings = d.settings || {};
    } catch(_) {}

    workerRef.current!.postMessage({ 
      type:'start', 
      payload: { 
        mapping, 
        options: settings, 
        resumeState: resumeState,
        progressKey: progressKey
      } 
    });

    const CHUNK = 2000;
    for(let i=0;i<rawRowsRef.current.length;i+=CHUNK){
      const chunk = rawRowsRef.current.slice(i,i+CHUNK);
      workerRef.current!.postMessage({ type:'data', payload:{ rows: chunk, total: rawRowsRef.current.length } });
      await new Promise(r => setTimeout(r, 8));
    }
    workerRef.current!.postMessage({ type:'end' });
  }

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    let statusText = isTranslationLoading ? "" : t(`upload.status.${s}`);
    
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `${t('upload.status.label')}: ${statusText} (${progressInfo.completed}/${progressInfo.total})`;
    }
    return `${t('upload.status.label')}: ${statusText}`;
  };
  
    const SummaryCard = ({ icon, title, value, total }: { icon: React.ReactNode, title: string, value: string | number, total?: number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {total !== undefined && <p className="text-xs text-muted-foreground">{t('upload.results.outOf')} {total}</p>}
      </CardContent>
    </Card>
  );

  const getButtonText = () => {
     if(isTranslationLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
     switch (workerStatus) {
      case 'processing':
      case 'blocking':
      case 'building-edges':
      case 'merging-edges':
      case 'annotating':
        return t('upload.buttons.processing');
      case 'caching':
        return t('upload.buttons.caching');
      case 'done':
        return t('upload.buttons.done');
      case 'error':
        return t('upload.buttons.error');
      default:
        return t('upload.buttons.idle');
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.1.title')}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.1.description')}</CardDescription>
          </div>
          <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {isTranslationLoading ? <Skeleton className="h-5 w-20"/> : t('upload.buttons.settings')}
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
                            <p className="text-xs text-muted-foreground">{rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} ${t('upload.file.rowsDetected')}` : t('upload.file.reading')}</p>
                          </>
                        ) : (
                          <>
                           <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">{t('upload.file.clickToUpload')}</span> {t('upload.file.orDragAndDrop')}</p>
                           <p className="text-xs text-muted-foreground">{t('upload.file.fileTypes')}</p>
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
                }} variant="outline">{t('upload.buttons.reset')}</Button>
            )}
          </div>
          {file && fileReadProgress > 0 && fileReadProgress < 100 && (
            <div className="mt-4">
              <Label>{t('upload.file.reading')}</Label>
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
                  <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.2.title')}</CardTitle>
                  <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.2.description')}</CardDescription>
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
                            {mapping[field as keyof Mapping] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{t(`upload.mappingFields.${field}`)}{REQUIRED_MAPPING_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field as keyof Mapping]} onValueChange={(v)=> handleMappingChange(field as keyof Mapping, v)} className="p-4 grid grid-cols-2 gap-2">
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

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.3.title')}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.3.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={startClustering} 
                disabled={!isMappingComplete || (workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error')}
              >
                {(workerStatus === 'processing' || workerStatus === 'caching' || workerStatus === 'building-edges' || workerStatus === 'merging-edges' || workerStatus === 'annotating' || workerStatus === 'blocking') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
          <CardHeader><CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48"/> : t('upload.steps.4.title')}</CardTitle><CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1"/> : t('upload.steps.4.description')}</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.totalRecords')} value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusteredRecords')} value={clusters.flatMap(c => (c as any).records).length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.unclusteredRecords')} value={rawRowsRef.current.length - clusters.flatMap(c => (c as any).records).length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.clusterCount')} value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title={t('upload.results.avgClusterSize')} value={clusters.length > 0 ? (clusters.flatMap(c => (c as any).records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>{t('upload.buttons.goToReview')} <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
