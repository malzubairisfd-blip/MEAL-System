
// src/workers/scoring.worker.ts
import { computePairScore } from "@/lib/scoringClient";

const safeAvg = (values: (number | null | undefined)[]) => {
  const numerics = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (!numerics.length) return 0;
  const total = numerics.reduce((sum, value) => sum + value, 0);
  return total / numerics.length;
};

const variance = (values: number[]) => {
  if (!values.length) return 0;
  const mean = safeAvg(values);
  return safeAvg(values.map((value) => (value - mean) ** 2));
};

const calculateConfidenceScore = (pairScores: any[], clusterSize: number) => {
  if (!pairScores.length) return 0;
  const finalScores = pairScores.map((pair) => pair.score);
  const avgPairScore = safeAvg(finalScores);
  const consistencyScore = Math.max(0, 1 - variance(finalScores));
  const sizeBoost = Math.min(0.1, Math.max(0, (clusterSize - 2) * 0.03));
  const confidence = avgPairScore * 0.7 + consistencyScore * 0.2 + sizeBoost;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
};

self.onmessage = (event) => {
  const { rawClusters } = event.data;
  if (!rawClusters) {
    postMessage({ type: "error", error: "No clusters provided to scoring worker." });
    return;
  }

  try {
    const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
      const progress = Math.round((index / rawClusters.length) * 100);
      postMessage({ type: "progress", progress });

      const records = cluster.records || [];
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

      const avgWomanNameScore = safeAvg(pairScores.map((pair) => pair.tokenReorderScore));
      const avgHusbandNameScore = safeAvg(pairScores.map((pair) => pair.husbandScore));
      const avgFinalScore = avgWomanNameScore * 0.4 + avgHusbandNameScore * 0.6;
      const confidenceScore = calculateConfidenceScore(pairScores, records.length);

      const perRecord = records.reduce<Record<string, Record<string, number[]>>>((acc, record) => {
        acc[record._internalId] = {
          nameScore: [],
          husbandScore: [],
          childrenScore: [],
          idScore: [],
          phoneScore: [],
          locationScore: [],
        };
        return acc;
      }, {});

      pairScores.forEach((pair) => {
        const entryA = perRecord[pair.aId];
        const entryB = perRecord[pair.bId];
        if (!entryA || !entryB) return;
        entryA.nameScore.push(pair.tokenReorderScore);
        entryB.nameScore.push(pair.tokenReorderScore);
        entryA.husbandScore.push(pair.husbandScore);
        entryB.husbandScore.push(pair.husbandScore);
        entryA.childrenScore.push(pair.childrenScore);
        entryB.childrenScore.push(pair.childrenScore);
        entryA.idScore.push(pair.idScore);
        entryB.idScore.push(pair.idScore);
        entryA.phoneScore.push(pair.phoneScore);
        entryB.phoneScore.push(pair.phoneScore);
        entryA.locationScore.push(pair.locationScore);
        entryB.locationScore.push(pair.locationScore);
      });

      const enrichedRecords = records.map((record: any) => ({
        ...record,
        nameScore: safeAvg(perRecord[record._internalId].nameScore),
        husbandScore: safeAvg(perRecord[record._internalId].husbandScore),
        childrenScore: safeAvg(perRecord[record._internalId].childrenScore),
        idScore: safeAvg(perRecord[record._internalId].idScore),
        phoneScore: safeAvg(perRecord[record._internalId].phoneScore),
        locationScore: safeAvg(perRecord[record._internalId].locationScore),
      }));

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

    postMessage({ type: "done", enrichedClusters });
  } catch (error: any) {
    postMessage({ type: "error", error: error?.message || "Unknown scoring error" });
  }
};
