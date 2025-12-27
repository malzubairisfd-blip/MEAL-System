// src/workers/scoring.worker.ts
import { computePairScore } from '@/lib/scoringClient';
import { calculateClusterConfidence } from '@/lib/clusterConfidence';

const safeAvg = (arr: (number | null)[]) => {
    const validArr = arr.filter(n => typeof n === 'number' && isFinite(n)) as number[];
    return validArr.length ? validArr.reduce((a, b) => a + b, 0) / validArr.length : null;
}

self.onmessage = (event) => {
    const { rawClusters } = event.data;
    if (!rawClusters) {
        postMessage({ type: 'error', error: 'No clusters provided to scoring worker.' });
        return;
    }

    try {
        const enrichedClusters = rawClusters.map((cluster: any, index: number) => {
            postMessage({ type: 'progress', progress: (index / rawClusters.length) * 100 });

            const records = cluster.records;
            if (!records || records.length < 2) {
                return {
                    ...cluster,
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
                    const p = computePairScore(records[i], records[j], {});
                    if (!p?.breakdown) continue;
                    pairScores.push({
                        aId: records[i]._internalId,
                        bId: records[j]._internalId,
                        finalScore: p.score,
                        womanNameScore: p.breakdown.firstNameScore,
                        husbandNameScore: p.breakdown.husbandScore,
                        childrenScore: p.breakdown.childrenScore,
                        idScore: p.breakdown.idScore,
                        phoneScore: p.breakdown.phoneScore,
                        locationScore: p.breakdown.locationScore,
                    });
                }
            }

            const avgWomanNameScore = safeAvg(pairScores.map(p => p.womanNameScore));
            const avgHusbandNameScore = safeAvg(pairScores.map(p => p.husbandNameScore));
            
            // This is the confidence score based on the overall similarity of pairs.
            const confidenceScore = safeAvg(pairScores.map(p => p.finalScore));
            
            // This is a simpler average of the two main name components for display.
            const avgFinalScore = safeAvg([avgWomanNameScore, avgHusbandNameScore]);

            
            const perRecord: Record<string, any> = {};
            records.forEach((r: any) => {
              perRecord[r._internalId] = {
                womanNameScore: [], husbandNameScore: [], childrenScore: [],
                idScore: [], phoneScore: [], locationScore: [],
              };
            });

            pairScores.forEach(p => {
              const A = perRecord[p.aId];
              const B = perRecord[p.bId];
              if (!A || !B) return;
              A.womanNameScore.push(p.womanNameScore); B.womanNameScore.push(p.womanNameScore);
              A.husbandNameScore.push(p.husbandNameScore); B.husbandNameScore.push(p.husbandNameScore);
              A.childrenScore.push(p.childrenScore); B.childrenScore.push(p.childrenScore);
              A.idScore.push(p.idScore); B.idScore.push(p.idScore);
              A.phoneScore.push(p.phoneScore); B.phoneScore.push(p.phoneScore);
              A.locationScore.push(p.locationScore); B.locationScore.push(p.locationScore);
            });
            
            const enrichedRecords = records.map((r: any) => ({
              ...r,
              womanNameScore: safeAvg(perRecord[r._internalId].womanNameScore),
              husbandNameScore: safeAvg(perRecord[r._internalId].husbandNameScore),
              childrenScore: safeAvg(perRecord[r._internalId].childrenScore),
              idScore: safeAvg(perRecord[r._internalId].idScore),
              phoneScore: safeAvg(perRecord[r._internalId].phoneScore),
              locationScore: safeAvg(perRecord[r._internalId].locationScore),
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

        postMessage({ type: 'done', enrichedClusters });
    } catch (e: any) {
        postMessage({ type: 'error', error: e.message });
    }
};
