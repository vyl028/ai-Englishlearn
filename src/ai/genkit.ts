import 'dotenv/config';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

/**
 * Deprecated path: The project now uses a direct Gemini SDK wrapper in `src/ai/gemini.ts`.
 * This Genkit instance is kept ONLY for backward compatibility / potential future flows.
 * New code should import helpers from `@/ai/gemini` instead of relying on `ai.definePrompt`.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});
