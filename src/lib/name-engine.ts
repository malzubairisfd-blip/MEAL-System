// src/lib/name-engine.ts

// ==========================================
// 1. ARABIC NORMALIZATION ENGINE
// ==========================================

const FIXED_COMPOUND_NAMES = [
    // === ALLAH NAMES (Sorted by length desc to match longest first) ===
    "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك",
    "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني",
    "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "عبد الصمد",
    "عبد الباري", "عبد القدوس", "عبد المطلب", "عبد المهيمن", "عبد الله",
    
    // === FEMALE ===
    "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "فاطمه الزهراء",
  
    // === MALE RELIGIOUS ===
    "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله",
    "فضل الله", "رحمه الله", "حسب الله", "جود الله", "جار الله",
  
    // === PROPHET / RELIGIOUS TITLES ===
    "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين",
    "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين",
    "عز الدين", "بدر الدين", "عماد الدين",
  
    // === HISTORICAL / KUNYA ===
    "ابو بكر", "ابو طالب", "ابو هريره", "ابو القاسم",
    "ام كلثوم", "ام sلمه", "ام حبيبه",
    "ابن تيميه", "ابn سينا", "ابن خلدون", "ابن رشد",
    "بنت الشاطئ"
  ];
  
  function baseArabicNormalize(value: any): string {
    if (!value) return "";
    
    let s = String(value).normalize("NFKC");
  
    // Specific Spelling Corrections
    s = s
      .replace(/يحيي/g, "يحي")
      .replace(/يحيى/g, "يحي");
  
    // Character Unification
    s = s
      .replace(/[ًٌٍَُِّْـء]/g, "")   // Remove Tashkeel (Diacritics), Tatweel, Hamza
      .replace(/[أإآ]/g, "ا")       // Normalize Alef
      .replace(/[ى]/g, "ي")         // Normalize Alef Maqsura to Ya
      .replace(/[ؤ]/g, "و")         // Hamza on Waw to Waw
      .replace(/[ئ]/g, "ي")         // Hamza on Ya to Ya
      .replace(/ة/g, "ه")           // Ta Marbuta to Ha
      .replace(/گ/g, "ك")           // Persian Gaf to Kaf
      .replace(/ڤ/g, "ف");          // Persian/Kurdish Ve to Fa
  
    // Clean non-alphanumeric (Keep spaces for now)
    s = s
      .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ") 
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  
    return s;
  }
  
  /**
   * Main Normalization Function
   * Applies base normalization + compound name merging (underscores).
   */
  export function normalizeArabicWithCompounds(text: any): string {
    let s = baseArabicNormalize(text);
  
    // 1. Apply Fixed Compound List
    for (const compound of FIXED_COMPOUND_NAMES) {
      const normalizedCompound = baseArabicNormalize(compound);
      if (s.includes(normalizedCompound)) {
        // Replace with underscored version globally
        // We use split/join to replace all occurrences
        const replacement = normalizedCompound.replace(/\s/g, "_");
        s = s.split(normalizedCompound).join(replacement);
      }
    }
  
    // 2. Apply Dynamic Patterns (Regex) for unknown compounds
    
    // Rule: "Abd" prefix (عبد + Name) -> abd_name
    s = s.replace(/\b(عبد)\s+([ء-ي]+)\b/g, "$1_$2");
  
    // Rule: "Abu/Umm/Ibn/Bint" prefix -> abu_name
    s = s.replace(/\b(ابو|ام|ابن|بنت)\s+([ء-ي]+)\b/g, "$1_$2");
  
    // Rule: "Al-Din" / "Al-Allah" suffix -> name_aldin
    s = s.replace(/\b([ء-ي]+)\s+(الدين|الله)\b/g, "$1_$2");
  
    return s.replace(/_+/g, "_").trim();
  }
  
  
  // ==========================================
  // 2. MATH & ALGORITHMS
  // ==========================================
  
  // A. Weighted Damerau-Levenshtein
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
        
        d[i][j] = Math.min(
          d[i - 1][j] + 1,       // deletion
          d[i][j - 1] + 1,       // insertion
          d[i - 1][j - 1] + cost // substitution
        );
  
        // Transposition check
        if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); 
        }
      }
    }
    return d[n][m];
  }
  
  // B. Bigram Similarity
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
  
  // C. Longest Common Subsequence (LCS)
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
  
  // D. Consonant Skeleton (Root Stability Proxy)
  // Removes Alef, Waw, Ya to approximate the Arabic root
  function getConsonantSkeleton(str: string): string {
    return str.replace(/[اوي]/g, "");
  }
  
  
  // ==========================================
  // 3. MAIN SCORING LOGIC
  // ==========================================
  
  export interface ScoreResult {
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
  
  export function calculateAdvancedNameSimilarity(oldName: string, newName: string): ScoreResult {
    // 1. Normalize
    const s1 = normalizeArabicWithCompounds(oldName);
    const s2 = normalizeArabicWithCompounds(newName);
  
    // 2. Edge Case: Empty or Identical
    if (!s1 && !s2) return { totalScore: 0, details: zeroDetails() };
    if (!s1 || !s2) return { totalScore: 0, details: zeroDetails() };
    if (s1 === s2) return { totalScore: 100, details: perfectDetails() };
  
    const maxLen = Math.max(s1.length, s2.length);
  
    // --- COMPONENT 1: Weighted Damerau-Levenshtein (35%) ---
    const dist = damerauLevenshtein(s1, s2);
    // Score is inverted: 0 distance = 100 score
    const damerauScore = Math.max(0, (1 - dist / maxLen) * 100);
  
    // --- COMPONENT 2: Positional Similarity (20%) ---
    // Start matches are more important than end matches
    let posScore = 0;
    const sameStart = s1[0] === s2[0];
    const sameEnd = s1[s1.length - 1] === s2[s2.length - 1];
    
    if (sameStart) posScore += 60; // Start is heavier
    if (sameEnd) posScore += 40;   // End is lighter
    
    // Penalty if lengths differ significantly
    const lenDiff = Math.abs(s1.length - s2.length);
    if (lenDiff > 2) posScore *= 0.7; // Reduce confidence if length varies wildly
  
    // --- COMPONENT 3: Bigram Similarity (15%) ---
    const bigramScore = bigramSimilarity(s1, s2) * 100;
  
    // --- COMPONENT 4: LCS Ratio (10%) ---
    const lcs = lcsLength(s1, s2);
    const lcsScore = (lcs / maxLen) * 100;
  
    // --- COMPONENT 5: Structural Integrity (10%) ---
    // Jaccard Index of character sets (does this name contain the same letters?)
    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    let intersection = 0;
    set1.forEach(x => { if(set2.has(x)) intersection++; });
    const union = new Set([...s1, ...s2]).size;
    const structuralScore = (intersection / union) * 100;
  
    // --- COMPONENT 6: Length Deviation Penalty (5%) ---
    // 100 if lengths are same, approaches 0 as they diverge
    const lengthFactor = Math.max(0, (1 - lenDiff / maxLen) * 100);
  
    // --- COMPONENT 7: Root Stability (5%) ---
    const root1 = getConsonantSkeleton(s1);
    const root2 = getConsonantSkeleton(s2);
    const rootMax = Math.max(root1.length, root2.length) || 1;
    const rootDist = damerauLevenshtein(root1, root2);
    const rootFactor = Math.max(0, (1 - rootDist / rootMax) * 100);
  
    // --- FINAL WEIGHTED CALCULATION ---
    const totalScore = 
      (0.35 * damerauScore) +
      (0.20 * posScore) +
      (0.15 * bigramScore) +
      (0.10 * lcsScore) +
      (0.10 * structuralScore) +
      (0.05 * lengthFactor) +
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
  
  // Helper: Classification Level
  export function getModificationLevel(score: number): string {
    if (score >= 97) return "Spelling mistake";
    if (score >= 92) return "Small modification";
    if (score >= 80) return "Moderate modification";
    if (score >= 65) return "High modification";
    return "Complete modification";
  }
  
  // Helpers for edge cases
  function zeroDetails() {
    return { 
      weighted_damerau: 0, positional_similarity: 0, bigram_similarity: 0, 
      lcs_ratio: 0, length_factor: 0, structural_integrity: 0, root_factor: 0 
    };
  }
  
  function perfectDetails() {
    return { 
      weighted_damerau: 100, positional_similarity: 100, bigram_similarity: 100, 
      lcs_ratio: 100, length_factor: 100, structural_integrity: 100, root_factor: 100 
    };
  }
