// src/workers/scoring.worker.ts
import { computePairScore } from '@/lib/scoringClient';

/* ───────────────────────────────────────────── */
/* Utilities                                    */
/* ───────────────────────────────────────────── */

const safeAvg = (arr: (number | null | undefined)[]) => {
  const valid = arr.filter(v => typeof v === 'number' && isFinite(v)) as number[];
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
};

const variance = (arr: number[]) => {
  if (arr.length === 0) return 0;
  const mean = safeAvg(arr);
  return safeAvg(arr.map(v => Math.pow(v - mean, 2)));
};

/**
 * Deterministic cluster confidence score (0–100)
 */
const calculateConfidenceScore = (pairScores: any[], clusterSize: number) => {
  if (pairScores.length === 0) return 0;

  const finalScores = pairScores.map(p => p.score);
  const avgPairScore = safeAvg(finalScores);

  // Consistency: penalize wide disagreement between pairs
  const v = variance(finalScores);
  const consistencyScore = Math.max(0, 1 - v); // Score from 0-1

  // Small, capped boost for larger clusters
  const sizeBoost = Math.min(0.1, Math.max(0, (clusterSize - 2) * 0.03)); // boost as 0-0.1

  const confidence =
    (avgPairScore * 0.7) +
    (consistencyScore * 0.2) +
    sizeBoost;

  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
};


/* ───────────────────────────────────────────── */
/* Worker                                       */
/* ───────────────────────────────────────────── */

self.onmessage = (event) => {
  const { rawClusters } = event.data;

  if (!rawClusters) {
    postMessage({ type: 'error', error: 'No clusters provided to scoring worker.' });
    return;
  }

  try {
    const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
      postMessage({
        type: 'progress',
        progress: Math.round((index / rawClusters.length) * 100),
      });

      const records = cluster.records || [];

      /* ───────── Single / empty cluster ───────── */
      if (records.length < 2) {
        return {
          ...cluster,
          records,
          pairScores: [],
          avgWomanNameScore: 0,
          avgHusbandNameScore: 0,
          avgFinalScore: 0,
          confidenceScore: 0,
          clusterSize: records.length,
        };
      }

      /* ───────── Pairwise scoring ───────── */
      const pairScores: any[] = [];

      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          const result = computePairScore(records[i], records[j], {});
          if (!result || !result.breakdown) continue;

          pairScores.push({
            aId: records[i]._internalId,
            bId: records[j]._internalId,
            score: result.score,
            ...result.breakdown,
          });
        }
      }

      /* ───────── Cluster averages ───────── */
      const avgWomanNameScore = safeAvg(
        pairScores.map(p => p.tokenReorderScore)
      );

      const avgHusbandNameScore = safeAvg(
        pairScores.map(p => p.husbandScore)
      );

      const avgFinalScore =
        avgWomanNameScore * 0.4 +
        avgHusbandNameScore * 0.6;

      const confidenceScore = calculateConfidenceScore(
        pairScores,
        records.length
      );

      /* ───────── Per-record aggregation ───────── */
      const perRecord: Record<string, any> = {};

      records.forEach((r: any) => {
        perRecord[r._internalId] = {
          nameScore: [],
          husbandScore: [],
          childrenScore: [],
          idScore: [],
          phoneScore: [],
          locationScore: [],
        };
      });

      pairScores.forEach(p => {
        const A = perRecord[p.aId];
        const B = perRecord[p.bId];
        if (!A || !B) return;

        // ✅ nameScore uses tokenReorderScore
        A.nameScore.push(p.tokenReorderScore);
        B.nameScore.push(p.tokenReorderScore);

        A.husbandScore.push(p.husbandScore);
        B.husbandScore.push(p.husbandScore);

        A.childrenScore.push(p.childrenScore);
        B.childrenScore.push(p.childrenScore);

        A.idScore.push(p.idScore);
        B.idScore.push(p.idScore);

        A.phoneScore.push(p.phoneScore);
        B.phoneScore.push(p.phoneScore);

        A.locationScore.push(p.locationScore);
        B.locationScore.push(p.locationScore);
      });

      const enrichedRecords = records.map((r: any) => ({
        ...r,
        nameScore: safeAvg(perRecord[r._internalId].nameScore),
        husbandScore: safeAvg(perRecord[r._internalId].husbandScore),
        childrenScore: safeAvg(perRecord[r._internalId].childrenScore),
        idScore: safeAvg(perRecord[r._internalId].idScore),
        phoneScore: safeAvg(perRecord[r._internalId].phoneScore),
        locationScore: safeAvg(perRecord[r._internalId].locationScore),
      }));

      /* ───────── Final cluster ───────── */
      return {
        ...cluster,
        records: enrichedRecords,
        pairScores,
        avgWomanNameScore,
        avgHusbandNameScore,
        avgFinalScore,
        confidenceScore,
        clusterSize: records.length,
      };
    });

    postMessage({ type: 'done', enrichedClusters });
  } catch (e: any) {
    postMessage({
      type: 'error',
      error: e?.message || 'Unknown scoring error',
    });
  }
};
