// src/workers/learning.worker.ts
import { preprocessRow } from '@/workers/preprocess';

function generateRuleCode(pattern: Record<string, number>): string {
  if (Object.keys(pattern).length === 0) {
      return `// No significant pattern found.`;
  }
  
  const lines: string[] = [];
  lines.push(`if (`);

  const getPart = (key: string, record: 'A' | 'B' | 'HA' | 'HB') => {
      const parts = key.split('_');
      const namePart = parts[1];
      switch(namePart) {
          case 'first': return `${record}[0]`;
          case 'father': return `${record}[1]`;
          case 'grandfather': return `${record}[2]`;
          case 'family': return `${record}[${record}.length - 1]`;
          default: return `''`;
      }
  }

  // Generate conditions based on the pattern, skipping scores below 0.7
  Object.entries(pattern).forEach(([key, score]) => {
      if (score < 0.70) return; // Skip scores below 70%

      // Use the actual score as the threshold, minus a small tolerance
      const threshold = (score - 0.02).toFixed(2);

      if (key.startsWith('woman_')) {
          lines.push(`  jw(${getPart(key, 'A')}, ${getPart(key, 'B')}) >= ${threshold} &&`);
      } else if (key.startsWith('husband_')) {
          lines.push(`  jw(${getPart(key, 'HA')}, ${getPart(key, 'HB')}) >= ${threshold} &&`);
      } else if (key === 'orderFree') {
          lines.push(`  nameOrderFreeScore(A, B) >= ${threshold} &&`);
      } else if (key === 'phone') {
          lines.push(`  (a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6)) &&`);
      } else if (key === 'children') {
          lines.push(`  tokenJaccard(a.children_normalized, b.children_normalized) >= ${threshold} &&`);
      }
  });

  // If all conditions were skipped, return an empty rule
  if (lines.length <= 1) {
    return `// No pattern strong enough to generate a rule (all scores < 0.70).`
  }


  // remove trailing &&
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ &&$/, "");
  
  lines.push(`) {`);
  lines.push(`  return { score: Math.min(1, minPair + 0.35), reasons: ["AUTO_LEARNED_STRUCTURAL"] };`);
  lines.push(`}`);

  return lines.join("\n");
}


self.onmessage = async (event: MessageEvent) => {
  const { records, mapping, pattern } = event.data;

  if (!Array.isArray(records) || records.length < 2) {
    postMessage({
      error: "A failure cluster must contain at least two records."
    });
    return;
  }
  
  if (!pattern || Object.keys(pattern).length === 0) {
      postMessage({ error: "Could not detect a valid pattern from the selected records." });
      return;
  }

  try {
    const code = generateRuleCode(pattern);

    const newRule = {
      id: `AUTO_RULE_${Date.now()}`,
      code,
      params: pattern,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // Send the generated rule back to the main thread for confirmation
    postMessage({ rule: newRule });

  } catch (error: any) {
    postMessage({
      error: error.message || String(error)
    });
  }
};
