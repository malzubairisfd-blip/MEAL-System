
// src/lib/scoringClient.ts
type Settings = any;

/**
 * Minimal, fast scoring used by Test Scoring UI.
 * Mirrors the important parts of your clustering score but is safe for client.
 */

function safeString(x: any) {
  return x === undefined || x === null ? "" : String(x);
}
function digitsOnly(x: any) {
  return safeString(x).replace(/\D/g, "");
}
function normalizeArabic(text: any) {
  if (!text) return "";
  let s = safeString(text).trim().replace(/\s+/g, " ");

  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ؤئ]/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0600-\u06FF0-9 ]/g, "");

  return s;
}

function tokens(s: string) {
  const n = normalizeArabic(s || "");
  return n ? n.split(" ").filter(Boolean) : [];
}

function reduceNameRoot(full: string) {
  const parts = tokens(full);
  return parts.map(p => p.substring(0, 3)).join(" ");
}

function extractPaternal(full: string) {
  const parts = tokens(full);
  return { father: parts[1] || "", grandfather: parts[2] || "" };
}

function jaroWinkler(s1: string, s2: string) {
  s1 = safeString(s1); s2 = safeString(s2);
  if (!s1 || !s2) return 0;
  const len1 = s1.length, len2 = s2.length;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1m = Array(len1).fill(false), s2m = Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2m[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1m[i] = true; s2m[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let k = 0, trans = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  trans /= 2;
  const m = matches;
  const jaro = (m / len1 + m / len2 + (m - trans) / m) / 3;
  let prefix = 0, maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenJaccard(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}
function nameOrderFreeScore(a: string, b: string) {
  const aT = tokens(a), bT = tokens(b);
  if (!aT.length || !bT.length) return 0;
  const j = tokenJaccard(aT, bT);
  const sortedA = aT.slice().sort().join(" "), sortedB = bT.slice().sort().join(" ");
  const sortedJ = jaroWinkler(sortedA, sortedB);
  return 0.7 * j + 0.3 * sortedJ;
}

export function computePairScore(aRaw: any, bRaw: any, settings: Settings) {
  const a = {
    womanName: normalizeArabic(aRaw.womanName || ""),
    husbandName: normalizeArabic(aRaw.husbandName || ""),
    nationalId: safeString(aRaw.nationalId || ""),
    phone: digitsOnly(aRaw.phone || ""),
    children: (Array.isArray(aRaw.children) ? aRaw.children : String(aRaw.children||'').split(',')).map(normalizeArabic),
    village: normalizeArabic(aRaw.village || ""),
  };
  const b = {
    womanName: normalizeArabic(bRaw.womanName || ""),
    husbandName: normalizeArabic(bRaw.husbandName || ""),
    nationalId: safeString(bRaw.nationalId || ""),
    phone: digitsOnly(bRaw.phone || ""),
    children: (Array.isArray(bRaw.children) ? bRaw.children : String(bRaw.children||'').split(',')).map(normalizeArabic),
    village: normalizeArabic(bRaw.village || ""),
  };
  
  const FSW = settings.finalScoreWeights || {};
  const R = settings.rules || {};

  const firstA = tokens(a.womanName)[0] || "";
  const firstB = tokens(b.womanName)[0] || "";
  const familyA = tokens(a.womanName).slice(1).join(" ");
  const familyB = tokens(b.womanName).slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(familyA, familyB);
  const tokenReorderScore = nameOrderFreeScore(a.womanName, b.womanName);
  
  let advancedNameScore = 0;
  if(R.enableNameRootEngine) {
    const rootA = reduceNameRoot(a.womanName);
    const rootB = reduceNameRoot(b.womanName);
    if (rootA && rootB && rootA === rootB) advancedNameScore = 0.8;
    else if (rootA && rootB && jaroWinkler(rootA, rootB) > 0.8) advancedNameScore = 0.5;
  }
  
  const husbandScore = Math.max(jaroWinkler(a.husbandName, b.husbandName), tokenJaccard(tokens(a.husbandName), tokens(b.husbandName)));
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children, b.children);
  const locationScore = (a.village && b.village && a.village === b.village) ? 1 : 0;
  
  let patronymScore = 0;
  if (R.enablePolygamyRules) {
      const aPat = extractPaternal(a.womanName);
      const bPat = extractPaternal(b.womanName);
      if (aPat.father && bPat.father && aPat.father === bPat.father) patronymScore += 0.35;
      if (aPat.grandfather && bPat.grandfather && aPat.grandfather === bPat.grandfather) patronymScore += 0.25;
      if (patronymScore > 0.5) patronymScore = 0.5;
  }
  
  let score = 0;
  score += (FSW.firstNameScore || 0) * firstNameScore;
  score += (FSW.familyNameScore || 0) * familyNameScore;
  score += (FSW.advancedNameScore || 0) * advancedNameScore;
  score += (FSW.tokenReorderScore || 0) * tokenReorderScore;
  score += (FSW.husbandScore || 0) * husbandScore;
  score += (FSW.idScore || 0) * idScore;
  score += (FSW.phoneScore || 0) * phoneScoreVal;
  score += (FSW.childrenScore || 0) * childrenScore;
  score += (FSW.locationScore || 0) * locationScore;
  
  if (R.enablePolygamyRules) {
    score += patronymScore * 0.2;
  }

  score = Math.max(0, Math.min(1, score));

  return { 
      score, 
      breakdown: { 
          firstNameScore, 
          familyNameScore, 
          tokenReorderScore, 
          advancedNameScore,
          husbandScore, 
          idScore, 
          phoneScore: phoneScoreVal, 
          childrenScore, 
          locationScore,
          patronymScore,
      } 
  };
}
