// src/workers/scoring.worker.ts
import { computePairScore, type PreprocessedRow, type WorkerOptions } from "@/lib/scoringClient";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";


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
