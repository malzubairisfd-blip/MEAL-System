

// src/lib/scoringClient.ts

// This file is a client-side mirror of the worker's scoring logic.
// It's used for live testing in the settings UI. It must be kept in sync.

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s) {
  if (!s) return "";
  try { s = String(s); } catch { s = "";}
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
  s = s.replace(/گ/g, "ك");
  s = s.replace(/[^ء-ي0-9a-zA-Z\s]/g, " "); // keep Arabic letters, numbers, ascii, spaces
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

function tokens(s) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

function digitsOnly(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\D/g, "");
}

function normalizeChildrenField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aM = Array(la).fill(false), bM = Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bM[j]) continue;
      if (a[i] !== b[j]) continue;
      aM[i] = true; bM[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let k = 0, trans = 0;
  for (let i = 0; i < la; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }
  trans = trans / 2;
  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;
  let prefix = 0, maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenJaccard(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName, bName) {
  const aT = tokens(aName), bT = tokens(bName);
  if (!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
}

function splitParts(name) {
  if (!name) return [];
  return tokens(name);
}

function applyAdditionalRules(a, b, opts) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a.womanName_normalized || "");
  const B = splitParts(b.womanName_normalized || "");
  const HA = splitParts(a.husbandName_normalized || "");
  const HB = splitParts(b.husbandName_normalized || "");

  // RULE 0: strong token match (80%+ tokens overlap)
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.80) return Math.min(1, minPair + 0.22);
  }

  /* ----------------------------------------------------
     RULE 6 — STRONG HOUSEHOLD + CHILDREN MATCH (CRITICAL)
     This rule overrides all weak lineage noise
     المرأة نفسها مع اختلاف النسب — الزوج + الأطفال حاسمين
  ---------------------------------------------------- */
  {
    const A = splitParts(a.womanName_normalized);
    const B = splitParts(b.womanName_normalized);

    const firstNameMatch =
      A.length > 0 && B.length > 0 && jw(A[0], B[0]) >= 0.93;

    const husbandStrong =
      jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.90 ||
      nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized) >= 0.90;

    const childrenMatch =
      tokenJaccard(
        a.children_normalized || [],
        b.children_normalized || []
      ) >= 0.90;

    if (firstNameMatch && husbandStrong && childrenMatch) {
      return minPair + 0.25; // HARD FORCE DUPLICATE
    }
  }

  // Helper thresholds
  const s90 = (x, y) => jw(x || "", y || "") >= 0.90;
  const s93 = (x, y) => jw(x || "", y || "") >= 0.93;
  const s95 = (x, y) => jw(x || "", y || "") >= 0.95;

  // Normalize accessors for first, father, grandfather, 4th/last
  const getPart = (arr, idx) => (arr && arr.length > idx) ? arr[idx] : "";

  const F1 = getPart(A, 0), Fa1 = getPart(A, 1), G1 = getPart(A, 2), L1 = getPart(A, 3);
  const F2 = getPart(B, 0), Fa2 = getPart(B, 1), G2 = getPart(B, 2), L2 = getPart(B, 3);

  const HF1 = getPart(HA, 0), HFa1 = getPart(HA, 1), HG1 = getPart(HA, 2);
  const HF2 = getPart(HB, 0), HFa2 = getPart(HB, 1), HG2 = getPart(HB, 2);

  // RULE 1:
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
    if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.18);
  }

  // RULE 2:
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
    if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.18);
  }

  // RULE 3:
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
      if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.17);
    }
  }

  // RULE 4:
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2)) {
      if (s93(Fa1, Fa2) && !s93(G1, G2)) {
        return Math.min(1, minPair + 0.20);
      }
    }
  }

  // RULE 5:
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2)) {
      if (jw(HF1, HF2) < 0.7) return Math.min(1, minPair + 0.16);
    }
  }

  return null;
}

export function computePairScore(aRaw, bRaw, opts) {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.06,
      locationScore: 0.04
    },
    thresholds: {
      minPair: 0.62,
      minInternal: 0.50,
      blockChunkSize: 3000
    },
    rules: {
      enablePolygamyRules: true
    }
  };
  const o = Object.assign({}, optsDefaults, opts || {});
  o.finalScoreWeights = Object.assign({}, optsDefaults.finalScoreWeights, (opts && opts.finalScoreWeights) || {});
  o.thresholds = Object.assign({}, optsDefaults.thresholds, (opts && opts.thresholds) || {});
  o.rules = Object.assign({}, optsDefaults.rules, (opts && opts.rules) || {});

  const a = {
    womanName: aRaw.womanName || "",
    husbandName: aRaw.husbandName || "",
    nationalId: String(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(aRaw.phone || ""),
    village: aRaw.village || "",
    subdistrict: aRaw.subdistrict || "",
    children: aRaw.children || []
  };
  const b = {
    womanName: bRaw.womanName || "",
    husbandName: bRaw.husbandName || "",
    nationalId: String(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(bRaw.phone || ""),
    village: bRaw.village || "",
    subdistrict: bRaw.subdistrict || "",
    children: bRaw.children || []
  };

  a.womanName_normalized = normalizeArabicRaw(a.womanName);
  b.womanName_normalized = normalizeArabicRaw(b.womanName);
  a.husbandName_normalized = normalizeArabicRaw(a.husbandName);
  b.husbandName_normalized = normalizeArabicRaw(b.husbandName);
  a.village_normalized = normalizeArabicRaw(a.village);
  b.village_normalized = normalizeArabicRaw(b.village);
  a.children_normalized = (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
  b.children_normalized = (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);

  if (a.nationalId && b.nationalId && a.nationalId === b.nationalId) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" } };
  }

  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const aParts = splitParts(a.womanName_normalized), bParts = splitParts(b.womanName_normalized);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" } };
  }

  const ruleBoost = applyAdditionalRules(a, b, o);
  if (ruleBoost !== null) {
    return { score: Math.min(1, ruleBoost), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleBoost } };
  }

  const A = splitParts(a.womanName_normalized), B = splitParts(b.womanName_normalized);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");

  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = s => splitParts(s).map(t => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized), rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    const jwroot = jaroWinkler(rA, rB);
    return Math.min(0.5, jwroot);
  })();

  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
  const husbandScore = Math.max(jaroWinkler(a.husbandName_normalized, b.husbandName_normalized), nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized));
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children_normalized || [], b.children_normalized || []);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const W = o.finalScoreWeights;
  let score = 0;
  score += (W.firstNameScore || 0) * firstNameScore;
  score += (W.familyNameScore || 0) * familyNameScore;
  score += (W.advancedNameScore || 0) * advancedNameScore;
  score += (W.tokenReorderScore || 0) * tokenReorderScore;
  score += (W.husbandScore || 0) * husbandScore;
  score += (W.idScore || 0) * idScore;
  score += (W.phoneScore || 0) * phoneScoreVal;
  score += (W.childrenScore || 0) * childrenScore;
  score += (W.locationScore || 0) * locationScore;

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = {
    firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore,
    husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore
  };

  return { score, breakdown };
}
