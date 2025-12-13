
'use server';

/**
 * @fileOverview An AI flow to describe why a cluster of records might be duplicates.
 * This has been refactored to a simple async function for stability.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { RecordRow } from '@/lib/types';
import { jsonStringify } from 'genkit/util';

// Define the input schema for a single record, to be used in an array
const RecordSchema = z.object({
    _internalId: z.string().optional(),
    womanName: z.string().optional(),
    husbandName: z.string().optional(),
    nationalId: z.string().optional(),
    phone: z.string().optional(),
    village: z.string().optional(),
    children: z.array(z.string()).optional(),
});

// Define the input schema for the flow, which is an array of records
const DescribeClusterInputSchema = z.object({
  cluster: z.array(RecordSchema),
});
type DescribeClusterInput = z.infer<typeof DescribeClusterInputSchema>;

// Define the output schema for the flow
const DescribeClusterOutputSchema = z.object({
  description: z.string().describe("A concise summary in Arabic explaining why these records were likely grouped together. Focus on key similarities and differences, and conclude with a recommendation on whether to investigate further."),
});
type DescribeClusterOutput = z.infer<typeof DescribeClusterOutputSchema>;


/**
 * Analyzes a cluster of records and generates a summary in Arabic.
 * @param input An object containing the cluster of records.
 * @returns A promise that resolves to an object with the description.
 */
export default async function generateClusterDescription(
  input: { cluster: RecordRow[] }
): Promise<{ description: string }> {

  const { cluster } = input;

  // Sanitize input to ensure children is always an array
  const validatedCluster = cluster.map(record => ({
      ...record,
      children: Array.isArray(record.children) ? record.children : (record.children ? String(record.children).split(/[;,|،]/) : [])
  }));
  
  const promptTemplate = `
حلل السجلات التالية وحدد سبب تجميعها كمجموعة واحدة.
ركز على:
- تشابه الأسماء
- تشابه أسماء الأزواج
- تشابه النسب---
- تشابه أرقام الهواتف
- تشابه بأرقام الهويه
- أي اختلافات طفيفة في التهجئة
- اهم النتائج والتي تتكون من تكرار او اشتباه تكرار او ليست 
تكرار وهل الحاله تحتاج إلى تحقق ميداني ام لا

أجب باللغة العربية فقط.

Here are the records:
{{{jsonStringify cluster}}}
`;

  try {
    const { text } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
        prompt: promptTemplate,
        promptParams: { cluster: validatedCluster },
        helpers: { jsonStringify },
    });

    if (!text) {
        return { description: "لم يتمكن الذكاء الاصطناعي من إنشاء ملخص لهذه المجموعة." };
    }
    
    return { description: text };

  } catch(e: any) {
    console.error("Error calling AI model:", e);
    return { description: "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي." };
  }
}
