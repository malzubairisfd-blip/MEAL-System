// workers/cluster.worker.ts
const normalizeArabicRaw = (value: any) => {
  if (!value) return "";
  try {
    value = String(value);
  } catch {
    value = "";
  }
  const normalized = value
    .normalize("NFKC")
    .replace(/يحيي/g, "يحي")
    .replace(/يحيى/g, "يحي")
    .replace(/عبد /g, "عبد")
    .replace(/[ًٌٍََُِّْـء]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized;
};

const digitsOnly = (value: any) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\D/g, "");
};

const normalizeChildrenField = (value: any) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[;,|،]/)
    .map((part) => String(part).trim())
    .filter(Boolean);
};

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

const jaroWinkler = (a: string, b: string) => {
  const sanitizedA = String(a || "");
  const sanitizedB = String(b || "");
  if (!sanitizedA || !sanitizedB) return 0;
  if (sanitizedA === sanitizedB) return 1;

  const la = sanitizedA.length;
  const lb = sanitizedB.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aMatches = Array(la).fill(false);
  const bMatches = Array(lb).fill(false);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (sanitizedA[i] !== sanitizedB[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (sanitizedA[i] !== sanitizedB[k]) transpositions++;
    k++;
  }

  transpositions /= 2;
  const m = matches;
  const jaro =
    (m / la + m / lb + (m - transpositions) / m) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, la, lb);
  for (let i = 0; i < maxPrefix; i++) {
    if (sanitizedA[i] === sanitizedB[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
};

const tokenJaccard = (aTokens: string[], bTokens: string[]) => {
  if (!aTokens || !bTokens) return 0;
  if (!aTokens.length && !bTokens.length) return 0;
  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
};

const nameOrderFreeScore = (aTokens: string[], bTokens: string[]) => {
  if (!aTokens.length || !bTokens.length) return 0;
  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  const sortedA = aTokens.slice().sort().join(" ");
  const sortedB = bTokens.slice().sort().join(" ");
  return 0.7 * jaccard + 0.3 * jaroWinkler(sortedA, sortedB);
};

const splitParts = (value: string) =>
  value ? value.split(/\s+/).filter(Boolean) : [];

const applyAdditionalRules = (a: PreprocessedRow, b: PreprocessedRow, opts: WorkerOptions) => {
  const minPair = opts.thresholds.minPair;
  const jw = jaroWinkler;
  const A = a.parts;
  const B = b.parts;
  const HA = a.husbandParts;
  const HB = b.husbandParts;

  const reasons: string[] = [];

  const ratio = (() => {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const token of setA) {
      if (setB.has(token)) inter++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : inter / union;
  })();

  if (ratio >= 0.8) {
    reasons.push("TOKEN_REORDER");
    return { score: Math.min(1, minPair + 0.22), reasons };
  }

  const firstNameMatch = A.length && B.length && jw(A[0], B[0]) >= 0.93;
  const husbandStrong =
    jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.9 ||
    nameOrderFreeScore(HA, HB) >= 0.9;
  const childrenMatch = tokenJaccard(a.children_normalized, b.children_normalized) >= 0.9;

  if (firstNameMatch && husbandStrong && childrenMatch) {
    reasons.push("DUPLICATED_HUSBAND_LINEAGE");
    return { score: minPair + 0.25, reasons };
  }

  const s93 = (x: string, y: string) => jw(x || "", y || "") >= 0.93;
  const s95 = (x: string, y: string) => jw(x || "", y || "") >= 0.95;

  const get = (arr: string[], index: number) => (arr[index] || "");
  const [F1, Fa1, G1, L1] = [get(A, 0), get(A, 1), get(A, 2), get(A, 3)];
  const [F2, Fa2, G2, L2] = [get(B, 0), get(B, 1), get(B, 2), get(B, 3)];
  const [HF1, HF2] = [get(HA, 0), get(HB, 0)];

  const evaluate = () => {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
      if (jw(HF1, HF2) < 0.7) return { reason: "WOMAN_LINEAGE_MATCH", boost: 0.18 };
    }
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
      if (jw(HF1, HF2) < 0.7) return { reason: "WOMAN_LINEAGE_MATCH", boost: 0.18 };
    }
    if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
      if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
        if (jw(HF1, HF2) < 0.7) return { reason: "WOMAN_LINEAGE_MATCH", boost: 0.17 };
      }
      if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2) && s93(Fa1, Fa2) && !s93(G1, G2)) {
        return { reason: "DUPLICATED_HUSBAND_LINEAGE", boost: 0.2 };
      }
      if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(HF1, HF2) < 0.7) {
        return { reason: "WOMAN_LINEAGE_MATCH", boost: 0.16 };
      }
    }

    if (
      A.length >= 3 &&
      B.length >= 3 &&
      HA.length >= 3 &&
      HB.length >= 3
    ) {
      const womanFamilyScore = jw(A[A.length - 1], B[B.length - 1]) >= 0.9;
      const womanLineageStrong =
        jw(A[1], B[1]) >= 0.93 &&
        jw(A[2], B[2]) >= 0.93 &&
        womanFamilyScore;
      const husbandSamePerson =
        jw(HA[0], HB[0]) >= 0.93 &&
        jw(HA[1], HB[1]) >= 0.93 &&
        jw(HA[2], HB[2]) >= 0.93 &&
        jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.9;
      const womanFirstSupport = jw(A[0], B[0]) >= 0.55 || jw(A[0], B[0]) === 0;
      if (womanLineageStrong && husbandSamePerson && womanFirstSupport) {
        return { reason: "DUPLICATED_HUSBAND_LINEAGE", boost: 0.23 };
      }
    }

    const investigationWords = [
      "تحت",
      "التحقيق",
      "مراجعة",
      "قيد",
      "موقوف",
      "غير",
      "مكتمل",
      "التحقق",
      "مراجعه",
    ];
    const hasInvestigation = investigationWords.some((word) => A.includes(word)) ||
      investigationWords.some((word) => B.includes(word)) ||
      investigationWords.some((word) => HA.includes(word)) ||
      investigationWords.some((word) => HB.includes(word));

    if (
      hasInvestigation &&
      jw(A[0], B[0]) >= 0.95 &&
      jw(A[A.length - 1], B[B.length - 1]) >= 0.9 &&
      nameOrderFreeScore(HA, HB) >= 0.93
    ) {
      return { reason: "INVESTIGATION_PLACEHOLDER", boost: 0.25 };
    }

    const husbandSame = nameOrderFreeScore(HA, HB) >= 0.8;
    const familySame = jw(A[A.length - 1], B[B.length - 1]) >= 0.9;
    const lineageOverlap = A.filter((token) =>
      B.some((value) => jw(token, value) >= 0.93)
    ).length >= 3;

    if (husbandSame && familySame && lineageOverlap) {
      return { reason: "POLYGAMY_SHARED_HOUSEHOLD", boost: 0.3 };
    }

    return null;
  };

  const evaluation = evaluate();
  if (evaluation) {
    reasons.push(evaluation.reason);
    return { score: Math.min(1, minPair + evaluation.boost), reasons };
  }

  return null;
};

type WorkerOptions = {
  thresholds: {
    minPair: number;
    minInternal: number;
    blockChunkSize: number;
  };
  finalScoreWeights: Record<string, number>;
  rules: {
    enablePolygamyRules: boolean;
  };
};

const defaultOptions: WorkerOptions = {
  thresholds: {
    minPair: 0.62,
    minInternal: 0.5,
    blockChunkSize: 3000,
  },
  finalScoreWeights: {
    firstNameScore: 0.15,
    familyNameScore: 0.25,
    advancedNameScore: 0.12,
    tokenReorderScore: 0.1,
    husbandScore: 0.12,
    idScore: 0.08,
    phoneScore: 0.05,
    childrenScore: 0.06,
    locationScore: 0.04,
  },
  rules: {
    enablePolygamyRules: true,
  },
};

type PreprocessedRow = {
  _internalId: string;
  womanName: string;
  husbandName: string;
  nationalId: string;
  phone: string;
  village: string;
  subdistrict: string;
  children: any[];
  womanName_normalized: string;
  husbandName_normalized: string;
  village_normalized: string;
  subdistrict_normalized: string;
  children_normalized: string[];
  parts: string[];
  husbandParts: string[];
};

const preprocessRow = (raw: any): PreprocessedRow => {
  const row = {
    ...raw,
    womanName: raw.womanName || "",
    husbandName: raw.husbandName || "",
    nationalId: String(raw.nationalId || raw.id || ""),
    phone: digitsOnly(raw.phone || ""),
    village: raw.village || "",
    subdistrict: raw.subdistrict || "",
    children: normalizeChildrenField(raw.children),
  };
  const womanName_normalized = raw.womanName_normalized || normalizeArabicRaw(row.womanName);
  const husbandName_normalized = raw.husbandName_normalized || normalizeArabicRaw(row.husbandName);
  const village_normalized = raw.village_normalized || normalizeArabicRaw(row.village);
  const subdistrict_normalized = raw.subdistrict_normalized || normalizeArabicRaw(row.subdistrict);
  const children_normalized =
    raw.children_normalized ||
    (row.children || []).map((child: any) => normalizeArabicRaw(child));

  return {
    ...row,
    womanName_normalized,
    husbandName_normalized,
    village_normalized,
    subdistrict_normalized,
    children_normalized,
    parts: raw._parts || splitParts(womanName_normalized),
    husbandParts: raw._husbandParts || splitParts(husbandName_normalized),
  };
};

const pairwiseScore = (rowA: PreprocessedRow, rowB: PreprocessedRow, opts: WorkerOptions) => {
    const o = opts;
    const weights = o.finalScoreWeights;

    const ruleResult = applyAdditionalRules(rowA, rowB, o);
    if (ruleResult) {
        return {
          score: ruleResult.score,
          reasons: ruleResult.reasons,
          breakdown: { reason: "RULE_BASED", boostedTo: ruleResult.score }
        };
    }

    if (rowA.nationalId && rowB.nationalId && rowA.nationalId === rowB.nationalId) {
       return { score: 0.99, reasons: ["EXACT_ID"], breakdown: { reason: "EXACT_ID" } };
    }

    const polygamyMatch =
      o.rules.enablePolygamyRules &&
      jaroWinkler(rowA.husbandName_normalized, rowB.husbandName_normalized) >= 0.95 &&
      jaroWinkler(rowA.parts[1] || "", rowB.parts[1] || "") >= 0.93 &&
      jaroWinkler(rowA.parts[2] || "", rowB.parts[2] || "") >= 0.9;

    if (polygamyMatch) {
       return { score: 0.97, reasons: ["POLYGAMY_PATTERN"], breakdown: { reason: "POLYGAMY_PATTERN" } };
    }
    
    const A = rowA.parts;
    const B = rowB.parts;
    const firstNameScore = jaroWinkler(A[0] || "", B[0] || "");
    const familyNameScore = jaroWinkler(A.slice(1).join(" "), B.slice(1).join(" "));
    const advancedNameScore = (() => {
      const root = (s: string) =>
        (splitParts(s).map((token) => token.slice(0, 3)).join(" "));
      const rootA = root(rowA.womanName_normalized);
      const rootB = root(rowB.womanName_normalized);
      if (!rootA || !rootB) return 0;
      return Math.min(0.5, jaroWinkler(rootA, rootB));
    })();
    const tokenReorderScore = nameOrderFreeScore(A, B);
    const husbandScore = Math.max(
      jaroWinkler(rowA.husbandName_normalized, rowB.husbandName_normalized),
      nameOrderFreeScore(rowA.husbandParts, rowB.husbandParts)
    );
    const phoneScoreVal = rowA.phone && rowB.phone
      ? rowA.phone === rowB.phone
        ? 1
        : rowA.phone.slice(-6) === rowB.phone.slice(-6)
        ? 0.85
        : rowA.phone.slice(-4) === rowB.phone.slice(-4)
        ? 0.6
        : 0
      : 0;
    const idScore = rowA.nationalId && rowB.nationalId
      ? rowA.nationalId === rowB.nationalId
        ? 1
        : rowA.nationalId.slice(-5) === rowB.nationalId.slice(-5)
        ? 0.75
        : 0
      : 0;
    const childrenScore = tokenJaccard(rowA.children_normalized, rowB.children_normalized);
    let locationScore = 0;
    if (rowA.village_normalized && rowB.village_normalized && rowA.village_normalized === rowB.village_normalized) {
      locationScore += 0.4;
    }
    if (
      rowA.subdistrict_normalized &&
      rowB.subdistrict_normalized &&
      rowA.subdistrict_normalized === rowB.subdistrict_normalized
    ) {
      locationScore += 0.25;
    }
    locationScore = Math.min(0.5, locationScore);

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
      };

    const W = o.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore +
              (W.phoneScore || 0) * phoneScoreVal + (W.childrenScore || 0) * childrenScore +
              (W.locationScore || 0) * locationScore;
  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter((v: any) => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));
  
  const reasons: any[] = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");
  return { score, breakdown, reasons };
}


const buildEdges = async (
  rows: PreprocessedRow[],
  minScore: number,
  opts: WorkerOptions,
  resumeState: any = null
) => {
  const n = rows.length;
  if (n <= 1) return { edges: [], finalState: null };
  const totalPairs = (n * (n - 1)) / 2;
  const edges: { a: number, b: number, score: number, reasons: string[] }[] = resumeState?.edges || [];
  let processed = resumeState?.processed || 0;
  let i = resumeState?.i || 0;

  const progressInterval = 5000;

  for (; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const result = pairwiseScore(rows[i], rows[j], opts);
      if (result.score >= minScore) {
        edges.push({ a: i, b: j, score: result.score, reasons: result.reasons });
      }
      processed++;
      if (processed % progressInterval === 0) {
        postMessage({
          type: "progress",
          status: "building-edges",
          progress: 10 + Math.round(40 * (processed / totalPairs)),
          completed: processed,
          total: totalPairs,
        });
        await yieldToEventLoop();
      }
    }
  }

  postMessage({ type: "progress", status: "edges-built", progress: 50, completed: totalPairs, total: totalPairs });
  return { edges, finalState: null };
};

const preprocessIncoming = (rowsChunk: any[], mapping: any) =>
  rowsChunk.map((row, index) => {
    const mappedRow: any = {
      _internalId: row._internalId || `row_${Date.now()}_${index}`,
    };

    Object.entries(mapping).forEach(([key, column]) => {
      if (key === "cluster_id") return;
      if (!column) return;
      if (row[column as string] !== undefined) {
        mappedRow[key as keyof any] = row[column as string];
      }
    });

    return preprocessRow(mappedRow);
  });

let inbound: PreprocessedRow[] = [];
let mapping: any = {};
let options: WorkerOptions = defaultOptions;
let resumeState: any = null;
let progressKey = "";

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (!type) return;

  if (type === "start") {
    mapping = payload.mapping || {};
    options = { ...defaultOptions, ...payload.options };
    options.finalScoreWeights = { ...defaultOptions.finalScoreWeights, ...(payload.options?.finalScoreWeights || {}) };
    options.thresholds = { ...defaultOptions.thresholds, ...(payload.options?.thresholds || {}) };
    options.rules = { ...defaultOptions.rules, ...(payload.options?.rules || {}) };
    resumeState = payload.resumeState || null;
    progressKey = payload.progressKey || "";
    inbound = [];
    postMessage({ type: "progress", status: "worker-ready", progress: 1 });
    return;
  }

  if (type === "data") {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const mapped = preprocessIncoming(rows, mapping);
    inbound.push(...mapped);
    postMessage({
      type: "progress",
      status: "receiving",
      progress: Math.min(5, 1 + Math.floor(inbound.length / 1000)),
      completed: inbound.length,
      total: payload.total ?? undefined,
    });
    return;
  }

  if (type === "end") {
    setTimeout(async () => {
      try {
        postMessage({
          type: "progress",
          status: "mapping-rows",
          progress: 5,
          completed: 0,
          total: inbound.length,
        });
        const { edges } = await buildEdges(inbound, options.thresholds.minPair, options, resumeState);
        const result = await runClustering(inbound, edges, options);
        postMessage({
          type: "done",
          payload: result,
        });
      } catch (err: any) {
        postMessage({ type: "error", error: err?.message || "Unknown error" });
      }
    }, 50);
  }
};

const runClustering = async (rows: PreprocessedRow[], edges: any[], opts: WorkerOptions) => {
  const uf = new UF(rows.length);
  const finalClusters: any[] = [];
  const finalized = new Set<number>();
  const rootReasons = new Map<number, Set<string>>();

  edges.sort((a, b) => b.score - a.score);

  for (let idx = 0; idx < edges.length; idx++) {
    const edge = edges[idx];
    if (finalized.has(edge.a) || finalized.has(edge.b)) continue;
    const rootA = uf.find(edge.a);
    const rootB = uf.find(edge.b);

    const reasonsA = rootReasons.get(rootA) || new Set();
    const reasonsB = rootReasons.get(rootB) || new Set();
    (edge.reasons || []).forEach((reason: string) => {
      reasonsA.add(reason);
      reasonsB.add(reason);
    });
    rootReasons.set(rootA, reasonsA);
    rootReasons.set(rootB, reasonsB);

    if (rootA === rootB) {
      continue;
    }

    if (uf.size[rootA] + uf.size[rootB] <= 4) {
      const mergedRoot = uf.merge(rootA, rootB);
      const aggregatedReasons = new Set([...(rootReasons.get(rootA) || []), ...(rootReasons.get(rootB) || [])]);
      rootReasons.set(mergedRoot, aggregatedReasons);
      continue;
    }

    const combinedIndices = Array.from(new Set([...uf.rootMembers(rootA), ...uf.rootMembers(rootB)]));
    const combinedRows = combinedIndices.map((index) => rows[index]);
    const subsetClusters = splitCluster(combinedRows, opts.thresholds.minInternal, opts);

    subsetClusters.forEach((cluster) => {
      if (cluster.records.length <= 1) return;
      const reasons = new Set([
        ...(rootReasons.get(rootA) || []),
        ...(rootReasons.get(rootB) || []),
        ...cluster.reasons,
      ]);
      cluster.reasons = Array.from(reasons);
      finalClusters.push(cluster);
      cluster.records.forEach((record: any) => {
        const originalIndex = rows.findIndex((row) => row._internalId === record._internalId);
        if (originalIndex >= 0) finalized.add(originalIndex);
      });
    });

    if (idx % 200 === 0) {
      postMessage({
        type: "progress",
        status: "merging-edges",
        progress: 60 + Math.round(35 * (idx / edges.length)),
        completed: idx + 1,
        total: edges.length,
      });
      await yieldToEventLoop();
    }
  }

  const leftovers = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const root = uf.find(i);
    const arr = leftovers.get(root) || [];
    arr.push(i);
    leftovers.set(root, arr);
  }

  leftovers.forEach((indices, root) => {
    if (indices.length <= 1) return;
    const subset = indices.map((index) => rows[index]);
    const parts = splitCluster(subset, opts.thresholds.minInternal, opts);
    parts.forEach((cluster) => {
      if (cluster.records.length <= 1) return;
      const reasons = new Set([
        ...(cluster.reasons || []),
        ...(rootReasons.get(root) || []),
      ]);
      cluster.reasons = Array.from(reasons);
      finalClusters.push(cluster);
    });
  });

  const clustersWithRecords = finalClusters
    .map((cluster) => ({
      ...cluster,
      records: cluster.records.map((record: any) => rows.find((r) => r._internalId === record._internalId)),
    }))
    .filter((cluster) => cluster.records.length > 1);

  postMessage({ type: "progress", status: "annotating", progress: 95 });
  postMessage({ type: "save_progress", key: progressKey, value: null });

  return {
    clusters: clustersWithRecords,
    edgesUsed: edges,
    rows,
  };
};

class UF {
  parent: number[];
  size: number[];
  members: Map<number, Set<number>>;

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, index) => index);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) {
      this.members.set(i, new Set([i]));
    }
  }

  find(x: number) {
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  merge(a: number, b: number) {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return a;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const membersA = this.members.get(a)!;
    const membersB = this.members.get(b)!;
    membersB.forEach((member) => membersA.add(member));
    this.members.delete(b);
    return a;
  }

  rootMembers(x: number) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}

const splitCluster = (rowsSubset: PreprocessedRow[], minInternal: number, opts: WorkerOptions) => {
  if (!rowsSubset.length) return [];
  const localEdges: any[] = [];
  for (let i = 0; i < rowsSubset.length; i++) {
    for (let j = i + 1; j < rowsSubset.length; j++) {
      const result = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
      if (result.score >= minInternal) {
        localEdges.push({ a: i, b: j, ...result });
      }
    }
  }

  if (rowsSubset.length <= 4) {
    const reasons = Array.from(new Set(localEdges.flatMap((edge) => edge.reasons || [])));
    return [{ records: rowsSubset, reasons, pairScores: localEdges }];
  }

  localEdges.sort((a, b) => b.score - a.score);
  const uf = new UF(rowsSubset.length);
  localEdges.forEach((edge) => {
    const ra = uf.find(edge.a);
    const rb = uf.find(edge.b);
    if (ra === rb) return;
    if (uf.size[ra] + uf.size[rb] <= 4) {
      uf.merge(ra, rb);
    }
  });

  const groups = new Map<number, number[]>();
  for (let i = 0; i < rowsSubset.length; i++) {
    const root = uf.find(i);
    const arr = groups.get(root) || [];
    arr.push(i);
    groups.set(root, arr);
  }

  const result: any[] = [];
  groups.forEach((indices) => {
    if (indices.length <= 1) return;
    const subset = indices.map((idx) => rowsSubset[idx]);
    const subEdges = localEdges.filter((edge) => indices.includes(edge.a) && indices.includes(edge.b));
    const reasons = Array.from(new Set(subEdges.flatMap((edge) => edge.reasons || [])));
    if (subset.length <= 4) {
      result.push({ records: subset, reasons, pairScores: subEdges });
    } else {
      result.push(...splitCluster(subset, Math.max(minInternal, 0.45), opts));
    }
  });

  return result;
};