
import { similarityScoreDetailed, RecordRow } from "./fuzzyCluster";

export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: any[];
}

function isForbiddenRelation(name1: string, name2: string) {
  if (!name1 || !name2) return false;
  const n1 = name1.split(" ");
  const n2 = name2.split(" ");

  // Same father = siblings
  if (n1.length > 1 && n2.length > 1 && n1[1] && n2[1] && n1[1] === n2[1]) return true;

  // Same grandfather
  if (n1.length > 2 && n2.length > 2 && n1[2] && n2[2] && n1[2] === n2[2]) return true;

  return false;
}

export function runAudit(records: RecordRow[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // INDEXES
  const byWoman = new Map<string, any[]>();
  const byHusband = new Map<string, any[]>();
  const byNationalId = new Map<string, any[]>();
  const byPhone = new Map<string, any[]>();

  // INDEXING
  for (const r of records) {
    const w = r.womanName?.trim();
    const h = r.husbandName?.trim();
    const id = r.nationalId?.trim();
    const ph = r.phone?.trim();

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
        records: list
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
        records: list
      });
    }
  }

  // 3. ILLEGAL MARRIAGES
  for (const [hname, women] of byHusband) {
    if (women.length > 1) {
      for (let i = 0; i < women.length; i++) {
        for (let j = i + 1; j < women.length; j++) {
          if (isForbiddenRelation(women[i].womanName, women[j].womanName)) {
            findings.push({
              type: "Forbidden Marriage",
              severity: "high",
              description: `${hname} is married to forbidden relatives`,
              records: [women[i], women[j]]
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
        records: list
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
        records: list
      });
    }
  }

  // 6. SIMILAR NAME CONFLICTS
  const seenPairs = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      
      const key = [a.womanName, b.womanName].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      const sim = similarityScoreDetailed(a, b);

      if (sim.score > 0.85) {
        findings.push({
          type: "Potential Duplicate",
          severity: "medium",
          description: `High similarity between ${a.womanName} and ${b.womanName}`,
          records: [a, b]
        });
      }
    }
  }

  return findings;
}
