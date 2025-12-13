import type { RecordRow } from '@/lib/types';

export function calculateClusterConfidence(cluster: RecordRow[]): number {
  if (cluster.length < 2) return 0;

  let score = 0;
  const base = 100;

  const first = cluster[0];

  for (let i = 1; i < cluster.length; i++) {
    const r = cluster[i];

    if (r.womanName === first.womanName) score += 25;
    if (r.husbandName === first.husbandName) score += 20;
    if (r.nationalId && r.nationalId === first.nationalId) score += 25;
    if (r.phone && r.phone === first.phone) score += 15;
  }

  // Normalize by cluster size
  const normalized = score / (cluster.length - 1);
  return Math.min(base, Math.round(normalized));
}