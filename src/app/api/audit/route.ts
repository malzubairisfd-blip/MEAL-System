

import { NextResponse } from "next/server";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const runtime = "nodejs"; // prevent edge runtime

// Gets the temporary directory for the cache.
const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');

/* -------------------------------------------------------------
   SAFE JSON PARSER 
------------------------------------------------------------- */
async function safeParse(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new Error("Invalid JSON — request body is not valid JSON.");
  }
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
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
   MAIN AUDIT ENDPOINT
------------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const body = await safeParse(req);

    if (!body.cacheId) {
      return jsonError("Missing cacheId.", 400);
    }
    
    let cached: any;
    try {
        const cacheDir = getTmpDir();
        const filePath = path.join(cacheDir, `${body.cacheId}.json`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        cached = JSON.parse(fileContent);
    } catch(e: any) {
        if (e.code === 'ENOENT') {
            return jsonError(`Cache file not found for ID: ${body.cacheId}. Please re-run the clustering process.`, 404);
        }
        return jsonError(`Cache file is invalid or could not be read. Error: ${e.message}`, 500);
    }

    const clusters = cached.clusters;

    if (!clusters) return jsonError("Cache corrupted: clusters missing from data.", 500);

    const issues: any[] = [];
    const potentialDuplicates: any[] = [];

    const threshold = typeof body.threshold === "number" ? body.threshold : 0.6;

    /* ---------------------------------------------------------
       LOOP THROUGH CLUSTERS
    --------------------------------------------------------- */
    for (let ci = 0; ci < clusters.length; ci++) {
      const clusterObject = clusters[ci];
      // FIX: The audit logic was expecting an array of records, but the cache stores an object with a 'records' property.
      const members = clusterObject.records;
      if (!Array.isArray(members) || members.length < 2) continue;

      /* --------------------------
         1. DUPLICATE NATIONAL IDs
      -------------------------- */
      const nationalIds = members.map((m: any) => safeString(m.nationalId).trim());
      const unique = new Set(nationalIds.filter(Boolean));
      if (unique.size < nationalIds.filter(Boolean).length) {
        issues.push({ type: "DUPLICATE_ID", severity: 'high', description: `Duplicate National ID found in a cluster.`, records: members });
      }

      /* --------------------------
         2. DUPLICATE woman+husband
      -------------------------- */
      const pairs = members.map((m: any) =>
        `${normalizeArabic(safeString(m.womanName))}|${normalizeArabic(safeString(m.husbandName))}`
      );
      if (new Set(pairs).size < pairs.length) {
        issues.push({ type: "DUPLICATE_COUPLE", severity: 'high', description: `Exact duplicate Woman+Husband name pair found.`, records: members });
      }

      /* --------------------------
         3. Woman with multiple husbands
      -------------------------- */
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

      /* --------------------------
         4. Husband with >4 wives
      -------------------------- */
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

      /* --------------------------
         5. Woman with multiple IDs
      -------------------------- */
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

      /* ---------------------------------------------------------
          6. POTENTIAL DUPLICATES (PAIRWISE) - This part is computationally heavy and may be removed if not needed.
      --------------------------------------------------------- */
      const M = members.length;
      const dupPairs: any[] = [];

      if (M <= 100) { // Limit pairwise check to smaller clusters to avoid performance issues
        for (let i = 0; i < M; i++) {
          for (let j = i + 1; j < M; j++) {
            const score = auditSimilarity(members[i], members[j]);
            if (score >= threshold) {
              dupPairs.push({
                a: members[i]._internalId,
                b: members[j]._internalId,
                aRow: members[i],
                bRow: members[j],
                score
              });
            }
          }
        }
      }
      if (dupPairs.length > 0) {
           issues.push({
            type: "HIGH_SIMILARITY",
            severity: 'medium',
            description: `Found ${dupPairs.length} pair(s) with similarity score > ${threshold} in this cluster.`,
            records: members
           });
      }
    }

    /* ---------------------------------------------------------
       RETURN FINAL CLEAN JSON
    --------------------------------------------------------- */
    return NextResponse.json({
      ok: true,
      issues,
      count: issues.length
    });

  } catch (err: any) {
    console.error("Audit API Error:", err);
    return jsonError(err.message || "Internal Server Error.");
  }
}
