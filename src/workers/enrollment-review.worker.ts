import { openDB, IDBPDatabase } from 'idb';

const ENROLLMENT_DB_NAME = 'enrollment-review-db';
const ENROLLMENT_STORE_NAME = 'files';
const ENROLLMENT_DATA_KEY = 'enrollmentData';
const ENROLLMENT_DB_VERSION = 2;

const FIXED_COMPOUND_NAMES = [
  "عبد الله","عبد الرحمن","عبد الرحيم","عبد الكريم","عبد العزيز","عبد الملك","عبد السلام","عبد القادر","عبد الجليل","عبد الرزاق","عبد الغني","عبد الوهاب","عبد الاله","عبد الواحد","عبد الماجد","امه الله","امه الرحمن","امه الرحيم","امه الكريم","صنع الله","عطاء الله","نور الله","فتح الله","نصر الله","فضل الله","رحمه الله","حسب الله","جود الله","نور الدين","شمس الدين","سيف الدين","زين الدين","جمال الدين","كمال الدين","صلاح الدين","علاء الدين","تقي الدين","نجم الدين","عز الدين","بدر الدين","عماد الدين","ابو بكر","ابو طالب","ابو هريره","ابو القاسم","ام كلثوم","ام sلمه","ام حبيبه","ابن تيميه","ابn سينا","ابن خلدون","ابن رشد","بنت الشاطئ"
];

function baseArabicNormalize(value: any): string {
  if (!value) return '';
  let s = String(value).normalize('NFKC');
  s = s.replace(/يحيي/g, 'يحي').replace(/يحيى/g, 'يحي');
  s = s.replace(/[ًٌٍَُِّْـء]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/گ/g, 'ك')
    .replace(/ڤ/g, 'ف')
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return s;
}

function normalizeArabicWithCompounds(value: any): string {
  let s = baseArabicNormalize(value);
  for (const compound of FIXED_COMPOUND_NAMES) {
    const normalizedCompound = baseArabicNormalize(compound);
    if (!normalizedCompound) continue;
    if (s.includes(normalizedCompound)) {
      const replacement = normalizedCompound.replace(/\s/g, '_');
      s = s.split(normalizedCompound).join(replacement);
    }
  }
  s = s.replace(/\b(عبد)\s+([ء-ي]+)\b/g, '$1_$2');
  s = s.replace(/\b(ابو|ام|ابن|بنت)\s+([ء-ي]+)\b/g, '$1_$2');
  s = s.replace(/\b([ء-ي]+)\s+(الدين|الله)\b/g, '$1_$2');
  return s.replace(/_+/g, '_').trim();
}

function damerauLevenshtein(s1: string, s2: string): number {
  const n = s1.length;
  const m = s2.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const d: number[][] = [];
  for (let i = 0; i <= n; i++) d[i] = [i];
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function bigramSimilarity(s1: string, s2: string): number {
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  if (b1.size === 0 || b2.size === 0) return 0;
  let intersection = 0;
  b1.forEach((x) => {
    if (b2.has(x)) intersection++;
  });
  return (2 * intersection) / (b1.size + b2.size);
}

function lcsLength(s1: string, s2: string): number {
  const dp = Array(s1.length + 1)
    .fill(0)
    .map(() => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[s1.length][s2.length];
}

function getConsonantSkeleton(str: string): string {
  return str.replace(/[اوي]/g, '');
}

type ScoreDetails = {
  weighted_damerau: number;
  positional_similarity: number;
  bigram_similarity: number;
  lcs_ratio: number;
  length_factor: number;
  structural_integrity: number;
  root_factor: number;
};

function zeroDetails(): ScoreDetails {
  return {
    weighted_damerau: 0,
    positional_similarity: 0,
    bigram_similarity: 0,
    lcs_ratio: 0,
    length_factor: 0,
    structural_integrity: 0,
    root_factor: 0,
  };
}

function perfectDetails(): ScoreDetails {
  return {
    weighted_damerau: 100,
    positional_similarity: 100,
    bigram_similarity: 100,
    lcs_ratio: 100,
    length_factor: 100,
    structural_integrity: 100,
    root_factor: 100,
  };
}

function calculateAdvancedNameSimilarity(oldName: string, newName: string): { totalScore: number; details: ScoreDetails } {
  const s1 = normalizeArabicWithCompounds(oldName);
  const s2 = normalizeArabicWithCompounds(newName);
  if (!s1 || !s2) return { totalScore: 0, details: zeroDetails() };
  if (s1 === s2) return { totalScore: 100, details: perfectDetails() };
  const maxLen = Math.max(s1.length, s2.length);
  const dist = damerauLevenshtein(s1, s2);
  const damerauScore = Math.max(0, (1 - dist / maxLen) * 100);
  let posScore = 0;
  if (s1[0] === s2[0]) posScore += 60;
  if (s1[s1.length - 1] === s2[s2.length - 1]) posScore += 40;
  const lenDiff = Math.abs(s1.length - s2.length);
  if (lenDiff > 2) posScore *= 0.7;
  const bigramScore = bigramSimilarity(s1, s2) * 100;
  const lcsScore = (lcsLength(s1, s2) / maxLen) * 100;
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));
  let intersection = 0;
  set1.forEach((x) => {
    if (set2.has(x)) intersection++;
  });
  const structuralScore = (intersection / (new Set([...s1, ...s2]).size)) * 100;
  const lengthFactor = Math.max(0, (1 - lenDiff / maxLen) * 100);
  const root1 = getConsonantSkeleton(s1);
  const root2 = getConsonantSkeleton(s2);
  const rootMax = Math.max(root1.length, root2.length) || 1;
  const rootDist = damerauLevenshtein(root1, root2);
  const rootFactor = Math.max(0, (1 - rootDist / rootMax) * 100);
  const totalScore =
    0.35 * damerauScore +
    0.2 * posScore +
    0.15 * bigramScore +
    0.1 * lcsScore +
    0.1 * structuralScore +
    0.05 * lengthFactor +
    0.05 * rootFactor;
  return {
    totalScore: parseFloat(totalScore.toFixed(2)),
    details: {
      weighted_damerau: parseFloat(damerauScore.toFixed(2)),
      positional_similarity: parseFloat(posScore.toFixed(2)),
      bigram_similarity: parseFloat(bigramScore.toFixed(2)),
      lcs_ratio: parseFloat(lcsScore.toFixed(2)),
      length_factor: parseFloat(lengthFactor.toFixed(2)),
      structural_integrity: parseFloat(structuralScore.toFixed(2)),
      root_factor: parseFloat(rootFactor.toFixed(2)),
    },
  };
}

function getModificationLevel(score: number): string {
  if (score >= 97) return 'Spelling mistake';
  if (score >= 92) return 'Small modification';
  if (score >= 80) return 'Moderate modification';
  if (score >= 65) return 'High modification';
  return 'Complete modification';
}

function getNameCompositeKey(value: string): string {
  const parts = value ? value.split(/\s+/).filter(Boolean) : [];
  const [first = '', father = '', grandfather = ''] = parts;
  const last = parts[parts.length - 1] || '';
  return [first, father, grandfather, last].map((part) => part || '').join('|');
}

function getClusterIdFromIds(ids: (string | number | undefined | null)[]): string {
  const numeric = ids.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numeric.length > 0) {
    return String(Math.max(...numeric));
  }
  const stringIds = ids.map((value) => (value === undefined || value === null ? '' : String(value))).filter(Boolean);
  stringIds.sort();
  return stringIds[stringIds.length - 1] || '';
}

const normalizedFieldMapping: Record<string, string> = {
  curr_bnf_1name_normalized: 'curr_bnf_1name',
  curr_bnf_2name_normalized: 'curr_bnf_2name',
  curr_bnf_3name_normalized: 'curr_bnf_3name',
  curr_bnf_4name_normalized: 'curr_bnf_4name',
  curr_bnf_5name_normalized: 'curr_bnf_5name',
  curr_hsbnd_1name_normalized: 'curr_hsbnd_1name',
  curr_hsbnd_2name_normalized: 'curr_hsbnd_2name',
  curr_hsbnd_3name_normalized: 'curr_hsbnd_3name',
  curr_hsbnd_4name_normalized: 'curr_hsbnd_4name',
  curr_hsbnd_5name_normalized: 'curr_hsbnd_5name',
  bnf_name_normalized: 'bnf_name',
  hsbnd_name_normalized: 'hsbnd_name',
  new_bnf_name_normalized: 'new_bnf_name',
  new_hsbnd_name_normalized: 'new_hsbnd_name',
  correcting_the_first_name_normalized: 'correcting_the_first_name',
  correcting_the_fathers_name_normalized: 'correcting_the_fathers_name',
  correcting_the_grandfathers_name_normalized: 'correcting_the_grandfathers_name',
  correcting_the_fourth_name_normalized: 'correcting_the_fourth_name',
  correcting_the_title_normalized: 'correcting_the_title',
  correcting_the_first_name_6_normalized: 'correcting_the_first_name_6',
  correcting_the_fathers_name_8_normalized: 'correcting_the_fathers_name_8',
  correcting_the_grandfathers_name_10_normalized: 'correcting_the_grandfathers_name_10',
  correcting_the_fourth_name_12_normalized: 'correcting_the_fourth_name_12',
  title_correction_14_normalized: 'title_correction_14',
};

const namePartDefinitions = [
  { key: 'bnf1', oldCol: 'curr_bnf_1name_normalized', newCol: 'correcting_the_first_name_normalized', flag: 'corrected_part_of_the_targets_namefirst_name' },
  { key: 'bnf2', oldCol: 'curr_bnf_2name_normalized', newCol: 'correcting_the_fathers_name_normalized', flag: 'the_corrected_part_of_the_targets_namefathers_name' },
  { key: 'bnf3', oldCol: 'curr_bnf_3name_normalized', newCol: 'correcting_the_grandfathers_name_normalized', flag: 'the_corrected_part_of_the_targets_namegrandfathers_name' },
  { key: 'bnf4', oldCol: 'curr_bnf_4name_normalized', newCol: 'correcting_the_fourth_name_normalized', flag: 'corrected_part_of_the_targets_namefourth_name' },
  { key: 'bnf5', oldCol: 'curr_bnf_5name_normalized', newCol: 'correcting_the_title_normalized', flag: 'corrected_part_of_the_targets_nametitle' },
  { key: 'hus1', oldCol: 'curr_hsbnd_1name_normalized', newCol: 'correcting_the_first_name_6_normalized', flag: 'corrected_part_of_husbands_namefirst_name' },
  { key: 'hus2', oldCol: 'curr_hsbnd_2name_normalized', newCol: 'correcting_the_fathers_name_8_normalized', flag: 'corrected_part_of_husbands_namefathers_name' },
  { key: 'hus3', oldCol: 'curr_hsbnd_3name_normalized', newCol: 'correcting_the_grandfathers_name_10_normalized', flag: 'the_corrected_part_of_the_husbands_namegrandfathers_name' },
  { key: 'hus4', oldCol: 'curr_hsbnd_4name_normalized', newCol: 'correcting_the_fourth_name_12_normalized', flag: 'corrected_part_of_husbands_namefourth_name' },
  { key: 'hus5', oldCol: 'curr_hsbnd_5name_normalized', newCol: 'title_correction_14_normalized', flag: 'corrected_part_of_husbands_namesurname' },
];

const NAME_PART_DIFF_KEYS = namePartDefinitions.flatMap((part) => [`diff_per_${part.key}`, `diff_level_${part.key}`]);
const WHOLE_NAME_DIFF_KEYS = ['diff_per_bnf', 'diff_level_bnf', 'diff_per_hus', 'diff_level_hus'];

async function getEnrollmentDb(): Promise<IDBPDatabase> {
  return openDB(ENROLLMENT_DB_NAME, ENROLLMENT_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ENROLLMENT_STORE_NAME)) {
        db.createObjectStore(ENROLLMENT_STORE_NAME);
      }
    },
  });
}

async function loadEnrollmentDataFromCache(): Promise<any[] | null> {
  try {
    const db = await getEnrollmentDb();
    const data = await db.get(ENROLLMENT_STORE_NAME, ENROLLMENT_DATA_KEY);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function saveEnrollmentDataToCache(data: any[]): Promise<void> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid or empty data provided to cache.');
  }
  const db = await getEnrollmentDb();
  const tx = db.transaction(ENROLLMENT_STORE_NAME, 'readwrite');
  await tx.objectStore(ENROLLMENT_STORE_NAME).put(data, ENROLLMENT_DATA_KEY);
  await tx.done;
}

function updateProgress(status: string, progress: number) {
  postMessage({ type: 'progress', status, progress });
}

function buildNameGroupMap(records: any[], type: 'bnf' | 'hus'): Map<string, any[]> {
  const map = new Map<string, any[]>();
  const baseCol = type === 'bnf' ? 'bnf_name_normalized' : 'hsbnd_name_normalized';
  records.forEach((record) => {
    const key = getNameCompositeKey(record[baseCol]);
    if (!key) return;
    const group = map.get(key) || [];
    group.push(record);
    map.set(key, group);
  });
  return map;
}

function applySimilarityAndClusters(
  records: any[],
  groupMap: Map<string, any[]>,
  type: 'bnf' | 'hus',
  updateFn: (value: number) => void,
  progressBase: number,
  progressRange: number
) {
  const newField = type === 'bnf' ? 'new_bnf_name_normalized' : 'new_hsbnd_name_normalized';
  const oldField = type === 'bnf' ? 'bnf_name_normalized' : 'hsbnd_name_normalized';
  const scoreField = type === 'bnf' ? 'enroll_bnf_sim_score' : 'enroll_hsbnd_sim_score';
  const total = records.length;
  if (total === 0) return;
  records.forEach((record, idx) => {
    const targetValue = record[newField];
    if (!targetValue) {
      record[scoreField] = 0;
      return;
    }
    const key = getNameCompositeKey(targetValue);
    const candidates = groupMap.get(key) || [];
    let bestScore = 0;
    let bestMatch: any = null;
    for (const candidate of candidates) {
      if (candidate === record) continue;
      const score = calculateAdvancedNameSimilarity(targetValue, candidate[oldField]).totalScore;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
    record[scoreField] = parseFloat(bestScore.toFixed(2));
    if (bestScore >= 95 && bestMatch) {
      const clusterCandidates = [record.unique_id, bestMatch.unique_id, record.enroll_cluster_id, bestMatch.enroll_cluster_id];
      const clusterId = getClusterIdFromIds(clusterCandidates);
      if (clusterId) {
        [record, bestMatch].forEach((entry) => {
          entry.enroll_cluster_id = clusterId;
        });
      }
    }
    if ((idx + 1) % 25 === 0 || idx === total - 1) {
      const relative = Math.round(((idx + 1) / total) * progressRange);
      updateFn(Math.min(100, progressBase + relative));
    }
  });
}

self.onmessage = async (event) => {
  const { uniqueIdCol } = event.data;
  try {
    if (!uniqueIdCol) throw new Error('Unique ID column is required for analysis.');
    updateProgress('generating_unique_id', 5);
    const cachedData = await loadEnrollmentDataFromCache();
    if (!cachedData || cachedData.length === 0) throw new Error('No cached data found. Upload a file first.');
    updateProgress('normalizing_names', 15);
    const totalRecords = cachedData.length;
    const normalizedRecords = cachedData.map((record: any, index: number) => {
      const newRecord: any = { ...record };
      newRecord.unique_id = record[uniqueIdCol];
      Object.entries(normalizedFieldMapping).forEach(([newCol, oldCol]) => {
        newRecord[newCol] = normalizeArabicWithCompounds(record[oldCol]);
      });
      namePartDefinitions.forEach((part) => {
        if (Number(record[part.flag]) === 1) {
          const scoreResult = calculateAdvancedNameSimilarity(newRecord[part.oldCol] || '', newRecord[part.newCol] || '');
          newRecord[`diff_per_${part.key}`] = scoreResult.totalScore;
          newRecord[`diff_level_${part.key}`] = getModificationLevel(scoreResult.totalScore);
        }
      });
      NAME_PART_DIFF_KEYS.forEach((key) => {
        if (newRecord[key] === undefined) newRecord[key] = null;
      });
      const bnfScore = calculateAdvancedNameSimilarity(newRecord.bnf_name_normalized, newRecord.new_bnf_name_normalized);
      newRecord.diff_per_bnf = bnfScore.totalScore;
      newRecord.diff_level_bnf = getModificationLevel(bnfScore.totalScore);
      Object.assign(newRecord, bnfScore.details);
      const husScore = calculateAdvancedNameSimilarity(newRecord.hsbnd_name_normalized, newRecord.new_hsbnd_name_normalized);
      newRecord.diff_per_hus = husScore.totalScore;
      newRecord.diff_level_hus = getModificationLevel(husScore.totalScore);
      WHOLE_NAME_DIFF_KEYS.forEach((key) => {
        if (newRecord[key] === undefined) newRecord[key] = null;
      });
      newRecord.enroll_bnf_sim_score = 0;
      newRecord.enroll_hsbnd_sim_score = 0;
      newRecord.enroll_cluster_id = '';
      newRecord.branch_recommendation = newRecord.diff_per_bnf >= 90 ? 'Approve locally' : 'Needs review';
      newRecord.HQ_recommendation = newRecord.diff_per_bnf < 80 ? 'Escalate to HQ' : 'Monitor';
      newRecord.enroll_recom = newRecord.diff_per_bnf >= 92 ? 'Proceed' : 'Review';
      newRecord.weighted_damerau_score = bnfScore.details.weighted_damerau;
      newRecord.positional_similarity = bnfScore.details.positional_similarity;
      newRecord.bigram_similarity = bnfScore.details.bigram_similarity;
      newRecord.lcs_ratio = bnfScore.details.lcs_ratio;
      newRecord.length_factor = bnfScore.details.length_factor;
      newRecord.structural_integrity = bnfScore.details.structural_integrity;
      newRecord.root_factor = bnfScore.details.root_factor;
      newRecord.data = JSON.stringify(record);
      if ((index + 1) % 50 === 0 || index === totalRecords - 1) {
        const relativeProgress = Math.round(((index + 1) / totalRecords) * 20);
        updateProgress('normalizing_names', 15 + relativeProgress);
      }
      return newRecord;
    });
    updateProgress('similarity_and_clustering', 50);
    const bnfGroupMap = buildNameGroupMap(normalizedRecords, 'bnf');
    const husGroupMap = buildNameGroupMap(normalizedRecords, 'hus');
    const recordsWithBnfNew = normalizedRecords.filter((record) => record.new_bnf_name_normalized);
    const recordsWithHusNew = normalizedRecords.filter((record) => record.new_hsbnd_name_normalized);
    applySimilarityAndClusters(recordsWithBnfNew, bnfGroupMap, 'bnf', (value) => updateProgress('similarity_and_clustering', value), 50, 25);
    applySimilarityAndClusters(recordsWithHusNew, husGroupMap, 'hus', (value) => updateProgress('similarity_and_clustering', value), 75, 15);
    updateProgress('caching_results', 85);
    await saveEnrollmentDataToCache(normalizedRecords);
    updateProgress('done', 100);
    postMessage({ type: 'done', data: { processedCount: normalizedRecords.length } });
  } catch (error: any) {
    postMessage({ type: 'error', error: error.message || 'An unknown error occurred in the worker.' });
  }
};