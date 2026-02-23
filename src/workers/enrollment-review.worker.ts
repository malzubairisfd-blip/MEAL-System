
// src/workers/enrollment-review.worker.ts
import { openDB, IDBPDatabase } from 'idb';

// ==========================================
// 1. ARABIC NORMALIZATION ENGINE
// ==========================================

const FIXED_COMPOUND_NAMES = [
    "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك",
    "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني",
    "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "عبد الصمد",
    "عبد الباري", "عبد القدوس", "عبد المطلب", "عبد المهيمن", "عبد الله",
    "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "فاطمه الزهراء",
    "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله",
    "فضل الله", "رحمه الله", "حسب الله", "جود الله", "جار الله",
    "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين",
    "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين",
    "عز الدين", "بدر الدين", "عماد الدين",
    "ابو بكر", "ابو طالب", "ابو هريره", "ابو القاسم",
    "ام كلثوم", "ام sلمه", "ام حبيبه",
    "ابن تيميه", "ابn سينا", "ابن خلدون", "ابن رشد",
    "بنت الشاطئ"
  ];
  
  function baseArabicNormalize(value: any): string {
    if (!value) return "";
    let s = String(value).normalize("NFKC");
    s = s.replace(/يحيي/g, "يحي").replace(/يحيى/g, "يحي");
    s = s.replace(/[ًٌٍَُِّْـء]/g, "").replace(/[أإآ]/g, "ا").replace(/[ى]/g, "ي").replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ي").replace(/ة/g, "ه").replace(/گ/g, "ك").replace(/ڤ/g, "ف");
    s = s.replace(/[^ء-ي0-9a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    return s;
  }
  
  function normalizeArabicWithCompounds(text: any): string {
    let s = baseArabicNormalize(text);
    for (const compound of FIXED_COMPOUND_NAMES) {
      const normalizedCompound = baseArabicNormalize(compound);
      if (s.includes(normalizedCompound)) {
        const replacement = normalizedCompound.replace(/\s/g, "_");
        s = s.split(normalizedCompound).join(replacement);
      }
    }
    s = s.replace(/\b(عبد)\s+([ء-ي]+)\b/g, "$1_$2");
    s = s.replace(/\b(ابو|ام|ابن|بنت)\s+([ء-ي]+)\b/g, "$1_$2");
    s = s.replace(/\b([ء-ي]+)\s+(الدين|الله)\b/g, "$1_$2");
    return s.replace(/_+/g, "_").trim();
  }
  
  // ==========================================
  // 2. MATH & ALGORITHMS
  // ==========================================
  
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
    b1.forEach(x => { if (b2.has(x)) intersection++; });
    return (2.0 * intersection) / (b1.size + b2.size);
  }
  
  function lcsLength(s1: string, s2: string): number {
    const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[s1.length][s2.length];
  }
  
  function getConsonantSkeleton(str: string): string {
    return str.replace(/[اوي]/g, "");
  }
  
  // ==========================================
  // 3. MAIN SCORING LOGIC
  // ==========================================
  
  interface ScoreResult {
    totalScore: number;
    details: {
      weighted_damerau: number;
      positional_similarity: number;
      bigram_similarity: number;
      lcs_ratio: number;
      length_factor: number;
      structural_integrity: number;
      root_factor: number;
    };
  }
  
  function calculateAdvancedNameSimilarity(oldName: string, newName: string): ScoreResult {
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
    set1.forEach(x => { if(set2.has(x)) intersection++; });
    const structuralScore = (intersection / (new Set([...s1, ...s2]).size)) * 100;
  
    const lengthFactor = Math.max(0, (1 - lenDiff / maxLen) * 100);
  
    const root1 = getConsonantSkeleton(s1);
    const root2 = getConsonantSkeleton(s2);
    const rootMax = Math.max(root1.length, root2.length) || 1;
    const rootDist = damerauLevenshtein(root1, root2);
    const rootFactor = Math.max(0, (1 - rootDist / rootMax) * 100);
  
    const totalScore = 
      (0.35 * damerauScore) + (0.20 * posScore) + (0.15 * bigramScore) +
      (0.10 * lcsScore) + (0.10 * structuralScore) + (0.05 * lengthFactor) +
      (0.05 * rootFactor);
  
    return {
      totalScore: parseFloat(totalScore.toFixed(2)),
      details: {
        weighted_damerau: parseFloat(damerauScore.toFixed(2)),
        positional_similarity: parseFloat(posScore.toFixed(2)),
        bigram_similarity: parseFloat(bigramScore.toFixed(2)),
        lcs_ratio: parseFloat(lcsScore.toFixed(2)),
        length_factor: parseFloat(lengthFactor.toFixed(2)),
        structural_integrity: parseFloat(structuralScore.toFixed(2)),
        root_factor: parseFloat(rootFactor.toFixed(2))
      }
    };
  }
  
  function getModificationLevel(score: number): string {
    if (score >= 97) return "Spelling mistake";
    if (score >= 92) return "Small modification";
    if (score >= 80) return "Moderate modification";
    if (score >= 65) return "High modification";
    return "Complete modification";
  }
  
  function zeroDetails() {
    return { weighted_damerau: 0, positional_similarity: 0, bigram_similarity: 0, lcs_ratio: 0, length_factor: 0, structural_integrity: 0, root_factor: 0 };
  }
  function perfectDetails() {
    return { weighted_damerau: 100, positional_similarity: 100, bigram_similarity: 100, lcs_ratio: 100, length_factor: 100, structural_integrity: 100, root_factor: 100 };
  }

// --- WORKER LOGIC ---
const ENROLLMENT_DB_NAME = 'enrollment-review-db';
const ENROLLMENT_STORE_NAME = 'files';
const ENROLLMENT_DATA_KEY = 'enrollmentData';
const ENROLLMENT_DB_VERSION = 2; // Correct version

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
    } catch (error) {
        console.error("Failed to load enrollment data from cache:", error);
        return null;
    }
}

async function saveEnrollmentDataToCache(data: any[]): Promise<void> {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid or empty data provided to cache.");
    }
    const db = await getEnrollmentDb();
    const tx = db.transaction(ENROLLMENT_STORE_NAME, 'readwrite');
    await tx.objectStore(ENROLLMENT_STORE_NAME).put(data, ENROLLMENT_DATA_KEY);
    await tx.done;
}


self.onmessage = async (event) => {
    const { uniqueIdCol } = event.data;

    try {
        postMessage({ type: 'progress', status: 'Loading data from cache...', progress: 5 });
        const cachedData = await loadEnrollmentDataFromCache();
        
        if (!cachedData || !Array.isArray(cachedData)) {
            throw new Error("No data found in cache. Please upload a file first.");
        }
        
        const totalRecords = cachedData.length;
        postMessage({ type: 'progress', status: `Analyzing & Preparing ${totalRecords} Records for Cache...`, progress: 10 });
        
        const processedRecords = cachedData.map((record: any, index: number) => {
            
            const newRecord = { ...record };

            // 1. Generate unique_id
            newRecord.unique_id = record[uniqueIdCol];

            // 2. Normalization
            const normalizedColumns: { [key: string]: string } = {
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
                title_correction_14_normalized: 'title_correction_14'
            };
            Object.entries(normalizedColumns).forEach(([newCol, oldCol]) => {
                newRecord[newCol] = normalizeArabicWithCompounds(record[oldCol]);
            });

            // 3. Difference Calculation for each part
            const nameParts = [
                { key: 'bnf1', oldNameCol: 'curr_bnf_1name_normalized', newNameCol: 'correcting_the_first_name_normalized', flagCol: 'corrected_part_of_the_targets_namefirst_name' },
                { key: 'bnf2', oldNameCol: 'curr_bnf_2name_normalized', newNameCol: 'correcting_the_fathers_name_normalized', flagCol: 'the_corrected_part_of_the_targets_namefathers_name' },
                { key: 'bnf3', oldNameCol: 'curr_bnf_3name_normalized', newNameCol: 'correcting_the_grandfathers_name_normalized', flagCol: 'the_corrected_part_of_the_targets_namegrandfathers_name' },
                { key: 'bnf4', oldNameCol: 'curr_bnf_4name_normalized', newNameCol: 'correcting_the_fourth_name_normalized', flagCol: 'corrected_part_of_the_targets_namefourth_name' },
                { key: 'bnf5', oldNameCol: 'curr_bnf_5name_normalized', newNameCol: 'correcting_the_title_normalized', flagCol: 'corrected_part_of_the_targets_nametitle' },
                { key: 'hus1', oldNameCol: 'curr_hsbnd_1name_normalized', newNameCol: 'correcting_the_first_name_6_normalized', flagCol: 'corrected_part_of_husbands_namefirst_name' },
                { key: 'hus2', oldNameCol: 'curr_hsbnd_2name_normalized', newNameCol: 'correcting_the_fathers_name_8_normalized', flagCol: 'corrected_part_of_husbands_namefathers_name' },
                { key: 'hus3', oldNameCol: 'curr_hsbnd_3name_normalized', newNameCol: 'correcting_the_grandfathers_name_10_normalized', flagCol: 'the_corrected_part_of_the_husbands_namegrandfathers_name' },
                { key: 'hus4', oldNameCol: 'curr_hsbnd_4name_normalized', newNameCol: 'correcting_the_fourth_name_12_normalized', flagCol: 'corrected_part_of_husbands_namefourth_name' },
                { key: 'hus5', oldNameCol: 'curr_hsbnd_5name_normalized', newNameCol: 'title_correction_14_normalized', flagCol: 'corrected_part_of_husbands_namesurname' },
            ];
            
            nameParts.forEach(part => {
                if (Number(record[part.flagCol]) === 1) {
                    const scoreResult = calculateAdvancedNameSimilarity(newRecord[part.oldNameCol], newRecord[part.newNameCol]);
                    newRecord[`diff_per_${part.key}`] = scoreResult.totalScore;
                    newRecord[`diff_level_${part.key}`] = getModificationLevel(scoreResult.totalScore);
                }
            });

            // 4. Whole Name Difference & Details
            const bnfScoreResult = calculateAdvancedNameSimilarity(newRecord['bnf_name_normalized'], newRecord['new_bnf_name_normalized']);
            newRecord['diff_per_bnf'] = bnfScoreResult.totalScore;
            newRecord['diff_level_bnf'] = getModificationLevel(bnfScoreResult.totalScore);
            Object.assign(newRecord, bnfScoreResult.details);

            const husScoreResult = calculateAdvancedNameSimilarity(newRecord['hsbnd_name_normalized'], newRecord['new_hsbnd_name_normalized']);
            newRecord['diff_per_hus'] = husScoreResult.totalScore;
            newRecord['diff_level_hus'] = getModificationLevel(husScoreResult.totalScore);
            // Also add husband details if needed
            // Object.assign(newRecord, { hus_weighted_damerau: husScoreResult.details.weighted_damerau, ... });

            // 5. Placeholder for Similarity and Clustering
            newRecord.enroll_bnf_sim_score = null;
            newRecord.enroll_hsbnd_sim_score = null;
            newRecord.enroll_cluster_id = null;
            newRecord.branch_recommendation = '';
            newRecord.HQ_recommendation = '';
            newRecord.enroll_recom = '';
            
            const currentProgress = 10 + ( (index + 1) / totalRecords) * 85;
            if(index % 100 === 0) {
                 postMessage({ type: 'progress', status: `Analyzing & Preparing Records... (${index + 1}/${totalRecords})`, progress: currentProgress });
            }

            return newRecord;
        });
        
        postMessage({ type: 'progress', status: 'Saving results to cache...', progress: 95 });
        await saveEnrollmentDataToCache(processedRecords);
        
        postMessage({ type: 'done', data: { processedCount: processedRecords.length } });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};

    