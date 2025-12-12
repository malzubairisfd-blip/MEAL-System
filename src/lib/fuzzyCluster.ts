
// lib/fuzzyCluster.ts

// This file is now deprecated for client-side clustering.
// The core logic has been moved into the self-contained worker script.
// We keep type definitions and server-side utilities here.

export type RecordRow = {
  _internalId?: string;
  beneficiaryId?: string;
  nationalId?: string;
  phone?: string;
  womanName?: string;
  husbandName?: string;
  children?: string[] | string;
  village?: string;
  subdistrict?: string;
  womanName_normalized?: string;
  husbandName_normalized?: string;
  village_normalized?: string;
  subdistrict_normalized?: string;
  children_normalized?: string[];
  [k: string]: any;
};

/* -----------------------------------------
   ARABIC NORMALIZATION
------------------------------------------ */
function normalizeArabicRaw(s?: string): string {
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

function tokens(s?: string) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

function jaroWinkler(a?: string, b?: string): number {
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

function tokenJaccard(aTokens?: string[], bTokens?: string[]): number {
  aTokens = aTokens || [];
  bTokens = bTokens || [];
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}


// This function remains for server-side pairwise scoring (e.g. in modals)
export function similarityScoreDetailed(a: RecordRow, b: RecordRow) {
    // A simplified version of the worker's pairwise score for server use
    const breakdown = {
        nameScore: jaroWinkler(a.womanName_normalized, b.womanName_normalized),
        husbandScore: jaroWinkler(a.husbandName_normalized, b.husbandName_normalized),
        idScore: (a.nationalId && b.nationalId && String(a.nationalId) === String(b.nationalId)) ? 1 : 0,
        phoneScore: (a.phone && b.phone && String(a.phone).slice(-6) === String(b.phone).slice(-6)) ? 1 : 0,
        locationScore: jaroWinkler(a.village_normalized, b.village_normalized),
        childrenScore: tokenJaccard(a.children_normalized, b.children_normalized),
    };
    
    const score = 
        0.40 * breakdown.nameScore +
        0.25 * breakdown.husbandScore +
        0.15 * breakdown.idScore +
        0.10 * breakdown.phoneScore +
        0.05 * breakdown.locationScore +
        0.05 * breakdown.childrenScore;

    return { score, breakdown };
}


// This function remains for server-side pairwise scoring (e.g. in modals)
export function fullPairwiseBreakdown(records: RecordRow[]) {
  const out: any[] = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const { score, breakdown } = similarityScoreDetailed(a, b);

      out.push({ a, b, score, breakdown });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}
