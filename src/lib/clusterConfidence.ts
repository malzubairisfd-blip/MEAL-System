
export function calculateClusterConfidence(
  pairScores: { score: number }[],
  clusterSize: number
): number {
  if (!pairScores || !pairScores.length) return 0;

  const avg =
    pairScores.reduce((s, p) => s + (p.score || 0), 0) / pairScores.length;

  const variance =
    pairScores.reduce((s, p) => s + Math.pow((p.score || 0) - avg, 2), 0) /
    pairScores.length;

  const stdDev = Math.sqrt(variance);

  // Penalize larger clusters more heavily.
  const sizePenalty = Math.max(0, (clusterSize - 2) * 0.02);

  // Confidence is the average score, minus penalties for deviation and size.
  // The score is converted to a percentage at the end.
  const confidence = avg - stdDev - sizePenalty;

  // Return as a percentage, clamped between 0 and 100.
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}
