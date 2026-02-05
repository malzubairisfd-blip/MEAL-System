// src/lib/arabic-fixer.ts
// --- START OF STANDALONE ARABIC FIXER (No Dependencies) ---
const ARABIC_CHARS_arabic_fixer: Record<string, string[]> = {
  'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], 'أ': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'],
  'ب': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'], 'ت': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
  'ث': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'], 'ج': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
  'ح': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'], 'خ': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
  'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], 'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'],
  'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], 'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'],
  'س': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'], 'ش': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
  'ص': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'], 'ض': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
  'ط': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'], 'ظ': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFEC7'],
  'ع': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'], 'غ': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
  'ف': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'], 'ق': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
  'ك': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'], 'ل': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
  'م': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'], 'ن': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
  'ه': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'], 'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'],
  'ي': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'], 'ى': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'],
  'ة': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], 'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'],
  'ؤ': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'], 'إ': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'],
  'ئ': ['\uFE89', '\uFE8A', '\uFE8C', '\uFE8B'], 'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80']
};
const NON_CONN_arabic_fixer = ['ا','أ','إ','آ','د','ذ','ر','ز','و','ؤ','ء'];
export function fixArabic(text: string): string {
  if (!text) return "";
  let shaped = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!ARABIC_CHARS_arabic_fixer[c]) { shaped += c; continue; }
    const p = chars[i-1], n = chars[i+1];
    const canP = p && ARABIC_CHARS_arabic_fixer[p] && !NON_CONN_arabic_fixer.includes(p);
    const canN = n && ARABIC_CHARS_arabic_fixer[n];
    let idx = 0; // Isolated
    if (canP && canN) idx = 2; else if (canP) idx = 1; else if (canN) idx = 3;
    shaped += ARABIC_CHARS_arabic_fixer[c][idx];
  }
  return shaped.split("").reverse().join("");
}
// --- END OF STANDALONE FIXER ---

// Arabic digits (١٢٣)
export function arabicNumber(num: number) {
  return String(num).replace(/\d/g, d =>
    "٠١٢٣٤٥٦٧٨٩"[Number(d)]
  );
}


// src/lib/arabicClusterSummary.ts
const getScoreColor_arabicClusterSummary = (score?: number) => {
    if (score === undefined) return "color: #4B5563"; // gray-600
    if (score >= 90) return "color: #DC2626"; // red-600
    if (score >= 75) return "color: #F97316"; // orange-500
    if (score >= 60) return "color: #2563EB"; // blue-600
    return "color: #4B5563"; // gray-600
};

export function getDecisionAndNote(confidenceScore: number) {
  let decision = "إحتمالية تكرار";
  let expertNote = "قد يكون هنالك إحتمالية لوجود تكرار نتيجة لتطابق بعض اجزاء من الاسم للمستفيدة او الزوج. يوصى بالتحقق المكتبي من المجموعة.";

  if (confidenceScore >= 85) {
    decision = "تكرار مؤكد";
    expertNote =
      "يوجد تطابق شامل في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وابقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج.";
  } else if (confidenceScore >= 70) {
    decision = "اشتباه تكرار مؤكد";
    expertNote =
      "يوجد تشابه مرتفع في الأسماء والنسب مع احتمالية مرتفعة أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وفي حال كان هنالك حالات تكرار يتم إبقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج او يتم تعليق المجموعه للتحقق الميداني.";
  } else if (confidenceScore >= 60) {
    decision = "اشتباه تكرار";
    expertNote =
      "يوجد تشابه جزئي، وقد يكون ناتجًا عن تشابه أسماء شائع في المنطقة. يوصى بالتحقق المكتبي والميداني من المجموعة.";
  }
  return { decision, expertNote };
}

type ClusterSummaryData_arabicClusterSummary = {
  reasons?: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidenceScore?: number;
}

const REASON_EXPLANATIONS_arabicClusterSummary: Record<string, string> = {
  SAME_HUSBAND_CHILDREN_OVERLAP: "تطابق تام لاسم الزوج مع وجود طفل واحد مشترك على الأقل.",
  CORE_WOMAN_AND_HUSBAND_LINEAGE_MATCH: "تطابق قوي في الأسماء الأولى والآباء والأجداد لكل من الزوجة والزوج.",
  FULL_WOMAN_AND_HUSBAND_MATCH: "تطابق شبه كامل في أسماء الزوجة والزوج وأنسابهم.",
  SAME_HUSBAND_WOMAN_VARIANT: "تطابق قوي في اسم الزوج مع تشابه في اسم الزوجة ونسبها.",
  DUPLICATED_HUSBAND_LINEAGE: "تطابق في اسم الزوج مع وجود تشابه في أسماء الأطفال.",
  WOMAN_LINEAGE_ONLY: "تشابه قوي في نسب المرأة مع اختلاف في اسم الزوج.",
  INVESTIGATION_PLACEHOLDER: "أحد السجلات يحتوي على كلمات مثل 'تحت التحقيق' مما يستدعي المراجعة.",
  POLYGAMY_SHARED_HOUSEHOLD: "نمط تعدد زوجات محتمل بناءً على تطابق اسم العائلة والزوج.",
  TOKEN_REORDER_LAST_RESORT: "تشابه كبير في الكلمات المكونة للأسماء مع اختلاف في الترتيب.",
  SHARED_HOUSEHOLD_SAME_HUSBAND: "تطابق قوي في اسم الزوج ونسبه مع تطابق في اسم العائلة للزوجة."
};


export function generateArabicClusterSummary(
  summaryData: ClusterSummaryData_arabicClusterSummary,
  rows: any[]
) {
  const reasons: string[] = summaryData.reasons || [];
  const size = rows.length;

  const explanations = Array.from(new Set(reasons))
        .map(reason => REASON_EXPLANATIONS_arabicClusterSummary[reason])
        .filter(Boolean);

  if (explanations.length === 0 && (summaryData.confidenceScore || 0) > 60) {
      explanations.push("تشابه عام في مكونات متعددة (أسماء، هوية، هاتف).");
  }

  const avgWoman = Number.isFinite(summaryData.avgWomanNameScore) ? Math.round(summaryData.avgWomanNameScore! * 100) : 0;
  const avgHusband = Number.isFinite(summaryData.avgHusbandNameScore) ? Math.round(summaryData.avgHusbandNameScore! * 100) : 0;
  const avgFinal = Number.isFinite(summaryData.avgFinalScore) ? Math.round(summaryData.avgFinalScore! * 100) : 0;
  const confidenceScore = Number.isFinite(summaryData.confidenceScore) ? Math.round(summaryData.confidenceScore!) : 0;

  const { decision, expertNote } = getDecisionAndNote(confidenceScore);

  const summaryHtml = `النتيجة العامة:<br>تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br><br>مستوى الثقة: <strong style="${getScoreColor_arabicClusterSummary(confidenceScore)}">${confidenceScore}%</strong><br><br>تحليل درجات التشابه:<br>• متوسط تشابه اسم المرأة: <strong style="${getScoreColor_arabicClusterSummary(avgWoman)}">${avgWoman}%</strong><br>• متوسط تشابه اسم الزوج: <strong style="${getScoreColor_arabicClusterSummary(avgHusband)}">${avgHusband}%</strong><br>• الدرجة النهائية للتشابه: <strong style="${getScoreColor_arabicClusterSummary(avgFinal)}">${avgFinal}%</strong><br><br>أسباب التجميع:<br>${explanations.map(e => `• ${e}`).join("<br>") || "• تحليل التشابه العام"}<br><br>تقييم خبير:<br>${expertNote}<br><br>القرار النهائي: ${decision}`;

  return summaryHtml;
}


// src/lib/auditEngine.ts
import type { RecordRow as RecordRow_auditEngine } from "./types";

export interface AuditFinding_auditEngine {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow_auditEngine[];
}

/* -------------------------------------------------------------
   BASIC NORMALIZATION HELPERS
------------------------------------------------------------- */
function safeString_auditEngine(x: any) {
  return x === null || x === undefined ? "" : String(x);
}

function digitsOnly_auditEngine(x: any) {
  return safeString_auditEngine(x).replace(/\D/g, "");
}

function normalizeArabic_auditEngine(s: any): string {
  if (!s) return "";
  let str = String(s); // Ensure 's' is a string before calling normalize
  str = str.normalize("NFKC");
  str = str.replace(/يحيي/g, "يحي");
  str = str.replace(/يحيى/g, "يحي");
  str = str.replace(/عبد /g, "عبد");
  str = str.replace(/[ًٌٍََُِّْـء]/g, "");
  str = str.replace(/[أإآ]/g, "ا");
  str = str.replace(/ى/g, "ي");
  str = str.replace(/ؤ/g, "و");
  str = str.replace(/ئ/g, "ي");
  str = str.replace(/ة/g, "ه");
  str = str.replace(/[^ء-ي0-9 ]/g, " ");
  str = str.replace(/\s+/g, " ").trim();
  return str.toLowerCase();
}

function tokens_auditEngine(s: string) {
  const n = normalizeArabic_auditEngine(s || "");
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/* -------------------------------------------------------------
   SIMPLE JARO–WINKLER FOR AUDIT
------------------------------------------------------------- */
function jaroWinkler_auditEngine(a: string, b: string) {
  a = safeString_auditEngine(a);
  b = safeString_auditEngine(b);
  if (!a || !b) return 0;

  const la = a.length, lb = b.length;
  const dist = Math.floor(Math.max(la, lb) / 2) - 1;

  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);

  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - dist);
    const end = Math.min(i + dist + 1, lb);

    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  let trans = 0;

  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }

  trans /= 2;

  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;

  // prefix
  let prefix = 0;
  const maxPrefix = 4;

  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/* -------------------------------------------------------------
   TOKEN JACCARD FOR NAME ORDER FREE MATCHING
------------------------------------------------------------- */
function tokenJaccard_auditEngine(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length && !bTokens.length) return 0;

  const A = new Set(aTokens);
  const B = new Set(bTokens);

  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;

  return inter / (new Set([...A, ...B]).size || 1);
}

function nameOrderFree_auditEngine(a: string, b: string) {
  const tA = tokens_auditEngine(a);
  const tB = tokens_auditEngine(b);
  if (!tA.length || !tB.length) return 0;

  const jacc = tokenJaccard_auditEngine(tA, tB);
  const sortedA = tA.slice().sort().join(" ");
  const sortedB = tB.slice().sort().join(" ");

  const jw = jaroWinkler_auditEngine(sortedA, sortedB);

  return 0.7 * jacc + 0.3 * jw;
}

/* -------------------------------------------------------------
   LIGHTWEIGHT PAIRWISE SCORING FOR AUDIT POTENTIAL DUPLICATES
------------------------------------------------------------- */
function auditSimilarity_auditEngine(a: any, b: any) {
  const wA = normalizeArabic_auditEngine(a.womanName || "");
  const wB = normalizeArabic_auditEngine(b.womanName || "");
  const hA = normalizeArabic_auditEngine(a.husbandName || "");
  const hB = normalizeArabic_auditEngine(b.husbandName || "");
  const idA = safeString_auditEngine(a.nationalId || "");
  const idB = safeString_auditEngine(b.nationalId || "");
  const pA = digitsOnly_auditEngine(a.phone || "");
  const pB = digitsOnly_auditEngine(b.phone || "");

  const wTokenScore = nameOrderFree_auditEngine(wA, wB);
  const wFirst = tokens_auditEngine(wA)[0] || "";
  const wSecond = tokens_auditEngine(wB)[0] || "";

  const firstScore = jaroWinkler_auditEngine(wFirst, wSecond);
  const husbandScore = Math.max(
    tokenJaccard_auditEngine(tokens_auditEngine(hA), tokens_auditEngine(hB)),
    jaroWinkler_auditEngine(hA, hB)
  );

  const idScore =
    idA && idB ? (idA === idB ? 1 : idA.slice(-5) === idB.slice(-5) ? 0.75 : 0) : 0;

  const phoneScore =
    pA && pB
      ? pA === pB
        ? 1
        : pA.slice(-6) === pB.slice(-6)
        ? 0.85
        : 0
      : 0;

  const score =
    0.35 * wTokenScore +
    0.25 * firstScore +
    0.20 * husbandScore +
    0.10 * idScore +
    0.10 * phoneScore;

  return Math.min(1, Math.max(0, score));
}

/* -------------------------------------------------------------
   MAIN CLIENT-SIDE AUDIT FUNCTION
------------------------------------------------------------- */
export async function runClientSideAudit(clusters: {records: RecordRow_auditEngine[]}[], threshold = 0.6): Promise<AuditFinding_auditEngine[]> {
    const issues: AuditFinding_auditEngine[] = [];

    for (const clusterObject of clusters) {
      const members = clusterObject.records;
      if (!Array.isArray(members) || members.length < 2) continue;

      // 1. DUPLICATE NATIONAL IDs
      const nationalIds = members.map((m: any) => safeString_auditEngine(m.nationalId).trim());
      const uniqueIds = new Set(nationalIds.filter(Boolean));
      if (uniqueIds.size < nationalIds.filter(Boolean).length) {
        issues.push({ type: "DUPLICATE_ID", severity: 'high', description: `Duplicate National ID found in a cluster.`, records: members });
      }

      // 2. DUPLICATE woman+husband
      const pairs = members.map((m: any) =>
        `${normalizeArabic_auditEngine(safeString_auditEngine(m.womanName))}|${normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName))}`
      );
      if (new Set(pairs).size < pairs.length) {
        issues.push({ type: "DUPLICATE_COUPLE", severity: 'high', description: `Exact duplicate Woman+Husband name pair found.`, records: members });
      }

      // 3. Woman with multiple husbands
      const byWoman = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        const h = normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName).trim());
        if (!byWoman.has(w)) byWoman.set(w, new Set());
        byWoman.get(w)!.add(h);
      }
      for (const [w, hs] of byWoman.entries()) {
        if (hs.size > 1) {
          issues.push({
            type: "WOMAN_MULTIPLE_HUSBANDS",
            severity: 'high',
            description: `Woman '${w}' appears to be registered with multiple husbands: ${[...hs].join(', ')}.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.womanName)) === w)
          });
        }
      }

      // 4. Husband with >4 wives
      const byHusband = new Map<string, Set<string>>();
      for (const m of members) {
        const h = normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName).trim());
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        if (!byHusband.has(h)) byHusband.set(h, new Set());
        byHusband.get(h)!.add(w);
      }
      for (const [h, ws] of byHusband.entries()) {
        if (ws.size > 4) {
          issues.push({
            type: "HUSBAND_TOO_MANY_WIVES",
            severity: 'medium',
            description: `Husband '${h}' is registered with ${ws.size} wives, which exceeds the limit of 4.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName)) === h)
          });
        }
      }

      // 5. Woman with multiple IDs
      const womanIDs = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        const id = safeString_auditEngine(m.nationalId).trim();
        if (!womanIDs.has(w)) womanIDs.set(w, new Set());
        if (id) womanIDs.get(w)!.add(id);
      }
      for (const [w, ids] of womanIDs.entries()) {
        if (ids.size > 1) {
          issues.push({
            type: "MULTIPLE_NATIONAL_IDS",
            severity: 'high',
            description: `Woman '${w}' is associated with multiple National IDs: ${[...ids].join(', ')}.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.womanName)) === w)
          });
        }
      }
      
      // 6. Check for high similarity using auditSimilarity
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            const score = auditSimilarity_auditEngine(members[i], members[j]);
            if (score > threshold) {
                 issues.push({
                    type: "HIGH_SIMILARITY",
                    severity: 'medium',
                    description: `High similarity score (${score.toFixed(2)}) found between records.`,
                    records: [members[i], members[j]]
                });
            }
        }
      }
    }

    return issues;
}


// src/lib/cache.ts
import { openDB, IDBPDatabase } from 'idb';
import type { RecordRow as RecordRow_cache } from './types';
import type { AuditFinding as AuditFinding_cache } from './auditEngine';

const DB_NAME_cache = 'beneficiary-insights-cache';
const DB_VERSION_cache = 1;
const STORE_NAME_cache = 'results';
const FULL_RESULT_KEY_cache = 'FULL_RESULT';

interface FullResult_cache {
  rows: RecordRow_cache[];
  clusters: any[]; 
  originalHeaders: string[];
  auditFindings?: AuditFinding_cache[];
  chartImages?: Record<string, string>;
  processedDataForReport?: any;
}


async function getDb_cache(): Promise<IDBPDatabase> {
  return openDB(DB_NAME_cache, DB_VERSION_cache, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME_cache)) {
        db.createObjectStore(STORE_NAME_cache);
      }
    },
  });
}

/**
 * Caches the initial raw data immediately after upload and ID generation.
 * This overwrites any existing data.
 */
export async function cacheRawData(payload: { rows: RecordRow_cache[], originalHeaders: string[] }): Promise<void> {
    const db = await getDb_cache();
    const resultToCache: FullResult_cache = {
        rows: payload.rows || [],
        originalHeaders: payload.originalHeaders || [],
        clusters: [], // Initialize clusters as empty
    };
    const tx = db.transaction(STORE_NAME_cache, 'readwrite');
    await tx.objectStore(STORE_NAME_cache).put(resultToCache, FULL_RESULT_KEY_cache);
    await tx.done;
}

/**
 * Updates the cached result with final cluster information.
 * This assumes raw data has already been cached.
 */
export async function cacheFinalResult(payload: { clusters: any[] }): Promise<void> {
    const db = await getDb_cache();
    const tx = db.transaction(STORE_NAME_cache, 'readwrite');
    const store = tx.objectStore(STORE_NAME_cache);
    const currentData = await store.get(FULL_RESULT_KEY_cache) as FullResult_cache | undefined;

    if (!currentData) {
        throw new Error("Cannot cache final results because raw data was not found. Please re-upload the file.");
    }
    
    const updatedData: FullResult_cache = {
        ...currentData,
        clusters: payload.clusters || [],
    };
    
    await store.put(updatedData, FULL_RESULT_KEY_cache);
    await tx.done;
}


export async function loadCachedResult(): Promise<FullResult_cache | null> {
  try {
    const db = await getDb_cache();
    const result = await db.transaction(STORE_NAME_cache).objectStore(STORE_NAME_cache).get(FULL_RESULT_KEY_cache);
    return result as FullResult_cache | null;
  } catch (error) {
     console.error("Failed to load cached result:", error);
     return null;
  }
}
