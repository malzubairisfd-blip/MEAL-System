
// src/lib/auditEngine.ts
import type { RecordRow } from "./types";

export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow[];
}

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
    }

    return issues;
}
