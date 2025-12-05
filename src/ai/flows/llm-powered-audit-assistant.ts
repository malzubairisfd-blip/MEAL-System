// src/ai/flows/llm-powered-audit-assistant.ts
'use server';

/**
 * @fileOverview LLM-powered audit assistant for generating descriptions of potential duplicate clusters.
 *
 * - generateClusterDescription - A function that generates a description for a given cluster.
 * - ClusterDescriptionInput - The input type for the generateClusterDescription function.
 * - ClusterDescriptionOutput - The return type for the generateClusterDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClusterDescriptionInputSchema = z.object({
  cluster: z.array(
    z.object({
      womanName: z.string().describe('Woman\s name'),
      husbandName: z.string().describe('Husband\s name'),
      nationalId: z.string().describe('National ID'),
      phone: z.string().describe('Phone number'),
      village: z.string().describe('Village name'),
      subdistrict: z.string().describe('Subdistrict name'),
      children: z.array(z.string()).describe('List of children'),
    })
  ).describe('A cluster of potentially duplicate records.'),
});

export type ClusterDescriptionInput = z.infer<typeof ClusterDescriptionInputSchema>;

const ClusterDescriptionOutputSchema = z.object({
  description: z.string().describe('A detailed description of the cluster, including potential connections and anomalies.'),
});

export type ClusterDescriptionOutput = z.infer<typeof ClusterDescriptionOutputSchema>;

export async function generateClusterDescription(input: ClusterDescriptionInput): Promise<ClusterDescriptionOutput> {
  return generateClusterDescriptionFlow(input);
}

const generateClusterDescriptionPrompt = ai.definePrompt({
  name: 'generateClusterDescriptionPrompt',
  input: {schema: ClusterDescriptionInputSchema},
  output: {schema: ClusterDescriptionOutputSchema},
  model: 'gemini-1.5-pro-latest',
  prompt: `You are an AI assistant helping a reviewer understand potential duplicate clusters of beneficiary records.

  Your task is to generate a concise description of the cluster IN ARABIC, highlighting potential connections, shared household members, and any anomalies that might indicate duplication or fraud.
  Reason if it is appropriate to include potentially identifying personal information to contextualize the records in question.

  Here is the cluster data:
  {{#each cluster}}
  - Woman: {{womanName}}, Husband: {{husbandName}}, ID: {{nationalId}}, Phone: {{phone}}, Village: {{village}}, Subdistrict: {{subdistrict}}, Children: {{children}}
  {{/each}}

  Description:`,
});

const generateClusterDescriptionFlow = ai.defineFlow(
  {
    name: 'generateClusterDescriptionFlow',
    inputSchema: ClusterDescriptionInputSchema,
    outputSchema: ClusterDescriptionOutputSchema,
  },
  async input => {
    const {output} = await generateClusterDescriptionPrompt(input);
    return output!;
  }
);
