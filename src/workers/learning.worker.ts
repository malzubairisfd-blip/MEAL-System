// src/workers/learning.worker.ts
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';
import { PreprocessedRow, preprocessRow } from '@/workers/cluster.worker';

// 1. ANALYZE FAILURE CLUSTER
export type RulePattern = {
  lengthPattern: "4vs4" | "4vs5" | "5vs5";
  womanCore: boolean;
  husbandCore: boolean;
  orderFree: boolean;
  phoneLast6: boolean;
  childrenFuzzy: boolean;
};

function detectRulePattern(a: PreprocessedRow, b: PreprocessedRow): RulePattern | null {
  const la = a.parts.length;
  const lb = b.parts.length;

  let lengthPattern: RulePattern["lengthPattern"] | null = null;
  if (la === 4 && lb === 4) lengthPattern = "4vs4";
  else if ((la === 4 && lb === 5) || (la === 5 && lb === 4)) lengthPattern = "4vs5";
  else if (la === 5 && lb === 5) lengthPattern = "5vs5";
  else return null;

  const womanCore =
    jaroWinkler(a.parts[0], b.parts[0]) >= 0.93 &&
    jaroWinkler(a.parts[1], b.parts[1]) >= 0.90 &&
    jaroWinkler(a.parts[2], b.parts[2]) >= 0.93 &&
    jaroWinkler(a.parts[a.parts.length - 1], b.parts[b.parts.length - 1]) >= 0.93;

  const husbandCore =
    jaroWinkler(a.husbandParts[0], b.husbandParts[0]) >= 0.93 &&
    jaroWinkler(a.husbandParts[1], b.husbandParts[1]) >= 0.90 &&
    jaroWinkler(a.husbandParts[2], b.husbandParts[2]) >= 0.93 &&
    jaroWinkler(
      a.husbandParts[a.husbandParts.length - 1],
      b.husbandParts[b.husbandParts.length - 1]
    ) >= 0.93;

  const orderFree =
    nameOrderFreeScore(a.parts, b.parts) >= 0.9 ||
    nameOrderFreeScore(a.husbandParts, b.husbandParts) >= 0.9;

  const phoneLast6 =
    a.phone &&
    b.phone &&
    a.phone.slice(-6) === b.phone.slice(-6);

  const childrenFuzzy =
    tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6;

  return {
    lengthPattern,
    womanCore,
    husbandCore,
    orderFree,
    phoneLast6,
    childrenFuzzy,
  };
}


// 2. RULE CODE GENERATOR
function generateRuleCode(p: RulePattern): string {
  const lines: string[] = [];

  lines.push(`if (`);

  if (p.womanCore) {
    lines.push(`  A.length >= 3 && B.length >= 3 &&`);
    lines.push(`  jw(A[0], B[0]) >= 0.93 &&`);
    lines.push(`  jw(A[1], B[1]) >= 0.90 &&`);
    lines.push(`  jw(A[2], B[2]) >= 0.93 &&`);
    lines.push(`  jw(A[A.length - 1], B[B.length - 1]) >= 0.93 &&`);
  }

  if (p.husbandCore) {
    lines.push(`  HA.length >= 3 && HB.length >= 3 &&`);
    lines.push(`  jw(HA[0], HB[0]) >= 0.93 &&`);
    lines.push(`  jw(HA[1], HB[1]) >= 0.90 &&`);
    lines.push(`  jw(HA[2], HB[2]) >= 0.93 &&`);
    lines.push(`  jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.93 &&`);
  }

  if (p.orderFree) {
    lines.push(`  nameOrderFreeScore(A, B) >= 0.9 &&`);
  }

  if (p.phoneLast6) {
    lines.push(`  a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6) &&`);
  }

  if (p.childrenFuzzy) {
    lines.push(`  tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6 &&`);
  }

  // remove trailing &&
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/&&$/, "");
  }

  lines.push(`) {`);
  lines.push(`  return {`);
  lines.push(`    score: Math.min(1, minPair + 0.28),`);
  lines.push(`    reasons: ["AUTO_${p.lengthPattern}_LINEAGE"],`);
  lines.push(`  };`);
  lines.push(`}`);

  return lines.join("\n");
}


async function submitRule(rule: any) {
  const apiUrl = new URL('/api/rules', self.location.origin).toString();
  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}


self.onmessage = async (event: MessageEvent) => {
    const { rawRecords, mapping } = event.data;

    if (!Array.isArray(rawRecords) || rawRecords.length < 2) {
        postMessage({ type: 'learning_error', payload: { error: "A failure cluster must contain at least two records." } });
        return;
    }

    try {
        const failureCluster: PreprocessedRow[] = rawRecords.map((record: any) => {
            const mappedRecord: any = {};
            for (const key in mapping) {
                mappedRecord[key] = record[mapping[key]];
            }
            mappedRecord._internalId = record._internalId;
            return preprocessRow(mappedRecord);
        });

        // Use the first pair to detect a representative pattern
        const pattern = detectRulePattern(failureCluster[0], failureCluster[1]);
        
        if (!pattern) {
             postMessage({ type: 'learning_error', payload: { error: "Could not detect a valid pattern from the selected records." } });
             return;
        }

        const code = generateRuleCode(pattern);
        const newRule = {
            id: `AUTO_RULE_${Date.now()}`,
            code: code
        };
        
        await submitRule(newRule);
        
        postMessage({ type: 'rule_learned', payload: newRule });

    } catch (error: any) {
        postMessage({ type: 'learning_error', payload: { error: error.message } });
    }
};
