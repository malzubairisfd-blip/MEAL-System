
import { ai } from '@/ai/genkit';
import type { RecordRow } from '@/lib/types';

export async function generateClusterDescription(
  input: { cluster: RecordRow[] }
): Promise<{ description: string }> {

  const cluster = input.cluster.map(r => ({
    womanName: r.womanName ?? '',
    husbandName: r.husbandName ?? '',
    nationalId: r.nationalId ?? '',
    phone: r.phone ?? '',
    village: r.village ?? '',
    children: Array.isArray(r.children) ? r.children : [],
  }));

  const prompt = `
أنت مساعد تدقيق بيانات.

حلل السجلات التالية وحدد سبب تجميعها كمجموعة واحدة.

ركز على:
- تشابه أسماء النساء
- تشابه أسماء الأزواج
- تشابه اسم الأب والجد
- اختلافات التهجئة البسيطة
- أرقام الهوية أو الهاتف إن وجدت

اختم بقرار واضح:
- "تكرار مؤكد"
- "اشتباه تكرار"
- "غير مكرر"

أجب باللغة العربية فقط.

السجلات:
${JSON.stringify(cluster, null, 2)}
`;

  try {
    const res = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 400,
      },
    });

    const text = res.text;
    return {
      description: text || 'لم يتمكن الذكاء الاصطناعي من إنشاء ملخص.',
    };
  } catch (e: any) {
    console.error('AI ERROR FULL:', e);
    // Re-throw the error so the API route can catch it and send an error event
    throw new Error(`AI generation failed: ${e?.message || 'Unknown error'}`);
  }
}
