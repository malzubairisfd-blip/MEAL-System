
// src/workers/scoring.worker.ts

// --- All scoring and confidence logic is now consolidated in this file ---

// --- Constants & Helpers from scoringClient ---

function baseArabicNormalize(value: any): string {
  if (!value) return "";
  let s = String(value)
    .normalize("NFKC")
    .replace(/يحيي/g, "يحي")
    .replace(/يحيى/g, "يحي")
    .replace(/عبد /g, "عبد")
    .replace(/[ًٌٍَُِّْـء]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/\s+/g, " ")
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ")
    .trim()
    .toLowerCase();
  return s;
}

const FIXED_COMPOUND_NAMES = [
  // === ALLAH NAMES ===
  "عبد الله","عبد الرحمن","عبد الرحيم","عبد الكريم","عبد العزيز",
  "عبد الملك","عبد السلام","عبد القادر","عبد الجليل","عبد الرزاق",
  "عبد الغني","عبد الوهاب","عبد الاله","عبد الواحد","عبد الماجد",

  // === FEMALE (الله) ===
  "امه الله","امه الرحمن","امه الرحيم","امه الكريم",

  // === MALE (الله) ===
  "صنع الله","عطاء الله","نور الله","فتح الله","نصر الله",
  "فضل الله","رحمه الله","حسب الله","جود الله",

  // === PROPHET / RELIGIOUS ===
  "نور الدين","شمس الدين","سيف الدين","زين الدين","جمال الدين",
  "كمال الدين","صلاح الدين","علاء الدين","تقي الدين","نجم الدين",

  // === FAMILY ===
  "ابو بكر","ابو طالب","ابو هريره",
  "ام كلثوم","ام سلمه","ام حبيبه",

  // === LINEAGE ===
  "ابن تيميه","ابن سينا","ابن خلدون","ابن رشد",
  "بنت الشاطئ"
];

const PREFIX_COMPOUND_RULES: RegExp[] = [
  /^امه\s+[ء-ي]{3,}$/,
  /^ابو\s+[ء-ي]{3,}$/,
  /^ام\s+[ء-ي]{3,}$/,
  /^ابن\s+[ء-ي]{3,}$/,
  /^بنت\s+[ء-ي]{3,}$/,
  /^[ء-ي]{3,}\s+الدين$/,
  /^[ء-ي]{3,}\s+الله$/
];

function normalizeArabicWithCompounds(value: any): string {
  let s = baseArabicNormalize(value);

  // Step 1: apply fixed compounds
  for (const name of FIXED_COMPOUND_NAMES) {
    const normalized = baseArabicNormalize(name);
    const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
    s = s.replace(re, normalized.replace(" ", "_"));
  }

  // Step 2: auto-detect safe 2-part compounds
  const parts = s.split(" ");
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) {
      const pair = `${parts[i]} ${parts[i + 1]}`;
      if (PREFIX_COMPOUND_RULES.some((r) => r.test(pair))) {
        result.push(pair.replace(" ", "_"));
        i++; // skip next
        continue;
      }
    }
    result.push(parts[i]);
  }

  return result.join(" ");
}


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

export type WorkerOptions = {
  thresholds?: Partial<{
    minPair: number;
    minInternal: number;
    blockChunkSize: number;
  }>;
  finalScoreWeights?: Partial<Record<string, number>>;
  rules?: Partial<{
    enablePolygamyRules: boolean;
  }>;
};

const defaultOptions = {
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
    childrenScore: 0.04,
    locationScore: 0.04,
  },
  rules: {
    enablePolygamyRules: true,
  },
};

export type PreprocessedRow = {
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
  const womanName_normalized = normalizeArabicWithCompounds(row.womanName);
  const husbandName_normalized = normalizeArabicWithCompounds(row.husbandName);
  const village_normalized = baseArabicNormalize(row.village);
  const subdistrict_normalized = baseArabicNormalize(row.subdistrict);
  const children_normalized = row.children.map((child: any) => baseArabicNormalize(child));

  return {
    ...row,
    womanName_normalized,
    husbandName_normalized,
    village_normalized,
    subdistrict_normalized,
    children_normalized,
    parts: splitParts(womanName_normalized),
    husbandParts: splitParts(husbandName_normalized),
  };
};

const applyAdditionalRules = (
  a: PreprocessedRow,
  b: PreprocessedRow,
  opts: typeof defaultOptions
) => {
  const minPair = opts.thresholds.minPair;
  const jw = jaroWinkler;

  const A = a.parts;
  const B = b.parts;
  const HA = a.husbandParts;
  const HB = b.husbandParts;

  const s93 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.93;
  const s95 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.95;

  /* =========================================================
     TIER 0 — ABSOLUTE GUARANTEES (GROUP FIXES)
     ========================================================= */
  // === GUARANTEED DUPLICATE: FULL WOMAN LINEAGE ===
  if (
    A.length >= 4 &&
    B.length >= 4 &&
    jw(A[0], B[0]) >= 0.98 &&
    jw(A[1], B[1]) >= 0.98 &&
    jw(A[2], B[2]) >= 0.95
    
  ) {
    return {
      score: Math.min(1, minPair + 0.35),
      reasons: ["EXACT_WOMAN_MATCH"],
    };
  }

/* =========================================================
   TIER 0.5 — CORE LINEAGE GUARANTEE (4–5 PART SAFE)
   ========================================================= */


const firstNameMatch =
  A.length > 0 &&
  B.length > 0 &&
  jw(A[0], B[0]) >= 0.93;

const husbandStrongMatch =
  jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.96;

if (firstNameMatch && husbandStrongMatch) {
  return {
    score: 1.0,
    reasons: ["SAME_WOMAN_FIRSTNAME_EXACT_HUSBAND"],
  };
}


if (
  // ---- WOMAN CORE (First / Father / Grandfather) ----
  A.length >= 3 &&
  B.length >= 3 &&
  jw(A[0], B[0]) >= 0.98 &&     // first name
  jw(A[1], B[1]) >= 0.90 &&     // father
  jw(A[2], B[2]) >= 0.95 &&     // grandfather

  // ---- HUSBAND CORE (First / Father / Grandfather) ----
  HA.length >= 3 &&
  HB.length >= 3 &&
  jw(HA[0], HB[0]) >= 0.98 &&
  jw(HA[1], HB[1]) >= 0.95 &&
  jw(HA[2], HB[2]) >= 0.95 

) {
  return {
    score: Math.min(1, minPair + 0.33),
    reasons: ["CORE_WOMAN_AND_HUSBAND_LINEAGE_MATCH"],
  };
}

  /* =========================================================
     TIER 1 — FULL WOMAN + HUSBAND IDENTITY
     ========================================================= */

  if (
    A.length >= 4 &&
    B.length >= 4 &&
    HA.length >= 4 &&
    HB.length >= 4 &&
    s95(A[0], B[0]) &&
    s95(A[1], B[1]) &&
    s93(A[2], B[2]) &&
    s95(HA[0], HB[0]) &&
    s93(HA[1], HB[1]) &&
    s93(HA[2], HB[2])
  ) {
    return {
      score: Math.min(1, minPair + 0.32),
      reasons: ["FULL_WOMAN_AND_HUSBAND_MATCH"],
    };
  }

  /* =========================================================
     TIER 2 — SAME HUSBAND, WOMAN FAMILY CHANGED
     ========================================================= */

  if (
    A.length >= 3 &&
    B.length >= 3 &&
    s95(A[0], B[0]) &&
    s95(A[1], B[1]) &&
    s93(A[2], B[2]) &&
    nameOrderFreeScore(HA, HB) >= 0.95
  ) {
    return {
      score: Math.min(1, minPair + 0.27),
      reasons: ["SAME_HUSBAND_WOMAN_VARIANT"],
    };
  }

  /* =========================================================
     TIER 3 — STRONG LINEAGE (ORDER FREE)
     ========================================================= */

  // DUPLICATED_HUSBAND_LINEAGE
  const husbandStrong =
    jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.9 ||
    nameOrderFreeScore(HA, HB) >= 0.9;
  const childrenMatch = tokenJaccard(a.children_normalized, b.children_normalized) >= 0.9;

  if (firstNameMatch && husbandStrong && childrenMatch) {
    return {
      score: Math.min(1, minPair + 0.25),
      reasons: ["DUPLICATED_HUSBAND_LINEAGE"],
    };
  }

  /* =========================================================
     TIER 4 — WOMAN ONLY LINEAGE (NO HUSBAND)
     ========================================================= */

  if (
    A.length >= 3 &&
    B.length >= 3 &&
    s93(A[0], B[0]) &&
    s93(A[1], B[1]) &&
    s93(A[2], B[2]) &&
    jw(HA[0] || "", HB[0] || "") < 0.6
  ) {
    return {
      score: Math.min(1, minPair + 0.2),
      reasons: ["WOMAN_LINEAGE_ONLY"],
    };
  }

  /* =========================================================
     TIER 5 — ADMIN / SPECIAL
     ========================================================= */

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

  if (
    investigationWords.some(w => A.includes(w) || B.includes(w)) &&
    s95(A[0], B[0]) &&
    s93(A[A.length - 1], B[B.length - 1]) &&
    nameOrderFreeScore(HA, HB) >= 0.93
  ) {
    return {
      score: Math.min(1, minPair + 0.25),
      reasons: ["INVESTIGATION_PLACEHOLDER"],
    };
  }

  /* =========================================================
     TIER 6 — POLYGAMY / INFERENCE
     ========================================================= */

  if (
    nameOrderFreeScore(HA, HB) >= 0.8 &&
    jw(A[A.length - 1], B[B.length - 1]) >= 0.9 &&
    A.filter(x => B.some(y => jw(x, y) >= 0.93)).length >= 3
  ) {
    return {
      score: Math.min(1, minPair + 0.3),
      reasons: ["POLYGAMY_SHARED_HOUSEHOLD"],
    };
  }

  /* =========================================================
     TIER 7 — LAST RESORT TOKEN OVERLAP
     ========================================================= */

  const setA = new Set(A);
  const setB = new Set(B);
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;

  if (union > 0 && inter / union >= 0.8) {
    return {
      score: Math.min(1, minPair + 0.22),
      reasons: ["TOKEN_REORDER_LAST_RESORT"],
    };
  }

  return null;
};

export function computePairScore(rawA: any, rawB: any, opts: WorkerOptions) {
  // Merge user options with defaults
  const mergedOpts: typeof defaultOptions = {
    ...defaultOptions,
    thresholds: { ...defaultOptions.thresholds, ...(opts.thresholds || {}) },
    finalScoreWeights: { ...defaultOptions.finalScoreWeights, ...(opts.finalScoreWeights || {}) },
    rules: { ...defaultOptions.rules, ...(opts.rules || {}) },
  };

  const rowA = preprocessRow(rawA);
  const rowB = preprocessRow(rawB);

  // --- Start Score Calculation ---
  const A = rowA.parts;
  const B = rowB.parts;
  const firstNameScore = jaroWinkler(A[0] || "", B[0] || "");
  const familyNameScore = jaroWinkler(A.slice(1).join(" "), B.slice(1).join(" "));
  const advancedNameScore = (() => {
    const root = (s: string) => (splitParts(s).map((token) => token.slice(0, 3)).join(" "));
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
  if (rowA.subdistrict_normalized && rowB.subdistrict_normalized && rowA.subdistrict_normalized === rowB.subdistrict_normalized) {
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
  
  const W = mergedOpts.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore +
              (W.phoneScore || 0) * phoneScoreVal + (W.childrenScore || 0) * childrenScore +
              (W.locationScore || 0) * locationScore;
  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter((v: any) => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  
  let finalScore = Math.max(0, Math.min(1, score));
  let finalReasons: string[] = [];
  if (tokenReorderScore > 0.85) finalReasons.push("TOKEN_REORDER");

  // --- Apply Rules ---
  const ruleResult = applyAdditionalRules(rowA, rowB, mergedOpts);
  if (ruleResult) {
    finalScore = ruleResult.score; // Override score if a rule matches
    finalReasons = [...new Set([...finalReasons, ...ruleResult.reasons])];
  }

  if (rowA.nationalId && rowB.nationalId && rowA.nationalId === rowB.nationalId) {
    finalScore = Math.max(finalScore, 0.99);
    finalReasons.push("EXACT_ID");
  }

  const polygamyMatch =
    mergedOpts.rules.enablePolygamyRules &&
    jaroWinkler(rowA.husbandName_normalized, rowB.husbandName_normalized) >= 0.95 &&
    jaroWinkler(rowA.parts[1] || "", rowB.parts[1] || "") >= 0.93 &&
    jaroWinkler(rowA.parts[2] || "", rowB.parts[2] || "") >= 0.9;

  if (polygamyMatch) {
    finalScore = Math.max(finalScore, 0.97);
    finalReasons.push("POLYGAMY_PATTERN");
  }
  
  return { score: finalScore, breakdown, reasons: finalReasons };
}


// --- New Scoring Functions (from your prompt) ---

export function jaroWinkler(a: string, b: string) {
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


export function averageWomanNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
  const A = a.parts;
  const B = b.parts;
  
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 0;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < maxLen; i++) {
    if (A[i] && B[i]) {
      sum += jaroWinkler(A[i], B[i]);
      count++;
    }
  }

  return count ? sum / count : 0;
}

export function averageHusbandNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
  const HA = a.husbandParts;
  const HB = b.husbandParts;
  
  if (!HA.length || !HB.length) return 0;

  let sum = 0;
  let count = 0;

  const maxLen = Math.max(HA.length, HB.length);
  for (let i = 0; i < maxLen; i++) {
    if (HA[i] && HB[i]) {
      sum += jaroWinkler(HA[i], HB[i]);
      count++;
    }
  }

  const partsAvg = count ? sum / count : 0;

  const fullNameScore = jaroWinkler(
    a.husbandName_normalized,
    b.husbandName_normalized
  );

  // 🔥 Stronger confidence via fusion
  return 0.6 * partsAvg + 0.4 * fullNameScore;
}

export function totalAverageNameScore(
  a: PreprocessedRow,
  b: PreprocessedRow
): {
  womanAvg: number;
  husbandAvg: number;
  totalAvg: number;
} {
  const womanAvg = averageWomanNameScore(a, b);
  const husbandAvg = averageHusbandNameScore(a, b);

  const totalAvg =
    0.45 * womanAvg +
    0.55 * husbandAvg;

  return {
    womanAvg,
    husbandAvg,
    totalAvg,
  };
}

// --- Cluster Confidence Logic from clusterConfidence.ts ---

function buildPairwiseMatrix(
  cluster: PreprocessedRow[],
  opts: WorkerOptions
) {
  const scores: {
    womanAvg: number;
    husbandAvg: number;
    totalAvg: number;
  }[] = [];
  const audit: any[] = [];
  const firedRules = new Set<string>();
  const keysUsed = new Set<string>();

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const r = computePairScore(cluster[i], cluster[j], opts);
      const nameScores = totalAverageNameScore(cluster[i], cluster[j]);
      scores.push(nameScores);

      (r.reasons || []).forEach((x: string) => firedRules.add(x));

      if (r.breakdown) {
          Object.keys(r.breakdown).forEach(k => {
            if ((r.breakdown as any)[k] > 0.85) keysUsed.add(k);
          });
      }

      audit.push({
        a: cluster[i]._internalId,
        b: cluster[j]._internalId,
        score: r.score,
        ...nameScores,
        reasons: r.reasons || [],
        breakdown: r.breakdown
      });
    }
  }

  const safeAvg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgScores = {
    womanAvg: safeAvg(scores.map(s => s.womanAvg)),
    husbandAvg: safeAvg(scores.map(s => s.husbandAvg)),
    totalAvg: safeAvg(scores.map(s => s.totalAvg)),
  }

  return { scores: avgScores, audit, firedRules: [...firedRules], keysUsed: [...keysUsed] };
}


// --- Main Confidence Calculation Function ---

export function calculateClusterConfidence(
  cluster: PreprocessedRow[],
  opts: WorkerOptions
) {
  if (cluster.length < 2) {
    return {
      confidencePercent: 100,
      confidenceLevel: "SINGLE_RECORD",
      auditTable: [],
      summary: "Single record cluster"
    };
  }

  const { scores, audit, firedRules, keysUsed } = buildPairwiseMatrix(cluster, opts);
  
  const confidencePercent = Math.round(scores.totalAvg * 100);

  const confidenceLevel =
    confidencePercent >= 92
    ? "CONFIRMED"
    : confidencePercent >= 85
    ? "STRONG_SUSPECT"
    : confidencePercent >= 70
    ? "SUSPECT"
    : "POSSIBLE";

  return {
    confidencePercent,
    confidenceLevel,
    avgWomanNameScore: scores.womanAvg,
    avgHusbandNameScore: scores.husbandAvg,
    avgFinalScore: scores.totalAvg,
    firedRules,
    keysUsed,
    auditTable: audit,
  };
}


// --- Worker Main Logic ---

self.onmessage = (event) => {
  const { rawClusters, options } = event.data;
  if (!rawClusters) {
    postMessage({ type: "error", error: "No clusters provided to scoring worker." });
    return;
  }

  try {
    const totalClusters = rawClusters.length;
    const UPDATE_BATCH_SIZE = Math.max(10, Math.floor(totalClusters / 100)); 

    const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
      if (index % UPDATE_BATCH_SIZE === 0) {
        const progress = Math.round((index / totalClusters) * 100);
        postMessage({ type: "progress", progress });
      }

      const records = (cluster.records || []) as PreprocessedRow[];
      if (records.length < 2) {
        return {
          ...cluster,
          records,
          pairScores: [],
          confidenceScore: 100, // Or some default for single-record clusters
          avgWomanNameScore: 1,
          avgHusbandNameScore: 1,
          avgFinalScore: 1,
        };
      }
      
      const confidenceResult = calculateClusterConfidence(records, options || {});
      const { confidencePercent, auditTable, avgWomanNameScore, avgHusbandNameScore, avgFinalScore } = confidenceResult;

      const safeAvg = (arr: (number | null | undefined)[]) => {
          const valid = arr.filter(v => typeof v === 'number' && isFinite(v)) as number[];
          return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
      };

      const recordsWithAvgScores = records.map(record => {
        const relatedPairs = auditTable.filter((p: any) => p.a === record._internalId || p.b === record._internalId);
        
        return {
          ...record,
          avgPairScore: safeAvg(relatedPairs.map((p: any) => p.score)),
          avgFirstNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.firstNameScore)),
          avgFamilyNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.familyNameScore)),
          avgAdvancedNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.advancedNameScore)),
          avgTokenReorderScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.tokenReorderScore)),
        };
      });

      return {
        ...cluster,
        records: recordsWithAvgScores,
        pairScores: auditTable, 
        confidenceScore: confidencePercent,
        avgWomanNameScore,
        avgHusbandNameScore,
        avgFinalScore
      };
    });

    postMessage({ type: "done", enrichedClusters });
  } catch (error: any) {
    postMessage({ type: "error", error: error?.message || "Unknown scoring error" });
  }
};
