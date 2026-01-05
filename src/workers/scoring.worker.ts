
// src/workers/scoring.worker.ts
import { computePairScore, type PreprocessedRow, type WorkerOptions, jaroWinkler } from "@/lib/scoringClient";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";


// --- New Scoring Functions ---

function averageWomanNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
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

function averageHusbandNameScore(a: PreprocessedRow, b: PreprocessedRow): number {
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

function totalAverageNameScore(
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
        };
      }
      
      const confidenceResult = calculateClusterConfidence(records, options || {});
      const { confidencePercent, auditTable } = confidenceResult;

      return {
        ...cluster,
        records: cluster.records, // Pass through original records
        pairScores: auditTable, // The detailed audit table serves as pairScores
        confidenceScore: confidencePercent,
        // We no longer need to calculate these averages here
        // avgWomanNameScore, avgHusbandNameScore, avgFinalScore are implicitly part of the confidence calc
      };
    });

    postMessage({ type: "done", enrichedClusters });
  } catch (error: any) {
    postMessage({ type: "error", error: error?.message || "Unknown scoring error" });
  }
};
