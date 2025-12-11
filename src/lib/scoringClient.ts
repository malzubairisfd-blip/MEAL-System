

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
function normalizeArabic(text:any){
  if(!text) return "";
  let s = String(text).trim();
  s = s.replace(/[\u064B-\u0652\u0670\u0640\u064C]/g, ""); // tashkeel/tajweed
  s = s.replace(/[أإآء]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/\s+/g, " ");
  return s;
}
function tokens(s:any){ const n = normalizeArabic(s||""); if(!n) return []; return n.split(" ").filter(Boolean); }
function digitsOnly(s:any){ if(!s) return ""; return String(s).replace(/\D/g,""); }
function normalizeChildrenField(val:any){
  if(!val) return [];
  if(Array.isArray(val)) return val.map(x=>normalizeArabic(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x=>normalizeArabic(x)).filter(Boolean);
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
  const wA = a.womanName || "";
  const wB = b.womanName || "";
  const hA = a.husbandName || "";
  const hB = b.husbandName || "";

  const WA = splitParts(wA);
  const WB = splitParts(wB);
  const HA = splitParts(hA);
  const HB = splitParts(hB);

  const lenWA = WA.length;
  const lenWB = WB.length;
  const lenHA = HA.length;
  const lenHB = HB.length;

  const [F1, Fa1, G1, L1] = WA;
  const [F2, Fa2, G2, L2] = WB;

  const [HF1, HFa1, HG1, HL1] = HA;
  const [HF2, HFa2, HG2, HL2] = HB;

  const sc = (x:string, y:string) => jw(x || "", y || "");
  const s93 = (x:string, y:string) => sc(x, y) >= 0.93;
  const s95 = (x:string, y:string) => sc(x, y) >= 0.95;

  const diffHusband = sc(hA, hB) < 0.60;

  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    sc(L1, L2) < 0.80 &&
    diffHusband
  ) {
    return minPair + 0.10;
  }

  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    s93(L1, L2) &&
    diffHusband
  ) {
    return minPair + 0.12;
  }

  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    s93(L1, L2) &&
    diffHusband
  ) {
    return minPair + 0.14;
  }

  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s95(F1, F2) &&
    s93(Fa1, Fa2) &&
    sc(G1, G2) < 0.93 &&
    sc(L1, L2) < 0.93 &&
    s95(HF1, HF2) &&
    sc(HFa1, HFa2) < 0.93 &&
    s93(HL1, HL2)
  ) {
    return minPair + 0.15;
  }

  if (
    ((lenWA === 4 && lenWB === 5) || (lenWA === 5 && lenWB === 4)) &&
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    sc(L1, L2) < 0.93 &&
    ((lenHA === 4 && lenHB === 5) || (lenHA === 5 && lenHB === 4)) &&
    s93(HF1, HF2) &&
    s93(HFa1, HFa2) &&
    s93(HG1, HG2)
  ) {
    return minPair + 0.12;
  }
  
  if (
    s93(F1, F2) &&
    s93(Fa1, Fa2) &&
    s93(G1, G2) &&
    sc(HF1, HF2) < 0.90
  ) {
    return minPair + 0.08;
  }


  return null;
}

export function computePairScore(aRaw:any,bRaw:any, opts:any){
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.04,
      locationScore: 0.04
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
    womanName: normalizeArabic(aRaw.womanName||""),
    husbandName: normalizeArabic(aRaw.husbandName||""),
    nationalId: String(aRaw.nationalId||aRaw.id||""),
    phone: digitsOnly(aRaw.phone||""),
    village: normalizeArabic(aRaw.village||""),
    subdistrict: normalizeArabic(aRaw.subdistrict||""),
    children: normalizeChildrenField(aRaw.children||""),
    raw: aRaw
  };
  const b = {
    womanName: normalizeArabic(bRaw.womanName||""),
    husbandName: normalizeArabic(bRaw.husbandName||""),
    nationalId: String(bRaw.nationalId||bRaw.id||""),
    phone: digitsOnly(bRaw.phone||""),
    village: normalizeArabic(bRaw.village||""),
    subdistrict: normalizeArabic(bRaw.subdistrict||""),
    children: normalizeChildrenField(bRaw.children||""),
    raw: bRaw
  };
  
  const extra = applyAdditionalRules(a, b, jaroWinkler, o.thresholds.minPair);
  if (extra !== null) {
     const breakdown = {
        firstNameScore: jaroWinkler((tokens(a.womanName)[0]||""), (tokens(b.womanName)[0]||"")),
        familyNameScore: jaroWinkler(tokens(a.womanName).slice(1).join(" "), tokens(b.womanName).slice(1).join(" ")),
        husbandScore: Math.max(jaroWinkler(a.husbandName, b.husbandName), tokenJaccard(tokens(a.husbandName), tokens(b.husbandName))),
        idScore: (a.nationalId && b.nationalId) ? (a.nationalId===b.nationalId ? 1 : 0) : 0,
        phoneScore: (a.phone && b.phone) ? (a.phone===b.phone ? 1 : (a.phone.slice(-6)===b.phone.slice(-6) ? 0.85 : 0)) : 0,
        childrenScore: tokenJaccard(a.children, b.children),
        locationScore: (a.village && b.village && a.village===b.village) ? 0.4 : 0,
        additionalRuleTriggered: true
    };
    return {
      score: extra,
      breakdown: breakdown
    };
  }

  const firstA = tokens(a.womanName)[0]||"";
  const firstB = tokens(b.womanName)[0]||"";
  const familyA = tokens(a.womanName).slice(1).join(" ");
  const familyB = tokens(b.womanName).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);
  const tokenReorderScore = nameOrderFreeScore(a.womanName, b.womanName);

  const rootA = reduceNameRoot(a.womanName), rootB = reduceNameRoot(b.womanName);
  let advancedNameScore = 0;
  if(rootA && rootB && rootA === rootB) advancedNameScore += 0.35;
  if(rootA && rootB && (rootA.startsWith(rootB) || rootB.startsWith(rootA))) advancedNameScore += 0.2;
  advancedNameScore = Math.min(0.4, advancedNameScore);

  const husbandJW = jaroWinkler(a.husbandName, b.husbandName);
  const husbandToken = tokenJaccard(tokens(a.husbandName), tokens(b.husbandName));
  const husbandScore = Math.max(husbandJW, husbandToken);

  const phoneScoreVal = (a.phone && b.phone) ? (a.phone===b.phone ? 1 : (a.phone.slice(-6)===b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4)===b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId===b.nationalId ? 1 : (a.nationalId.slice(-5)===b.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  const childrenScore = tokenJaccard(a.children, b.children);

  let locationScore = 0;
  if(a.village && b.village && a.village===b.village) locationScore += 0.4;
  if(a.subdistrict && b.subdistrict && a.subdistrict===b.subdistrict) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const aPat = extractPaternal(a.womanName), bPat = extractPaternal(b.womanName);
  let patronymScore = 0;
  if(aPat.father && bPat.father && aPat.father===bPat.father) patronymScore += 0.35;
  if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) patronymScore += 0.25;
  patronymScore = Math.min(0.5, patronymScore);

  const aMat = extractMaternal(a.womanName), bMat = extractMaternal(b.womanName);
  let maternalScore = 0;
  if(aMat.mother && bMat.mother && aMat.mother===bMat.mother) maternalScore += 0.18;
  if(aMat.grandmother && bMat.grandmother && aMat.grandmother===bMat.grandmother) maternalScore += 0.12;
  maternalScore = Math.min(0.3, maternalScore);

  const tribalScore = (extractTribal(a.womanName) && extractTribal(b.womanName) && extractTribal(a.womanName)===extractTribal(b.womanName)) ? 0.4 : 0;

  let sharedHusbandPatronym = 0;
  const husbandSimilar = jaroWinkler(a.husbandName,b.husbandName) >= 0.92;
  if(husbandSimilar){
    if(aPat.father && bPat.father && aPat.father===bPat.father) sharedHusbandPatronym += 0.25;
    if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) sharedHusbandPatronym += 0.2;
    if(sharedHusbandPatronym >= 0.4) sharedHusbandPatronym = 0.55;
  }

  const womanExact = (a.womanName && b.womanName && a.womanName===b.womanName);
  const womanFuzzy = (firstNameScore + familyNameScore + advancedNameScore + tokenReorderScore) / 4;
  const strongNameMatch = (womanExact || womanFuzzy >= 0.85 || tokenReorderScore >= 0.85);
  const multiRegistrationFlag = strongNameMatch && (idScore < 0.5 && phoneScoreVal < 0.5 && husbandScore < 0.5) ? 1 : 0;
  
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
    patronymScore,
    sharedHusbandPatronym,
    tribalScore,
    maternalScore,
    multiRegistrationFlag,
    strongNameMatch,
    additionalRuleTriggered: false
  };
  
  let score = 0;
  score += FSW.firstNameScore * firstNameScore;
  score += FSW.familyNameScore * familyNameScore;
  score += FSW.advancedNameScore * advancedNameScore;
  score += FSW.tokenReorderScore * tokenReorderScore;
  score += FSW.husbandScore * husbandScore;
  score += FSW.idScore * idScore;
  score += FSW.phoneScore * phoneScoreVal;
  score += FSW.childrenScore * childrenScore;
  score += FSW.locationScore * locationScore;

  if(o.rules.enableNameRootEngine) score += advancedNameScore * 0.12;
  if(o.rules.enableTribalLineage) score += tribalScore * 1.0;
  if(o.rules.enableMaternalLineage) score += maternalScore * 0.7;
  if(o.rules.enablePolygamyRules) score += sharedHusbandPatronym * 1.2;

  score = Math.max(0, Math.min(1, score));

  return { score, breakdown };
}
