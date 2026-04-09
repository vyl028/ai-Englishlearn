'use server';

/**
 * @fileOverview Define an English term without requiring a preset part of speech.
 * The model should return one or more entries split by part of speech.
 */

import { generateJson, generateText } from '@/ai/llm';
import {
  DefineTermAutoInput,
  DefineTermAutoInputSchema,
  DefineTermAutoOutput,
  DefineTermAutoOutputSchema,
} from '@/lib/types';

export async function defineTermAuto(input: DefineTermAutoInput): Promise<DefineTermAutoOutput> {
  DefineTermAutoInputSchema.parse(input);

  // 简化提示词，加速响应
  const systemPrompt = `You are a bilingual lexicographer. Provide accurate, concise learning content for Grade 9 students in China. Output valid JSON only.`;

  const userPrompt = `Term: ${input.term}

Return a JSON array of 1-3 objects (common parts of speech only):
{
  "word": string,
  "partOfSpeech": "noun"|"verb"|"adjective"|"adverb"|"phrase",
  "definition": string,
  "enrichment": {
    "collocations": [{"phrase": string, "meaningZh"?: string}],
    "synonyms": string[],
    "antonyms": string[],
    "examples": [{"en": string, "zh": string}],
    "level": {"cefr"?: "A1"-"C2"|"Unknown", "usageZh"?: string}
  }
}

Rules:
- Phrases (with whitespace) return single item with partOfSpeech "phrase"
- Only common senses; omit rare usages
- definition: concise Chinese dictionary-style
- collocations: 2-3 items
- synonyms/antonyms: 2-3 items each
- examples: 1-2 short sentences
- usageZh: <= 80 Chinese characters
- Omit empty enrichment fields`;

  try {
    const data = await generateJson<DefineTermAutoOutput>({
      systemPrompt,
      userPrompt,
      image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
      schemaHint: 'Return ONLY valid compact JSON array. No markdown.',
      schema: DefineTermAutoOutputSchema,
    });

    return DefineTermAutoOutputSchema.parse(
      data.map((it) => ({
        ...it,
        word: String(it.word || '').trim(),
        partOfSpeech: String(it.partOfSpeech || '').trim(),
        definition: String(it.definition || '').trim(),
      }))
    );
  } catch (e: any) {
    console.error('[defineTermAuto] Generation failed:', e?.message || e);
  }

  // Fallback: definition-only
  const trimmed = String(input.term || '').trim();
  const fallbackPos = /\s/.test(trimmed) ? 'phrase' : 'noun';
  const fallbackSystemPrompt = 'Provide a concise Chinese definition for the English term.';
  const fallbackUserPrompt = `Term: ${trimmed}\nProvide a concise Chinese definition only.`;
  const text = await generateText({
    systemPrompt: fallbackSystemPrompt,
    userPrompt: fallbackUserPrompt,
    image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
  });

  return DefineTermAutoOutputSchema.parse([
    {
      word: trimmed,
      partOfSpeech: fallbackPos,
      definition: String(text || '').trim(),
    },
  ]);
}
