'use server';

/**
 * @fileOverview Define an English term without requiring a preset part of speech.
 * The model should return one or more entries split by part of speech.
 */

import { generateJsonArray, generateText } from '@/ai/llm';
import {
  DefineTermAutoInput,
  DefineTermAutoInputSchema,
  DefineTermAutoOutput,
  DefineTermAutoOutputSchema,
} from '@/lib/types';

export async function defineTermAuto(input: DefineTermAutoInput): Promise<DefineTermAutoOutput> {
  DefineTermAutoInputSchema.parse(input);

  const systemPrompt = `You are an expert bilingual lexicographer and English teacher.
You provide accurate, concise learning content for a Grade 9 student in mainland China.
You must output valid JSON only.`;

  const userPrompt = `Target term: ${input.term}

Return ONLY a JSON array of 1-4 objects, each representing a common part of speech of the term.
Each object must have this shape:
{
  "word": string,
  "partOfSpeech": "noun"|"pronoun"|"verb"|"adjective"|"adverb"|"preposition"|"conjunction"|"interjection"|"phrase",
  "definition": string,
  "enrichment": {
    "collocations": [{"phrase": string, "meaningZh"?: string, "exampleEn"?: string, "exampleZh"?: string}],
    "synonyms": string[],
    "antonyms": string[],
    "examples": [{"en": string, "zh": string}],
    "level": {"cefr"?: "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"Unknown", "usageZh"?: string}
  }
}

Rules:
- If the term contains whitespace (a phrase), prefer returning a single item with partOfSpeech "phrase".
- Do not invent rare senses; include only common parts of speech used in real English.
- definition: concise Chinese dictionary-style definition (no markdown).
- collocations: 3-6 common collocations, keep short and practical.
- synonyms/antonyms: 3-6 items each, single words preferred.
- examples: 3-5 short natural English sentences that contain the target term, each with Chinese translation.
- usageZh: brief Chinese usage notes (patterns, common mistakes), <= 120 Chinese characters.
`;

  try {
    const data = await generateJsonArray<DefineTermAutoOutput>({
      systemPrompt,
      userPrompt,
      image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
      schemaHint:
        'Return ONLY valid JSON array. No markdown. No extra keys outside the specified object shape.',
    });

    const parsed = DefineTermAutoOutputSchema.safeParse(data);
    if (parsed.success) {
      return DefineTermAutoOutputSchema.parse(
        parsed.data.map((it) => ({
          ...it,
          word: String(it.word || '').trim(),
          partOfSpeech: String(it.partOfSpeech || '').trim(),
          definition: String(it.definition || '').trim(),
        }))
      );
    }

    console.warn('[defineTermAuto] Invalid JSON payload from model:', parsed.error?.message);
  } catch (e: any) {
    console.error('[defineTermAuto] Generation failed:', e?.message || e);
  }

  // Fallback: definition-only (best effort)
  const trimmed = String(input.term || '').trim();
  const fallbackPos = /\s/.test(trimmed) ? 'phrase' : 'noun';
  const fallbackSystemPrompt =
    'You are an assistant that provides precise bilingual dictionary style Chinese definitions for English words and phrases.';
  const fallbackUserPrompt = `Term: ${trimmed}\nPart of Speech: ${fallbackPos}\nProvide a concise Chinese definition. Output only the definition sentence(s).`;
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
