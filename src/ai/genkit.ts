import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // Specify the model directly as a default for all generate calls.
      model: 'gemini-1.5-flash-latest',
    }),
  ],
});
