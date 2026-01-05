import type { RecordRow } from './types';
import { computePairScore, type WorkerOptions, type PreprocessedRow } from './scoringClient';
import { averageWomanNameScore, averageHusbandNameScore, totalAverageNameScore } from '@/workers/scoring.worker';

// --- Utility Functions ---

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const stdDev = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map(v => (v - m) ** 2));
  return Math.sqrt(variance);
};

// --- Dynamic Calculation Logic ---

function adaptiveThresholds(clusterSize: number) {
  return {
    minPair:
      clusterSize <= 3 ? 0.88 :
      clusterSize <= 6 ? 0.85 :
      clusterSize <= 10 ? 0.82 :
      0.78,
    stdCap:
      clusterSize <= 3 ? 0.08 :
      clusterSize <= 6 ? 0.12 :
      0.15
  };
}

function dynamicWeights(
  base: WorkerOptions["finalScoreWeights"],
  clusterSize: number,
  hasChildren: boolean,
  hasHusband: boolean
) {
  if (!base) return {};
  const w = { ...base };

  if (clusterSize >= 6) {
    w.firstNameScore = (w.firstNameScore || 0) * 0.7;
    w.familyNameScore = (w.familyNameScore || 0) * 0.8;
    w.childrenScore = (w.childrenScore || 0) * 1.4;
    w.husbandScore = (w.husbandScore || 0) * 1.3;
  }

  if (!hasChildren) {
    w.childrenScore = 0;
  }

  if (!hasHusband) {
    w.familyNameScore = (w.familyNameScore || 0) * 1.3;
    w.tokenReorderScore = (w.tokenReorderScore || 0) * 1.2;
  }

  return w;
}

function buildPairwiseMatrix(
  cluster: PreprocessedRow[],
  opts: WorkerOptions
) {
  const scores: {
    womanAvg: number;
    husbandAvg: number;
    totalAvg: number;
  }[] = [];
  const audit: any[] = [];
  const firedRules = new Set<string>();
  const keysUsed = new Set<string>();

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const r = computePairScore(cluster[i], cluster[j], opts);
      const nameScores = totalAverageNameScore(cluster[i], cluster[j]);
      scores.push(nameScores);

      (r.reasons || []).forEach((x: string) => firedRules.add(x));

      if (r.breakdown) {
          Object.keys(r.breakdown).forEach(k => {
            if ((r.breakdown as any)[k] > 0.85) keysUsed.add(k);
          });
      }

      audit.push({
        a: cluster[i]._internalId,
        b: cluster[j]._internalId,
        score: r.score,
        ...nameScores,
        reasons: r.reasons || [],
        breakdown: r.breakdown
      });
    }
  }

  const safeAvg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgScores = {
    womanAvg: safeAvg(scores.map(s => s.womanAvg)),
    husbandAvg: safeAvg(scores.map(s => s.husbandAvg)),
    totalAvg: safeAvg(scores.map(s => s.totalAvg)),
  }

  return { scores: avgScores, audit, firedRules: [...firedRules], keysUsed: [...keysUsed] };
}

function autoGenerateClusterSummary(data: {
    confidencePercent: number,
    size: number,
    firedRules: string[],
    keysUsed: string[],
    minScore: number
}) {
    // Placeholder for summary generation logic
    return `Cluster of size ${data.size} with confidence ${data.confidencePercent}%. Rules: ${data.firedRules.join(', ')}.`;
}

// --- Main Confidence Calculation Function ---

export function calculateClusterConfidence(
  cluster: PreprocessedRow[],
  opts: WorkerOptions
) {
  if (cluster.length < 2) {
    return {
      confidencePercent: 100,
      confidenceLevel: "SINGLE_RECORD",
      auditTable: [],
      summary: "Single record cluster"
    };
  }

  const { scores, audit, firedRules, keysUsed } =
    buildPairwiseMatrix(cluster, opts);

  const size = cluster.length;
  
  const confidencePercent = Math.round(scores.totalAvg * 100);

  const confidenceLevel =
    confidencePercent >= 92
    ? "CONFIRMED"
    : confidencePercent >= 85
    ? "STRONG_SUSPECT"
    : confidencePercent >= 70
    ? "SUSPECT"
    : "POSSIBLE";

  return {
    confidencePercent,
    confidenceLevel,
    avgWomanNameScore: scores.womanAvg,
    avgHusbandNameScore: scores.husbandAvg,
    avgFinalScore: scores.totalAvg,
    firedRules,
    keysUsed,
    auditTable: audit,
  };
}
