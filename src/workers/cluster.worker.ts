
// WorkerScript v12 — Parallel Pair Scoring with Mapped Data
// Receives a range of pairs to score and sends back qualifying edges.

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s: any) {
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

function tokens(s: any) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\s+/).filter(Boolean);
}

function digitsOnly(s: any) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\D/g, "");
}

function normalizeChildrenField(val: any) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a: any, b: any) {
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

function tokenJaccard(aTokens: any, bTokens: any) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName: any, bName: any) {
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

/* -------------------------
   Component compare
   ------------------------- */
function splitParts(name: any) {
  if (!name) return [];
  return tokens(name);
}

// Pre-calculates normalized fields for performance
function preprocessRows(rows: any[]) {
    return rows.map(r => {
        const norm = {
            woman: normalizeArabicRaw(r.womanName || ""),
            husband: normalizeArabicRaw(r.husbandName || ""),
            village: normalizeArabicRaw(r.village || ""),
            subdistrict: normalizeArabicRaw(r.subdistrict || ""),
            children: (Array.isArray(r.children) ? r.children : normalizeChildrenField(r.children)).map(normalizeArabicRaw),
            id: String(r.nationalId || "").trim(),
            phone: String(r.phone || "").replace(/\D/g, ""),
            womanFirstChar: '',
            husbandFirstChar: ''
        };
        norm.womanFirstChar = (norm.woman[0] || '').charAt(0);
        norm.husbandFirstChar = (norm.husband[0] || '').charAt(0);
        return { ...r, _norm: norm };
    });
}


/* -------------------------
   Additional Rules
   ------------------------- */
function applyAdditionalRules(a: any, b: any, opts: any) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a._norm.woman || "");
  const B = splitParts(b._norm.woman || "");
  const HA = splitParts(a._norm.husband || "");
  const HB = splitParts(b._norm.husband || "");
  const reasons: any[] = [];
  
  // RULE 0: strong token match (80%+ tokens overlap)
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.80) {
      reasons.push("TOKEN_REORDER");
      return { score: Math.min(1, minPair + 0.22), reasons };
    }
  }

  /* RULE 6 — STRONG HOUSEHOLD + CHILDREN MATCH (CRITICAL) */
  {
    const A_parts = splitParts(a._norm.woman);
    const B_parts = splitParts(b._norm.woman);

    const firstNameMatch =
      A_parts.length > 0 && B_parts.length > 0 && jw(A_parts[0], B_parts[0]) >= 0.93;

    const husbandStrong =
      jw(a._norm.husband, b._norm.husband) >= 0.90 ||
      nameOrderFreeScore(a._norm.husband, b._norm.husband) >= 0.90;

    const childrenMatch =
      tokenJaccard(
        a._norm.children || [],
        b._norm.children || []
      ) >= 0.90;

    if (firstNameMatch && husbandStrong && childrenMatch) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: minPair + 0.25, reasons }; // HARD FORCE DUPLICATE
    }
  }


  const s93 = (x: any, y: any) => jw(x || "", y || "") >= 0.93;
  const s95 = (x: any, y: any) => jw(x || "", y || "") >= 0.95;

  const getPart = (arr: any, idx: any) => (arr && arr.length > idx) ? arr[idx] : "";

  const F1 = getPart(A, 0), Fa1 = getPart(A, 1), G1 = getPart(A, 2), L1 = getPart(A, 3);
  const F2 = getPart(B, 0), Fa2 = getPart(B, 1), G2 = getPart(B, 2), L2 = getPart(B, 3);

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

  /* RULE — DOMINANT LINEAGE MATCH (WOMAN + HUSBAND) */
  {
    if (A.length >= 3 && B.length >= 3 && HA.length >= 3 && HB.length >= 3) {
      const womanFatherOK = jw(A[1], B[1]) >= 0.93;
      const womanGrandOK = jw(A[2], B[2]) >= 0.93;
      const womanFamilyOK = jw(A[A.length - 1], B[B.length - 1]) >= 0.90;
      const womanLineageStrong = womanFatherOK && womanGrandOK && womanFamilyOK;
      const husbandFirstOK  = jw(HA[0], HB[0]) >= 0.93;
      const husbandFatherOK = jw(HA[1], HB[1]) >= 0.93;
      const husbandGrandOK  = jw(HA[2], HB[2]) >= 0.93;
      const husbandFamilyOK = jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.90;
      const husbandIsSamePerson = husbandFirstOK && husbandFatherOK && husbandGrandOK && husbandFamilyOK;
      const womanFirstSupport = jw(A[0], B[0]) >= 0.55 || jw(A[0], B[0]) === 0;

      if (womanLineageStrong && husbandIsSamePerson && womanFirstSupport) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: Math.min(1, minPair + 0.23), reasons };
      }
    }
  }
  
  // ✅ Rule 8 — Administrative placeholder override
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
      "مراجعه"
    ];

    const hasInvestigation =
      investigationWords.some(w => A.includes(w)) ||
      investigationWords.some(w => B.includes(w)) ||
      investigationWords.some(w => HA.includes(w)) ||
      investigationWords.some(w => HB.includes(w));

    if (
      hasInvestigation &&
      jw(A[0], B[0]) >= 0.95 && // woman first name
      jw(A[A.length - 1], B[B.length - 1]) >= 0.90 && // woman family
      nameOrderFreeScore(
        a._norm.husband,
        b._norm.husband
      ) >= 0.93
    ) {
      return {
        score: minPair + 0.25,
        reasons: ["INVESTIGATION_PLACEHOLDER"]
      };
    }
  }

  // ✅ Rule 9 — Polygamy household with shared lineage
  {
    const husbandSame =
      nameOrderFreeScore(
        a._norm.husband,
        b._norm.husband
      ) >= 0.95;

    const familySame =
      jw(A[A.length - 1], B[B.length - 1]) >= 0.90;

    const lineageOverlap =
      A.filter(x => B.some(y => jw(x, y) >= 0.93)).length >= 3;

    if (husbandSame && familySame && lineageOverlap) {
      return {
        score: minPair + 0.30,
        reasons: ["POLYGAMY_SHARED_HOUSEHOLD"]
      };
    }
  }

  return null;
}

/* -------------------------
   pairwiseScore: tiered approach
   ------------------------- */
function pairwiseScore(aRaw: any, bRaw: any, opts: any) {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15, familyNameScore: 0.25, advancedNameScore: 0.12,
      tokenReorderScore: 0.10, husbandScore: 0.12, idScore: 0.08,
      phoneScore: 0.05, childrenScore: 0.06, locationScore: 0.04
    },
    thresholds: { minPair: 0.62 },
    rules: { enablePolygamyRules: true }
  };
  const o = Object.assign({}, optsDefaults, opts || {});
  o.finalScoreWeights = Object.assign({}, optsDefaults.finalScoreWeights, (opts && opts.finalScoreWeights) || {});
  o.thresholds = Object.assign({}, optsDefaults.thresholds, (opts && opts.thresholds) || {});
  o.rules = Object.assign({}, optsDefaults.rules, (opts && opts.rules) || {});

  const a = aRaw;
  const b = bRaw;

  if (a._norm.id && b._norm.id && a._norm.id === b._norm.id) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" }, reasons: ["EXACT_ID"] };
  }

  const husbandJW = jaroWinkler(a._norm.husband, b._norm.husband);
  const aParts = splitParts(a._norm.woman), bParts = splitParts(b._norm.woman);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" }, reasons: ["POLYGAMY_PATTERN"] };
  }

  const ruleResult = applyAdditionalRules(a, b, o);
  if (ruleResult) {
    return { score: Math.min(1, ruleResult.score), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleResult.score }, reasons: ruleResult.reasons };
  }

  const A = splitParts(a._norm.woman), B = splitParts(b._norm.woman);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");
  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = (s: any) => splitParts(s).map((t: any) => t.slice(0, 3)).join(" ");
    const rA = root(a._norm.woman), rB = root(b._norm.woman);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScore(a._norm.woman, b._norm.woman);
  const husbandScore = Math.max(jaroWinkler(a._norm.husband, b._norm.husband), nameOrderFreeScore(a._norm.husband, b._norm.husband));
  const phoneScoreVal = (a._norm.phone && b._norm.phone) ? (a._norm.phone === b._norm.phone ? 1 : (a._norm.phone.slice(-6) === b._norm.phone.slice(-6) ? 0.85 : (a._norm.phone.slice(-4) === b._norm.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a._norm.id && b._norm.id) ? (a._norm.id === b._norm.id ? 1 : (a._norm.id.slice(-5) === b._norm.id.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a._norm.children, b._norm.children);
  let locationScore = 0;
  if (a._norm.village && b._norm.village && a._norm.village === b._norm.village) locationScore += 0.4;
  if (a._norm.subdistrict && b._norm.subdistrict && a._norm.subdistrict === b._norm.subdistrict) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const W = o.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore + (W.phoneScore || 0) * phoneScoreVal +
              (W.childrenScore || 0) * childrenScore + (W.locationScore || 0) * locationScore;

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  
  const reasons: any[] = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");

  return { score, breakdown, reasons };
}

// Convert a flat pair index k to indices (i, j)
function getIndicesFromPairIndex(k: number, n: number) {
    const i = n - 2 - Math.floor(Math.sqrt(-8*k + 4*n*(n-1)-7)/2.0 - 0.5);
    const j = k + i + 1 - Math.floor(((n-1)*n)/2) + Math.floor(((n-i)*((n-i)-1))/2);
    return { i, j };
}


/* -------------------------
   Worker message handling
   ------------------------- */
self.onmessage = (ev) => {
  try {
    const { rows, options, startPair, endPair } = ev.data;
    
    const preprocessedRows = preprocessRows(rows);
    
    const n = preprocessedRows.length;
    const minScore = options?.thresholds?.minPair ?? 0.62;
    const edges = [];
    let processed = 0;

    for (let k = startPair; k < endPair; k++) {
      const { i, j } = getIndicesFromPairIndex(k, n);
      
      if (i >= n || j >= n) continue;

      const rowA = preprocessedRows[i];
      const rowB = preprocessedRows[j];
      
      // Binary Threshold Pruning
      if (rowA._norm.womanFirstChar !== rowB._norm.womanFirstChar && rowA._norm.husbandFirstChar !== rowB._norm.husbandFirstChar) {
          processed++;
          continue;
      }

      const scoreResult = pairwiseScore(rowA, rowB, options);
      if (scoreResult && scoreResult.score >= minScore) {
        edges.push({ a: i, b: j, score: scoreResult.score, reasons: scoreResult.reasons || [] });
      }

      processed++;
      if (processed > 0 && processed % 20000 === 0) {
        self.postMessage({ type: 'progress', processed });
        processed = 0; // Reset after posting
      }
    }
    
    self.postMessage({ type: 'done', edges: edges, processed });

  } catch (error: any) {
      self.postMessage({ type: 'error', error: { message: error.message, stack: error.stack } });
  }
};
