'use server';

/**
 * @fileOverview Extract English words (with part of speech) from an image and provide Chinese definitions.
 */

import { generateJsonArray } from '@/ai/gemini';
import {
  ExtractWordAndDefineInput,
  ExtractWordAndDefineInputSchema,
  ExtractWordAndDefineOutput,
  ExtractWordAndDefineOutputSchema
} from '@/lib/types';

export async function extractWordAndDefine(input: ExtractWordAndDefineInput): Promise<ExtractWordAndDefineOutput> {
  ExtractWordAndDefineInputSchema.parse(input);

  const systemPrompt = 'You are an OCR + bilingual lexicon expert. You read an image, list distinct English words with part of speech and give concise accurate Chinese definitions.';
  const userPrompt = `Analyze the image and return ONLY a JSON array. Each element: {"word": string, "partOfSpeech": string, "definition": string}. Avoid duplicates. If no valid English words, return [].`;

  const data = await generateJsonArray<{ word: string; partOfSpeech: string; definition: string; }[]>({
    systemPrompt,
    userPrompt,
    image: { dataUri: input.photoDataUri },
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    schemaHint: 'Return ONLY valid compact JSON array, no markdown, no commentary.'
  });

  return ExtractWordAndDefineOutputSchema.parse(data);
}
