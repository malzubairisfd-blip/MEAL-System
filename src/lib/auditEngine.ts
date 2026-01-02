
// src/lib/auditEngine.ts
import type { RecordRow } from "./types";

export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow[];
}

/* -------------------------------------------------------------
   BASIC NORMALIZATION HELPERS
------------------------------------------------------------- */
function safeString(x: any) {
  return x === null || x === undefined ? "" : String(x);
}

function digitsOnly(x: any) {
  return safeString(x).replace(/\D/g, "");
}

function normalizeArabic(s: any): string {
  if (!s) return "";
  let str = String(s); // Ensure 's' is a string before calling normalize
  str = str.normalize("NFKC");
  str = str.replace(/يحيي/g, "يحي");
  str = str.replace(/يحيى/g, "يحي");
  str = str.replace(/عبد /g, "عبد");
  str = str.replace(/[ًٌٍََُِّْـء]/g, "");
  str = str.replace(/[أإآ]/g, "ا");
  str = str.replace(/ى/g, "ي");
  str = str.replace(/ؤ/g, "و");
  str = str.replace(/ئ/g, "ي");
  str = str.replace(/ة/g, "ه");
  str = str.replace(/[^ء-ي0-9 ]/g, " ");
  str = str.replace(/\s+/g, " ").trim();
  return str.toLowerCase();
}

function tokens(s: string) {
  const n = normalizeArabic(s || "");
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/* -------------------------------------------------------------
   SIMPLE JARO–WINKLER FOR AUDIT
------------------------------------------------------------- */
function jaroWinkler(a: string, b: string) {
  a = safeString(a);
  b = safeString(b);
  if (!a || !b) return 0;

  const la = a.length, lb = b.length;
  const dist = Math.floor(Math.max(la, lb) / 2) - 1;

  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);

  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - dist);
    const end = Math.min(i + dist + 1, lb);

    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  let trans = 0;

  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }

  trans /= 2;

  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;

  // prefix
  let prefix = 0;
  const maxPrefix = 4;

  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/* -------------------------------------------------------------
   TOKEN JACCARD FOR NAME ORDER FREE MATCHING
------------------------------------------------------------- */
function tokenJaccard(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length && !bTokens.length) return 0;

  const A = new Set(aTokens);
  const B = new Set(bTokens);

  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;

  return inter / (new Set([...A, ...B]).size || 1);
}

function nameOrderFree(a: string, b: string) {
  const tA = tokens(a);
  const tB = tokens(b);
  if (!tA.length || !tB.length) return 0;

  const jacc = tokenJaccard(tA, tB);
  const sortedA = tA.slice().sort().join(" ");
  const sortedB = tB.slice().sort().join(" ");

  const jw = jaroWinkler(sortedA, sortedB);

  return 0.7 * jacc + 0.3 * jw;
}

/* -------------------------------------------------------------
   LIGHTWEIGHT PAIRWISE SCORING FOR AUDIT POTENTIAL DUPLICATES
------------------------------------------------------------- */
function auditSimilarity(a: any, b: any) {
  const wA = normalizeArabic(a.womanName || "");
  const wB = normalizeArabic(b.womanName || "");
  const hA = normalizeArabic(a.husbandName || "");
  const hB = normalizeArabic(b.husbandName || "");
  const idA = safeString(a.nationalId || "");
  const idB = safeString(b.nationalId || "");
  const pA = digitsOnly(a.phone || "");
  const pB = digitsOnly(b.phone || "");

  const wTokenScore = nameOrderFree(wA, wB);
  const wFirst = tokens(wA)[0] || "";
  const wSecond = tokens(wB)[0] || "";

  const firstScore = jaroWinkler(wFirst, wSecond);
  const husbandScore = Math.max(
    tokenJaccard(tokens(hA), tokens(hB)),
    jaroWinkler(hA, hB)
  );

  const idScore =
    idA && idB ? (idA === idB ? 1 : idA.slice(-5) === idB.slice(-5) ? 0.75 : 0) : 0;

  const phoneScore =
    pA && pB
      ? pA === pB
        ? 1
        : pA.slice(-6) === pB.slice(-6)
        ? 0.85
        : 0
      : 0;

  const score =
    0.35 * wTokenScore +
    0.25 * firstScore +
    0.20 * husbandScore +
    0.10 * idScore +
    0.10 * phoneScore;

  return Math.min(1, Math.max(0, score));
}

/* -------------------------------------------------------------
   MAIN CLIENT-SIDE AUDIT FUNCTION
------------------------------------------------------------- */
export async function runClientSideAudit(clusters: {records: RecordRow[]}[], threshold = 0.6): Promise<AuditFinding[]> {
    const issues: AuditFinding[] = [];

    for (const clusterObject of clusters) {
      const members = clusterObject.records;
      if (!Array.isArray(members) || members.length < 2) continue;

      // 1. DUPLICATE NATIONAL IDs
      const nationalIds = members.map((m: any) => safeString(m.nationalId).trim());
      const uniqueIds = new Set(nationalIds.filter(Boolean));
      if (uniqueIds.size < nationalIds.filter(Boolean).length) {
        issues.push({ type: "DUPLICATE_ID", severity: 'high', description: `Duplicate National ID found in a cluster.`, records: members });
      }

      // 2. DUPLICATE woman+husband
      const pairs = members.map((m: any) =>
        `${normalizeArabic(safeString(m.womanName))}|${normalizeArabic(safeString(m.husbandName))}`
      );
      if (new Set(pairs).size < pairs.length) {
        issues.push({ type: "DUPLICATE_COUPLE", severity: 'high', description: `Exact duplicate Woman+Husband name pair found.`, records: members });
      }

      // 3. Woman with multiple husbands
      const byWoman = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic(safeString(m.womanName).trim());
        const h = normalizeArabic(safeString(m.husbandName).trim());
        if (!byWoman.has(w)) byWoman.set(w, new Set());
        byWoman.get(w)!.add(h);
      }
      for (const [w, hs] of byWoman.entries()) {
        if (hs.size > 1) {
          issues.push({
            type: "WOMAN_MULTIPLE_HUSBANDS",
            severity: 'high',
            description: `Woman '${w}' appears to be registered with multiple husbands: ${[...hs].join(', ')}.`,
            records: members.filter(m => normalizeArabic(safeString(m.womanName)) === w)
          });
        }
      }

      // 4. Husband with >4 wives
      const byHusband = new Map<string, Set<string>>();
      for (const m of members) {
        const h = normalizeArabic(safeString(m.husbandName).trim());
        const w = normalizeArabic(safeString(m.womanName).trim());
        if (!byHusband.has(h)) byHusband.set(h, new Set());
        byHusband.get(h)!.add(w);
      }
      for (const [h, ws] of byHusband.entries()) {
        if (ws.size > 4) {
          issues.push({
            type: "HUSBAND_TOO_MANY_WIVES",
            severity: 'medium',
            description: `Husband '${h}' is registered with ${ws.size} wives, which exceeds the limit of 4.`,
            records: members.filter(m => normalizeArabic(safeString(m.husbandName)) === h)
          });
        }
      }

      // 5. Woman with multiple IDs
      const womanIDs = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic(safeString(m.womanName).trim());
        const id = safeString(m.nationalId).trim();
        if (!womanIDs.has(w)) womanIDs.set(w, new Set());
        if (id) womanIDs.get(w)!.add(id);
      }
      for (const [w, ids] of womanIDs.entries()) {
        if (ids.size > 1) {
          issues.push({
            type: "MULTIPLE_NATIONAL_IDS",
            severity: 'high',
            description: `Woman '${w}' is associated with multiple National IDs: ${[...ids].join(', ')}.`,
            records: members.filter(m => normalizeArabic(safeString(m.womanName)) === w)
          });
        }
      }
      
      // 6. Check for high similarity using auditSimilarity
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            const score = auditSimilarity(members[i], members[j]);
            if (score > threshold) {
                 issues.push({
                    type: "HIGH_SIMILARITY",
                    severity: 'medium',
                    description: `High similarity score (${score.toFixed(2)}) found between records.`,
                    records: [members[i], members[j]]
                });
            }
        }
      }
    }

    return issues;
}
