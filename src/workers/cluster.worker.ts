
// src/workers/cluster.worker.ts
import { alignLineage, jaroWinkler, collapseDuplicateAncestors, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';


// --- Executor for Learned Rules ---
type RuleResult = {
  score: number;
  reasons: string[];
};

// Default no-op executor (safe fallback)
let executeLearnedRules: (
  a: any,
  b: any,
  jw: Function,
  nameOrderFreeScore: Function,
  tokenJaccard: Function,
  minPair: number
) => RuleResult | null = () => null;

async function loadAutoRules() {
  try {
    const response = await fetch('/api/rules', { cache: 'no-store' });
    if (!response.ok) return;

    const rules = await response.json();
    if (!Array.isArray(rules)) return;

    // Only enabled + non-empty rules
    const enabledRules = rules.filter(
      r => r.enabled && typeof r.code === 'string' && r.code.trim().length > 0
    );

    postMessage({
      type: 'rules_loaded',
      count: enabledRules.length,
    });

    if (enabledRules.length === 0) {
      executeLearnedRules = () => null;
      return;
    }

    // Wrap every rule defensively so one bad rule doesn't kill all
    const wrappedRules = enabledRules.map((r, idx) => `
      try {
        ${r.code}
      } catch (e) {
        // AUTO_RULE_${idx} failed silently
      }
    `).join('\n');

    executeLearnedRules = new Function(
      'a',
      'b',
      'jw',
      'nameOrderFreeScore',
      'tokenJaccard',
      'minPair',
      `
      // Pre-bind commonly used tokens
      const A = a.parts || [];
      const B = b.parts || [];
      const HA = a.husbandParts || [];
      const HB = b.husbandParts || [];

      ${wrappedRules}

      return null;
      `
    ) as any;

  } catch (e) {
    console.warn(
      "Could not load or compile auto-rules.json. Continuing without learned rules.",
      e
    );
    executeLearnedRules = () => null;
  }
}


// --- Constants & Helpers ---

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

export function normalizeArabicWithCompounds(value: any): string {
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

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const splitParts = (value: string) =>
  value ? value.split(/\s+/).filter(Boolean) : [];


// --- Rule Logic ---

const applyAdditionalRules = (
  a: PreprocessedRow,
  b: PreprocessedRow,
  opts: WorkerOptions
) => {
  // Execute the dynamically loaded learned rules first.
  // These are given top priority.
  const autoResult = executeLearnedRules(a, b, jaroWinkler, nameOrderFreeScore, tokenJaccard, opts.thresholds.minPair);
  if (autoResult) {
      return autoResult; // A learned rule matched, so we return its result immediately.
  }
  
  // If only testing auto-rules, stop here.
  if (opts.autoRulesOnly) {
    return null;
  }

  // --- Start of hardcoded rules if no learned rule matched ---

  const minPair = opts.thresholds.minPair;
  const jw = jaroWinkler;

  const A = a.parts;
  const B = b.parts;
  const HA = a.husbandParts;
  const HB = b.husbandParts;

  const s93 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.93;
  const s95 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.95;

  // TIERS...
  
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

const firstNameMatchRule =
  A.length > 0 &&
  B.length > 0 &&
  jw(A[0], B[0]) >= 0.93;

const husbandStrongMatch =
  jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.96;

if (firstNameMatchRule && husbandStrongMatch) {
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


if (
  A.length >= 4 &&
  B.length >= 4 &&
  HA.length >= 4 &&
  HB.length >= 4
) {
  if (
    jw(A[0], B[0]) >= 0.95 &&                     
    jw(A[A.length - 1], B[B.length - 1]) >= 0.93 &&
    jw(HA[0], HB[0]) >= 0.95 &&                   
    jw(HA[1], HB[1]) >= 0.95 &&                   
    jw(HA[2], HB[2]) >= 0.93 &&                    
    jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.93 
  ) {
    return {
      score: Math.min(1, minPair + 0.26),
      reasons: ["SHARED_HOUSEHOLD_SAME_HUSBAND"],
    };
  }
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
   TIER X — SAME HUSBAND + CHILDREN OVERLAP (GUARANTEED)
   Detects Groups 1, 2, 3
   ========================================================= */

const husbandExact =
  jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.97;

// children_normalized is an array of strings
const childrenA = a.children_normalized || [];
const childrenB = b.children_normalized || [];


// fast exit
if (husbandExact && (childrenA.length || childrenB.length)) {
  let childMatches = 0;

  for (const ca of childrenA) {
    for (const cb of childrenB) {
      if (jw(ca, cb) >= 0.90) {
        childMatches++;
        break;
      }
    }
  }

  // ✅ at least ONE child matches OR strong overall similarity
  const childrenOverlap =
    childMatches >= 1 ||
    tokenJaccard(childrenA, childrenB) >= 0.6;

  if (childrenOverlap) {
    return {
      score: 1.0,
      reasons: ["SAME_HUSBAND_CHILDREN_OVERLAP"],
    };
  }
}

  /* =========================================================
     TIER 3 — STRONG LINEAGE (ORDER FREE)
     ========================================================= */

  // DUPLICATED_HUSBAND_LINEAGE
  const strongFirstNameMatch = A.length && B.length && jw(A[0], B[0]) >= 0.93;
  const husbandStrong =
    jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.9 ||
    nameOrderFreeScore(HA, HB) >= 0.9;
  const childrenMatch = tokenJaccard(a.children_normalized, b.children_normalized) >= 0.9;

  if (strongFirstNameMatch && husbandStrong && childrenMatch) {
    return {
      score: Math.min(1, minPair + 0.25),
      reasons: ["DUPLICATED_HUSBAND_LINEAGE"],
    };
  }
  
  /* =========================================================
     GUARANTEED DUPLICATE — COLLAPSED LINEAGE MATCH
     Handles 4–5 parts, repeated ancestors
     ========================================================= */
  const collapsedA = collapseDuplicateAncestors(A);
  const collapsedB = collapseDuplicateAncestors(B);

  if (collapsedA.length >= 4 && collapsedB.length >= 4) {
      const maxLen = Math.max(collapsedA.length, collapsedB.length);
      const alignedA = alignLineage(collapsedA, maxLen);
      const alignedB = alignLineage(collapsedB, maxLen);

      const familyMatch = jw(alignedA[maxLen - 1], alignedB[maxLen - 1]) >= 0.95;
      const firstNameMatch = jw(alignedA[0], alignedB[0]) >= 0.88;

      if (familyMatch && firstNameMatch) {
          let strongMatches = 0;
          for (let i = 1; i < maxLen - 1; i++) {
              if (jw(alignedA[i], alignedB[i]) >= 0.93) strongMatches++;
          }
          if (strongMatches >= maxLen - 3) {
              return {
                  score: Math.min(1, minPair + 0.40),
                  reasons: ["COLLAPSED_LINEAGE_FULL_MATCH"],
              };
          }
      }
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

// --- Config & Options ---

export type WorkerOptions = {
  thresholds: {
    minPair: number;
    minInternal: number;
    blockChunkSize: number;
  };
  finalScoreWeights: Record<string, number>;
  rules: {
    enablePolygamyRules: boolean;
  };
  autoRulesOnly?: boolean;
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
  autoRulesOnly: false,
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

export const preprocessRow = (raw: any): PreprocessedRow => {
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
  const womanName_normalized = raw.womanName_normalized || normalizeArabicWithCompounds(row.womanName);
  const husbandName_normalized = raw.husbandName_normalized || normalizeArabicWithCompounds(row.husbandName);
  const village_normalized = raw.village_normalized || baseArabicNormalize(row.village);
  const subdistrict_normalized = raw.subdistrict_normalized || baseArabicNormalize(row.subdistrict);
  const children_normalized =
    raw.children_normalized || (row.children || []).map((child: any) => baseArabicNormalize(child));

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
  const tokenReorderScore = nameOrderFreeScore(rowA.parts, rowB.parts);
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


const pairwiseScore = (rowA: PreprocessedRow, rowB: PreprocessedRow, opts: WorkerOptions) => {
    return computePairScore(rowA, rowB, opts);
};

// --- Optimized Edges Builder (Blocking / Inverted Index) ---

const buildEdges = async (
  rows: PreprocessedRow[],
  minScore: number,
  opts: WorkerOptions,
  resumeState: any = null
) => {
  const n = rows.length;
  if (n <= 1) return { edges: [], finalState: null };
  const edges: { a: number; b: number; score: number; reasons: string[] }[] = resumeState?.edges || [];

  postMessage({ type: "progress", status: "indexing", progress: 10, completed: 0, total: n });

  // 1. Build Inverted Index
  // Maps a Token Key -> Array of Row Indices
  const tokenMap = new Map<string, number[]>();

  // Helper to add to map
  const addToken = (key: string, index: number) => {
    if (!key || key.length < 2) return; // Skip very short tokens
    let arr = tokenMap.get(key);
    if (!arr) {
      arr = [];
      tokenMap.set(key, arr);
    }
    arr.push(index);
  };

  for (let i = 0; i < n; i++) {
    const row = rows[i];

    // Key 1: ID (Exact)
    if (row.nationalId) addToken(`ID:${row.nationalId}`, i);

    // Key 2: Phone (Last 6 digits)
    if (row.phone && row.phone.length >= 6) addToken(`PH:${row.phone.slice(-6)}`, i);

    // Key 3: First 3 chars of Normalized First Name (Phonetic Block)
    if (row.parts[0] && row.parts[0].length >= 2) {
      addToken(`W_N:${row.parts[0].substring(0, 3)}`, i);
    }

    // Key 4: Husband First Name (First 3 chars)
    if (row.husbandParts[0] && row.husbandParts[0].length >= 2) {
      addToken(`H_N:${row.husbandParts[0].substring(0, 3)}`, i);
    }

    // Key 5: Woman Family Name (Last Token)
    if (row.parts.length > 1) {
      const last = row.parts[row.parts.length - 1];
      if (last.length > 2) addToken(`W_L:${last}`, i);
    }

    // --- NEW KEYS ---

    // 1️⃣ WOMAN CORE LINEAGE KEY
    if (row.parts.length >= 3) {
      addToken(
        `W_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}`,
        i
      );
    }
    
    // 2️⃣ WOMAN CORE + LAST
    if (row.parts.length >= 4) {
      addToken(
        `W_CORE_L:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}|${row.parts[row.parts.length - 1]}`,
        i
      );
    }

    // 3️⃣ HUSBAND CORE LINEAGE KEY
    if (row.husbandParts.length >= 3) {
      addToken(
        `H_CORE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`,
        i
      );
    }

    // 4️⃣ FULL HUSBAND LINEAGE
    if (row.husbandParts.length >= 4) {
      addToken(
        `H_FULL:${row.husbandParts.slice(0, 4).join("|")}`,
        i
      );
    }

    // 5️⃣ WOMAN + HUSBAND CORE COMPOSITE
    if (row.parts.length >= 3 && row.husbandParts.length >= 3) {
      addToken(
        `W_H_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}::${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`,
        i
      );
    }
    
    // 6️⃣ CHILDREN ROOT KEY
    const husbandCore = row.husbandParts.length >= 3 ? `${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}` : null;
    const childRoots = row.children_normalized.map(c => c.slice(0, 3)).sort();
    if (husbandCore) {
      for (const root of new Set(childRoots)) {
        addToken(`H_CH_ONE:${husbandCore}::${root}`, i);
      }
    }
    
    // 7️⃣ HOUSEHOLD / POLYGAMY KEY
    if (row.husbandParts.length >= 2 && row.village_normalized) {
      addToken(`HOUSE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.village_normalized}`, i);
    }

    // 8️⃣ NEW: WOMAN 1 + HUSBAND 3 CORE
    if (row.parts.length >= 1 && row.husbandParts.length >= 3) {
      addToken(`W1_H3_CORE:${row.parts[0]}|${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`, i);
    }

    // Update UI occasionally during indexing
    if (i % 25000 === 0) {
      postMessage({ type: "progress", status: "indexing", progress: 10 + Math.round((i / n) * 10), completed: i, total: n });
      await yieldToEventLoop();
    }
  }

  // 2. Iterate and Match using Candidates
  let processed = 0;
  const progressInterval = 2000;

  // Cutoff for "Common Names". If a bucket has > 500 people, we don't rely ONLY on that bucket
  // to find candidates, because checking 500*500 is slow. We rely on cross-matching other keys.
  const COMMON_TOKEN_THRESHOLD = 707;

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    // Candidate Set: contains indices of rows that share at least one key with the current row
    const candidates = new Set<number>();

    const keysToCheck: string[] = [];
    
    // Original Keys
    if (row.nationalId) keysToCheck.push(`ID:${row.nationalId}`);
    if (row.phone && row.phone.length >= 6) keysToCheck.push(`PH:${row.phone.slice(-6)}`);
    if (row.parts[0] && row.parts[0].length >= 2) keysToCheck.push(`W_N:${row.parts[0].substring(0, 3)}`);
    if (row.husbandParts[0] && row.husbandParts[0].length >= 2) keysToCheck.push(`H_N:${row.husbandParts[0].substring(0, 3)}`);
    if (row.parts.length > 1) {
      const last = row.parts[row.parts.length - 1];
      if (last.length > 2) keysToCheck.push(`W_L:${last}`);
    }

    // Add new keys to check
    if (row.parts.length >= 3) keysToCheck.push(`W_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}`);
    if (row.parts.length >= 4) keysToCheck.push(`W_CORE_L:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}|${row.parts[row.parts.length - 1]}`);
    if (row.husbandParts.length >= 3) keysToCheck.push(`H_CORE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);
    if (row.husbandParts.length >= 4) keysToCheck.push(`H_FULL:${row.husbandParts.slice(0, 4).join("|")}`);
    if (row.parts.length >= 3 && row.husbandParts.length >= 3) keysToCheck.push(`W_H_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}::${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);
    const husbandCoreCheck = row.husbandParts.length >= 3 ? `${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}` : null;
    const childRootsCheck = row.children_normalized.map(c => c.slice(0, 3)).sort();
    if (husbandCoreCheck) {
      for (const root of new Set(childRootsCheck)) {
        keysToCheck.push(`H_CH_ONE:${husbandCoreCheck}::${root}`);
      }
    }
    if (row.husbandParts.length >= 2 && row.village_normalized) keysToCheck.push(`HOUSE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.village_normalized}`);
    if (row.parts.length >= 1 && row.husbandParts.length >= 3) {
      keysToCheck.push(`W1_H3_CORE:${row.parts[0]}|${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);
    }

    for (const key of keysToCheck) {
      const matches = tokenMap.get(key);
      if (!matches) continue;

      if (matches.length > COMMON_TOKEN_THRESHOLD) {
        if (key.startsWith("W_N:") || key.startsWith("H_N:")) continue;
      }

      for (const idx of matches) {
        if (idx > i) {
          candidates.add(idx);
        }
      }
    }

    // Evaluate Candidates
    for (const j of candidates) {
      const result = pairwiseScore(rows[i], rows[j], opts);
      if (result.score >= minScore) {
        edges.push({ a: i, b: j, score: result.score, reasons: result.reasons as string[] });
      }
    }

    processed++;
    if (processed % progressInterval === 0) {
      postMessage({
        type: "progress",
        status: "building-edges",
        progress: 20 + Math.round(30 * (processed / n)), // Progress from 20% to 50%
        completed: processed,
        total: n,
      });
      await yieldToEventLoop();
    }
  }

  postMessage({ type: "progress", status: "edges-built", progress: 50, completed: n, total: n });
  return { edges, finalState: null };
};

// --- Worker Message Handling & Main Logic ---

function safePostMessage(message: any) {
  try {
    // structuredClone is the modern way to ensure an object is cloneable.
    if (typeof structuredClone === 'function') {
      structuredClone(message);
    }
    postMessage(message);
  } catch (e) {
    console.error("safePostMessage error:", e);
    postMessage({
      type: 'error',
      data: 'Worker message serialization failed. See worker console for details.'
    });
  }
}

const preprocessIncoming = (rowsChunk: any[], mapping: any) =>
  rowsChunk.map((row, index) => {
    const mappedRow: any = {
      // FIXED: use a proper template string fallback so _internalId always exists
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

self.onmessage = async (event) => {
  const { type, payload } = event.data;
  if (!type) return;

  if (type === "start") {
    mapping = payload.mapping || {};
    options = { ...defaultOptions, ...payload.options };
    options.finalScoreWeights = {
      ...defaultOptions.finalScoreWeights,
      ...(payload.options?.finalScoreWeights || {}),
    };
    options.thresholds = { ...defaultOptions.thresholds, ...(payload.options?.thresholds || {}) };
    options.rules = { ...defaultOptions.rules, ...(payload.options?.rules || {}) };
    options.autoRulesOnly = payload.options?.autoRulesOnly ?? false;
    resumeState = payload.resumeState || null;
    progressKey = payload.progressKey || "";
    inbound = [];
    await loadAutoRules(); // Load learned rules
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
      progress: Math.min(10, 1 + Math.floor((inbound.length / (payload.total || 1)) * 9)),
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
          progress: 10,
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

  // Precompute id -> index map to avoid repeated findIndex calls and to ensure correct mapping
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    idToIndex.set(rows[i]._internalId, i);
  }

  // Sorting millions of edges is fast, but let's be safe
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

    if (uf.size[rootA] + uf.size[rootB] <= 5) {
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
        const originalIndex = idToIndex.get(record._internalId);
        if (originalIndex !== undefined && originalIndex >= 0) finalized.add(originalIndex);
      });
    });

    if (idx % 2000 === 0) {
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

  // Handle leftovers
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
      const reasons = new Set([...(cluster.reasons || []), ...(rootReasons.get(root) || [])]);
      cluster.reasons = Array.from(reasons);
      finalClusters.push(cluster);
    });
  });

  // Map clusters' records back to original row objects and filter singletons
  const clustersWithRecords = finalClusters
    .map((cluster) => ({
      ...cluster,
      records: cluster.records
        .map((record: any) => {
          const idx = idToIndex.get(record._internalId);
          return idx !== undefined && idx >= 0 ? rows[idx] : null;
        })
        .filter(Boolean),
    }))
    .filter((cluster) => cluster.records.length > 1);

  // --- NEW: merge overlapping clusters and ensure no record appears in more than one final cluster ---
  // This step only merges/deduplicates clusters that share records.
  // It does not change scoring, rules, thresholds, or pairwise logic.

  let merged = mergeOverlappingClusters(clustersWithRecords);

  // Remap merged clusters to canonical row objects (defensive) and ensure uniqueness: each _internalId used once.
  const usedIds = new Set<string>();
  const finalMerged: any[] = [];

  for (const c of merged) {
    const remappedRecords = (c.records || [])
      .map((rec: any) => {
        const idx = idToIndex.get(rec._internalId);
        return idx !== undefined && idx >= 0 ? rows[idx] : null;
      })
      .filter(Boolean);

    const uniqueRecords: any[] = [];
    for (const r of remappedRecords) {
      if (!usedIds.has(r._internalId)) {
        usedIds.add(r._internalId);
        uniqueRecords.push(r);
      }
    }

    if (uniqueRecords.length > 1) {
      // Rebuild pairScores to only include edges between remaining records (best-effort).
      // We attempt to keep existing pairScores where possible by filtering by _internalId.
      const idSet = new Set(uniqueRecords.map((r) => r._internalId));
      const filteredPairScores =
        (c.pairScores || []).filter((edge: any) => {
          const aId = edge.aId ?? edge.a ?? edge.a?._internalId ?? "";
          const bId = edge.bId ?? edge.b ?? edge.b?._internalId ?? "";
          // edge may not have _internalId fields — best-effort: allow if either matches a pair
          if (!aId && !edge.a && edge.aIndex !== undefined) {
            // if edge stored indices, we leave it (can't reliably remap here)
            return true;
          }
          // If stored as ids, ensure both endpoints are kept
          if (aId && bId) {
            return idSet.has(String(aId)) && idSet.has(String(bId));
          }
          return true;
        });

      finalMerged.push({
        ...c,
        records: uniqueRecords,
        pairScores: filteredPairScores,
        reasons: Array.from(new Set(c.reasons || [])),
      });
    }
  }

  postMessage({ type: "progress", status: "annotating", progress: 95 });
  postMessage({ type: "save_progress", key: progressKey, value: null });

  return {
    clusters: finalMerged,
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

  if (rowsSubset.length <= 5) {
    const reasons = Array.from(new Set(localEdges.flatMap((edge) => edge.reasons || [])));
    return [{ records: rowsSubset, reasons, pairScores: localEdges }];
  }

  localEdges.sort((a, b) => b.score - a.score);
  const uf = new UF(rowsSubset.length);
  localEdges.forEach((edge) => {
    const ra = uf.find(edge.a);
    const rb = uf.find(edge.b);
    if (ra === rb) return;
    if (uf.size[ra] + uf.size[rb] <= 5) {
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
    if (subset.length <= 5) {
      result.push({ records: subset, reasons, pairScores: subEdges });
    } else {
      result.push(...splitCluster(subset, Math.max(minInternal, 0.45), opts));
    }
  });

  return result;
};

const mergeOverlappingClusters = (clusters: any[]) => {
  if (!clusters.length) return clusters;
  const clusterUF = new UF(clusters.length);
  const recordToCluster = new Map<string, number>();
  clusters.forEach((cluster, idx) => {
    cluster.records.forEach((record: any) => {
      const existing = recordToCluster.get(record._internalId);
      if (existing !== undefined) {
        clusterUF.merge(existing, idx);
      }
      recordToCluster.set(record._internalId, idx);
    });
  });

  const merged = new Map<number, any>();
  clusters.forEach((cluster, idx) => {
    const root = clusterUF.find(idx);
    const existing = merged.get(root);
    if (!existing) {
      merged.set(root, {
        ...cluster,
        records: [...cluster.records],
        pairScores: [...(cluster.pairScores || [])],
        reasons: Array.from(new Set(cluster.reasons || [])),
      });
      return;
    }
    existing.records = mergeDedupRecords(existing.records, cluster.records);
    existing.pairScores = mergeDedupPairScores(existing.pairScores || [], cluster.pairScores || []);
    existing.reasons = Array.from(new Set([...(existing.reasons || []), ...(cluster.reasons || [])]));
  });

  return Array.from(merged.values());
};

const mergeDedupRecords = (targetRecords: any[], sourceRecords: any[]) => {
  const map = new Map(targetRecords.map((record) => [record._internalId, record]));
  sourceRecords.forEach((record) => {
    map.set(record._internalId, record);
  });
  return Array.from(map.values());
};

const mergeDedupPairScores = (target: any[], source: any[]) => {
  const map = new Map<string, any>();
  const addEdge = (edge: any) => {
    const aKey = edge.aId ?? edge.a ?? "";
    const bKey = edge.bId ?? edge.b ?? "";
    if (!aKey || !bKey) return;
    const sorted = [aKey, bKey].sort();
    map.set(`${sorted[0]}_${sorted[1]}`, edge);
  };
  target.forEach(addEdge);
  source.forEach(addEdge);
  return Array.from(map.values());
};

    