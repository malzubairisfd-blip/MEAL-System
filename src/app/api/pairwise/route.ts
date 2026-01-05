
import { NextResponse } from "next/server";
import type { RecordRow } from "@/lib/types";

export const runtime = "nodejs";

// --- START: Self-contained Scoring Logic ---

// Helper functions copied from the worker to make this endpoint self-sufficient.

function jaroWinkler(a: string, b: string) {
  const sanitizedA = String(a || "");
  const sanitizedB = String(b || "");
  if (!sanitizedA || !sanitizedB) return 0;
  if (sanitizedA === sanitizedB) return 1;

  const la = sanitizedA.length;
  const lb = sanitizedB.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aMatches = Array(la).fill(false);
  const bMatches = Array(lb).fill(false);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (sanitizedA[i] !== sanitizedB[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (sanitizedA[i] !== sanitizedB[k]) transpositions++;
    k++;
  }

  transpositions /= 2;
  const m = matches;
  const jaro = (m / la + m / lb + (m - transpositions) / m) / 3;

  let prefix = 0;
  const maxPrefix = Math.min(4, la, lb);
  for (let i = 0; i < maxPrefix; i++) {
    if (sanitizedA[i] === sanitizedB[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function totalAverageNameScore(
  a: RecordRow,
  b: RecordRow
): {
  womanAvg: number;
  husbandAvg: number;
  totalAvg: number;
} {
  const womanAvg = jaroWinkler(a.womanName!, b.womanName!);
  const husbandAvg = jaroWinkler(a.husbandName!, b.husbandName!);

  const totalAvg =
    0.45 * womanAvg +
    0.55 * husbandAvg;

  return {
    womanAvg,
    husbandAvg,
    totalAvg,
  };
}


// --- END: Self-contained Scoring Logic ---


export async function POST(req: Request) {
  try {
    const { cluster } = await req.json();

    if (!cluster || !Array.isArray(cluster) || cluster.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Invalid cluster data provided." },
        { status: 400 }
      );
    }

    const pairs = [];
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const recordA = cluster[i];
        const recordB = cluster[j];

        const result = totalAverageNameScore(recordA, recordB);
        
        pairs.push({
          a: recordA,
          b: recordB,
          score: result.totalAvg,
          breakdown: {
            nameScore: result.womanAvg,
            husbandScore: result.husbandAvg,
          }
        });
      }
    }
    
    // Sort pairs by score, descending
    pairs.sort((a,b) => b.score - a.score);

    return NextResponse.json({ ok: true, pairs });

  } catch (err: any) {
    console.error("Pairwise API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to process pairwise request.", details: err.message },
      { status: 500 }
    );
  }
}
