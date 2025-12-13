
'use server';

/**
 * @fileOverview An AI flow to describe why a cluster of records might be duplicates.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { RecordRow } from '@/lib/types';

// Define the input schema for a single record, to be used in an array
const RecordSchema = z.object({
    womanName: z.string().optional(),
    husbandName: z.string().optional(),
    nationalId: z.string().optional(),
    phone: z.string().optional(),
    village: z.string().optional(),
    children: z.array(z.string()).optional(),
});

// Define the input schema for the flow, which is an array of records
export const DescribeClusterInputSchema = z.array(RecordSchema);
export type DescribeClusterInput = z.infer<typeof DescribeClusterInputSchema>;

// Define the output schema for the flow
export const DescribeClusterOutputSchema = z.object({
  summary: z.string().describe("A concise summary in Arabic explaining why these records were likely grouped together. Focus on key similarities and differences."),
});
export type DescribeClusterOutput = z.infer<typeof DescribeClusterOutputSchema>;


const prompt = ai.definePrompt({
  name: 'describeClusterPrompt',
  input: {schema: DescribeClusterInputSchema},
  output: {schema: DescribeClusterOutputSchema},
  prompt: `
You are an expert data analyst specializing in identifying duplicate entries in beneficiary lists.
You will be given a cluster of records as a JSON object.
Your task is to provide a concise summary in Arabic that explains why these records were likely grouped together.

Analyze the provided records and identify the key similarities (e.g., similar names, identical phone numbers, shared husband's name) and any notable differences.

Based on your analysis, generate a brief, easy-to-understand summary.

Here are the records:
{{{jsonStringify input}}}
`,
});


const describeClusterFlow = ai.defineFlow(
  {
    name: 'describeClusterFlow',
    inputSchema: DescribeClusterInputSchema,
    outputSchema: DescribeClusterOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      throw new Error("The model did not return a valid summary.");
    }
    
    return output;
  }
);


export async function describeCluster(cluster: RecordRow[]): Promise<DescribeClusterOutput> {
    // Map the incoming cluster data to match the Zod schema exactly.
    // CRITICAL: This sanitizes the `children` field, which can sometimes be a string instead of an array.
    const validatedInput = cluster.map(record => ({
        womanName: record.womanName,
        husbandName: record.husbandName,
        nationalId: String(record.nationalId || ''),
        phone: String(record.phone || ''),
        village: record.village,
        children: Array.isArray(record.children) ? record.children : (record.children ? String(record.children).split(/[;,|،]/) : [])
    }));

    return await describeClusterFlow(validatedInput);
}
