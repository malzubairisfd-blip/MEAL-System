
import type { RecordRow } from '@/lib/types';

export function calculateClusterConfidence(avgWomanNameScore?: number, avgHusbandNameScore?: number): number {
  const womanScore = (avgWomanNameScore || 0) * 100;
  const husbandScore = (avgHusbandNameScore || 0) * 100;

  if (womanScore === 0 && husbandScore === 0) {
    return 0;
  }
  
  // Calculate a weighted average. You can adjust the weights.
  const weightedAverage = (womanScore * 0.6) + (husbandScore * 0.4);
  
  return Math.min(100, Math.round(weightedAverage));
}
