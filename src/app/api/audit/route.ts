
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // prevent edge runtime

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
      return jsonError("Missing cacheId.");
    }
    
    // Construct the full URL for the internal API call
    const cacheUrl = new URL(req.url);
    const host = req.headers.get('host');
    const protocol = host?.startsWith('localhost') ? 'http' : 'https';
    const fetchUrl = `${protocol}://${host}/api/cluster-cache?id=${body.cacheId}`;
    
    let cached: any;
    try {
        const cacheRes = await fetch(fetchUrl);
        if (!cacheRes.ok) {
          const errorText = await cacheRes.text();
          console.error("Cache fetch failed:", errorText);
          throw new Error(`Failed to fetch from cache API: ${cacheRes.statusText}`);
        }
        cached = await cacheRes.json();
    } catch(e: any) {
        console.error("Error fetching or parsing cache:", e);
        return jsonError(`Cache file missing or invalid. Fetch failed.`);
    }


    const rows = cached.data?.rows;
    const clusters = cached.data?.clusters;

    if (!clusters) return jsonError("Cache corrupted: clusters missing.");

    const issues: any[] = [];
    const potentialDuplicates: any[] = [];

    const threshold = typeof body.threshold === "number" ? body.threshold : 0.6;

    /* ---------------------------------------------------------
       LOOP THROUGH CLUSTERS
    --------------------------------------------------------- */
    for (let ci = 0; ci < clusters.length; ci++) {
      const members = clusters[ci];
      if (!Array.isArray(members) || members.length < 2) continue;

      /* --------------------------
         1. DUPLICATE NATIONAL IDs
      -------------------------- */
      const nationalIds = members.map((m: any) => safeString(m.nationalId).trim());
      const unique = new Set(nationalIds.filter(Boolean));
      if (unique.size < nationalIds.filter(Boolean).length) {
        issues.push({ type: "DUPLICATE_ID", clusterIndex: ci, members });
      }

      /* --------------------------
         2. DUPLICATE woman+husband
      -------------------------- */
      const pairs = members.map((m: any) =>
        `${safeString(m.womanName)}|${safeString(m.husbandName)}`
      );
      if (new Set(pairs).size < pairs.length) {
        issues.push({ type: "DUPLICATE_COUPLE", clusterIndex: ci, members });
      }

      /* --------------------------
         3. Woman with multiple husbands
      -------------------------- */
      const byWoman = new Map<string, Set<string>>();
      for (const m of members) {
        const w = safeString(m.womanName).trim();
        const h = safeString(m.husbandName).trim();
        if (!byWoman.has(w)) byWoman.set(w, new Set());
        byWoman.get(w)!.add(h);
      }
      for (const [w, hs] of byWoman.entries()) {
        if (hs.size > 1) {
          issues.push({
            type: "WOMAN_MULTIPLE_HUSBANDS",
            woman: w,
            husbands: [...hs],
            clusterIndex: ci,
            members
          });
        }
      }

      /* --------------------------
         4. Husband with >4 wives
      -------------------------- */
      const byHusband = new Map<string, Set<string>>();
      for (const m of members) {
        const h = safeString(m.husbandName).trim();
        const w = safeString(m.womanName).trim();
        if (!byHusband.has(h)) byHusband.set(h, new Set());
        byHusband.get(h)!.add(w);
      }
      for (const [h, ws] of byHusband.entries()) {
        if (ws.size > 4) {
          issues.push({
            type: "HUSBAND_TOO_MANY_WIVES",
            husband: h,
            wives: [...ws],
            clusterIndex: ci,
            members
          });
        }
      }

      /* --------------------------
         5. Woman with multiple IDs
      -------------------------- */
      const womanIDs = new Map<string, Set<string>>();
      for (const m of members) {
        const w = safeString(m.womanName).trim();
        const id = safeString(m.nationalId).trim();
        if (!womanIDs.has(w)) womanIDs.set(w, new Set());
        if (id) womanIDs.get(w)!.add(id);
      }
      for (const [w, ids] of womanIDs.entries()) {
        if (ids.size > 1) {
          issues.push({
            type: "MULTIPLE_NATIONAL_IDS",
            woman: w,
            ids: [...ids],
            clusterIndex: ci,
            members
          });
        }
      }

      /* ---------------------------------------------------------
          6. POTENTIAL DUPLICATES (PAIRWISE)
      --------------------------------------------------------- */
      const M = members.length;
      const dupPairs: any[] = [];

      if (M <= 600) {
        // full pairwise
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
      } else {
        // top-K per member (K=25)
        const K = 25;
        for (let i = 0; i < M; i++) {
          const u = members[i];
          const scores: any[] = [];

          for (let j = 0; j < M; j++) {
            if (i === j) continue;
            const v = members[j];
            const score = auditSimilarity(u, v);
            if (score > 0) scores.push({ j, score });
          }

          scores.sort((a, b) => b.score - a.score);

          for (let k = 0; k < Math.min(K, scores.length); k++) {
            if (scores[k].score >= threshold) {
              const j = scores[k].j;

              const aId = members[i]._internalId;
              const bId = members[j]._internalId;
              
              const [a, b] = [aId, bId].sort();

              dupPairs.push({
                a,
                b,
                aRow: aId < bId ? members[i] : members[j],
                bRow: aId < bId ? members[j] : members[i],
                score: scores[k].score
              });
            }
          }
        }

        // dedupe
        const seen = new Set();
        const uniq = [];
        for (const p of dupPairs) {
          const key = p.a + "_" + p.b;
          if (!seen.has(key)) {
            seen.add(key);
            uniq.push(p);
          }
        }
        dupPairs.length = 0;
        dupPairs.push(...uniq);
      }

      potentialDuplicates.push({
        clusterIndex: ci,
        clusterSize: M,
        pairs: dupPairs
      });
    }

    /* ---------------------------------------------------------
       RETURN FINAL CLEAN JSON
    --------------------------------------------------------- */
    return NextResponse.json({
      ok: true,
      issues,
      potentialDuplicates,
      count: issues.length
    });

  } catch (err: any) {
    return jsonError(err.message || "Internal Server Error.");
  }
}
