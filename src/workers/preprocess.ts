
// src/workers/preprocess.ts

/**
 * This file contains client-safe logic for preprocessing and scoring.
 * It is used for the "Test Scoring" feature on the settings page and the "Correction" page,
 * providing instant feedback without invoking the full worker pipeline.
 */

// --- Preprocessing ---

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
  /^امه\s+[ء-ي]{3,}$/, /^ابو\s+[ء-ي]{3,}$/, /^ام\s+[ء-ي]{3,}$/,
  /^ابن\s+[ء-ي]{3,}$/, /^بنت\s+[ء-ي]{3,}$/, /^[ء-ي]{3,}\s+الدين$/,
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
        i++; continue;
      }
    }
    result.push(parts[i]);
  }
  return result.join(" ");
}

const digitsOnly = (value: any) => (value === undefined || value === null) ? "" : String(value).replace(/\D/g, "");

const normalizeChildrenField = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value).split(/[;,|،]/).map(part => String(part).trim()).filter(Boolean);
};

const splitParts = (value: string) => value ? value.split(/\s+/).filter(Boolean) : [];

export const preprocessRow = (raw: any) => {
  const row = { ...raw, womanName: raw.womanName || "", husbandName: raw.husbandName || "", nationalId: String(raw.nationalId || raw.id || ""), phone: digitsOnly(raw.phone || ""), village: raw.village || "", subdistrict: raw.subdistrict || "", children: normalizeChildrenField(raw.children), };
  const womanName_normalized = normalizeArabicWithCompounds(row.womanName);
  const husbandName_normalized = normalizeArabicWithCompounds(row.husbandName);
  return { ...row, womanName_normalized, husbandName_normalized, village_normalized: baseArabicNormalize(row.village), subdistrict_normalized: baseArabicNormalize(row.subdistrict), children_normalized: (row.children || []).map((child: any) => baseArabicNormalize(child)), parts: splitParts(womanName_normalized), husbandParts: splitParts(husbandName_normalized), };
};


// --- Scoring ---

const jaroWinkler = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aMatches = Array(la).fill(false), bMatches = Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true; bMatches[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++; k++;
  }
  t /= 2;
  const jaro = (matches / la + matches / lb + (matches - t) / matches) / 3;
  let p = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) if (a[i] === b[i]) p++; else break;
  return jaro + p * 0.1 * (1 - jaro);
};

const tokenJaccard = (aTokens: string[], bTokens: string[]) => {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (new Set([...A, ...B]).size || 1);
};

const nameOrderFreeScore = (aTokens: string[], bTokens: string[]) => {
  if (!aTokens.length || !bTokens.length) return 0;
  const jacc = tokenJaccard(aTokens, bTokens);
  const aSorted = aTokens.slice().sort().join(" ");
  const bSorted = bTokens.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
};

// This function must now be self-contained or import from other client-safe files.
export function computePairScore(rawA: any, rawB: any, opts: any) {
  const defaultOptions = { thresholds: { minPair: 0.62 }, finalScoreWeights: {}, rules: {} };
  const mergedOpts = { ...defaultOptions, ...opts, thresholds: { ...defaultOptions.thresholds, ...(opts.thresholds || {}) }, finalScoreWeights: { ...defaultOptions.finalScoreWeights, ...(opts.finalScoreWeights || {}) }, rules: { ...defaultOptions.rules, ...(opts.rules || {}) } };
  const rowA = preprocessRow(rawA);
  const rowB = preprocessRow(rawB);

  // Simplified scoring logic for client-side test (omitting complex rule engine from worker)
  const firstNameScore = jaroWinkler(rowA.parts[0] || "", rowB.parts[0] || "");
  const familyNameScore = jaroWinkler(rowA.parts.slice(1).join(" "), rowB.parts.slice(1).join(" "));
  const advancedNameScore = (() => { const root = (s: string) => (splitParts(s).map(t=>t.slice(0,3)).join(" ")); const rA=root(rowA.womanName_normalized), rB=root(rowB.womanName_normalized); if(!rA||!rB)return 0; return Math.min(0.5,jaroWinkler(rA,rB)); })();
  const tokenReorderScore = nameOrderFreeScore(rowA.parts, rowB.parts);
  const husbandScore = Math.max(jaroWinkler(rowA.husbandName_normalized, rowB.husbandName_normalized), nameOrderFreeScore(rowA.husbandParts, rowB.husbandParts));
  const phoneScoreVal = rowA.phone && rowB.phone ? (rowA.phone === rowB.phone ? 1 : rowA.phone.slice(-6) === rowB.phone.slice(-6) ? 0.85 : (rowA.phone.slice(-4) === rowB.phone.slice(-4) ? 0.6 : 0)) : 0;
  const idScore = rowA.nationalId && rowB.nationalId ? (rowA.nationalId === rowB.nationalId ? 1 : (rowA.nationalId.slice(-5) === rowB.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(rowA.children_normalized, rowB.children_normalized);
  let locationScore = 0;
  if(rowA.village_normalized && rowB.village_normalized && rowA.village_normalized === rowB.village_normalized) locationScore += 0.4;
  if(rowA.subdistrict_normalized && rowB.subdistrict_normalized && rowA.subdistrict_normalized === rowB.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  const W = mergedOpts.finalScoreWeights;
  let score = Object.entries(breakdown).reduce((acc, [key, val]) => acc + (W[key] || 0) * val, 0);

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter((v:any) => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  
  let finalScore = Math.max(0, Math.min(1, score));
  let finalReasons: string[] = [];

  // Re-implement a minimal, client-safe version of rules if needed, or acknowledge they are not run here.
  // For now, we will just return the weighted score.

  if (rowA.nationalId && rowB.nationalId && rowA.nationalId === rowB.nationalId) {
    finalScore = Math.max(finalScore, 0.99);
    finalReasons.push("EXACT_ID");
  }

  return { score: finalScore, breakdown, reasons: finalReasons };
}
