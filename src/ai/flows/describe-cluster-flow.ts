'use server';

/**
 * AI flow: Generates an Arabic explanation for why a cluster was grouped.
 * Hardened for production: retry, timeout, cache, deterministic prompt.
 */

import { ai } from '@/ai/genkit';
import type { RecordRow } from '@/lib/types';
import crypto from 'crypto';

/* -----------------------------
   Configuration
----------------------------- */
const MODEL = 'googleai/gemini-1.5-flash-latest';
const MAX_RETRIES = 2;
const TIMEOUT_MS = 12_000;

/* -----------------------------
   Simple in-memory cache
   (Replace with Redis / KV later if needed)
----------------------------- */
const summaryCache = new Map<string, string>();

/* -----------------------------
   Utilities
----------------------------- */

// Stable cluster hash (order-independent)
function clusterHash(cluster: RecordRow[]): string {
  const ids = cluster
    .map(r => r._internalId || '')
    .sort()
    .join('|');

  return crypto.createHash('sha1').update(ids).digest('hex');
}

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
    promise
      .then(v => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(err => {
        clearTimeout(t);
        reject(err);
      });
  });
}

// Retry wrapper
async function retry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/* -----------------------------
   Main Function
----------------------------- */
export default async function generateClusterDescription(
  input: { cluster: RecordRow[] }
): Promise<{ description: string }> {

  const { cluster } = input;
  if (!cluster || cluster.length === 0) {
    return { description: 'المجموعة فارغة ولا يمكن تحليلها.' };
  }

  // Normalize children field
  const normalizedCluster = cluster.map(r => ({
    ...r,
    children: Array.isArray(r.children)
      ? r.children
      : r.children
        ? String(r.children).split(/[;,|،]/).map(s => s.trim())
        : [],
  }));

  // Cache lookup
  const key = clusterHash(normalizedCluster);
  const cached = summaryCache.get(key);
  if (cached) {
    return { description: cached };
  }

  /* -----------------------------
     Optimized Arabic Prompt
  ----------------------------- */
  const prompt = `
أنت مدقق بيانات مختص باكتشاف السجلات المكررة.

حلل السجلات التالية وحدد سبب تجميعها في مجموعة واحدة.

يرجى الالتزام بالهيكل التالي في الإجابة:

1️⃣ **سبب التجميع**
- تشابه أسماء النساء
- تشابه أسماء الأزواج
- تشابه اسم الأب والجد
- تشابه أرقام الهواتف أو الهوية
- اختلافات بسيطة في التهجئة (إن وجدت)

2️⃣ **تقييم الحالة**
اختر أحد الخيارات فقط:
- تكرار مؤكد
- اشتباه تكرار
- ليست تكرار

3️⃣ **التوصية**
- هل الحالة تحتاج إلى تحقق ميداني؟ (نعم / لا) مع سبب مختصر.

⚠️ أجب باللغة العربية فقط.
⚠️ كن مختصرًا ودقيقًا.

السجلات:
${JSON.stringify(normalizedCluster, null, 2)}
`;

  try {
    const result = await retry(
      () =>
        withTimeout(
          ai.generate({
            model: MODEL,
            prompt,
          }),
          TIMEOUT_MS
        ),
      MAX_RETRIES
    );

    const text = result?.text?.trim();

    const finalText =
      text && text.length > 0
        ? text
        : 'لم يتمكن الذكاء الاصطناعي من توليد ملخص واضح لهذه المجموعة.';

    // Cache result
    summaryCache.set(key, finalText);

    return { description: finalText };

  } catch (error: any) {
    console.error('AI summary failed:', error);
    return {
      description:
        'تعذر إنشاء ملخص تلقائي لهذه المجموعة بسبب خطأ تقني. يوصى بالمراجعة اليدوية.',
    };
  }
}