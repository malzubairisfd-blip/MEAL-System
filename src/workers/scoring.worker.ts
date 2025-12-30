// src/workers/scoring.worker.ts

const safeAvg = (arr: (number | null | undefined)[]) => {
  const valid = arr.filter((v) => typeof v === "number" && isFinite(v)) as number[];
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
};
const variance = (arr: number[]) => {
  if (!arr.length) return 0;
  const mean = safeAvg(arr);
  return safeAvg(arr.map((v) => (v - mean) ** 2));
};
const calculateConfidenceScore = (pairScores: any[], clusterSize: number) => {
  if (!pairScores.length) return 0;
  const finalScores = pairScores.map((p) => p.score);
  const avgPairScore = safeAvg(finalScores);
  const consistencyScore = Math.max(0, 1 - variance(finalScores));
  const sizeBoost = Math.min(0.1, Math.max(0, (clusterSize - 2) * 0.03));
  const confidence = avgPairScore * 0.7 + consistencyScore * 0.2 + sizeBoost;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
};
const normalizeArabicRaw = (s: any) => {
  if (!s) return "";
  try {
    s = String(s);
  } catch {
    s = "";
  }
  s = s.normalize("NFKC");
  s = s.replace(/يحيي/g, "يحي").replace(/يحيى/g, "يحي").replace(/عبد /g, "عبد");
  s = s
    .replace(/[ًٌٍََُِّْـء]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك");
  s = s.replace(/[^ء-ي0-9a-zA-Z\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
};
const digitsOnly = (s: any) => {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\D/g, "");
};
const normalizeChildrenField = (val: any) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((x) => String(x)).filter(Boolean);
  return String(val)
    .split(/[;,|،]/)
    .map((x) => String(x).trim())
    .filter(Boolean);
};
const jaroWinkler = (aInput: any, bInput: any) => {
  const a = String(aInput || "");
  const b = String(bInput || "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aM = Array(la).fill(false);
  const bM = Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bM[j]) continue;
      if (a[i] !== b[j]) continue;
      aM[i] = true;
      bM[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let trans = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }
  trans = trans / 2;
  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
};
const tokenJaccard = (aTokens: any, bTokens: any) => {
  if (!aTokens || !bTokens) return 0;
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
};
const splitPartsFromNormalized = (s: any) => {
  if (!s) return [];
  return String(s).split(/\s+/).filter(Boolean);
};
const nameOrderFreeScore = (aName: any, bName: any) => {
  const aT = splitPartsFromNormalized(aName);
  const bT = splitPartsFromNormalized(bName);
  if (!aT.length || !bT.length) return 0;
  const A = new Set(aT);
  const B = new Set(bT);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  const aSorted = aT.slice().sort().join(" ");
  const bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
};
const nameOrderFreeScoreFromParts = (aParts: any, bParts: any) => {
  if (!aParts.length || !bParts.length) return 0;
  const A = new Set(aParts);
  const B = new Set(bParts);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  const aSorted = aParts.slice().sort().join(" ");
  const bSorted = bParts.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
};
const applyAdditionalRules = (a: any, b: any, opts: any) => {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;
  const A = a._parts || splitPartsFromNormalized(a.womanName_normalized || "");
  const B = b._parts || splitPartsFromNormalized(b.womanName_normalized || "");
  const HA = a._husbandParts || splitPartsFromNormalized(a.husbandName_normalized || "");
  const HB = b._husbandParts || splitPartsFromNormalized(b.husbandName_normalized || "");
  const reasons: any[] = [];
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.8) {
      reasons.push("TOKEN_REORDER");
      return { score: Math.min(1, minPair + 0.22), reasons };
    }
  }
  {
    const A_parts = A;
    const B_parts = B;
    const firstNameMatch = A_parts.length > 0 && B_parts.length > 0 && jw(A_parts[0], B_parts[0]) >= 0.93;
    const husbandStrong = jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.9 || nameOrderFreeScoreFromParts(HA, HB) >= 0.9;
    const childrenMatch = tokenJaccard(a.children_normalized || [], b.children_normalized || []) >= 0.9;
    if (firstNameMatch && husbandStrong && childrenMatch) {
      reasons.push("DUPLICATED_HUSBAND_LINEAGE");
      return { score: minPair + 0.25, reasons };
    }
  }
  const s93 = (x: any, y: any) => jw(x || "", y || "") >= 0.93;
  const s95 = (x: any, y: any) => jw(x || "", y || "") >= 0.95;
  const getPart = (arr: any, idx: any) => (arr && arr.length > idx) ? arr[idx] : "";
  const F1 = getPart(A, 0),
    Fa1 = getPart(A, 1),
    G1 = getPart(A, 2),
    L1 = getPart(A, 3);
  const F2 = getPart(B, 0),
    Fa2 = getPart(B, 1),
    G2 = getPart(B, 2),
    L2 = getPart(B, 3);
  const HF1 = getPart(HA, 0);
  const HF2 = getPart(HB, 0);
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
    if (jw(HF1, HF2) < 0.7) {
      reasons.push("WOMAN_LINEAGE_MATCH");
      return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
    if (jw(HF1, HF2) < 0.7) {
      reasons.push("WOMAN_LINEAGE_MATCH");
      return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
      if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.17), reasons };
      }
    }
  }
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2)) {
      if (s93(Fa1, Fa2) && !s93(G1, G2)) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: Math.min(1, minPair + 0.20), reasons };
      }
    }
  }
  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2)) {
      if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.16), reasons };
      }
    }
  }
  {
    if (A.length >= 3 && B.length >= 3 && HA.length >= 3 && HB.length >= 3) {
      const womanFatherOK = jw(A[1], B[1]) >= 0.93;
      const womanGrandOK = jw(A[2], B[2]) >= 0.93;
      const womanFamilyOK = jw(A[A.length - 1], B[B.length - 1]) >= 0.90;
      const womanLineageStrong = womanFatherOK && womanGrandOK && womanFamilyOK;
      const husbandFirstOK = jw(HA[0], HB[0]) >= 0.93;
      const husbandFatherOK = jw(HA[1], HB[1]) >= 0.93;
      const husbandGrandOK = jw(HA[2], HB[2]) >= 0.93;
      const husbandFamilyOK = jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.90;
      const husbandIsSamePerson = husbandFirstOK && husbandFatherOK && husbandGrandOK && husbandFamilyOK;
      const womanFirstSupport = jw(A[0], B[0]) >= 0.55 || jw(A[0], B[0]) === 0;
      if (womanLineageStrong && husbandIsSamePerson && womanFirstSupport) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: Math.min(1, minPair + 0.23), reasons };
      }
    }
  }
  {
    const investigationWords = [
      "تحت",
      "التحقيق",
      "مراجعة",
      "قيد",
      "موقوف",
      "غير",
      "مكتمل",
      "التحقق",
      "مراجعه",
    ];
    const hasInvestigation =
      investigationWords.some((w) => A.includes(w)) ||
      investigationWords.some((w) => B.includes(w)) ||
      investigationWords.some((w) => HA.includes(w)) ||
      investigationWords.some((w) => HB.includes(w));
    if (
      hasInvestigation &&
      jw(A[0], B[0]) >= 0.95 &&
      jw(A[A.length - 1], B[B.length - 1]) >= 0.90 &&
      nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized) >= 0.93
    ) {
      return {
        score: minPair + 0.25,
        reasons: ["INVESTIGATION_PLACEHOLDER"],
      };
    }
  }
  {
    const husbandSame =
      nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized) >= 0.80;
    const familySame = jw(A[A.length - 1], B[B.length - 1]) >= 0.90;
    const lineageOverlap =
      A.filter((x: any) => B.some((y: any) => jw(x, y) >= 0.93)).length >= 3;
    if (husbandSame && familySame && lineageOverlap) {
      return {
        score: minPair + 0.30,
        reasons: ["POLYGAMY_SHARED_HOUSEHOLD"],
      };
    }
  }
  return null;
};
const pairwiseScore = (aRaw: any, bRaw: any, opts: any) => {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.1,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.06,
      locationScore: 0.04,
    },
    thresholds: {
      minPair: 0.62,
      minInternal: 0.5,
      blockChunkSize: 3000,
    },
    rules: {
      enablePolygamyRules: true,
    },
  };
  const o = Object.assign({}, optsDefaults, opts || {});
  o.finalScoreWeights = Object.assign({}, optsDefaults.finalScoreWeights, (opts && opts.finalScoreWeights) || {});
  o.thresholds = Object.assign({}, optsDefaults.thresholds, (opts && opts.thresholds) || {});
  o.rules = Object.assign({}, optsDefaults.rules, (opts && opts.rules) || {});
  const a: any = {
    womanName: aRaw.womanName || "",
    husbandName: aRaw.husbandName || "",
    nationalId: String(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(aRaw.phone || ""),
    village: aRaw.village || "",
    subdistrict: aRaw.subdistrict || "",
    children: aRaw.children || [],
  };
  const b: any = {
    womanName: bRaw.womanName || "",
    husbandName: bRaw.husbandName || "",
    nationalId: String(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(bRaw.phone || ""),
    village: bRaw.village || "",
    subdistrict: bRaw.subdistrict || "",
    children: bRaw.children || [],
  };
  a.womanName_normalized = aRaw.womanName_normalized || normalizeArabicRaw(a.womanName);
  b.womanName_normalized = bRaw.womanName_normalized || normalizeArabicRaw(b.womanName);
  a.husbandName_normalized = aRaw.husbandName_normalized || normalizeArabicRaw(a.husbandName);
  b.husbandName_normalized = bRaw.husbandName_normalized || normalizeArabicRaw(b.husbandName);
  a.village_normalized = aRaw.village_normalized || normalizeArabicRaw(a.village);
  b.village_normalized = bRaw.village_normalized || normalizeArabicRaw(b.village);
  a.children_normalized = aRaw.children_normalized || (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
  b.children_normalized = bRaw.children_normalized || (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);
  const A = aRaw._parts || splitPartsFromNormalized(a.womanName_normalized);
  const B = bRaw._parts || splitPartsFromNormalized(b.womanName_normalized);
  const firstA = A[0] || "";
  const firstB = B[0] || "";
  const famA = A.slice(1).join(" ");
  const famB = B.slice(1).join(" ");
  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = (s: any) => splitPartsFromNormalized(s).map((t: any) => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized);
    const rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScoreFromParts(A, B);
  const husbandScore = Math.max(
    jaroWinkler(a.husbandName_normalized, b.husbandName_normalized),
    nameOrderFreeScoreFromParts(aRaw._husbandParts || splitPartsFromNormalized(a.husbandName_normalized), bRaw._husbandParts || splitPartsFromNormalized(b.husbandName_normalized))
  );
  const phoneScoreVal = a.phone && b.phone
    ? a.phone === b.phone
      ? 1
      : a.phone.slice(-6) === b.phone.slice(-6)
      ? 0.85
      : a.phone.slice(-4) === b.phone.slice(-4)
      ? 0.6
      : 0
    : 0;
  const idScore = a.nationalId && b.nationalId
    ? a.nationalId === b.nationalId
      ? 1
      : a.nationalId.slice(-5) === b.nationalId.slice(-5)
      ? 0.75
      : 0
    : 0;
  const childrenScore = tokenJaccard(a.children_normalized, b.children_normalized);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);
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
  };
  const ruleResult = applyAdditionalRules(Object.assign({}, a, aRaw), Object.assign({}, b, bRaw), o);
  if (ruleResult) {
    return { score: Math.min(1, ruleResult.score), breakdown, reasons: ruleResult.reasons, tokenReorderScore, husbandScore, childrenScore, idScore, phoneScore: phoneScoreVal, locationScore };
  }
  if (a.nationalId && b.nationalId && a.nationalId === b.nationalId) {
    return { score: 0.99, breakdown, reasons: ["EXACT_ID"], tokenReorderScore, husbandScore, childrenScore, idScore, phoneScore: phoneScoreVal, locationScore };
  }
  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const aParts = aRaw._parts || splitPartsFromNormalized(a.womanName_normalized);
  const bParts = bRaw._parts || splitPartsFromNormalized(b.womanName_normalized);
  const aFather = aParts[1] || "";
  const bFather = bParts[1] || "";
  const aGrand = aParts[2] || "";
  const bGrand = bParts[2] || "";
  if (
    o.rules.enablePolygamyRules &&
    husbandJW >= 0.95 &&
    jaroWinkler(aFather, bFather) >= 0.93 &&
    jaroWinkler(aGrand, bGrand) >= 0.9
  ) {
    return { score: 0.97, breakdown, reasons: ["POLYGAMY_PATTERN"], tokenReorderScore, husbandScore, childrenScore, idScore, phoneScore: phoneScoreVal, locationScore };
  }
  const W = o.finalScoreWeights;
  let score =
    (W.firstNameScore || 0) * firstNameScore +
    (W.familyNameScore || 0) * familyNameScore +
    (W.advancedNameScore || 0) * advancedNameScore +
    (W.tokenReorderScore || 0) * tokenReorderScore +
    (W.husbandScore || 0) * husbandScore +
    (W.idScore || 0) * idScore +
    (W.phoneScore || 0) * phoneScoreVal +
    (W.childrenScore || 0) * childrenScore +
    (W.locationScore || 0) * locationScore;
  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter((v: any) => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));
  const reasons: any[] = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");
  return { score, breakdown, reasons, tokenReorderScore, husbandScore, childrenScore, idScore, phoneScore: phoneScoreVal, locationScore };
};
const computePairScore = (a: any, b: any, opts?: any) => pairwiseScore(a, b, opts);
self.onmessage = (event) => {
  const { rawClusters } = event.data;
  if (!rawClusters) {
    postMessage({ type: "error", error: "No clusters provided to scoring worker." });
    return;
  }
  try {
    const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
      postMessage({
        type: "progress",
        progress: Math.round((index / rawClusters.length) * 100),
      });
      const records = cluster.records || [];
      if (records.length < 2) {
        return {
          ...cluster,
          records,
          pairScores: [],
          avgWomanNameScore: 0,
          avgHusbandNameScore: 0,
          avgFinalScore: 0,
          confidenceScore: 0,
          clusterSize: records.length,
        };
      }
      const pairScores: any[] = [];
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          const result = computePairScore(records[i], records[j], {});
          if (!result || !result.breakdown) continue;
          pairScores.push({
            aId: records[i]._internalId,
            bId: records[j]._internalId,
            score: result.score,
            ...result.breakdown,
          });
        }
      }
      const avgWomanNameScore = safeAvg(pairScores.map((p) => p.tokenReorderScore));
      const avgHusbandNameScore = safeAvg(pairScores.map((p) => p.husbandScore));
      const avgFinalScore = avgWomanNameScore * 0.4 + avgHusbandNameScore * 0.6;
      const confidenceScore = calculateConfidenceScore(pairScores, records.length);
      const perRecord: Record<string, any> = {};
      records.forEach((r: any) => {
        perRecord[r._internalId] = {
          nameScore: [],
          husbandScore: [],
          childrenScore: [],
          idScore: [],
          phoneScore: [],
          locationScore: [],
        };
      });
      pairScores.forEach((p) => {
        const A = perRecord[p.aId];
        const B = perRecord[p.bId];
        if (!A || !B) return;
        A.nameScore.push(p.tokenReorderScore);
        B.nameScore.push(p.tokenReorderScore);
        A.husbandScore.push(p.husbandScore);
        B.husbandScore.push(p.husbandScore);
        A.childrenScore.push(p.childrenScore);
        B.childrenScore.push(p.childrenScore);
        A.idScore.push(p.idScore);
        B.idScore.push(p.idScore);
        A.phoneScore.push(p.phoneScore);
        B.phoneScore.push(p.phoneScore);
        A.locationScore.push(p.locationScore);
        B.locationScore.push(p.locationScore);
      });
      const enrichedRecords = records.map((r: any) => ({
        ...r,
        nameScore: safeAvg(perRecord[r._internalId].nameScore),
        husbandScore: safeAvg(perRecord[r._internalId].husbandScore),
        childrenScore: safeAvg(perRecord[r._internalId].childrenScore),
        idScore: safeAvg(perRecord[r._internalId].idScore),
        phoneScore: safeAvg(perRecord[r._internalId].phoneScore),
        locationScore: safeAvg(perRecord[r._internalId].locationScore),
      }));
      return {
        ...cluster,
        records: enrichedRecords,
        pairScores,
        avgWomanNameScore,
        avgHusbandNameScore,
        avgFinalScore,
        confidenceScore,
        clusterSize: records.length,
      };
    });
    postMessage({ type: "done", enrichedClusters });
  } catch (e: any) {
    postMessage({
      type: "error",
      error: e?.message || "Unknown scoring error",
    });
  }
};
