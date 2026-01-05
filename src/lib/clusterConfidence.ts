import type { RecordRow } from './types';
import { computePairScore, type WorkerOptions, type PreprocessedRow } from './scoringClient';

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
  const scores: number[] = [];
  const audit: any[] = [];
  const firedRules = new Set<string>();
  const keysUsed = new Set<string>();

  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const r = computePairScore(cluster[i], cluster[j], opts);

      scores.push(r.score);

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
        reasons: r.reasons || [],
        breakdown: r.breakdown
      });
    }
  }

  return { scores, audit, firedRules: [...firedRules], keysUsed: [...keysUsed] };
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
  const thresholds = adaptiveThresholds(size);

  const avg = mean(scores);
  const std = stdDev(scores);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;

  const stdPenalty =
    clamp(std / thresholds.stdCap) * thresholds.stdCap;

  const sizePenalty =
    Math.log2(size - 1) * 0.03;

  const weakLinkPenalty =
    minScore < thresholds.minPair
      ? (thresholds.minPair - minScore) * 0.6
      : 0;

  let confidence =
    avg - stdPenalty - sizePenalty - weakLinkPenalty;

  confidence = clamp(confidence);

  const confidencePercent = Math.round(confidence * 100);

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
    avgScore: avg,
    stdDeviation: std,
    penalties: {
      stdPenalty,
      sizePenalty,
      weakLinkPenalty
    },
    firedRules,
    keysUsed,
    auditTable: audit,
    summary: autoGenerateClusterSummary({
      confidencePercent,
      size,
      firedRules,
      keysUsed,
      minScore
    })
  };
}
