// src/workers/cluster.worker.ts
import { alignLineage, jaroWinkler, collapseDuplicateAncestors, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';
import type { RecordRow } from "@/lib/types";

// --- Preprocessing Logic (Copied from preprocess.ts) ---

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
  "عبد الله","عبد الرحمن","عبد الرحيم","عبد الكريم","عبد العزيز",
  "عبد الملك","عبد السلام","عبد القادر","عبد الجليل","عبد الرزاق",
  "عبد الغني","عبد الوهاب","عبد الاله","عبد الواحد","عبد الماجد",
  "امه الله","امه الرحمن","امه الرحيم","امه الكريم",
  "صنع الله","عطاء الله","نور الله","فتح الله","نصر الله",
  "فضل الله","رحمه الله","حسب الله","جود الله",
  "نور الدين","شمس الدين","سيف الدين","زين الدين","جمال الدين",
  "كمال الدين","صلاح الدين","علاء الدين","تقي الدين","نجم الدين",
  "ابو بكر","ابو طالب","ابو هريره",
  "ام كلثوم","ام سلمه","ام حبيبه",
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

  for (const name of FIXED_COMPOUND_NAMES) {
    const normalized = baseArabicNormalize(name);
    const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
    s = s.replace(re, normalized.replace(" ", "_"));
  }

  const parts = s.split(" ");
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) {
      const pair = `${parts[i]} ${parts[i + 1]}`;
      if (PREFIX_COMPOUND_RULES.some((r) => r.test(pair))) {
        result.push(pair.replace(" ", "_"));
        i++; 
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

const splitParts = (value: string) =>
  value ? value.split(/\s+/).filter(Boolean) : [];

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
    parts: raw.parts || splitParts(womanName_normalized),
    husbandParts: raw.husbandParts || splitParts(husbandName_normalized),
  };
};

export interface WorkerOptions {
    thresholds: {
        minPair: number;
        minInternal: number;
        blockChunkSize: number;
    };
    finalScoreWeights: {
        [key: string]: number;
    };
    rules: {
        [key: string]: boolean;
    };
    autoRulesOnly?: boolean;
}

// --- Executor for Learned Rules ---
type RuleResult = {
  score: number;
  reasons: string[];
};

let executeLearnedRules: (
  a: any,
  b: any,
  jw: Function,
  nameOrderFreeScore: Function,
  tokenJaccard: Function,
  minPair: number
) => RuleResult | null = () => null;

function compileRules(rules: any[]) {
  try {
    if (!Array.isArray(rules) || rules.length === 0) {
      executeLearnedRules = () => null;
      return;
    }

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

    const wrappedRules = enabledRules.map((r, idx) => `
      try {
        ${r.code}
      } catch (e) { }
    `).join('\n');

    executeLearnedRules = new Function(
      'a', 'b', 'jw', 'nameOrderFreeScore', 'tokenJaccard', 'minPair',
      `
      const A = a.parts || [];
      const B = b.parts || [];
      const HA = a.husbandParts || [];
      const HB = b.husbandParts || [];
      ${wrappedRules}
      return null;
      `
    ) as any;

  } catch (e) {
    console.warn("Could not load auto-rules.", e);
    executeLearnedRules = () => null;
  }
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// --- Rule Logic ---

const applyAdditionalRules = (
  a: PreprocessedRow,
  b: PreprocessedRow,
  opts: WorkerOptions
) => {
  if (opts.autoRulesOnly) return null;

  const minPair = opts.thresholds.minPair;
  const jw = jaroWinkler;

  const A = a.parts;
  const B = b.parts;
  const HA = a.husbandParts;
  const HB = b.husbandParts;

  const s93 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.93;
  const s95 = (x?: string, y?: string) => jw(x || "", y || "") >= 0.95;

  if (A.length >= 4 && B.length >= 4 && jw(A[0], B[0]) >= 0.98 && jw(A[1], B[1]) >= 0.98 && jw(A[2], B[2]) >= 0.95) {
    return { score: Math.min(1, minPair + 0.35), reasons: ["EXACT_WOMAN_MATCH"] };
  }

  if (A.length > 0 && B.length > 0 && jw(A[0], B[0]) >= 0.93 && jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.96) {
    return { score: 1.0, reasons: ["SAME_WOMAN_FIRSTNAME_EXACT_HUSBAND"] };
  }

  if (A.length >= 3 && B.length >= 3 && HA.length >= 3 && HB.length >= 3 &&
      jw(A[0], B[0]) >= 0.98 && jw(A[1], B[1]) >= 0.90 && jw(A[2], B[2]) >= 0.95 &&
      jw(HA[0], HB[0]) >= 0.98 && jw(HA[1], HB[1]) >= 0.95 && jw(HA[2], HB[2]) >= 0.95) {
    return { score: Math.min(1, minPair + 0.33), reasons: ["CORE_WOMAN_AND_HUSBAND_LINEAGE_MATCH"] };
  }

  if (A.length >= 4 && B.length >= 4 && HA.length >= 4 && HB.length >= 4 &&
      jw(A[0], B[0]) >= 0.95 && jw(A[A.length - 1], B[B.length - 1]) >= 0.93 &&
      jw(HA[0], HB[0]) >= 0.95 && jw(HA[1], HB[1]) >= 0.95 && jw(HA[2], HB[2]) >= 0.93 && jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.93) {
    return { score: Math.min(1, minPair + 0.26), reasons: ["SHARED_HOUSEHOLD_SAME_HUSBAND"] };
  }

  if (A.length >= 4 && B.length >= 4 && HA.length >= 4 && HB.length >= 4 &&
      s95(A[0], B[0]) && s95(A[1], B[1]) && s93(A[2], B[2]) &&
      s95(HA[0], HB[0]) && s93(HA[1], HB[1]) && s93(HA[2], HB[2])) {
    return { score: Math.min(1, minPair + 0.32), reasons: ["FULL_WOMAN_AND_HUSBAND_MATCH"] };
  }

  if (A.length >= 3 && B.length >= 3 && s95(A[0], B[0]) && s95(A[1], B[1]) && s93(A[2], B[2]) && nameOrderFreeScore(HA, HB) >= 0.95) {
    return { score: Math.min(1, minPair + 0.27), reasons: ["SAME_HUSBAND_WOMAN_VARIANT"] };
  }

  const husbandExact = jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.97;
  const childrenA = a.children_normalized || [];
  const childrenB = b.children_normalized || [];

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
    if (childMatches >= 1 || tokenJaccard(childrenA, childrenB) >= 0.6) {
      return { score: 1.0, reasons: ["SAME_HUSBAND_CHILDREN_OVERLAP"] };
    }
  }

  if (A.length && B.length && jw(A[0], B[0]) >= 0.93 &&
     (jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.9 || nameOrderFreeScore(HA, HB) >= 0.9) &&
     tokenJaccard(a.children_normalized, b.children_normalized) >= 0.9) {
    return { score: Math.min(1, minPair + 0.25), reasons: ["DUPLICATED_HUSBAND_LINEAGE"] };
  }

  const collapsedA = collapseDuplicateAncestors(A);
  const collapsedB = collapseDuplicateAncestors(B);
  if (collapsedA.length >= 4 && collapsedB.length >= 4) {
      const maxLen = Math.max(collapsedA.length, collapsedB.length);
      const alignedA = alignLineage(collapsedA, maxLen);
      const alignedB = alignLineage(collapsedB, maxLen);
      if (jw(alignedA[maxLen - 1], alignedB[maxLen - 1]) >= 0.95 && jw(alignedA[0], alignedB[0]) >= 0.88) {
          let strongMatches = 0;
          for (let i = 1; i < maxLen - 1; i++) {
              if (jw(alignedA[i], alignedB[i]) >= 0.93) strongMatches++;
          }
          if (strongMatches >= maxLen - 3) return { score: Math.min(1, minPair + 0.40), reasons: ["COLLAPSED_LINEAGE_FULL_MATCH"] };
      }
  }

  if (A.length >= 3 && B.length >= 3 && s93(A[0], B[0]) && s93(A[1], B[1]) && s93(A[2], B[2]) && jw(HA[0] || "", HB[0] || "") < 0.6) {
    return { score: Math.min(1, minPair + 0.2), reasons: ["WOMAN_LINEAGE_ONLY"] };
  }
  
  const autoResult = executeLearnedRules(a, b, jaroWinkler, nameOrderFreeScore, tokenJaccard, opts.thresholds.minPair);
  if (autoResult) return autoResult;

  const investigationWords = ["تحت", "التحقيق", "مراجعة", "قيد", "موقوف", "غير", "مكتمل", "التحقق", "مراجعه"];
  if (investigationWords.some(w => A.includes(w) || B.includes(w)) && s95(A[0], B[0]) && s93(A[A.length - 1], B[B.length - 1]) && nameOrderFreeScore(HA, HB) >= 0.93) {
    return { score: Math.min(1, minPair + 0.25), reasons: ["INVESTIGATION_PLACEHOLDER"] };
  }

  if (nameOrderFreeScore(HA, HB) >= 0.8 && jw(A[A.length - 1], B[B.length - 1]) >= 0.9 && A.filter(x => B.some(y => jw(x, y) >= 0.93)).length >= 3) {
    return { score: Math.min(1, minPair + 0.3), reasons: ["POLYGAMY_SHARED_HOUSEHOLD"] };
  }

  const setA = new Set(A);
  const setB = new Set(B);
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;

  if (union > 0 && inter / union >= 0.8) {
    return { score: Math.min(1, minPair + 0.22), reasons: ["TOKEN_REORDER_LAST_RESORT"] };
  }

  return null;
};

// --- Config & Options ---

const defaultOptions: WorkerOptions = {
  thresholds: { minPair: 0.62, minInternal: 0.5, blockChunkSize: 3000 },
  finalScoreWeights: { firstNameScore: 0.15, familyNameScore: 0.25, advancedNameScore: 0.12, tokenReorderScore: 0.1, husbandScore: 0.12, idScore: 0.08, phoneScore: 0.05, childrenScore: 0.06, locationScore: 0.04 },
  rules: { enablePolygamyRules: true },
  autoRulesOnly: false,
};

// Guard to prevent dummy IDs/Phones from falsely creating 100% matches
const isPlaceholderValue = (val: string) => {
  if (!val) return true;
  const str = String(val).trim();
  if (str.length < 5) return true;
  if (/^(\d)\1+$/.test(str)) return true; // e.g. 000000
  if (str.includes("1234567")) return true;
  return false;
};

export function computePairScore(rawA: any, rawB: any, opts: WorkerOptions) {
  const mergedOpts: typeof defaultOptions = {
    ...defaultOptions,
    thresholds: { ...defaultOptions.thresholds, ...(opts.thresholds || {}) },
    finalScoreWeights: { ...defaultOptions.finalScoreWeights, ...(opts.finalScoreWeights || {}) },
    rules: { ...defaultOptions.rules, ...(opts.rules || {}) },
  };

  const rowA = preprocessRow(rawA);
  const rowB = preprocessRow(rawB);

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

  const validIdA = !isPlaceholderValue(rowA.nationalId);
  const validIdB = !isPlaceholderValue(rowB.nationalId);
  const validPhoneA = !isPlaceholderValue(rowA.phone);
  const validPhoneB = !isPlaceholderValue(rowB.phone);

  const phoneScoreVal = rowA.phone && rowB.phone && validPhoneA && validPhoneB
    ? rowA.phone === rowB.phone ? 1 : rowA.phone.slice(-6) === rowB.phone.slice(-6) ? 0.85 : rowA.phone.slice(-4) === rowB.phone.slice(-4) ? 0.6 : 0 : 0;
    
  const idScore = rowA.nationalId && rowB.nationalId && validIdA && validIdB
    ? rowA.nationalId === rowB.nationalId ? 1 : rowA.nationalId.slice(-5) === rowB.nationalId.slice(-5) ? 0.75 : 0 : 0;
    
  const childrenScore = tokenJaccard(rowA.children_normalized, rowB.children_normalized);
  let locationScore = 0;
  if (rowA.village_normalized && rowB.village_normalized && rowA.village_normalized === rowB.village_normalized) locationScore += 0.4;
  if (rowA.subdistrict_normalized && rowB.subdistrict_normalized && rowA.subdistrict_normalized === rowB.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  
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

  const ruleResult = applyAdditionalRules(rowA, rowB, mergedOpts);
  if (ruleResult) {
    finalScore = ruleResult.score;
    finalReasons = [...new Set([...finalReasons, ...ruleResult.reasons])];
  }

  if (rowA.nationalId && rowB.nationalId && rowA.nationalId === rowB.nationalId && validIdA && validIdB) {
    finalScore = Math.max(finalScore, 0.99);
    finalReasons.push("EXACT_ID");
  }

  const polygamyMatch = mergedOpts.rules.enablePolygamyRules &&
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

// --- Optimized Edges Builder ---

const buildEdges = async (rows: PreprocessedRow[], minScore: number, opts: WorkerOptions, resumeState: any = null) => {
  const n = rows.length;
  if (n <= 1) return { edges: [], finalState: null };
  const edges: { a: number; b: number; score: number; reasons: string[] }[] = resumeState?.edges || [];

  postMessage({ type: "progress", status: "indexing", progress: 10, completed: 0, total: n });

  const tokenMap = new Map<string, number[]>();
  const addToken = (key: string, index: number) => {
    if (!key || key.length < 2) return;
    let arr = tokenMap.get(key);
    if (!arr) { arr = []; tokenMap.set(key, arr); }
    arr.push(index);
  };

  for (let i = 0; i < n; i++) {
    const row = rows[i];

    if (row.nationalId) addToken(`ID:${row.nationalId}`, i);
    if (row.phone && row.phone.length >= 6) addToken(`PH:${row.phone.slice(-6)}`, i);
    if (row.womanName_normalized) addToken(`W_EXACT:${row.womanName_normalized}`, i);
    if (row.husbandName_normalized) addToken(`H_EXACT:${row.husbandName_normalized}`, i);
    if (row.parts[0] && row.parts[0].length >= 2) addToken(`W_N:${row.parts[0].substring(0, 3)}`, i);
    if (row.husbandParts[0] && row.husbandParts[0].length >= 2) addToken(`H_N:${row.husbandParts[0].substring(0, 3)}`, i);
    if (row.parts.length > 1) {
      const last = row.parts[row.parts.length - 1];
      if (last.length > 2) addToken(`W_L:${last}`, i);
    }

    if (row.parts.length >= 3) addToken(`W_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}`, i);
    if (row.parts.length >= 4) addToken(`W_CORE_L:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}|${row.parts[row.parts.length - 1]}`, i);
    if (row.husbandParts.length >= 3) addToken(`H_CORE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`, i);
    if (row.husbandParts.length >= 4) addToken(`H_FULL:${row.husbandParts.slice(0, 4).join("|")}`, i);
    if (row.parts.length >= 3 && row.husbandParts.length >= 3) addToken(`W_H_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}::${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`, i);
    
    const husbandCoreCheck = row.husbandParts.length >= 3 ? `${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}` : null;
    if (husbandCoreCheck) {
      for (const root of new Set(row.children_normalized.map(c => c.slice(0, 3)).sort())) {
        addToken(`H_CH_ONE:${husbandCoreCheck}::${root}`, i);
      }
    }
    if (row.husbandParts.length >= 2 && row.village_normalized) addToken(`HOUSE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.village_normalized}`, i);
    if (row.parts.length >= 1 && row.husbandParts.length >= 3) addToken(`W1_H3_CORE:${row.parts[0]}|${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`, i);

    if (i % 25000 === 0) {
      postMessage({ type: "progress", status: "indexing", progress: 10 + Math.round((i / n) * 10), completed: i, total: n });
      await yieldToEventLoop();
    }
  }

  let processed = 0;
  const progressInterval = 2000;
  const COMMON_TOKEN_THRESHOLD = 707;

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const candidates = new Set<number>();
    const keysToCheck: string[] = [];
    
    if (row.nationalId) keysToCheck.push(`ID:${row.nationalId}`);
    if (row.phone && row.phone.length >= 6) keysToCheck.push(`PH:${row.phone.slice(-6)}`);
    if (row.womanName_normalized) keysToCheck.push(`W_EXACT:${row.womanName_normalized}`);
    if (row.husbandName_normalized) keysToCheck.push(`H_EXACT:${row.husbandName_normalized}`);
    if (row.parts[0] && row.parts[0].length >= 2) keysToCheck.push(`W_N:${row.parts[0].substring(0, 3)}`);
    if (row.husbandParts[0] && row.husbandParts[0].length >= 2) keysToCheck.push(`H_N:${row.husbandParts[0].substring(0, 3)}`);
    if (row.parts.length > 1) {
      const last = row.parts[row.parts.length - 1];
      if (last.length > 2) keysToCheck.push(`W_L:${last}`);
    }

    if (row.parts.length >= 3) keysToCheck.push(`W_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}`);
    if (row.parts.length >= 4) keysToCheck.push(`W_CORE_L:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}|${row.parts[row.parts.length - 1]}`);
    if (row.husbandParts.length >= 3) keysToCheck.push(`H_CORE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);
    if (row.husbandParts.length >= 4) keysToCheck.push(`H_FULL:${row.husbandParts.slice(0, 4).join("|")}`);
    if (row.parts.length >= 3 && row.husbandParts.length >= 3) keysToCheck.push(`W_H_CORE:${row.parts[0]}|${row.parts[1]}|${row.parts[2]}::${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);
    const husbandCoreCheck = row.husbandParts.length >= 3 ? `${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}` : null;
    if (husbandCoreCheck) {
      for (const root of new Set(row.children_normalized.map(c => c.slice(0, 3)).sort())) keysToCheck.push(`H_CH_ONE:${husbandCoreCheck}::${root}`);
    }
    if (row.husbandParts.length >= 2 && row.village_normalized) keysToCheck.push(`HOUSE:${row.husbandParts[0]}|${row.husbandParts[1]}|${row.village_normalized}`);
    if (row.parts.length >= 1 && row.husbandParts.length >= 3) keysToCheck.push(`W1_H3_CORE:${row.parts[0]}|${row.husbandParts[0]}|${row.husbandParts[1]}|${row.husbandParts[2]}`);

    for (const key of keysToCheck) {
      const matches = tokenMap.get(key);
      if (!matches) continue;
      if (matches.length > COMMON_TOKEN_THRESHOLD) {
        if (key.startsWith("W_N:") || key.startsWith("H_N:")) continue;
      }
      for (const idx of matches) {
        if (idx > i) candidates.add(idx);
      }
    }

    for (const j of candidates) {
      const result = pairwiseScore(rows[i], rows[j], opts);
      if (result.score >= minScore) {
        edges.push({ a: i, b: j, score: result.score, reasons: result.reasons as string[] });
      }
    }

    processed++;
    if (processed % progressInterval === 0) {
      postMessage({ type: "progress", status: "building-edges", progress: 20 + Math.round(30 * (processed / n)), completed: processed, total: n });
      await yieldToEventLoop();
    }
  }

  postMessage({ type: "progress", status: "edges-built", progress: 50, completed: n, total: n });
  return { edges, finalState: null };
};

// --- Worker Message Handling & Main Logic ---

function safePostMessage(message: any) {
  try {
    if (typeof structuredClone === 'function') structuredClone(message);
    postMessage(message);
  } catch (e) {
    console.error("safePostMessage error:", e);
    postMessage({ type: 'error', data: 'Worker message serialization failed.' });
  }
}

const preprocessIncoming = (rowsChunk: any[], mapping: any) =>
  rowsChunk.map((row, index) => {
    const mappedRow: any = { _internalId: row._internalId || `row_${Date.now()}_${index}` };
    Object.entries(mapping).forEach(([key, column]) => {
      if (key === "cluster_id" || !column) return;
      if (row[column as string] !== undefined) mappedRow[key as keyof any] = row[column as string];
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
    options.finalScoreWeights = { ...defaultOptions.finalScoreWeights, ...(payload.options?.finalScoreWeights || {}) };
    options.thresholds = { ...defaultOptions.thresholds, ...(payload.options?.thresholds || {}) };
    options.rules = { ...defaultOptions.rules, ...(payload.options?.rules || {}) };
    options.autoRulesOnly = payload.options?.autoRulesOnly ?? false;
    resumeState = payload.resumeState || null;
    progressKey = payload.progressKey || "";
    inbound = [];
    compileRules(payload.autoRules || []);
    postMessage({ type: "progress", status: "worker-ready", progress: 1 });
    return;
  }

  if (type === "data") {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    inbound.push(...preprocessIncoming(rows, mapping));
    postMessage({ type: "progress", status: "receiving", progress: Math.min(10, 1 + Math.floor((inbound.length / (payload.total || 1)) * 9)), completed: inbound.length, total: payload.total ?? undefined });
    return;
  }

  if (type === "end") {
    setTimeout(async () => {
      try {
        postMessage({ type: "progress", status: "mapping-rows", progress: 10, completed: 0, total: inbound.length });
        const { edges } = await buildEdges(inbound, options.thresholds.minPair, options, resumeState);
        const result = await runClustering(inbound, edges, options);
        postMessage({ type: "done", payload: result });
      } catch (err: any) {
        postMessage({ type: "error", error: err?.message || "Unknown error" });
      }
    }, 50);
  }
};

// === NEW: Re-clustering function to strictly enforce max size of 4 via highest local edges ===
function breakLargeCluster(globalIndices: number[], globalEdges: any[], maxSize: number, rows: any[], rootReasons: Set<string>) {
  const localUf = new UF(globalIndices.length);
  const globalToLocal = new Map<number, number>();
  globalIndices.forEach((gIdx, lIdx) => globalToLocal.set(gIdx, lIdx));

  // Extract edges that are only between members of this cluster
  const localEdges = globalEdges.filter(e => globalToLocal.has(e.a) && globalToLocal.has(e.b));
  
  // Sort edges strictly by similarity score (Robust greedy partition)
  localEdges.sort((x, y) => y.score - x.score);

  // Re-cluster locally, enforcing strict size bounds
  for(const edge of localEdges) {
      const la = globalToLocal.get(edge.a)!;
      const lb = globalToLocal.get(edge.b)!;
      const rootA = localUf.find(la);
      const rootB = localUf.find(lb);
      
      if (rootA !== rootB && localUf.size[rootA] + localUf.size[rootB] <= maxSize) {
          localUf.merge(rootA, rootB);
      }
  }

  // Extract the split groups
  const subGroups = new Map<number, number[]>();
  for(let i=0; i < globalIndices.length; i++) {
      const root = localUf.find(i);
      if(!subGroups.has(root)) subGroups.set(root, []);
      subGroups.get(root)!.push(globalIndices[i]);
  }

  const results = [];
  for (const subGlobalIndices of subGroups.values()) {
      if (subGlobalIndices.length <= 1) continue;
      const subset = subGlobalIndices.map(idx => rows[idx]);
      const subSetEdges = localEdges.filter(e => subGlobalIndices.includes(e.a) && subGlobalIndices.includes(e.b));
      results.push({
          records: subset,
          reasons: Array.from(rootReasons),
          pairScores: subSetEdges
      });
  }
  return results;
}


const runClustering = async (rows: PreprocessedRow[], edges: any[], opts: WorkerOptions) => {
  const uf = new UF(rows.length);
  const rootReasons = new Map<number, Set<string>>();
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) idToIndex.set(rows[i]._internalId, i);

  edges.sort((a, b) => b.score - a.score);

  // Phase 1: Group everything loosely first to gather all potential matches (preventing 100% exact matches from splitting early)
  for (let idx = 0; idx < edges.length; idx++) {
    const edge = edges[idx];
    const rootA = uf.find(edge.a);
    const rootB = uf.find(edge.b);

    const reasonsA = rootReasons.get(rootA) || new Set();
    const reasonsB = rootReasons.get(rootB) || new Set();
    (edge.reasons || []).forEach((reason: string) => { reasonsA.add(reason); reasonsB.add(reason); });
    rootReasons.set(rootA, reasonsA);
    rootReasons.set(rootB, reasonsB);

    if (rootA === rootB) continue;
    uf.merge(rootA, rootB);

    if (idx % 2000 === 0) {
      postMessage({ type: "progress", status: "merging-edges", progress: 60 + Math.round(35 * (idx / edges.length)), completed: idx + 1, total: edges.length });
      await yieldToEventLoop();
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const root = uf.find(i);
    const arr = groups.get(root) || [];
    arr.push(i);
    groups.set(root, arr);
  }

  // Phase 2: Enforce Maximum Size of 4 using Robust Local Scoring
  const finalClusters: any[] = [];
  groups.forEach((indices, root) => {
    if (indices.length <= 1) return;
    
    if (indices.length <= 4) {
        // Safe size, keep exactly as is
        const subset = indices.map((idx) => rows[idx]);
        const indicesSet = new Set(indices);
        const subEdges = edges.filter((edge) => indicesSet.has(edge.a) && indicesSet.has(edge.b));
        finalClusters.push({ records: subset, reasons: Array.from(rootReasons.get(root) || []), pairScores: subEdges });
    } else {
        // Exceeds 4: Break down robustly prioritizing top similarities
        const splitGroups = breakLargeCluster(indices, edges, 4, rows, rootReasons.get(root) || new Set());
        finalClusters.push(...splitGroups);
    }
  });

  let merged = mergeOverlappingClusters(finalClusters);

  const usedIds = new Set<string>();
  const finalMerged: any[] = [];
  let clusterCounter = 1;

  for (const c of merged) {
    const remappedRecords = (c.records || []).map((rec: any) => {
        const idx = idToIndex.get(rec._internalId);
        return idx !== undefined && idx >= 0 ? rows[idx] : null;
    }).filter(Boolean);

    const uniqueRecords: any[] = [];
    for (const r of remappedRecords) {
      if (!usedIds.has(r._internalId)) {
        usedIds.add(r._internalId);
        uniqueRecords.push(r);
      }
    }

    if (uniqueRecords.length > 1) {
      const idSet = new Set(uniqueRecords.map((r) => r._internalId));
      const filteredPairScores = (c.pairScores || []).filter((edge: any) => {
          const aId = edge.aId ?? edge.a ?? edge.a?._internalId ?? "";
          const bId = edge.bId ?? edge.b ?? edge.b?._internalId ?? "";
          if (!aId && !edge.a && edge.aIndex !== undefined) return true;
          if (aId && bId) return idSet.has(String(aId)) && idSet.has(String(bId));
          return true;
      });
      
      const maxBeneficiaryId = uniqueRecords.reduce((max: number, r: RecordRow) => {
          const currentId = Number(r.beneficiaryId);
          return !isNaN(currentId) && currentId > max ? currentId : max;
      }, 0);
      const generatedClusterId = maxBeneficiaryId > 0 ? maxBeneficiaryId : clusterCounter++;

      finalMerged.push({
        ...c,
        Generated_Cluster_ID: generatedClusterId,
        records: uniqueRecords,
        pairScores: filteredPairScores,
        reasons: Array.from(new Set(c.reasons || [])),
      });
    }
  }

  postMessage({ type: "progress", status: "annotating", progress: 95 });
  postMessage({ type: "save_progress", key: progressKey, value: null });

  return { clusters: finalMerged, edgesUsed: edges, rows };
};

class UF {
  parent: number[];
  size: number[];
  members: Map<number, Set<number>>;

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, index) => index);
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

const mergeOverlappingClusters = (clusters: any[]) => {
  if (!clusters.length) return clusters;
  const clusterUF = new UF(clusters.length);
  const recordToCluster = new Map<string, number>();

  clusters.forEach((cluster, idx) => {
    cluster.records.forEach((record: any) => {
        const internalId = record._internalId;
        if (recordToCluster.has(internalId)) clusterUF.merge(recordToCluster.get(internalId)!, idx);
        else recordToCluster.set(internalId, idx);
    });
  });

  const merged = new Map<number, any>();
  clusters.forEach((cluster, idx) => {
    const root = clusterUF.find(idx);
    const existing = merged.get(root);
    if (!existing) {
      merged.set(root, { ...cluster, records: [...cluster.records], pairScores: [...(cluster.pairScores || [])], reasons: Array.from(new Set(cluster.reasons || [])) });
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
  sourceRecords.forEach((record) => map.set(record._internalId, record));
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