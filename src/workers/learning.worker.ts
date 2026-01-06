// src/workers/learning.worker.ts
import { jaroWinkler, alignLineage } from '@/lib/similarity';
import { PreprocessedRow, preprocessRow } from '@/workers/cluster.worker';

export type LearnedPattern = {
  allowDuplicateAncestor: boolean;
  minFirstNameJW: number;
  familyAnchor: boolean;
  maxLengthDiff: number;
};

export function analyzeFailureCluster(cluster: PreprocessedRow[]): LearnedPattern {
  let minFN = 1;
  let allowDup = false;
  let familyAnchor = true;

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const A = cluster[i].parts;
      const B = cluster[j].parts;

      minFN = Math.min(minFN, jaroWinkler(A[0], B[0]));

      if (A.some((v, k) => v === A[k + 1]) ||
          B.some((v, k) => v === B[k + 1])) {
        allowDup = true;
      }

      if (
        jaroWinkler(
          A[A.length - 1],
          B[B.length - 1]
        ) < 0.95
      ) familyAnchor = false;
    }
  }

  const lengths = cluster.map(r => r.parts.length);

  return {
    allowDuplicateAncestor: allowDup,
    minFirstNameJW: Math.max(0.85, minFN - 0.02),
    familyAnchor,
    maxLengthDiff: Math.max(...lengths) - Math.min(...lengths),
  };
}


export function synthesizeRule(pattern: LearnedPattern) {
  return {
    id: `AUTO_RULE_${Date.now()}`,
    type: "LINEAGE",

    params: {
      allowDuplicateAncestor: pattern.allowDuplicateAncestor,
      minFirstNameJW: pattern.minFirstNameJW,
      familyAnchor: pattern.familyAnchor,
      maxLengthDiff: pattern.maxLengthDiff,
    }
  };
}


export async function submitRule(rule: any) {
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
        // Preprocess the raw records using the provided mapping
        const failureCluster: PreprocessedRow[] = rawRecords.map((record: any) => {
            const mappedRecord: any = {};
            for (const key in mapping) {
                mappedRecord[key] = record[mapping[key]];
            }
            mappedRecord._internalId = record._internalId;
            return preprocessRow(mappedRecord);
        });

        const pattern = analyzeFailureCluster(failureCluster);
        const newRule = synthesizeRule(pattern);
        
        await submitRule(newRule);
        
        postMessage({ type: 'rule_learned', payload: newRule });

    } catch (error: any) {
        postMessage({ type: 'learning_error', payload: { error: error.message } });
    }
};
