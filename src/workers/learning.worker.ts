
// src/workers/learning.worker.ts
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';
import { PreprocessedRow, preprocessRow } from '@/workers/cluster.worker';

// 1. ANALYZE FAILURE CLUSTER

type RulePattern = {
  womanCore: boolean;
  husbandCore: boolean;
  orderFree: boolean;
  phoneLast6: boolean;
  childrenFuzzy: boolean;
};

function extractLineage(parts: string[]) {
  return {
    first: parts[0],
    father: parts[1],
    grandfather: parts[2],
    family: parts[parts.length - 1],
    middle: parts.slice(1, -1),
  };
}

function detectWomanCore(a: string[], b: string[]) {
  if (a.length < 3 || b.length < 3) return false;

  const A = extractLineage(a);
  const B = extractLineage(b);

  const familyMatch = jaroWinkler(A.family, B.family) >= 0.93;

  const fatherGrandMatch =
    jaroWinkler(A.father, B.father) >= 0.93 ||
    jaroWinkler(A.grandfather, B.grandfather) >= 0.93;

  const firstVariant =
    jaroWinkler(A.first, B.first) >= 0.88; // IMPORTANT: lowered

  return familyMatch && (fatherGrandMatch || firstVariant);
}

function detectOrderFree(a: string[], b: string[]) {
  return nameOrderFreeScore(a, b) >= 0.9;
}

function extractPattern(a: PreprocessedRow, b: PreprocessedRow): RulePattern | null {
  const womanCore = detectWomanCore(a.parts, b.parts);
  const husbandCore =
    a.husbandParts.length > 0 &&
    b.husbandParts.length > 0 &&
    detectWomanCore(a.husbandParts, b.husbandParts);

  const orderFree = detectOrderFree(a.parts, b.parts);

  const phoneLast6 =
    a.phone && b.phone &&
    a.phone.slice(-6) === b.phone.slice(-6);

  const childrenFuzzy =
    tokenJaccard(a.children_normalized, b.children_normalized) >= 0.6;

  // 🚫 EMPTY-PATTERN PROTECTION
  if (
    !womanCore &&
    !husbandCore &&
    !orderFree &&
    !phoneLast6 &&
    !childrenFuzzy
  ) {
    return null;
  }

  return {
    womanCore,
    husbandCore,
    orderFree,
    phoneLast6,
    childrenFuzzy,
  };
}


// 2. RULE CODE GENERATOR
function generateRuleCode(p: RulePattern): string | null {
  const lines: string[] = [];

  if (
    !p.womanCore &&
    !p.husbandCore &&
    !p.orderFree &&
    !p.phoneLast6 &&
    !p.childrenFuzzy
  ) {
    return null; // 🚫 never generate empty rule
  }

  lines.push(`if (`);

  if (p.womanCore) {
    lines.push(`  A.length >= 3 && B.length >= 3 &&`);
    lines.push(`  jw(A[A.length - 1], B[B.length - 1]) >= 0.93 &&`);
    lines.push(`  (`);
    lines.push(`    jw(A[0], B[0]) >= 0.90 ||`);
    lines.push(`    (jw(A[1], B[1]) >= 0.93 && jw(A[2], B[2]) >= 0.93)`);
    lines.push(`  ) &&`);
  }
  
  if (p.husbandCore) {
    lines.push(`  HA.length >= 3 && HB.length >= 3 &&`);
     lines.push(`  jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.93 &&`);
    lines.push(`  (`);
    lines.push(`    jw(HA[0], HB[0]) >= 0.90 ||`);
    lines.push(`    (jw(HA[1], HB[1]) >= 0.93 && jw(HA[2], HB[2]) >= 0.93)`);
    lines.push(`  ) &&`);
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
        const pattern = extractPattern(failureCluster[0], failureCluster[1]);
        
        if (!pattern) {
             postMessage({ type: 'learning_error', payload: { error: "Could not detect a valid pattern from the selected records." } });
             return;
        }

        const code = generateRuleCode(pattern);
        if (!code) {
          postMessage({ type: 'learning_error', payload: { error: "Detected pattern was empty and could not generate a rule." } });
          return;
        }

        const newRule = {
            id: `AUTO_RULE_${Date.now()}`,
            code: code,
            params: pattern,
            enabled: true
        };
        
        await submitRule(newRule);
        
        postMessage({ type: 'rule_learned', payload: newRule });

    } catch (error: any) {
        postMessage({ type: 'learning_error', payload: { error: error.message } });
    }
};
