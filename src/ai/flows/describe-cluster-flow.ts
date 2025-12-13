'use server';

import { ai } from '@/ai/genkit';
import type { RecordRow } from '@/lib/types';

/**
 * Server action: generateClusterDescription
  *
   * - Samples/clamps very large clusters to keep payload size reasonable.
    * - Normalizes record shape to the fields we care about.
     * - Builds an Arabic prompt and asks the ai client for a concise Arabic description
      *   including a final decision ("تكرار مؤكد" | "اشتباه تكرار" | "غير مكرر").
       *
        * Returns: { description: string } (Arabic)
         */
         export async function generateClusterDescription(
           input: { cluster: RecordRow[] }
           ): Promise<{ description: string }> {
             const MAX_RECORDS = 40; // tune to your token limits / cost
               const clusterRows = Array.isArray(input.cluster) ? input.cluster : [];

                 // If the cluster is very large, sample deterministically by taking first N.
                   const sampled = clusterRows.slice(0, MAX_RECORDS).map((r) => ({
                       womanName: r.womanName ?? '',
                           husbandName: r.husbandName ?? '',
                               nationalId: r.nationalId ?? '',
                                   phone: r.phone ?? '',
                                       village: r.village ?? '',
                                           children: Array.isArray(r.children) ? r.children : [],
                                               // optionally include other small normalized fields if helpful
                                                 }));

                                                   const meta = {
                                                       originalCount: clusterRows.length,
                                                           usedCount: sampled.length,
                                                             };

                                                               // Build safe prompt. Avoid embedding unnecessary huge structures.
                                                                 const prompt = `
                                                                 أنت مساعد تدقيق بيانات مُدَرَّب على اكتشاف التكرارات والاشتباكات بين السجلات.

                                                                 المطلوب:
                                                                 - حلل السجلات المقدمة وأعطِ ملخصًا مختصرًا باللغة العربية يوضح أسباب تجميعها كمجموعة واحدة.
                                                                 - ركز على:
                                                                   - تشابه أسماء النساء
                                                                     - تشابه أسماء الأزواج
                                                                       - تشابه اسم الأب والجد (إن وجد)
                                                                         - اختلافات التهجئة البسيطة
                                                                           - أرقام الهوية أو الهاتف إن وجدت
                                                                           - اذكر أمثلة قصيرة من السجلات تدعم استنتاجك (بحد أقصى 3 أمثلة).
                                                                           - أختم بقرار واضح من بين الخيارات التالية: "تكرار مؤكد", "اشتباه تكرار", "غير مكرر".
                                                                           - أجب باللغة العربية فقط، وبنبرة عملية ومباشرة، لا تزيد عن ~300 كلمة.

                                                                           معلومات حول العينة المرسلة:
                                                                           ${JSON.stringify(meta, null, 2)}

                                                                           السجلات (العينة المستخدمة):
                                                                           ${JSON.stringify(sampled, null, 2)}
                                                                           `;

                                                                             try {
                                                                                 const res = await ai.generate({
                                                                                       model: process.env.GENKIT_MODEL ?? 'googleai/gemini-1.5-flash-latest',
                                                                                             prompt,
                                                                                                   config: {
                                                                                                           temperature: 0.2,
                                                                                                                   maxOutputTokens: 500,
                                                                                                                           // forward other model-specific options as needed
                                                                                                                                   ...(undefined as any),
                                                                                                                                         },
                                                                                                                                               // optional: you can include additional flags in the wrapper if needed
                                                                                                                                                   });

                                                                                                                                                       const text = (res && typeof res.text === 'string' && res.text.trim())
                                                                                                                                                             ? res.text.trim()
                                                                                                                                                                   : 'لم يتمكن الذكاء الاصطناعي من إنشاء ملخص.';

                                                                                                                                                                       // Optionally sanitize or enforce the final decision presence
                                                                                                                                                                           // If the model didn't include one of the required labels, append "اشتباه تكرار" as fallback.
                                                                                                                                                                               const finalLabels = ['تكرار مؤكد', 'اشتباه تكرار', 'غير مكرر'];
                                                                                                                                                                                   const hasLabel = finalLabels.some((lbl) => text.includes(lbl));
                                                                                                                                                                                       const description = hasLabel ? text : `${text}\n\nالقرار: اشتباه تكرار`;

                                                                                                                                                                                           return { description };
                                                                                                                                                                                             } catch (e: any) {
                                                                                                                                                                                                 console.error('AI summary error:', e);
                                                                                                                                                                                                     return {
                                                                                                                                                                                                           description: 'حدث خطأ أثناء توليد ملخص الذكاء الاصطناعي.',
                                                                                                                                                                                                               };
                                                                                                                                                                                                                 }
                                                                                                                                                                                                                 }