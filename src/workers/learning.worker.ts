
// src/workers/learning.worker.ts
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';
import { PreprocessedRow, preprocessRow } from '@/workers/cluster.worker';

/* =========================================================
   TYPES
   ========================================================= */

type RulePattern = {
  womanScore: number;
  husbandScore: number;
  orderFree: boolean;
  phoneLast6: boolean;
  childrenFuzzy: boolean;
  totalSignal: number;
};

/* =========================================================
   LINEAGE SCORING (CRITICAL FIX)
   ========================================================= */

function lineageScore(a: string[], b: string[]): number {
  if (a.length < 2 || b.length < 2) return 0;

  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];

  let score = 0;

  // Family name (strongest)
  if (jaroWinkler(lastA, lastB) >= 0.93) score += 0.35;

  // Father
  if (jaroWinkler(a[1] || "", b[1] || "") >= 0.90) score += 0.30;

  // Grandfather
  if (jaroWinkler(a[2] || "", b[2] || "") >= 0.90) score += 0.20;

  // First name (variant tolerant)
  if (jaroWinkler(a[0], b[0]) >= 0.85) score += 0.15;

  return score; // max = 1.0
}

/* =========================================================
   PATTERN EXTRACTION (NO MORE EMPTY PATTERNS)
   ========================================================= */

function extractPattern(a: PreprocessedRow, b: PreprocessedRow): RulePattern | null {
  const womanScore = lineageScore(a.parts, b.parts);
  const husbandScore =
    a.husbandParts.length && b.husbandParts.length
      ? lineageScore(a.husbandParts, b.husbandParts)
      : 0;

  const orderFree = nameOrderFreeScore(a.parts, b.parts) >= 0.85;

  const phoneLast6 =
    !!(a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6));

  const childrenFuzzy =
    tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6;

  const totalSignal =
    womanScore * 0.45 +
    husbandScore * 0.30 +
    (orderFree ? 0.15 : 0) +
    (phoneLast6 ? 0.10 : 0) +
    (childrenFuzzy ? 0.15 : 0);

  // 🔐 Minimum evidence gate (CRITICAL)
  if (totalSignal < 0.55) return null;

  return {
    womanScore,
    husbandScore,
    orderFree,
    phoneLast6,
    childrenFuzzy,
    totalSignal,
  };
}

/* =========================================================
   RULE CODE GENERATOR (MANUAL-STYLE RULES)
   ========================================================= */

function generateRuleCode(p: RulePattern): string {
  const lines: string[] = [];

  lines.push(`if (`);

  if (p.womanScore >= 0.7) {
    lines.push(`  A.length >= 3 && B.length >= 3 &&`);
    lines.push(`  jw(A[A.length - 1], B[B.length - 1]) >= 0.93 &&`);
    lines.push(`  (`);
    lines.push(`    jw(A[0], B[0]) >= 0.85 ||`);
    lines.push(`    (jw(A[1], B[1]) >= 0.90 && jw(A[2], B[2]) >= 0.90)`);
    lines.push(`  ) &&`);
  }

  if (p.husbandScore >= 0.7) {
    lines.push(`  HA.length >= 3 && HB.length >= 3 &&`);
    lines.push(`  jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.93 &&`);
    lines.push(`  (`);
    lines.push(`    jw(HA[0], HB[0]) >= 0.85 ||`);
    lines.push(`    (jw(HA[1], HB[1]) >= 0.90 && jw(HA[2], HB[2]) >= 0.90)`);
    lines.push(`  ) &&`);
  }

  if (p.orderFree) {
    lines.push(`  nameOrderFreeScore(A, B) >= 0.85 &&`);
  }

  if (p.phoneLast6) {
    lines.push(`  a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6) &&`);
  }

  if (p.childrenFuzzy) {
    lines.push(`  tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6 &&`);
  }

  // remove trailing &&
  lines[lines.length - 1] =
    lines[lines.length - 1].replace(/&&$/, "");

  lines.push(`) {`);
  lines.push(`  return {`);
  lines.push(`    score: Math.min(1, minPair + 0.30),`);
  lines.push(`    reasons: ["AUTO_STRUCTURAL_LINEAGE"],`);
  lines.push(`  };`);
  lines.push(`}`);

  return lines.join("\n");
}

/* =========================================================
   RULE SUBMISSION
   ========================================================= */

async function submitRule(rule: any) {
  const apiUrl = new URL('/api/rules', self.location.origin).toString();
  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

/* =========================================================
   WORKER ENTRY
   ========================================================= */

self.onmessage = async (event: MessageEvent) => {
  const { rawRecords, mapping } = event.data;

  if (!Array.isArray(rawRecords) || rawRecords.length < 2) {
    postMessage({
      error: "A failure cluster must contain at least two records."
    });
    return;
  }

  try {
    const cluster: PreprocessedRow[] = rawRecords.map((record: any) => {
      const mapped: any = {};
      for (const key in mapping) {
        mapped[key] = record[mapping[key]];
      }
      mapped._internalId = record._internalId;
      return preprocessRow(mapped);
    });

    // Representative pair
    const pattern = extractPattern(cluster[0], cluster[1]);

    if (!pattern) {
      postMessage({
        error: "Could not detect a valid pattern from the selected records."
      });
      return;
    }

    const code = generateRuleCode(pattern);

    const newRule = {
      id: `AUTO_RULE_${Date.now()}`,
      code,
      params: pattern,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    await submitRule(newRule);

    postMessage({ success: true, rule: newRule });

  } catch (error: any) {
    postMessage({
      error: error.message || String(error)
    });
  }
};
