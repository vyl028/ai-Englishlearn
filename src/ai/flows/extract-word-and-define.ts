'use server';

/**
 * @fileOverview Extract English words (with part of speech) from an image and provide Chinese definitions.
 */

import { generateJson } from '@/ai/llm';
import {
  ExtractWordAndDefineInput,
  ExtractWordAndDefineInputSchema,
  ExtractWordAndDefineOutput,
  ExtractWordAndDefineOutputSchema
} from '@/lib/types';

export async function extractWordAndDefine(input: ExtractWordAndDefineInput): Promise<ExtractWordAndDefineOutput> {
  ExtractWordAndDefineInputSchema.parse(input);

  // 简化提示词，减少token开销和响应时间
  const systemPrompt = `You are an OCR + bilingual lexicon expert. Extract distinct English words from images and provide concise Chinese definitions. Output valid JSON only.`;

  const userPrompt = `Analyze the image and return a JSON array of words.
Each element: {"word": string, "partOfSpeech": string, "definition": string, "enrichment": {...}}

enrichment fields (compact):
- collocations: 2-3 items with phrase, meaningZh, exampleEn, exampleZh
- synonyms: 2-3 words
- antonyms: 1-2 words
- examples: 1-2 items with en, zh
- level: {cefr: "A1"-"C2"|"Unknown", usageZh: max 60 chars}

Rules:
- Max 6 items (reduce noise)
- No duplicates (case-insensitive)
- definition: concise Chinese dictionary-style
- Omit empty fields`;

  const data = await generateJson<ExtractWordAndDefineOutput>({
    systemPrompt,
    userPrompt,
    image: { dataUri: input.photoDataUri },
    schemaHint: 'Return ONLY valid compact JSON array, no markdown.',
    schema: ExtractWordAndDefineOutputSchema,
  });

  return data;
}
