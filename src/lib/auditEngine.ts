
// src/lib/auditEngine.ts
import { similarityScoreDetailed } from "./fuzzyCluster";
import type { RecordRow } from "./types";


export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow[];
}

/* -----------------------------------------
   CHECK FOR FORBIDDEN RELATIONSHIPS
------------------------------------------ */
function isForbiddenRelation(name1: string, name2: string) {
  if (!name1 || !name2) return false;
  const n1 = name1.split(" ");
  const n2 = name2.split(" ");

  // To be siblings or first cousins, they must have at least 3 names (first, father, grandfather)
  if (n1.length < 3 || n2.length < 3) return false;

  // Same father and grandfather = siblings
  if (n1[1] && n1[1] === n2[1] && n1[2] && n1[2] === n2[2]) {
    return true;
  }

  // Same grandfather and great-grandfather = first cousins
  if (n1.length > 3 && n2.length > 3) {
    if (n1[2] && n1[2] === n2[2] && n1[3] && n1[3] === n2[3]) {
      return true;
    }
  }
  
  return false;
}

/* -----------------------------------------
   MAIN AUDIT FUNCTION
------------------------------------------ */
export function runAudit(records: RecordRow[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // INDEXES
  const byWoman = new Map<string, RecordRow[]>();
  const byHusband = new Map<string, RecordRow[]>();
  const byNationalId = new Map<string, RecordRow[]>();
  const byPhone = new Map<string, RecordRow[]>();

  // INDEXING
  for (const r of records) {
    const w = r.womanName?.trim();
    const h = r.husbandName?.trim();
    const id = String(r.nationalId || "").trim();
    const ph = String(r.phone || "").trim();

    if (w) {
        if (!byWoman.has(w)) byWoman.set(w, []);
        byWoman.get(w)!.push(r);
    }
    if (h) {
        if (!byHusband.has(h)) byHusband.set(h, []);
        byHusband.get(h)!.push(r);
    }
    if (id) {
        if (!byNationalId.has(id)) byNationalId.set(id, []);
        byNationalId.get(id)!.push(r);
    }
    if (ph) {
        if (!byPhone.has(ph)) byPhone.set(ph, []);
        byPhone.get(ph)!.push(r);
    }
  }

  // 1. WOMAN DUPLICATES
  for (const [name, list] of byWoman) {
    if (list.length > 1) {
      findings.push({
        type: "Duplicate Woman",
        severity: "high",
        description: `${name} appears multiple times`,
        records: list,
      });
    }
  }

  // 2. HUSBAND DUPLICATES (multi wives)
  for (const [name, list] of byHusband) {
    if (list.length > 4) {
      findings.push({
        type: "Husband has more than 4 wives",
        severity: "high",
        description: `${name} has ${list.length} wives`,
        records: list,
      });
    }
  }

  // 3. ILLEGAL MARRIAGES (siblings, forbidden relations)
  for (const [hname, women] of byHusband) {
    if (women.length > 1) {
      for (let i = 0; i < women.length; i++) {
        for (let j = i + 1; j < women.length; j++) {
          if (isForbiddenRelation(women[i].womanName, women[j].womanName)) {
            findings.push({
              type: "Forbidden Marriage",
              severity: "high",
              description: `${hname} is married to forbidden relatives`,
              records: [women[i], women[j]],
            });
          }
        }
      }
    }
  }

  // 4. NATIONAL ID DUPLICATES
  for (const [id, list] of byNationalId) {
    if (list.length > 1) {
      findings.push({
        type: "Duplicate National ID",
        severity: "high",
        description: `National ID ${id} appears multiple times`,
        records: list,
      });
    }
  }

  // 5. PHONE DUPLICATES
  for (const [ph, list] of byPhone) {
    if (list.length > 1) {
      findings.push({
        type: "Phone Number Reused",
        severity: "medium",
        description: `Phone number ${ph} appears multiple times`,
        records: list,
      });
    }
  }

  // 6. SIMILAR NAME CONFLICTS (potential duplicates)
  const seenPairs = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      
      const key = [a._internalId, b._internalId].sort().join('|');
      if(seenPairs.has(key)) continue;
      seenPairs.add(key);

      // Ensure children are arrays before calling similarity score
      const recordA_safe = { ...a, children: Array.isArray(a.children) ? a.children : (typeof a.children === 'string' ? a.children.split(/[;,،|]/) : []) };
      const recordB_safe = { ...b, children: Array.isArray(b.children) ? b.children : (typeof b.children === 'string' ? b.children.split(/[;,،|]/) : []) };

      const sim = similarityScoreDetailed(recordA_safe as RecordRow, recordB_safe as RecordRow);

      if (sim.score > 0.85) {
        findings.push({
          type: "Potential Duplicate",
          severity: "medium",
          description: `High similarity between ${a.womanName} and ${b.womanName}`,
          records: [a, b],
        });
      }
    }
  }

  return findings;
}
