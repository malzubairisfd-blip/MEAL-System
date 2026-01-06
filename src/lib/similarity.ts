
// src/lib/similarity.ts

export const jaroWinkler = (a: string, b: string) => {
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
};


export function alignLineage(arr: string[], targetLength: number): string[] {
  if (arr.length >= targetLength) {
    return arr;
  }
  const result = [...arr];
  while (result.length < targetLength) {
    result.push(""); // Pad with empty strings
  }
  return result;
}

export const collapseDuplicateAncestors = (parts: string[]) => {
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === 0 || parts[i] !== parts[i - 1]) {
      out.push(parts[i]);
    }
  }
  return out;
};

export function tokenJaccard(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

export function nameOrderFreeScore(aTokens: string[], bTokens: string[]) {
    if (!aTokens.length || !bTokens.length) return 0;
    const jacc = tokenJaccard(aTokens, bTokens);
    const aSorted = aTokens.slice().sort().join(" ");
    const bSorted = bTokens.slice().sort().join(" ");
    const sj = jaroWinkler(aSorted, bSorted);
    return 0.7 * jacc + 0.3 * sj;
}
