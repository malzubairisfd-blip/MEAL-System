// src/workers/scoring.worker.ts
// Scoring worker: first consumes a reduced candidate pair list (provided by the cluster worker via the main thread),
// computes and caches pair scores for that reduced set, then enriches clusters using cached values where available.
// If an intra-cluster pair is missing from the cache, it falls back to computing the pair score (to guarantee identical outputs).

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

type CandidatePair = {
  aId: string;
  bId: string;
  score?: number;
  reasons?: string[];
  breakdown?: any;
};

type IncomingMessage = {
  rawClusters?: any[];
  candidatePairs?: CandidatePair[];
  rowsMap?: Record<string, any>;
};

const pairCache = new Map<string, any>();

const keyFor = (aId: string, bId: string) => (aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`);

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const { rawClusters, candidatePairs, rowsMap } = event.data;

  if (!rawClusters) {
    postMessage({ type: "error", error: "No clusters provided to scoring worker." });
    return;
  }

  try {
    // Build an initial cache from the provided candidatePairs (reduced set).
    if (Array.isArray(candidatePairs) && candidatePairs.length) {
      let idx = 0;
      for (const cp of candidatePairs) {
        const progress = Math.round((idx / candidatePairs.length) * 100);
        if (idx % 50 === 0) {
          postMessage({ type: "progress", progress: Math.min(100, progress) });
          // yield to event loop (allow UI to update)
          await new Promise((r) => setTimeout(r, 0));
        }
        const k = keyFor(cp.aId, cp.bId);
        if (pairCache.has(k)) {
          idx++;
          continue;
        }
        if (cp.breakdown) {
          // If the cluster worker provided a precomputed breakdown/score, use it.
          pairCache.set(k, {
            score: cp.score ?? (cp.breakdown?.score ?? 0),
            breakdown: cp.breakdown,
            reasons: cp.reasons || [],
          });
        } else {
          // We may need the actual record objects to run computePairScore.
          const a = rowsMap?.[cp.aId];
          const b = rowsMap?.[cp.bId];
          if (a && b) {
            try {
              const result = computePairScore(a, b, {});
              pairCache.set(k, {
                score: result?.score ?? 0,
                breakdown: result?.breakdown ?? null,
                reasons: result?.reasons ?? [],
              });
            } catch (err) {
              // store a safe fallback
              pairCache.set(k, { score: cp.score ?? 0, breakdown: null, reasons: cp.reasons || [] });
            }
          } else {
            // No record objects available for this candidate; store the provided score if any
            pairCache.set(k, { score: cp.score ?? 0, breakdown: cp.breakdown ?? null, reasons: cp.reasons || [] });
          }
        }
        idx++;
      }
      postMessage({ type: "progress", progress: 100 });
    }

    // Now enrich clusters. For each intra-cluster pair we try to use the cache first.
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
      // Ensure we have quick access to records by id for computing missing pairs
      const recMap: Record<string, any> = {};
      for (const r of records) recMap[r._internalId] = r;

      for (let i = 0; i < records.length; i++) {
        for (let j = i + 1; j < records.length; j++) {
          const ai = records[i]._internalId;
          const bi = records[j]._internalId;
          const k = keyFor(ai, bi);
          let cached = pairCache.get(k);
          if (!cached) {
            // compute now (fallback) and cache it
            try {
              const result = computePairScore(recMap[ai], recMap[bi], {});
              cached = {
                score: result?.score ?? 0,
                breakdown: result?.breakdown ?? null,
                reasons: result?.reasons ?? [],
              };
            } catch (err) {
              cached = { score: 0, breakdown: null, reasons: [] };
            }
            pairCache.set(k, cached);
          }
          if (!cached) continue;
          pairScores.push({
            aId: ai,
            bId: bi,
            score: cached.score,
            ...((cached.breakdown && typeof cached.breakdown === "object") ? cached.breakdown : {}),
            reasons: cached.reasons || [],
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
