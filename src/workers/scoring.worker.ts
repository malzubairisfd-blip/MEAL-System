// src/workers/scoring.worker.ts
import { computePairScore, type PreprocessedRow } from "./cluster.worker";
import { jaroWinkler } from "@/lib/similarity";

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

/* =========================================================
   FULL CLUSTER CONFIDENCE CALCULATION – PRODUCTION READY
   ========================================================= */

/* ---------------------------------------------------------
   TYPES
--------------------------------------------------------- */

type PairScore = {
  aId: string;            // record internal id
  bId: string;            // record internal id
  womanScore: number;   // 0..1
  husbandScore: number; // 0..1
  totalAvg: number;     // 0..1  ( (woman + husband) / 2 )
  score: number;        // Final computed score
  reasons: string[];
  [key: string]: any; // Allow for breakdown properties
};

type ClusterConfidenceResult = {
  avgWomanScore: number;
  avgHusbandScore: number;
  totalAverageScore: number;
  standardDeviation: number;
  sizePenalty: number;
  confidencePercent: number;
  confidenceLabel: string;
};

/* ---------------------------------------------------------
   BASIC MATH HELPERS
--------------------------------------------------------- */

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/* ---------------------------------------------------------
   ADAPTIVE CLUSTER SIZE PENALTY
--------------------------------------------------------- */

function clusterSizePenalty(clusterSize: number): number {
  if (clusterSize <= 2) return 0;

  // logarithmic growth (safe for large clusters)
  return Math.min(0.12, Math.log(clusterSize - 1) * 0.03);
}

/* ---------------------------------------------------------
   ARABIC CONFIDENCE LABELS (4 LEVELS)
--------------------------------------------------------- */

function arabicConfidenceLabel(percent: number): string {
  if (percent >= 90) return "تكرار مؤكد";
  if (percent >= 75) return "اشتباه تكرار مؤكد";
  if (percent >= 60) return "اشتباه تكرار";
  return "إحتمالية تكرار";
}

/* ---------------------------------------------------------
   MAIN CONFIDENCE CALCULATION
--------------------------------------------------------- */

function calculateClusterConfidence(
  pairScores: PairScore[],
  clusterSize: number
): ClusterConfidenceResult {

  // ---- Collect Scores ----
  const womanScores = pairScores.map(p => p.womanScore);
  const husbandScores = pairScores.map(p => p.husbandScore);
  const totalScores = pairScores.map(p => p.totalAvg);

  // ---- Averages ----
  const avgWomanScore = mean(womanScores);
  const avgHusbandScore = mean(husbandScores);

  // combined average (woman + husband)
  const totalAverageScore =
    (avgWomanScore + avgHusbandScore) / 2;

  // ---- Consistency ----
  const deviation = standardDeviation(totalScores);

  // ---- Size Penalty ----
  const sizePenalty = clusterSizePenalty(clusterSize);

  // ---- FINAL CONFIDENCE FORMULA ----
  let confidence =
    totalAverageScore
    - deviation
    - sizePenalty;

  confidence = Math.max(0, Math.min(1, confidence));
  const confidencePercent = Math.round(confidence * 100);

  return {
    avgWomanScore,
    avgHusbandScore,
    totalAverageScore,
    standardDeviation: deviation,
    sizePenalty,
    confidencePercent,
    confidenceLabel: arabicConfidenceLabel(confidencePercent),
  };
}

// --- Worker Main Logic ---
export type WorkerOptions = import("./cluster.worker").WorkerOptions;


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
          confidenceScore: 0,
          avgWomanNameScore: 0,
          avgHusbandNameScore: 0,
          avgFinalScore: 0,
        };
      }
      
      const pairScores: PairScore[] = [];
      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
            const result = computePairScore(records[i], records[j], options || {});
            const nameAvgs = totalAverageNameScore(records[i], records[j]);
            pairScores.push({
                aId: records[i]._internalId,
                bId: records[j]._internalId,
                womanScore: nameAvgs.womanAvg,
                husbandScore: nameAvgs.husbandAvg,
                totalAvg: nameAvgs.totalAvg,
                score: result.score,
                ...result.breakdown,
                reasons: result.reasons,
            });
        }
      }

      const confidenceResult = calculateClusterConfidence(pairScores, records.length);
      
      const recordsWithAvgScores = records.map(record => {
        const relatedPairs = pairScores.filter((p: any) => p.aId === record._internalId || p.bId === record._internalId);
        
        const safeAvg = (arr: (number | null | undefined)[]) => {
            const valid = arr.filter(v => typeof v === 'number' && isFinite(v)) as number[];
            return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
        };

        return {
          ...record,
          avgPairScore: safeAvg(relatedPairs.map((p) => p.score)),
          avgFirstNameScore: safeAvg(relatedPairs.map((p) => p.firstNameScore)),
          avgFamilyNameScore: safeAvg(relatedPairs.map((p) => p.familyNameScore)),
          avgAdvancedNameScore: safeAvg(relatedPairs.map((p) => p.advancedNameScore)),
          avgTokenReorderScore: safeAvg(relatedPairs.map((p) => p.tokenReorderScore)),
        };
      });

      return {
        ...cluster,
        records: recordsWithAvgScores,
        pairScores: pairScores,
        confidenceScore: confidenceResult.confidencePercent,
        avgWomanNameScore: confidenceResult.avgWomanScore,
        avgHusbandNameScore: confidenceResult.avgHusbandScore,
        avgFinalScore: confidenceResult.totalAverageScore,
      };
    });

    postMessage({ type: "done", enrichedClusters });
  } catch (error: any) {
    postMessage({ type: "error", error: error?.message || "Unknown scoring error" });
  }
};
