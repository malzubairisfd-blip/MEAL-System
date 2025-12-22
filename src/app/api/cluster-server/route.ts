
// src/app/api/cluster-server/route.ts
import { NextResponse } from 'next/server';

// Self-contained clustering engine, adapted for the server environment.
// All logic from the original, correct worker script is included here.

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

function yieldToEventLoop() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
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
   Additional Rules
   ------------------------- */
function applyAdditionalRules(a: any, b: any, opts: any) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a.womanName_normalized || "");
  const B = splitParts(b.womanName_normalized || "");
  const HA = splitParts(a.husbandName_normalized || "");
  const HB = splitParts(b.husbandName_normalized || "");
  const reasons: string[] = [];

    // RULE 6 — STRONG HOUSEHOLD + CHILDREN MATCH (CRITICAL)
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

  const s93 = (x: string, y: string) => jw(x || "", y || "") >= 0.93;
  const s95 = (x: string, y: string) => jw(x || "", y || "") >= 0.95;

  const getPart = (arr: string[], idx: number) => (arr && arr.length > idx) ? arr[idx] : "";

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
function pairwiseScore(aRaw: any, bRaw: any, opts: any) {
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
    thresholds: { minPair: 0.62, minInternal: 0.50, blockChunkSize: 3000 },
    rules: { enablePolygamyRules: true }
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
    const root = (s: string) => splitParts(s).map(t => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized), rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
  const husbandScore = Math.max(jaroWinkler(a.husbandName_normalized, b.husbandName_normalized), nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized));
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children_normalized, b.children_normalized);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const W = o.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore + (W.phoneScore || 0) * phoneScoreVal +
              (W.childrenScore || 0) * childrenScore + (W.locationScore || 0) * locationScore;

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  
  const reasons: string[] = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");

  return { score, breakdown, reasons };
}

/* -------------------------
   Blocking, edges, union-find, splitting
   ------------------------- */
function buildBlocks(rows: any[], opts: any) {
  const blocks = new Map<string, number[]>();
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

    const keys = new Set<string>();
    if (wFirst && hFirst && idLast4 && phoneLast4) keys.add("full:" + wFirst + ":" + hFirst + ":" + idLast4 + ":" + phoneLast4);
    if (wFirst && phoneLast4) keys.add("wp:" + wFirst + ":" + phoneLast4);
    if (wFirst && idLast4) keys.add("wi:" + wFirst + ":" + idLast4);
    if (wFirst && hFirst) keys.add("wh:" + wFirst + ":" + hFirst);
    if (hFirst) keys.add("h:" + hFirst);
    if (wFirst) keys.add("w:" + wFirst);
    if (village) keys.add("v:" + village);
    if (keys.size === 0) keys.add("blk:all");

    for (const k of keys) {
      const arr = blocks.get(k) || [];
      arr.push(i);
      blocks.set(k, arr);
    }
  }
  return Array.from(blocks.values());
}

function pushEdgesForList(list: number[], rows: any[], minScore: number, seen: Set<string>, edges: any[], opts: any) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = pairwiseScore(rows[a], rows[b], opts);
      const score = result.score ?? 0;
      if (score >= minScore) edges.push({ a, b, score, reasons: result.reasons || [] });
    }
  }
}

async function buildEdges(rows: any[], minScore = 0.62, opts: any, send: (data: any) => void) {
  const blocks = buildBlocks(rows, opts);
  const seen = new Set<string>();
  const edges: any[] = [];
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
    if (bi % 20 === 0 || bi === blocks.length - 1) {
      const pct = Math.round(10 + 40 * (bi / Math.max(1, blocks.length)));
      send({ type: "progress", status: "building-edges", progress: pct, completed: bi + 1, total: blocks.length });
      await yieldToEventLoop();
    }
  }
  send({ type: "progress", status: "edges-built", progress: 50, completed: blocks.length, total: blocks.length });
  edges.sort((x, y) => y.score - x.score);
  return edges;
}

class UF {
  parent: number[];
  size: number[];
  members: Map<number, Set<number>>;
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) this.members.set(i, new Set([i]));
  }
  find(x: number) {
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  merge(a: number, b: number) {
    a = this.find(a); b = this.find(b);
    if (a === b) return a;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const mb = this.members.get(b)!, ma = this.members.get(a)!;
    for (const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }
  rootMembers(x: number) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}

/* Split cluster so each piece <= 4 */
function splitCluster(rowsSubset: any[], minInternal = 0.50, opts: any) {
    if (rowsSubset.length <= 1) return [];
    if (rowsSubset.length <= 4) {
        const localEdges: any[] = [];
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

    const localEdges: any[] = [];
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

    const groups = new Map<number, number[]>();
    for (let i = 0; i < rowsSubset.length; i++) {
        const r = uf.find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r)!.push(i);
    }

    const result: any[] = [];
    for (const idxs of groups.values()) {
        if (idxs.length <= 1) continue;
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
async function runClustering(rows: any[], opts: any, send: (data: any) => void) {
  rows.forEach((r, i) => r._internalId = r._internalId || 'row_' + i);

  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.50;

  send({ type: "progress", status: "blocking", progress: 5, completed: 0, total: rows.length });

  const edges = await buildEdges(rows, minPair, opts, send);

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClusters: any[] = [];
  const edgesUsed: any[] = [];
  const rootReasons = new Map();

  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    if (finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    
    const currentReasons = rootReasons.get(ra) || new Set();
    (e.reasons || []).forEach((r: string) => currentReasons.add(r));
    rootReasons.set(ra, currentReasons);

    if (ra === rb) { edgesUsed.push(e); continue; }

    const otherReasons = rootReasons.get(rb) || new Set();
    (e.reasons || []).forEach((r: string) => otherReasons.add(r));
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
       p.records.forEach((r: any) => {
           const originalIndex = rows.findIndex(row => row._internalId === r._internalId);
           if (originalIndex !== -1) finalized.add(originalIndex);
       });
    }
    edgesUsed.push(e);
    if (ei % 200 === 0) {
      send({ type: "progress", status: "merging-edges", progress: 60 + Math.round(35 * (ei / edges.length)), completed: ei + 1, total: edges.length });
      await yieldToEventLoop();
    }
  }

  // leftovers
  const leftovers = new Map<number, number[]>();
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
        records: c.records.map((r: any) => rows.find(row => row._internalId === r._internalId))
    }))
    .filter(c => c.records.length > 1);

  send({ type: "progress", status: "annotating", progress: 95 });
  return { clusters: clustersWithRecords, edgesUsed, rows };
}


// Server-Sent Events (SSE) handler
export async function POST(req: Request) {
    try {
        const { rows, mapping, options } = await req.json();

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const send = (data: any) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (e) {
                        console.error("Error sending data to stream:", e);
                    }
                };

                try {
                    // Map rows on the server
                    const inbound = rows.map((originalRecord: any, i: number) => {
                        const mapped: any = {
                            ...originalRecord,
                            _internalId: "row_" + i,
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

                    send({ type: 'status', status: 'mapping-rows', progress: 5, completed: inbound.length, total: inbound.length });
                    
                    // Run the entire clustering process
                    const result = await runClustering(inbound, options, send);
                    
                    // Send the final result
                    send({ type: 'done', payload: result });

                } catch (error: any) {
                    console.error('Clustering error on server:', error);
                    send({ type: 'error', error: error.message });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch(e: any) {
         return NextResponse.json({ error: 'Failed to parse request body: ' + e.message }, { status: 400 });
    }
}
