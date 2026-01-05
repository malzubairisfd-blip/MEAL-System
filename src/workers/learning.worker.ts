// src/workers/learning.worker.ts
import { jaroWinkler, normalizeArabicWithCompounds, preprocessRow, nameOrderFreeScore, tokenJaccard } from './cluster.worker';
import type { PreprocessedRow, WorkerOptions } from './cluster.worker';

// This worker does not need the full clustering logic, only the learning part.
// So, we redefine or import only what's necessary.

type FailureCluster = PreprocessedRow[];

type LineageDiff = {
  // Structure
  duplicateAncestor: boolean;
  lengthDiff: number;
  // Woman Name
  minWomanJW: number;
  minWomanOrderFree: number;
  // Husband Name
  minHusbandJW: number;
  minHusbandOrderFree: number;
  // Other
  minChildrenJaccard: number;
  familyNameStable: boolean;
};

type AutoRule = {
  id: string;
  pattern: LineageDiff;
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

function analyzeClusterPattern(cluster: FailureCluster): LineageDiff {
  let minWomanJW = 1;
  let minWomanOrderFree = 1;
  let minHusbandJW = 1;
  let minHusbandOrderFree = 1;
  let minChildrenJaccard = 1;
  
  let duplicateAncestor = false;
  let familyNameStable = true;

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const a = cluster[i];
      const b = cluster[j];

      // Woman Name Analysis
      minWomanJW = Math.min(minWomanJW, jaroWinkler(a.womanName_normalized, b.womanName_normalized));
      minWomanOrderFree = Math.min(minWomanOrderFree, nameOrderFreeScore(a.parts, b.parts));

      // Husband Name Analysis
      minHusbandJW = Math.min(minHusbandJW, jaroWinkler(a.husbandName_normalized, b.husbandName_normalized));
      minHusbandOrderFree = Math.min(minHusbandOrderFree, nameOrderFreeScore(a.husbandParts, b.husbandParts));
      
      // Children Analysis
      minChildrenJaccard = Math.min(minChildrenJaccard, tokenJaccard(a.children_normalized, b.children_normalized));

      // Structural Analysis
      if (a.parts.some((v, k) => v === a.parts[k + 1]) || b.parts.some((v, k) => v === b.parts[k + 1])) {
        duplicateAncestor = true;
      }
      
      if (jaroWinkler(a.parts[a.parts.length - 1], b.parts[b.parts.length - 1]) < 0.95) {
        familyNameStable = false;
      }
    }
  }

  const lengths = cluster.map(r => r.parts.length);
  const lengthDiff = Math.max(...lengths) - Math.min(...lengths);

  return {
    duplicateAncestor,
    lengthDiff,
    minWomanJW,
    minWomanOrderFree,
    minHusbandJW,
    minHusbandOrderFree,
    minChildrenJaccard,
    familyNameStable,
  };
}


function generateRuleFromPattern(pattern: LineageDiff): AutoRule {
  const id = `AUTO_COMPLEX_RULE_${Date.now()}`;
  return { id, pattern };
}


self.onmessage = async (event: MessageEvent) => {
    const { rawRecords, mapping } = event.data;

    if (!Array.isArray(rawRecords) || rawRecords.length < 2) {
        postMessage({ type: 'learning_error', payload: { error: "A failure cluster must contain at least two records." } });
        return;
    }

    try {
        // Preprocess the raw records using the provided mapping
        const failureCluster: FailureCluster = rawRecords.map((record: any) => {
            const mappedRecord: any = {};
            for (const key in mapping) {
                mappedRecord[key] = record[mapping[key]];
            }
            mappedRecord._internalId = record._internalId;
            // Use preprocessRow from cluster.worker to ensure consistency
            return preprocessRow(mappedRecord);
        });

        const pattern = analyzeClusterPattern(failureCluster);
        const newRule = generateRuleFromPattern(pattern);
        
        // Persist the rule by sending it to the new API endpoint
        const apiUrl = new URL('/api/rules', self.location.origin).toString();
        const res = await fetch(apiUrl, {
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
