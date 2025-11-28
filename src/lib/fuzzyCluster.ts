// lib/fuzzyCluster.ts
// FINAL VERSION — COMPLETE — NO QUESTIONS NEEDED

import jarowinkler from "talisman/metrics/jaro-winkler";
import levenshtein from "fast-levenshtein";

export type RecordRow = {
  _internalId?: string;
  nationalId?: string;
  phone?: string;
  womanName?: string;
  husbandName?: string;
  children?: string[];
  village?: string;
  subdistrict?: string;
  [k: string]: any;
};

/* -----------------------------------------
   ARABIC NORMALIZATION
------------------------------------------ */
function normalizeArabic(s: string): string {
  if (!s) return "";
  s = s.normalize("NFKC");
  s = s.replace(/[ًٌٍََُِّْـ]/g, "");
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/[^ء-ي0-9 ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

function tokens(s?: string) {
  const n = normalizeArabic(s || "");
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

function digits(s?: string) {
  if (!s) return "";
  return String(s).replace(/\D/g, "");
}

/* -----------------------------------------
   FUZZY SCORE FUNCTIONS
------------------------------------------ */
function jaro(a: string, b: string) {
  return jarowinkler(a || "", b || "");
}

function lev(a: string, b: string) {
  const d = levenshtein.get(a || "", b || "");
  const maxLen = Math.max(1, a.length, b.length);
  return 1 - d / maxLen;
}

function tokenJaccard(a: string[], b: string[]) {
  if (!a.length && !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return inter / uni;
}

function phoneScore(a?: string, b?: string) {
  const A = digits(a);
  const B = digits(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.slice(-6) === B.slice(-6)) return 0.85;
  if (A.slice(-4) === B.slice(-4)) return 0.6;
  return 0;
}

/* -----------------------------------------
   PAIRWISE SCORE (THE HEART)
------------------------------------------ */
export function pairwiseScore(a: RecordRow, b: RecordRow) {
  const wA = normalizeArabic(a.womanName || "");
  const wB = normalizeArabic(b.womanName || "");

  const nameJW = jaro(wA, wB);
  const nameLev = lev(wA, wB);
  const perm = tokenJaccard(tokens(wA), tokens(wB));

  const hA = normalizeArabic(a.husbandName || "");
  const hB = normalizeArabic(b.husbandName || "");
  const hJW = jaro(hA, hB);
  const hPerm = tokenJaccard(tokens(hA), tokens(hB));

  const idMatch =
    a.nationalId && b.nationalId && String(a.nationalId) === String(b.nationalId)
      ? 1
      : 0;

  const phone = phoneScore(a.phone, b.phone);

  const loc =
    a.village &&
    b.village &&
    normalizeArabic(a.village) === normalizeArabic(b.village)
      ? 1
      : a.subdistrict &&
        b.subdistrict &&
        normalizeArabic(a.subdistrict) === normalizeArabic(b.subdistrict)
      ? 0.8
      : 0;

  const chA = (a.children || []).map(normalizeArabic);
  const chB = (b.children || []).map(normalizeArabic);
  const children = tokenJaccard(chA, chB);

  // WEIGHTS (TUNABLE)
  const score =
    0.30 * nameJW +
    0.05 * nameLev +
    0.12 * perm +
    0.25 * Math.max(hJW, hPerm) +
    0.14 * idMatch +
    0.08 * phone +
    0.03 * loc +
    0.08 * children;

  return {
    score: Math.max(0, Math.min(1, score)),
    breakdown: {
      nameJW,
      nameLev,
      perm,
      husbandJW: hJW,
      husbandPerm: hPerm,
      idMatch,
      phoneScore: phone,
      location: loc,
      children,
    },
  };
}

/* -----------------------------------------
   BLOCKING TO REDUCE COMPARISONS
------------------------------------------ */
function buildBlocks(rows: RecordRow[]) {
  const blocks = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const first = tokens(r.womanName)[0]?.slice(0, 4) || "";
    const last =
      tokens(r.womanName)[tokens(r.womanName).length - 1]?.slice(0, 4) || "";
    const phone = digits(r.phone).slice(0, 6);
    const village = normalizeArabic(r.village || "").slice(0, 6);

    const keys = [
      first ? `fn:${first}` : "",
      last ? `ln:${last}` : "",
      phone ? `ph:${phone}` : "",
      village ? `vl:${village}` : "",
    ].filter(Boolean);

    if (keys.length === 0) keys.push("blk:all");

    for (const k of keys) {
      if (!blocks.has(k)) blocks.set(k, []);
      blocks.get(k)!.push(i);
    }
  }

  return Array.from(blocks.values());
}

/* -----------------------------------------
   BUILD ALL EDGES
------------------------------------------ */
function buildEdges(rows: RecordRow[], minScore: number) {
  const blocks = buildBlocks(rows);
  const edges: any[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const a = block[i];
        const b = block[j];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { score, breakdown } = pairwiseScore(rows[a], rows[b]);
        if (score >= minScore) edges.push({ a, b, score, breakdown });
      }
    }
  }

  edges.sort((x, y) => y.score - x.score);
  return edges;
}

/* -----------------------------------------
   UNION-FIND
------------------------------------------ */
class UF {
  p: number[];
  size: number[];
  members: Map<number, Set<number>>;

  constructor(n: number) {
    this.p = Array(n)
      .fill(0)
      .map((_, i) => i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) this.members.set(i, new Set([i]));
  }

  find(x: number): number {
    if (this.p[x] === x) return x;
    return (this.p[x] = this.find(this.p[x]));
  }

  merge(a: number, b: number) {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return a;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.p[b] = a;
    this.size[a] += this.size[b];
    for (const m of this.members.get(b)!) this.members.get(a)!.add(m);
    this.members.delete(b);
    return a;
  }

  rootMembers(x: number) {
    return Array.from(this.members.get(this.find(x))!);
  }
}

/* -----------------------------------------
   RECURSIVELY SPLIT >4 GROUPS
------------------------------------------ */
function splitCluster(rows: RecordRow[], minInternal: number): RecordRow[][] {
  if (rows.length <= 4) return [rows];

  // build edges inside the cluster
  const edges: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const { score, breakdown } = pairwiseScore(rows[i], rows[j]);
      if (score >= minInternal) edges.push({ a: i, b: j, score, breakdown });
    }
  }
  edges.sort((x, y) => y.score - x.score);

  const uf = new UF(rows.length);

  for (const e of edges) {
    const ra = uf.find(e.a);
    const rb = uf.find(e.b);
    if (ra === rb) continue;
    const sizeA = uf.size[ra];
    const sizeB = uf.size[rb];
    if (sizeA + sizeB <= 4) {
      uf.merge(ra, rb);
    }
  }

  // collect groups
  const groupsMap = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const r = uf.find(i);
    if (!groupsMap.has(r)) groupsMap.set(r, []);
    groupsMap.get(r)!.push(i);
  }

  const result: RecordRow[][] = [];
  for (const idxs of groupsMap.values()) {
    const subset = idxs.map((i) => rows[i]);
    if (subset.length <= 4) result.push(subset);
    else result.push(...splitCluster(subset, minInternal));
  }

  return result;
}

/* -----------------------------------------
   MAIN FUNCTION
------------------------------------------ */
export async function runClustering(
  rows: RecordRow[],
  opts?: { minPairScore?: number; minInternalScore?: number }
) {
  rows.forEach((row, i) => {
    row._internalId = row._internalId || `row_${i}`;
  });

  const minPair = opts?.minPairScore ?? 0.60;
  const minInternal = opts?.minInternalScore ?? 0.50;

  const edges = buildEdges(rows, minPair);
  const uf = new UF(rows.length);

  const finalized = new Set<number>();
  const finalClusters: RecordRow[][] = [];
  const edgesUsed: any[] = [];

  for (const e of edges) {
    if (finalized.has(e.a) || finalized.has(e.b)) continue;

    const ra = uf.find(e.a);
    const rb = uf.find(e.b);

    if (ra === rb) {
      edgesUsed.push(e);
      continue;
    }

    const sizeA = uf.size[ra];
    const sizeB = uf.size[rb];

    // SAFE MERGE
    if (sizeA + sizeB <= 4) {
      uf.merge(ra, rb);
      edgesUsed.push(e);
      continue;
    }

    // NEED TO SPLIT AGAIN
    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    const combinedRows = combinedIdx.map((x) => rows[x]);

    const split = splitCluster(combinedRows, minInternal);

    for (const g of split) {
      const realIdxs: number[] = [];
      for (const r of g) {
        const idx = combinedIdx.find((x) => rows[x]._internalId === r._internalId);
        if (idx !== undefined) {
          realIdxs.push(idx);
          finalized.add(idx);
        }
      }
      finalClusters.push(realIdxs.map((x) => rows[x]));
    }

    edgesUsed.push(e);
  }

  // Remaining
  const leftovers = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    if (!leftovers.has(r)) leftovers.set(r, []);
    leftovers.get(r)!.push(i);
  }

  for (const arr of leftovers.values()) {
    if (arr.length <= 4) {
      finalClusters.push(arr.map((i) => rows[i]));
    } else {
      const subRows = arr.map((i) => rows[i]);
      const parts = splitCluster(subRows, minInternal);
      for (const p of parts) finalClusters.push(p);
    }
  }

  return {
    clusters: finalClusters.filter(c => c.length > 1),
    edgesUsed,
  };
}

export function similarityScoreDetailed(a: RecordRow, b: RecordRow) {
  const { score, breakdown: rawBreakdown } = pairwiseScore(a, b);
  const breakdown = {
    nameScore: 0.30 * rawBreakdown.nameJW + 0.05 * rawBreakdown.nameLev + 0.12 * rawBreakdown.perm,
    husbandScore: 0.25 * Math.max(rawBreakdown.husbandJW, rawBreakdown.husbandPerm),
    idScore: 0.14 * rawBreakdown.idMatch,
    phoneScore: 0.08 * rawBreakdown.phoneScore,
    locationScore: 0.03 * rawBreakdown.location,
    childrenScore: 0.08 * rawBreakdown.children,
  };
  return { score, breakdown };
}

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
