import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // Specify the model directly in the plugin configuration.
      model: 'gemini-1.5-flash-latest',
    }),
  ],
});
