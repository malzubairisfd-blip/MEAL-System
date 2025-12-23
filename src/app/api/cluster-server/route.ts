

import {NextResponse} from 'next/server';

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s: any) {
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

function tokens(s: any) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

function digitsOnly(s: any) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\D/g, "");
}

function normalizeChildrenField(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

function preprocessRows(rows: any[]) {
    for (const r of rows) {
        r._normWoman = normalizeArabicRaw(r.womanName || "");
        r._normHusband = normalizeArabicRaw(r.husbandName || "");
        r._normPhone = String(r.phone || "").replace(/\D/g, "");
        r._normId = String(r.nationalId || "").trim();
        r._normChildren = (Array.isArray(r.children) ? r.children : normalizeChildrenField(r.children)).map(normalizeArabicRaw);
        r._normVillage = normalizeArabicRaw(r.village || "");
        r._normSubdistrict = normalizeArabicRaw(r.subdistrict || "");
  }
}

function yieldToEventLoop() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}


/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a: any, b: any) {
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

function tokenJaccard(aTokens: any, bTokens: any) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName: any, bName: any) {
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
function splitParts(name: any) {
  if (!name) return [];
  return tokens(name);
}

/* -------------------------
   Additional Rules
   ------------------------- */
function applyAdditionalRules(a: any, b: any, opts: any) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a._normWoman || "");
  const B = splitParts(b._normWoman || "");
  const HA = splitParts(a._normHusband || "");
  const HB = splitParts(b._normHusband || "");
  const reasons: any[] = [];
  
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
    const A_parts = splitParts(a._normWoman);
    const B_parts = splitParts(b._normWoman);

    const firstNameMatch =
      A_parts.length > 0 && B_parts.length > 0 && jw(A_parts[0], B_parts[0]) >= 0.93;

    const husbandStrong =
      jw(a._normHusband, b._normHusband) >= 0.90 ||
      nameOrderFreeScore(a._normHusband, b._normHusband) >= 0.90;

    const childrenMatch =
      tokenJaccard(
        a._normChildren || [],
        b._normChildren || []
      ) >= 0.90;

    if (firstNameMatch && husbandStrong && childrenMatch) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: minPair + 0.25, reasons }; // HARD FORCE DUPLICATE
    }
  }


  const s93 = (x: any, y: any) => jw(x || "", y || "") >= 0.93;
  const s95 = (x: any, y: any) => jw(x || "", y || "") >= 0.95;

  const getPart = (arr: any, idx: any) => (arr && arr.length > idx) ? arr[idx] : "";

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

  const a = aRaw;
  const b = bRaw;

  if (a._normId && b._normId && a._normId === b._normId) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" }, reasons: ["EXACT_ID"] };
  }

  const husbandJW = jaroWinkler(a._normHusband, b._normHusband);
  const aParts = splitParts(a._normWoman), bParts = splitParts(b._normWoman);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" }, reasons: ["POLYGAMY_PATTERN"] };
  }

  const ruleResult = applyAdditionalRules(a, b, o);
  if (ruleResult) {
    return { score: Math.min(1, ruleResult.score), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleResult.score }, reasons: ruleResult.reasons };
  }

  const A = splitParts(a._normWoman), B = splitParts(b._normWoman);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");
  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = (s: any) => splitParts(s).map((t: any) => t.slice(0, 3)).join(" ");
    const rA = root(a._normWoman), rB = root(b._normWoman);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScore(a._normWoman, b._normWoman);
  const husbandScore = Math.max(jaroWinkler(a._normHusband, b._normHusband), nameOrderFreeScore(a._normHusband, b._normHusband));
  const phoneScoreVal = (a._normPhone && b._normPhone) ? (a._normPhone === b._normPhone ? 1 : (a._normPhone.slice(-6) === b._normPhone.slice(-6) ? 0.85 : (a._normPhone.slice(-4) === b._normPhone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a._normId && b._normId) ? (a._normId === b._normId ? 1 : (a._normId.slice(-5) === b._normId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a._normChildren, b._normChildren);
  let locationScore = 0;
  if (a._normVillage && b._normVillage && a._normVillage === b._normVillage) locationScore += 0.4;
  if (a._normSubdistrict && b._normSubdistrict && a._normSubdistrict === b._normSubdistrict) locationScore += 0.25;
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
  
  const reasons: any[] = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");

  return { score, breakdown, reasons };
}

/* --------------------------------------
   Resumable Edge Building Logic
   -------------------------------------- */
async function buildEdges(rows: any, minScore = 0.62, opts: any, resumeState: any = null, send: Function, progressKey: string) {
  const n = rows.length;
  if (n <= 1) return { edges: [], finalState: null };
  
  const totalPairs = (n * (n - 1)) / 2;
  const edges = resumeState?.edges || [];
  let processed = resumeState?.processed || 0;
  
  let i = resumeState?.i || 0;
  let j = resumeState?.j || i + 1;

  for (; i < n; i++) {
    for (; j < n; j++) {
      const result = pairwiseScore(rows[i], rows[j], opts);
      const score = result.score ?? 0;
      if (score >= minScore) {
        edges.push({ a: i, b: j, score, reasons: result.reasons || [] });
      }
      processed++;

      if (processed % 5000 === 0) {
        const progressState = { i, j: j + 1, edges, processed };
        send({
          type: "save_progress",
          key: progressKey,
          value: progressState
        });
        send({
          type: "progress",
          status: "building-edges",
          progress: 10 + Math.round(40 * (processed / totalPairs)),
          completed: processed,
          total: totalPairs
        });
        await yieldToEventLoop();
      }
    }
    j = i + 2;
  }
  
  send({ type: "progress", status: "edges-built", progress: 50, completed: totalPairs, total: totalPairs });
  send({ type: 'save_progress', key: progressKey, value: null });
  
  edges.sort((x, y) => y.score - x.score);
  return { edges, finalState: null };
}


class UF {
  parent: any;
  size: any;
  members: any;
  constructor(n: any) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) this.members.set(i, new Set([i]));
  }
  find(x: any) {
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  merge(a: any, b: any) {
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
  rootMembers(x: any) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}

/* Split cluster so each piece <= 4 */
function splitCluster(rowsSubset: any, minInternal = 0.50, opts: any) {
    if (rowsSubset.length <= 1) return []; // Return empty if not a potential cluster
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

    const groups = new Map();
    for (let i = 0; i < rowsSubset.length; i++) {
        const r = uf.find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(i);
    }

    const result: any[] = [];
    for (const idxs of groups.values()) {
        if (idxs.length <= 1) continue; // Ignore single-record groups
        const subset = idxs.map((i: any) => rowsSubset[i]);
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
async function runClustering(rows: any, opts: any, resumeState: any, send: Function, progressKey: string) {
  // ensure internal ids
  rows.forEach((r: any, i: any) => r._internalId = r._internalId || 'row_' + i);
  
  preprocessRows(rows);

  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.50;

  send({ type: "progress", status: "blocking", progress: 5, completed: 0, total: rows.length });

  const { edges } = await buildEdges(rows, minPair, opts, resumeState, send, progressKey);

  send({ type: "progress", status: "edges-built", progress: 60, completed: edges.length, total: Math.max(1, rows.length) });

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
    (e.reasons || []).forEach((r: any) => currentReasons.add(r));
    rootReasons.set(ra, currentReasons);

    if (ra === rb) { edgesUsed.push(e); continue; }

    const otherReasons = rootReasons.get(rb) || new Set();
    (e.reasons || []).forEach((r: any) => otherReasons.add(r));
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
           const originalIndex = rows.findIndex((row: any) => row._internalId === r._internalId);
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
  const leftovers = new Map();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r, arr);
  }
  for (const [root, arr] of leftovers.entries()) {
    if (arr.length <= 1) continue;
    const subRows = arr.map((i: any) => rows[i]);
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
        records: c.records.map((r: any) => rows.find((row: any) => row._internalId === r._internalId))
    }))
    .filter(c => c.records.length > 1);

  send({ type: "progress", status: "annotating", progress: 95 });

  const CHUNK_SIZE = 1000;
  function chunkArray(arr: any[], size: number) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
  }

  send({ type: "cache_rows", payload: rows });
  chunkArray(clustersWithRecords, CHUNK_SIZE).forEach((chunk, i) => {
      send({ type: "cache_clusters", index: i, payload: chunk });
  });
  chunkArray(edgesUsed, CHUNK_SIZE).forEach((chunk, i) => {
      send({ type: "cache_edges", index: i, payload: chunk });
  });
  send({ type: "cache_done" });
}


function mapIncomingRowsToInternal(rowsChunk: any, mapping: any, startIndex: number) {
  return rowsChunk.map((originalRecord: any, i: any) => {
        const mapped: any = {
            ...originalRecord,
            _internalId: "row_" + (startIndex + i),
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
        
        // This is deprecated by preprocessRows, but keeping for safety in case of partial refactors
        mapped.womanName_normalized = normalizeArabicRaw(mapped.womanName);
        mapped.husbandName_normalized = normalizeArabicRaw(mapped.husbandName);
        mapped.village_normalized = normalizeArabicRaw(mapped.village);
        mapped.subdistrict_normalized = normalizeArabicRaw(mapped.subdistrict);
        mapped.children_normalized = mapped.children.map(normalizeArabicRaw);

        return mapped;
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rows, mapping, options, resumeState, progressKey } = body;

        if (!rows || !Array.isArray(rows) || !mapping) {
            return NextResponse.json({ ok: false, error: 'Invalid request body. "rows" and "mapping" are required.' }, { status: 400 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const send = (data: any) => {
                    try {
                        const message = `data: ${JSON.stringify(data)}\n\n`;
                        controller.enqueue(encoder.encode(message));
                    } catch (e) {
                        // This can happen if the client disconnects.
                        console.error("Failed to enqueue message:", e);
                    }
                };

                try {
                    send({ type: 'progress', status: 'worker-ready', progress: 1 });

                    const mappedRows = mapIncomingRowsToInternal(rows, mapping, 0);
                    send({ type: 'progress', status: 'mapping-rows', progress: 5, completed: mappedRows.length, total: mappedRows.length });

                    await runClustering(mappedRows, options, resumeState, send, progressKey);
                    
                } catch (err: any) {
                    send({ type: 'error', error: String(err && err.message ? err.message : err) });
                } finally {
                    try {
                        controller.close();
                    } catch (e) {
                         console.error("Error closing stream controller:", e);
                    }
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('Cluster Server Error:', error);
        return NextResponse.json({ ok: false, error: 'Failed to process request: ' + error.message }, { status: 500 });
    }
}
