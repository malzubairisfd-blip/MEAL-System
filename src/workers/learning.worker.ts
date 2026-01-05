
// src/workers/learning.worker.ts
import { jaroWinkler } from './cluster.worker';
import type { PreprocessedRow, WorkerOptions } from './cluster.worker';

// This worker does not need the full clustering logic, only the learning part.
// So, we redefine or import only what's necessary.

type FailureCluster = PreprocessedRow[];

type LineageDiff = {
  duplicateAncestor: boolean;
  lengthDiff: number;
  firstNameMinJW: number;
  familyNameStable: boolean;
};

type RuleResult = {
  score: number;
  reasons: string[];
};

type AutoRule = {
  id: string;
  pattern: LineageDiff;
  // We serialize the apply function by storing its pattern.
  // The main worker will reconstruct the function.
};

function collapseDuplicateAncestors(parts: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === 0 || parts[i] !== parts[i - 1]) {
      result.push(parts[i]);
    }
  }
  return result;
}

function alignLineage(arr: string[], targetLength: number): string[] {
    if (arr.length >= targetLength) {
      return arr;
    }
    const result = [...arr];
    while (result.length < targetLength) {
      result.push(""); // Pad with empty strings
    }
    return result;
}


function analyzeClusterPattern(cluster: FailureCluster): LineageDiff {
  let minFirstNameJW = 1;
  let duplicateAncestor = false;
  let familyStable = true;

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const A = cluster[i].parts;
      const B = cluster[j].parts;

      minFirstNameJW = Math.min(
        minFirstNameJW,
        jaroWinkler(A[0], B[0])
      );

      if (A.some((v, k) => v === A[k + 1]) ||
          B.some((v, k) => v === B[k + 1])) {
        duplicateAncestor = true;
      }

      if (
        jaroWinkler(
          A[A.length - 1],
          B[B.length - 1]
        ) < 0.95
      ) {
        familyStable = false;
      }
    }
  }

  const lengths = cluster.map(r => r.parts.length);
  const lengthDiff = Math.max(...lengths) - Math.min(...lengths);

  return {
    duplicateAncestor,
    lengthDiff,
    firstNameMinJW: minFirstNameJW,
    familyNameStable: familyStable,
  };
}

function generateRuleFromPattern(pattern: LineageDiff): AutoRule {
  const id = `AUTO_LINEAGE_RULE_${Date.now()}`;
  return { id, pattern };
}


self.onmessage = async (event: MessageEvent) => {
    const { failureCluster } = event.data;

    if (!Array.isArray(failureCluster) || failureCluster.length < 2) {
        postMessage({ type: 'learning_error', payload: { error: "A failure cluster must contain at least two records." } });
        return;
    }

    try {
        const pattern = analyzeClusterPattern(failureCluster);
        const newRule = generateRuleFromPattern(pattern);
        
        // Persist the rule by sending it to the new API endpoint
        const res = await fetch("/api/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRule),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to save the new rule on the server.");
        }
        
        postMessage({ type: 'rule_learned', payload: newRule });

    } catch (error: any) {
        postMessage({ type: 'learning_error', payload: { error: error.message } });
    }
};
