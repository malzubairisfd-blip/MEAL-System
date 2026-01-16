// Mapping for Arabic characters to their contextual forms (Isolated, End, Middle, Beginning)
const ARABIC_MAPPING: Record<string, string[]> = {
  'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], 'أ': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'],
  'ب': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'], 'ت': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
  'ث': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'], 'ج': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
  'ح': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'], 'خ': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
  'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], 'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'],
  'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], 'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'],
  'س': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'], 'ش': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
  'ص': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'], 'ض': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
  'ط': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'], 'ظ': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFECB'],
  'ع': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'], 'غ': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
  'ف': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'], 'ق': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
  'ك': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'], 'ل': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
  'م': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'], 'ن': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
  'ه': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'], 'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'],
  'ي': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'], 'ى': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'],
  'ة': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], 'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'],
  'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'], 'إ': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'],
  'ئ': ['\uFE89', '\uFE8A', '\uFE8C', '\uFE8B'], 'ؤ': ['\uFE85', '\uFE86', '\uFE85', '\uFE86']
};

/**
 * Checks if the character connects to the left
 */
const connectsLeft = (char: string) => !['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ة', 'ء'].includes(char);

export function fixArabicPDFText(text: string): string {
  if (!text) return "";
  
  const chars = Array.from(text);
  let reshaped = "";

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const map = ARABIC_MAPPING[char];

    if (!map) {
      reshaped += char;
      continue;
    }

    const prev = chars[i - 1];
    const next = chars[i + 1];

    const hasPrev = prev && ARABIC_MAPPING[prev] && connectsLeft(prev);
    const hasNext = next && ARABIC_MAPPING[next];

    if (hasPrev && hasNext) reshaped += map[2]; // Middle
    else if (hasPrev) reshaped += map[1];       // End
    else if (hasNext) reshaped += map[3];       // Beginning
    else reshaped += map[0];                    // Isolated
  }

  // Reverse the string for RTL in a LTR environment (like jsPDF)
  return reshaped.split("").reverse().join("");
}
