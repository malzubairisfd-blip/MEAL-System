

// src/lib/scoringClient.ts

import type { RecordRow } from "./fuzzyCluster";

type Settings = any;

/**
 * Client-side mirror of the worker's pairwiseScore function.
 * Used for live testing in the settings UI.
 * It is CRITICAL that this logic stays in sync with the worker's logic.
 */

/* -------------------------
   Utilities & Normalizers
   ------------------------- */
function normalizeArabic(s: string): string {
  if (!s) return "";
  s = s.normalize("NFKC");
  s = s.replace(/يحيي/g, "يحي");
  s = s.replace(/يحيى/g, "يحي");
  s = s.replace(/عبد /g, "عبد");
  s = s.replace(/[ًٌٍََُِّْـء]/g, "");
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/[^ء-ي0-9 ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}
function tokens(s:any){ const n = normalizeArabic(s || ""); if(!n) return []; return n.split(" ").filter(Boolean); }
function digitsOnly(s:any){ if(!s) return ""; return String(s).replace(/\D/g,""); }
function normalizeChildrenField(val:any){
  if(!val) return [];
  if(Array.isArray(val)) return val.map(x=>String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x=>String(x)).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(s1:string, s2:string){
  s1 = String(s1 || ""); s2 = String(s2 || "");
  if(!s1 || !s2) return 0;
  const len1=s1.length, len2=s2.length;
  const matchDist = Math.floor(Math.max(len1,len2)/2)-1;
  const s1m = Array(len1).fill(false), s2m = Array(len2).fill(false);
  let matches=0;
  for(let i=0;i<len1;i++){
    const start=Math.max(0,i-matchDist), end=Math.min(i+matchDist+1,len2);
    for(let j=start;j<end;j++){
      if(s2m[j]) continue;
      if(s1[i] !== s2[j]) continue;
      s1m[i]=true; s2m[j]=true; matches++; break;
    }
  }
  if(matches===0) return 0;
  let k=0, trans=0;
  for(let i=0;i<len1;i++){
    if(!s1m[i]) continue;
    while(!s2m[k]) k++;
    if(s1[i] !== s2[k]) trans++;
    k++;
  }
  trans = trans/2.0;
  const m = matches;
  const jaro = (m/len1 + m/len2 + (m-trans)/m)/3.0;
  let prefix=0, maxPrefix=4;
  for(let i=0;i<Math.min(maxPrefix,len1,len2);i++){
    if(s1[i]===s2[i]) prefix++; else break;
  }
  return jaro + prefix*0.1*(1-jaro);
}
function tokenJaccard(a:string[], b:string[]){
  if(!a.length && !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const uni = new Set([...A,...B]).size;
  return uni === 0 ? 0 : inter/uni;
}

/* -------------------------
   Name helpers
   ------------------------- */
function reduceNameRoot(full:string){
  const parts = tokens(full);
  return parts.map(p => p.slice(0,3)).join(" ");
}
function extractPaternal(full:string){
  const parts = tokens(full);
  return { father: parts[1] || "", grandfather: parts[2] || "" };
}
function extractMaternal(full:string){
  const parts = tokens(full);
  const L = parts.length;
  return { mother: parts[L-2]||"", grandmother: parts[L-3]||"" };
}
function extractTribal(full:string){
  const parts = tokens(full);
  for(let i=parts.length-1;i>=0;i--) if(parts[i].startsWith("ال")) return parts[i];
  return "";
}
function nameOrderFreeScore(aName:string,bName:string){
  const aT = tokens(aName), bT = tokens(bName);
  if(!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  const union = new Set([...A,...B]).size; const jacc = union===0?0:inter/union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted,bSorted);
  return 0.7*jacc + 0.3*sj;
}

function splitParts(name:string) {
  if (!name) return [];
  return name.trim().split(/\s+/).filter(Boolean);
}

function applyAdditionalRules(a:any, b:any, jw:any, minPair:any) {

  const A = splitParts(a.womanName_normalized);
  const B = splitParts(b.womanName_normalized);

  const HA = splitParts(a.husbandName_normalized);
  const HB = splitParts(b.husbandName_normalized);

  const sc = (x:string,y:string) => jw(x||"", y||"");
  const s90 = (x:string,y:string) => sc(x,y) >= 0.90;
  const s93 = (x:string,y:string) => sc(x,y) >= 0.93;
  const s95 = (x:string,y:string) => sc(x,y) >= 0.95;

  /* ----------------------------------------------------
     RULE 0 — STRONG TOKEN MATCH (NEW, MAIN FIX)
     If 80–100% tokens match between both names → DUPLICATE
     ---------------------------------------------------- */
  {
    const setA = new Set(A);
    const setB = new Set(B);

    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;

    const union = new Set([...setA, ...setB]).size;
    const ratio = union === 0 ? 0 : inter / union;

    if (ratio >= 0.80) {  
      return minPair + 0.20; // FORCE DUPLICATE
    }
  }

  /* ----------------------------------------------------
     RULE 1 — EXACT 3-part match (first + father + grandfather)
     ---------------------------------------------------- */
  if (
    A.length >= 3 && B.length >= 3 &&
    s93(A[0], B[0]) &&
    s93(A[1], B[1]) &&
    s93(A[2], B[2])
  ) {
    return minPair + 0.18;
  }

  /* ----------------------------------------------------
     RULE 2 — 4 vs 5 part names, extension ignored
     Example: محمد العمراني ≈ محمد
     ---------------------------------------------------- */
  if (
    (A.length === 4 && B.length === 5) ||
    (A.length === 5 && B.length === 4)
  ) {
    const minLen = Math.min(A.length, B.length);

    let strongMatches = 0;
    for (let i = 0; i < minLen; i++) {
      if (s93(A[i], B[i])) strongMatches++;
    }

    // 80%+ of parts match
    if (strongMatches >= minLen - 1) {
      return minPair + 0.17;
    }
  }

  /* ----------------------------------------------------
     RULE 3 — Very high similarity in all four key parts
     ---------------------------------------------------- */
  if (
    A.length >= 4 && B.length >= 4 &&
    s93(A[0], B[0]) &&
    s93(A[1], B[1]) &&
    s93(A[2], B[2]) &&
    s93(A[3], B[3])
  ) {
    return minPair + 0.16;
  }

  /* ----------------------------------------------------
     RULE 4 — Husband names also match strongly
     ---------------------------------------------------- */
  if (
    HA.length > 0 && HB.length > 0 &&
    s93(HA[0], HB[0]) &&
    (HA[1] && HB[1] ? s93(HA[1], HB[1]) : true)
  ) {
    // combine with woman-name similarity
    const womanJacc = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
    if (womanJacc >= 0.80) {
      return minPair + 0.15;
    }
  }

  /* ----------------------------------------------------
     RULE 5 — fallback: first-name high similarity
     ---------------------------------------------------- */
  if (A.length > 0 && B.length > 0 && s93(A[0], B[0])) {
    return minPair + 0.14;
  }

  return null;
}

export function computePairScore(aRaw:any,bRaw:any, opts:any){
  const optsDefaults = {
    finalScoreWeights: {
        nameScore: 0.40,
        husbandScore: 0.25,
        idScore: 0.15,
        phoneScore: 0.10,
        locationScore: 0.05,
        childrenScore: 0.05
    },
    rules: {
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enablePolygamyRules: true
    },
    thresholds: {
      minPair: 0.62
    }
  };
    const o = { ...optsDefaults, ...opts,
    finalScoreWeights: {...optsDefaults.finalScoreWeights, ...(opts?.finalScoreWeights || {})},
    rules: {...optsDefaults.rules, ...(opts?.rules || {})},
    thresholds: {...optsDefaults.thresholds, ...(opts?.thresholds || {})},
   };
  const FSW = o.finalScoreWeights;

  const a = {
    womanName_normalized: normalizeArabic(aRaw.womanName||""),
    husbandName_normalized: normalizeArabic(aRaw.husbandName||""),
    nationalId: String(aRaw.nationalId||aRaw.id||""),
    phone: digitsOnly(aRaw.phone||""),
    village_normalized: normalizeArabic(aRaw.village||""),
    subdistrict_normalized: normalizeArabic(aRaw.subdistrict||""),
    children_normalized: normalizeChildrenField(aRaw.children||"").map(normalizeArabic)
  };
  const b = {
    womanName_normalized: normalizeArabic(bRaw.womanName||""),
    husbandName_normalized: normalizeArabic(bRaw.husbandName||""),
    nationalId: String(bRaw.nationalId||bRaw.id||""),
    phone: digitsOnly(bRaw.phone||""),
    village_normalized: normalizeArabic(bRaw.village||""),
    subdistrict_normalized: normalizeArabic(bRaw.subdistrict||""),
    children_normalized: normalizeChildrenField(bRaw.children||"").map(normalizeArabic)
  };
  
  const wTokensA = tokens(a.womanName_normalized);
  const wTokensB = tokens(b.womanName_normalized);
  const firstNameA = wTokensA[0] || "";
  const firstNameB = wTokensB[0] || "";
  const familyNameA = wTokensA.slice(1).join(" ");
  const familyNameB = wTokensB.slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstNameA, firstNameB);
  const familyNameScore = jaroWinkler(familyNameA, familyNameB);
  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);

  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const husbandPerm = nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized);
  const husbandScore = Math.max(husbandJW, husbandPerm);

  const phoneScoreVal = (a.phone && b.phone) ? (a.phone===b.phone ? 1 : (a.phone.slice(-6)===b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4)===b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId===b.nationalId ? 1 : (a.nationalId.slice(-5)===b.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  const childrenScore = tokenJaccard(a.children_normalized, b.children_normalized);

  let locationScore = 0;
  if(a.village_normalized && b.village_normalized && a.village_normalized===b.village_normalized) locationScore += 0.4;
  if(a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized===b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);
  
  const breakdown = {
    firstNameScore,
    familyNameScore,
    tokenReorderScore,
    husbandScore,
    idScore,
    phoneScore: phoneScoreVal,
    childrenScore,
    locationScore,
    additionalRuleTriggered: false
  };

  const ruleScore = applyAdditionalRules(a, b, jaroWinkler, o.thresholds.minPair);
  if (ruleScore !== null) {
    breakdown.additionalRuleTriggered = true;
    return {
      score: ruleScore,
      breakdown: breakdown
    };
  }
  
  let score = 0;
  score += (FSW.firstNameScore ?? 0) * firstNameScore;
  score += (FSW.familyNameScore ?? 0) * familyNameScore;
  score += (FSW.tokenReorderScore ?? 0) * tokenReorderScore;
  score += (FSW.husbandScore ?? 0) * husbandScore;
  score += (FSW.idScore ?? 0) * idScore;
  score += (FSW.phoneScore ?? 0) * phoneScoreVal;
  score += (FSW.childrenScore ?? 0) * childrenScore;
  score += (FSW.locationScore ?? 0) * locationScore;
  
  score = Math.max(0, Math.min(1, score));

  return { score, breakdown };
}
