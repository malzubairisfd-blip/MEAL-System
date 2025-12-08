
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
const arabicEquivalenceMap: Record<string, string> = {
  "إ":"ا","أ":"ا","آ":"ا","ى":"ي","ئ":"ي","ؤ":"و","ة":"ه",
  "ق":"ك","ك":"ق","ط":"ت","ت":"ط","ه":"ح","ح":"ه","ظ":"ض","ض":"ظ","ز":"ذ","ذ":"ز"
};
function normalizeChar(ch:string){ return arabicEquivalenceMap[ch] || ch; }
function safeString(x:any){ if (x===null || x===undefined) return ""; return String(x); }
function normalizeArabic(text:any){
  if(!text) return "";
  let t = safeString(text).trim();
  t = t.replace(/[^\u0600-\u06FF0-9\s]/g," ").replace(/\s+/g," ");
  t = t.replace(/ابن|بن|ولد/g,"بن");
  t = t.replace(/آل|ال/g,"ال");
  t = t.replace(/[.,·•\u200C\u200B]/g,"");
  return t.split("").map(normalizeChar).join("").trim();
}
function tokens(s:any){ const n = normalizeArabic(s||""); if(!n) return []; return n.split(" ").filter(Boolean); }
function digitsOnly(s:any){ if(!s) return ""; return safeString(s).replace(/\D/g,""); }
function normalizeChildrenField(val:any){
  if(!val) return [];
  if(Array.isArray(val)) return val.map(x=>normalizeArabic(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x=>normalizeArabic(x)).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(s1:string, s2:string){
  s1 = safeString(s1); s2 = safeString(s2);
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
    }
  };
  const o = { ...optsDefaults, ...opts,
    finalScoreWeights: {...optsDefaults.finalScoreWeights, ...(opts.finalScoreWeights || {})},
    rules: {...optsDefaults.rules, ...(opts.rules || {})},
  };
  const FSW = o.finalScoreWeights;

  const a = {
    womanName: normalizeArabic(aRaw.womanName||""),
    husbandName: normalizeArabic(aRaw.husbandName||""),
    nationalId: safeString(aRaw.nationalId||aRaw.id||""),
    phone: digitsOnly(aRaw.phone||""),
    village: normalizeArabic(aRaw.village||""),
    subdistrict: normalizeArabic(aRaw.subdistrict||""),
    children: normalizeChildrenField(aRaw.children||""),
    raw: aRaw
  };
  const b = {
    womanName: normalizeArabic(bRaw.womanName||""),
    husbandName: normalizeArabic(bRaw.husbandName||""),
    nationalId: safeString(bRaw.nationalId||bRaw.id||""),
    phone: digitsOnly(bRaw.phone||""),
    village: normalizeArabic(bRaw.village||""),
    subdistrict: normalizeArabic(bRaw.subdistrict||""),
    children: normalizeChildrenField(bRaw.children||""),
    raw: bRaw
  };

  // components
  const firstA = tokens(a.womanName)[0]||"";
  const firstB = tokens(b.womanName)[0]||"";
  const familyA = tokens(a.womanName).slice(1).join(" ");
  const familyB = tokens(b.womanName).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);
  const tokenReorderScore = nameOrderFreeScore(a.womanName, b.womanName);

  // advanced root
  const rootA = reduceNameRoot(a.womanName), rootB = reduceNameRoot(b.womanName);
  let advancedNameScore = 0;
  if(rootA && rootB && rootA === rootB) advancedNameScore += 0.35;
  if(rootA && rootB && (rootA.startsWith(rootB) || rootB.startsWith(rootA))) advancedNameScore += 0.2;
  advancedNameScore = Math.min(0.4, advancedNameScore);

  // husband
  const husbandJW = jaroWinkler(a.husbandName, b.husbandName);
  const husbandToken = tokenJaccard(tokens(a.husbandName), tokens(b.husbandName));
  const husbandScore = Math.max(husbandJW, husbandToken);

  // phone & id
  const phoneScore = (a.phone && b.phone) ? (a.phone===b.phone ? 1 : (a.phone.slice(-6)===b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4)===b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId===b.nationalId ? 1 : (a.nationalId.slice(-5)===b.nationalId.slice(-5) ? 0.75 : 0)) : 0;

  const childrenScore = tokenJaccard(a.children, b.children);

  let locationScore = 0;
  if(a.village && b.village && a.village===b.village) locationScore += 0.4;
  if(a.subdistrict && b.subdistrict && a.subdistrict===b.subdistrict) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  // patronymic / maternal / tribal
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

  // shared husband + paternal line boost (polygamy rule)
  let sharedHusbandPatronym = 0;
  const husbandSimilar = jaroWinkler(a.husbandName,b.husbandName) >= 0.92;
  if(husbandSimilar){
    if(aPat.father && bPat.father && aPat.father===bPat.father) sharedHusbandPatronym += 0.25;
    if(aPat.grandfather && bPat.grandfather && aPat.grandfather===bPat.grandfather) sharedHusbandPatronym += 0.2;
    if(sharedHusbandPatronym >= 0.4) sharedHusbandPatronym = 0.55;
  }

  // multi-registration detection
  const womanExact = (a.womanName && b.womanName && a.womanName===b.womanName);
  const womanFuzzy = (firstNameScore + familyNameScore + advancedNameScore + tokenReorderScore) / 4;
  const strongNameMatch = (womanExact || womanFuzzy >= 0.85 || tokenReorderScore >= 0.85);
  const multiRegistrationFlag = strongNameMatch && (idScore < 0.5 && phoneScore < 0.5 && husbandScore < 0.5) ? 1 : 0;

  // compose final score from weights
  let score = 0;
  score += FSW.firstNameScore * firstNameScore;
  score += FSW.familyNameScore * familyNameScore;
  score += FSW.advancedNameScore * advancedNameScore;
  score += FSW.tokenReorderScore * tokenReorderScore;
  score += FSW.husbandScore * husbandScore;
  score += FSW.idScore * idScore;
  score += FSW.phoneScore * phoneScore;
  score += FSW.childrenScore * childrenScore;
  score += FSW.locationScore * locationScore;

  if(o.rules.enableNameRootEngine) score += advancedNameScore * 0.12;
  if(o.rules.enableTribalLineage) score += tribalScore * 1.0;
  if(o.rules.enableMaternalLineage) score += maternalScore * 0.7;
  if(o.rules.enablePolygamyRules) score += sharedHusbandPatronym * 1.2;

  score = Math.max(0, Math.min(1, score));

  const breakdown = {
    firstNameScore,
    familyNameScore,
    advancedNameScore,
    tokenReorderScore,
    husbandScore,
    idScore,
    phoneScore,
    childrenScore,
    locationScore,
    patronymScore,
    sharedHusbandPatronym,
    tribalScore,
    maternalScore,
    multiRegistrationFlag,
    strongNameMatch
  };

  return { score, breakdown };
}
