
// src/workers/scoring.worker.ts
import { type PreprocessedRow, type WorkerOptions, computePairScore } from "@/lib/scoringClient";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";


// --- New Scoring Functions ---

function jaroWinkler(a: string, b: string) {
  const sanitizedA = String(a || "");
  const sanitizedB = String(b || "");
  if (!sanitizedA || !sanitizedB) return 0;
  if (sanitizedA === sanitizedB) return 1;

  const la = sanitizedA.length;
  const lb = sanitizedB.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aMatches = Array(la).fill(false);
  const bMatches = Array(lb).fill(false);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (sanitizedA[i] !== sanitizedB[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (sanitizedA[i] !== sanitizedB[k]) transpositions++;
    k++;
  }

  transpositions /= 2;
  const m = matches;
  const jaro =
    (m / la + m / lb + (m - transpositions) / m) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, la, lb);
  for (let i = 0; i < maxPrefix; i++) {
    if (sanitizedA[i] === sanitizedB[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
};


export function averageWomanNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
  const A = a.parts;
  const B = b.parts;
  
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 0;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < maxLen; i++) {
    if (A[i] && B[i]) {
      sum += jaroWinkler(A[i], B[i]);
      count++;
    }
  }

  return count ? sum / count : 0;
}

export function averageHusbandNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
  const HA = a.husbandParts;
  const HB = b.husbandParts;
  
  if (!HA.length || !HB.length) return 0;

  let sum = 0;
  let count = 0;

  const maxLen = Math.max(HA.length, HB.length);
  for (let i = 0; i < maxLen; i++) {
    if (HA[i] && HB[i]) {
      sum += jaroWinkler(HA[i], HB[i]);
      count++;
    }
  }

  const partsAvg = count ? sum / count : 0;

  const fullNameScore = jaroWinkler(
    a.husbandName_normalized,
    b.husbandName_normalized
  );

  // 🔥 Stronger confidence via fusion
  return 0.6 * partsAvg + 0.4 * fullNameScore;
}

export function totalAverageNameScore(
  a: PreprocessedRow,
  b: PreprocessedRow
): {
  womanAvg: number;
  husbandAvg: number;
  totalAvg: number;
} {
  const womanAvg = averageWomanNameScore(a, b);
  const husbandAvg = averageHusbandNameScore(a, b);

  const totalAvg =
    0.45 * womanAvg +
    0.55 * husbandAvg;

  return {
    womanAvg,
    husbandAvg,
    totalAvg,
  };
}


self.onmessage = (event) => {
  const { rawClusters, options } = event.data;
  if (!rawClusters) {
    postMessage({ type: "error", error: "No clusters provided to scoring worker." });
    return;
  }

  try {
    const totalClusters = rawClusters.length;
    const UPDATE_BATCH_SIZE = Math.max(10, Math.floor(totalClusters / 100)); 

    const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
      if (index % UPDATE_BATCH_SIZE === 0) {
        const progress = Math.round((index / totalClusters) * 100);
        postMessage({ type: "progress", progress });
      }

      const records = (cluster.records || []) as PreprocessedRow[];
      if (records.length < 2) {
        return {
          ...cluster,
          records,
          pairScores: [],
          confidenceScore: 100, // Or some default for single-record clusters
          avgWomanNameScore: 1,
          avgHusbandNameScore: 1,
          avgFinalScore: 1,
        };
      }
      
      const confidenceResult = calculateClusterConfidence(records, options || {});
      const { confidencePercent, auditTable, avgWomanNameScore, avgHusbandNameScore, avgFinalScore } = confidenceResult;

      const safeAvg = (arr: (number | null | undefined)[]) => {
          const valid = arr.filter(v => typeof v === 'number' && isFinite(v)) as number[];
          return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
      };

      const recordsWithAvgScores = records.map(record => {
        const relatedPairs = auditTable.filter((p: any) => p.a === record._internalId || p.b === record._internalId);
        
        return {
          ...record,
          avgPairScore: safeAvg(relatedPairs.map((p: any) => p.score)),
          avgFirstNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.firstNameScore)),
          avgFamilyNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.familyNameScore)),
          avgAdvancedNameScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.advancedNameScore)),
          avgTokenReorderScore: safeAvg(relatedPairs.map((p: any) => p.breakdown?.tokenReorderScore)),
        };
      });

      return {
        ...cluster,
        records: recordsWithAvgScores,
        pairScores: auditTable, 
        confidenceScore: confidencePercent,
        avgWomanNameScore,
        avgHusbandNameScore,
        avgFinalScore
      };
    });

    postMessage({ type: "done", enrichedClusters });
  } catch (error: any) {
    postMessage({ type: "error", error: error?.message || "Unknown scoring error" });
  }
};
