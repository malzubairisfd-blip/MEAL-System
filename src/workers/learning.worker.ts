
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from "@/lib/similarity";
import { preprocessRow, PreprocessedRow } from "./cluster.worker";

/* ================= LINEAGE SCORE ================= */

function lineageScore(a: string[], b: string[]) {
  if (a.length < 2 || b.length < 2) return 0;
  let s = 0;
  if (jaroWinkler(a[a.length - 1], b[b.length - 1]) >= 0.93) s += 0.35;
  if (jaroWinkler(a[1] || "", b[1] || "") >= 0.9) s += 0.3;
  if (jaroWinkler(a[2] || "", b[2] || "") >= 0.9) s += 0.2;
  if (jaroWinkler(a[0], b[0]) >= 0.85) s += 0.15;
  return s;
}

/* ================= PATTERN EXTRACTION ================= */

function extractPattern(a: PreprocessedRow, b: PreprocessedRow) {
  const woman = lineageScore(a.parts, b.parts);
  const husband = lineageScore(a.husbandParts, b.husbandParts);
  const orderFree = nameOrderFreeScore(a.parts, b.parts) >= 0.85;
  const phone = a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6);
  const children = tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6;

  const signal =
    woman * 0.45 + husband * 0.3 + (orderFree ? 0.15 : 0) + (children ? 0.1 : 0);

  if (signal < 0.55) return null;

  return { woman, husband, orderFree, phone, children };
}

/* ================= RULE GENERATOR ================= */

function generateRuleCode(p: any) {
  const l: string[] = [];
  l.push(`if (`);

  if (p.woman >= 0.7) {
    l.push(`  A.length>=3 && B.length>=3 &&`);
    l.push(`  jw(A[A.length-1],B[B.length-1])>=0.93 &&`);
    l.push(`  (jw(A[0],B[0])>=0.85 || (jw(A[1],B[1])>=0.9 && jw(A[2],B[2])>=0.9)) &&`);
  }

  if (p.husband >= 0.7) {
    l.push(`  HA.length>=3 && HB.length>=3 &&`);
    l.push(`  jw(HA[HA.length-1],HB[HB.length-1])>=0.93 &&`);
    l.push(`  (jw(HA[0],HB[0])>=0.85 || (jw(HA[1],HB[1])>=0.9 && jw(HA[2],HB[2])>=0.9)) &&`);
  }

  if (p.orderFree) l.push(`  nameOrderFreeScore(A,B)>=0.85 &&`);
  if (p.children) l.push(`  tokenJaccard(a.children_normalized,b.children_normalized)>=0.6 &&`);

  l[l.length - 1] = l[l.length - 1].replace(/&&$/, "");
  l.push(`){return{score:Math.min(1,minPair+0.3),reasons:["AUTO_STRUCTURAL_LINEAGE"]}}`);
  return l.join("\n");
}

/* ================= WORKER ================= */

self.onmessage = async (e: MessageEvent) => {
  const rows = e.data.records.map(preprocessRow);
  const pattern = extractPattern(rows[0], rows[1]);

  if (!pattern) {
    postMessage({ error: "No valid pattern detected" });
    return;
  }

  const rule = {
    id: `AUTO_RULE_${Date.now()}`,
    enabled: true,
    code: generateRuleCode(pattern),
    createdAt: new Date().toISOString(),
  };

  await fetch("/api/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });

  postMessage({ success: true, rule });
};
