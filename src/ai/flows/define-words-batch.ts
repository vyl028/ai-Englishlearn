'use server';

/**
 * @fileOverview Define multiple English words in one request and return Chinese definitions + optional compact enrichment.
 */

import { generateJsonArray } from '@/ai/llm';
import {
  DefineWordsBatchInput,
  DefineWordsBatchInputSchema,
  DefineWordsBatchOutput,
  DefineWordsBatchOutputSchema,
} from '@/lib/types';

export async function defineWordsBatch(input: DefineWordsBatchInput): Promise<DefineWordsBatchOutput> {
  const parsed = DefineWordsBatchInputSchema.parse(input);

  const systemPrompt = `You are an expert bilingual lexicographer and English teacher.
You provide accurate, concise learning content for Chinese learners.
You must output valid JSON only (no markdown, no extra commentary).`;

  const userPrompt = `Define the following English words for learning.

Input words (JSON):
${JSON.stringify(parsed.words)}

Return ONLY a JSON array with the SAME LENGTH and SAME ORDER as the input array.
Each element must have:
{
  "word": string,
  "partOfSpeech": string,
  "definition": string,
  "enrichment"?: {
    "collocations": [{"phrase": string, "meaningZh"?: string, "exampleEn"?: string, "exampleZh"?: string}],
    "synonyms": string[],
    "antonyms": string[],
    "examples": [{"en": string, "zh": string}],
    "level": {"cefr"?: "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"Unknown", "usageZh"?: string}
  }
}

Rules:
- Keep it compact to save tokens:
  - collocations: 2-3
  - synonyms/antonyms: 2-3 each
  - examples: 1-2 short natural sentences with Chinese translation
  - usageZh: <= 80 Chinese characters
- definition: concise Chinese dictionary-style definition (no markdown).
- Do NOT change the order.
- Do NOT add extra items.`;

  const data = await generateJsonArray<DefineWordsBatchOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY valid JSON array. No markdown. No extra keys.',
  });

  const out = DefineWordsBatchOutputSchema.parse(data);
  if (out.length !== parsed.words.length) {
    throw new Error(`Model returned ${out.length} items, expected ${parsed.words.length}.`);
  }
  return out.map((w) => ({
    ...w,
    word: String(w.word || '').trim(),
    partOfSpeech: String(w.partOfSpeech || '').trim(),
    definition: String(w.definition || '').trim(),
  }));
}

