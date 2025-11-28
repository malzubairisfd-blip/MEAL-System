// scripts/evaluate.ts
import fs from "fs";
import { pairwiseScore } from "../lib/fuzzyCluster";

// Make sure to have rows.json and labels.json in the root of your project
// when running this script.
// Example command: ts-node scripts/evaluate.ts

try {
  const rows = JSON.parse(fs.readFileSync("rows.json", "utf8"));
  const labels = JSON.parse(fs.readFileSync("labels.json", "utf8"));

  const idMap = new Map(rows.map((r: any) => [String(r._internalId), r]));

  const pairs = labels.map((l: any) => {
    const a = idMap.get(String(l.aId));
    const b = idMap.get(String(l.bId));
    if (!a || !b) {
      console.warn(`Could not find records for label: ${l.aId}, ${l.bId}`);
      return null;
    }
    const { score } = pairwiseScore(a, b);
    return { score, label: l.label };
  }).filter(Boolean);

  const thresholds = [0.95, 0.92, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60];
  console.log("Evaluation Results:");
  for (const t of thresholds) {
    const tp = pairs.filter((p) => p.score >= t && p.label === 1).length;
    const fp = pairs.filter((p) => p.score >= t && p.label === 0).length;
    const fn = pairs.filter((p) => p.score < t && p.label === 1).length;
    const tn = pairs.filter((p) => p.score < t && p.label === 0).length;

    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1 = precision > 0 && recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    console.log({
      threshold: t.toFixed(2),
      precision: precision.toFixed(4),
      recall: recall.toFixed(4),
      f1: f1.toFixed(4),
      tp,
      fp,
      fn,
      tn,
    });
  }
} catch (error: any) {
    if (error.code === 'ENOENT') {
        console.error("Error: Make sure 'rows.json' and 'labels.json' exist in the project root directory.");
    } else {
        console.error("An error occurred:", error.message);
    }
}
