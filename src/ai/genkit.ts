// src/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // Specify the model, version, and other options if needed.
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
