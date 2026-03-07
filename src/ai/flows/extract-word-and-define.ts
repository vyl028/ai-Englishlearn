'use server';

/**
 * @fileOverview Extract English words (with part of speech) from an image and provide Chinese definitions.
 */

import { generateJsonArray } from '@/ai/llm';
import {
  ExtractWordAndDefineInput,
  ExtractWordAndDefineInputSchema,
  ExtractWordAndDefineOutput,
  ExtractWordAndDefineOutputSchema
} from '@/lib/types';

export async function extractWordAndDefine(input: ExtractWordAndDefineInput): Promise<ExtractWordAndDefineOutput> {
  ExtractWordAndDefineInputSchema.parse(input);

  const systemPrompt = `You are an OCR + bilingual lexicon expert.
You read an image, extract distinct English words, and provide concise Chinese learning content.
You must output valid JSON only.`;
  const userPrompt = `Analyze the image and return ONLY a JSON array.
Each element must have: {"word": string, "partOfSpeech": string, "definition": string, "enrichment"?: {...} }.

The "enrichment" object shape:
{
  "collocations": [{"phrase": string, "meaningZh"?: string, "exampleEn"?: string, "exampleZh"?: string}],
  "synonyms": string[],
  "antonyms": string[],
  "examples": [{"en": string, "zh": string}],
  "level": {"cefr"?: "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"Unknown", "usageZh"?: string}
}

Rules:
- Return at most 8 items (avoid noise).
- Avoid duplicates (case-insensitive).
- definition: concise Chinese dictionary-style definition.
- enrichment should be compact: collocations 2-4, synonyms/antonyms 2-4, examples 1-2, usageZh <= 80 Chinese characters.
- If no valid English words, return [].`;

  const data = await generateJsonArray<{ word: string; partOfSpeech: string; definition: string; }[]>({
    systemPrompt,
    userPrompt,
    image: { dataUri: input.photoDataUri },
    schemaHint: 'Return ONLY valid compact JSON array, no markdown, no commentary.'
  });

  return ExtractWordAndDefineOutputSchema.parse(data);
}
