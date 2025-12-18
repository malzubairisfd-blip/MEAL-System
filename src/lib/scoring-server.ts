// src/lib/scoring-server.ts
import type { RecordRow } from "./types";

// This file contains server-side scoring logic, extracted to be used by APIs.
// It is a mirror of the logic inside the Web Worker.

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s: any): string {
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
  s = s.replace(/[^ء-ي0-9a-zA-Z\s]/g, " "); // keep Arabic letters, numbers, ascii, spaces
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

function tokens(s: string): string[] {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

function digitsOnly(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\D/g, "");
}

function normalizeChildrenField(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a: string, b: string): number {
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

function tokenJaccard(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName: string, bName: string): number {
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

function splitParts(name: string): string[] {
  if (!name) return [];
  return tokens(name);
}

/* -------------------------
   Main Pairwise Scoring Function
   ------------------------- */
export function similarityScoreDetailed(aRaw: RecordRow, bRaw: RecordRow, opts: any = {}) {
    const optsDefaults = {
      finalScoreWeights: {
        nameScore: 0.45,
        husbandScore: 0.35,
        idScore: 0.08,
        phoneScore: 0.05,
        childrenScore: 0.04,
        locationScore: 0.03
      }
    };
    const o = { ...optsDefaults, ...opts };
    o.finalScoreWeights = { ...optsDefaults.finalScoreWeights, ...(opts.finalScoreWeights || {}) };

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
    a.children_normalized = (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
    b.children_normalized = (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);

    const nameScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
    const husbandScore = nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized);
    const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
    const phoneScore = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : 0)) : 0;
    const childrenScore = tokenJaccard(a.children_normalized, b.children_normalized);
    let locationScore = 0;
    if (a.village && b.village && normalizeArabicRaw(a.village) === normalizeArabicRaw(b.village)) locationScore += 0.5;
    if (a.subdistrict && b.subdistrict && normalizeArabicRaw(a.subdistrict) === normalizeArabicRaw(b.subdistrict)) locationScore += 0.5;
    
    const W = o.finalScoreWeights;
    const score = (W.nameScore * nameScore) + (W.husbandScore * husbandScore) + (W.idScore * idScore) + (W.phoneScore * phoneScore) + (W.childrenScore * childrenScore) + (W.locationScore * locationScore);

    return {
        score: Math.min(1, score),
        breakdown: { nameScore, husbandScore, idScore, phoneScore, childrenScore, locationScore }
    };
}


export function fullPairwiseBreakdown(cluster: RecordRow[]): { a: RecordRow, b: RecordRow, score: number, breakdown: any }[] {
    const pairs = [];
    if (cluster.length < 2) return [];

    for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
            const result = similarityScoreDetailed(cluster[i], cluster[j]);
            pairs.push({
                a: cluster[i],
                b: cluster[j],
                score: result.score,
                breakdown: result.breakdown
            });
        }
    }
    return pairs;
}
