// src/workers/cluster.worker.ts
import { alignLineage, jaroWinkler, collapseDuplicateAncestors, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';

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

const FIXED_COMPOUND_NAMES_cluster_worker = [
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

const PREFIX_COMPOUND_RULES_cluster_worker: RegExp[] = [
  /^امه\s+[ء-ي]{3,}$/,
  /^ابو\s+[ء-ي]{3,}$/,
  /^ام\s+[ء-ي]{3,}$/,
  /^ابن\s+[ء-ي]{3,}$/,
  /^بنت\s+[ء-ي]{3,}$/,
  /^[ء-ي]{3,}\s+الدين$/,
  /^[ء-ي]{3,}\s+الله$/
];

function normalizeArabicWithCompounds_cluster_worker(value: any): string {
  let s = baseArabicNormalize(value);

  // Step 1: apply fixed compounds
  for (const name of FIXED_COMPOUND_NAMES_cluster_worker) {
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
      if (PREFIX_COMPOUND_RULES_cluster_worker.some((r) => r.test(pair))) {
        result.push(pair.replace(" ", "_"));
        i++; // skip next
        continue;
      }
    }
    result.push(parts[i]);
  }

  return result.join(" ");
}

const digitsOnly_cluster_worker = (value: any) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\D/g, "");
};

const normalizeChildrenField_cluster_worker = (value: any) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[;,|،]/)
    .map((part) => String(part).trim())
    .filter(Boolean);
};

const splitParts_cluster_worker = (value: string) =>
  value ? value.split(/\s+/).filter(Boolean) : [];

export type PreprocessedRow_cluster_worker = {
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

const preprocessRow_cluster_worker = (raw: any): PreprocessedRow_cluster_worker => {
  const row = {
    ...raw,
    womanName: raw.womanName || "",
    husbandName: raw.husbandName || "",
    nationalId: String(raw.nationalId || raw.id || ""),
    phone: digitsOnly_cluster_worker(raw.phone || ""),
    village: raw.village || "",
    subdistrict: raw.subdistrict || "",
    children: normalizeChildrenField_cluster_worker(raw.children),
  };
  const womanName_normalized = raw.womanName_normalized || normalizeArabicWithCompounds_cluster_worker(row.womanName);
  const husbandName_normalized = raw.husbandName_normalized || normalizeArabicWithCompounds_cluster_worker(row.husbandName);
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
    parts: raw.parts || splitParts_cluster_worker(womanName_normalized),
    husbandParts: raw.husbandParts || splitParts_cluster_worker(husbandName_normalized),
  };
};

export interface WorkerOptions_cluster_worker {
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

// --- End of Preprocessing Logic ---


// --- Executor for Learned Rules ---
type RuleResult_cluster_worker = {
  score: number;
  reasons: string[];
};

// Default no-op executor (safe fallback)
let executeLearnedRules_cluster_worker: (
  a: any,
  b: any,
  jw: Function,
  nameOrderFreeScore: Function,
  tokenJaccard: Function,
  minPair: number
) => RuleResult_cluster_worker | null = () => null;

function compileRules_cluster_worker(rules: any[]) {
  try {
    if (!Array.isArray(rules) || rules.length === 0) {
      executeLearnedRules_cluster_worker = () => null;
      return;
    }

    // Only enabled + non-empty rules
    const enabledRules = rules.filter(
      r => r.enabled && typeof r.code === 'string' && r.code.trim().length > 0
    );

    postMessage({
      type: 'rules_loaded',
      count: enabledRules.length,
    });

    if (enabledRules.length === 0) {
      executeLearnedRules_cluster_worker = () => null;
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

    executeLearnedRules_cluster_worker = new Function(
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
      "Could not load or compile auto-rules. Continuing without learned rules.",
      e
    );
    executeLearnedRules_cluster_worker = () => null;
  }
}
// src/workers/double-benefit.worker.ts
import { jaroWinkler as jaroWinkler_double_benefit, nameOrderFreeScore as nameOrderFreeScore_double_benefit, tokenJaccard as tokenJaccard_double_benefit } from '@/lib/similarity';

// --- Normalization Logic ---
function baseArabicNormalize_double_benefit(value: any): string {
    if (!value) return "";
    let s = String(value).normalize("NFKC").replace(/يحيي/g, "يحي").replace(/يحيى/g, "يحي").replace(/عبد /g, "عبد").replace(/[ًٌٍَُِّْـء]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه").replace(/گ/g, "ك").replace(/\s+/g, " ").replace(/[^ء-ي0-9a-zA-Z\s]/g, " ").trim().toLowerCase();
    return s;
}

const FIXED_COMPOUND_NAMES_double_benefit = ["عبد الله", "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك", "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني", "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله", "فضل الله", "رحمه الله", "حسب الله", "جود الله", "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين", "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين", "ابو بكر", "ابو طالب", "ابو هريره", "ام كلثوم", "ام سلمه", "ام حبيبه", "ابن تيميه", "ابن سينا", "ابن خلدون", "ابن رشد", "بنت الشاطئ"];
const PREFIX_COMPOUND_RULES_double_benefit: RegExp[] = [/^امه\s+[ء-ي]{3,}$/, /^ابو\s+[ء-ي]{3,}$/, /^ام\s+[ء-ي]{3,}$/, /^ابن\s+[ء-ي]{3,}$/, /^بنت\s+[ء-ي]{3,}$/, /^[ء-ي]{3,}\s+الدين$/, /^[ء-ي]{3,}\s+الله$/];

function normalizeArabicWithCompounds_double_benefit(value: any): string {
    let s = baseArabicNormalize_double_benefit(value);
    for (const name of FIXED_COMPOUND_NAMES_double_benefit) {
        const normalized = baseArabicNormalize_double_benefit(name);
        const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
        s = s.replace(re, normalized.replace(" ", "_"));
    }
    const parts = s.split(" ");
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) {
            const pair = `${parts[i]} ${parts[i + 1]}`;
            if (PREFIX_COMPOUND_RULES_double_benefit.some((r) => r.test(pair))) {
                result.push(pair.replace(" ", "_"));
                i++;
                continue;
            }
        }
        result.push(parts[i]);
    }
    return result.join(" ");
}

const digitsOnly_double_benefit = (value: any) => (value === undefined || value === null) ? "" : String(value).replace(/\D/g, "");

// --- Scoring Logic ---
function calculateSimilarity_double_benefit(educator: any, beneficiary: any, mapping: any) {
    const normEdName = normalizeArabicWithCompounds_double_benefit(educator[mapping.educatorName]);
    const normBnfName = normalizeArabicWithCompounds_double_benefit(beneficiary[mapping.beneficiaryName]);
    
    const edNameParts = normEdName.split(' ');
    const bnfNameParts = normBnfName.split(' ');
    
    const nameScore = nameOrderFreeScore_double_benefit(edNameParts, bnfNameParts);

    const edId = String(educator[mapping.educatorId] || '').trim();
    const bnfId = String(beneficiary[mapping.beneficiaryId] || '').trim();
    let idScore = 0;
    if (edId && bnfId) {
        idScore = edId === bnfId ? 1 : (edId.slice(-6) === bnfId.slice(-6) ? 0.8 : 0);
    }

    const edPhones = String(educator[mapping.educatorPhone] || '').split(/[-,]/).map(p => digitsOnly_double_benefit(p));
    const bnfPhone = digitsOnly_double_benefit(beneficiary[mapping.beneficiaryPhone]);
    let phoneScore = 0;
    if (bnfPhone) {
        for (const edPhone of edPhones) {
            if (edPhone === bnfPhone) {
                phoneScore = 1;
                break;
            }
            if (edPhone.slice(-7) === bnfPhone.slice(-7)) {
                phoneScore = Math.max(phoneScore, 0.9);
            }
        }
    }
    
    // Weighted score
    return (nameScore * 0.5) + (idScore * 0.3) + (phoneScore * 0.2);
}
