'use server';

/**
 * @fileOverview Define a captured English word by providing its Chinese definition.
 */

import { generateJsonArray, generateText } from '@/ai/llm';
import {
  DefineCapturedWordInput,
  DefineCapturedWordInputSchema,
  DefineCapturedWordOutput,
  DefineCapturedWordOutputSchema
} from '@/lib/types';

export async function defineCapturedWord(input: DefineCapturedWordInput): Promise<DefineCapturedWordOutput> {
  DefineCapturedWordInputSchema.parse(input);

  const systemPrompt = `You are an expert bilingual lexicographer and English teacher.
You provide accurate, concise learning content for a Grade 9 student in mainland China.
You must output valid JSON only.`;

  const userPrompt = `Target word: ${input.word}
Part of speech: ${input.partOfSpeech}

Return a single JSON object with the following shape:
{
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
- definition: concise Chinese dictionary-style definition (no markdown).
- collocations: 3-6 common collocations, keep short and practical.
- synonyms/antonyms: 3-6 items each, single words preferred.
- examples: 3-5 short natural English sentences that contain the target word, each with Chinese translation.
- usageZh: brief Chinese usage notes (patterns, common mistakes), <= 120 Chinese characters.
`;

  try {
    const data = await generateJsonArray<DefineCapturedWordOutput>({
      systemPrompt,
      userPrompt,
      image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
      schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys outside the specified object.',
    });

    const parsed = DefineCapturedWordOutputSchema.safeParse(data);
    if (parsed.success) {
      const definition = parsed.data.definition.trim();
      return DefineCapturedWordOutputSchema.parse({
        ...parsed.data,
        definition,
      });
    }

    console.warn('[defineCapturedWord] Invalid JSON payload from model:', parsed.error?.message);
  } catch (e: any) {
    console.error('[defineCapturedWord] Enrichment generation failed:', e?.message || e);
  }

  // Fallback: definition-only (best effort)
  const fallbackSystemPrompt = 'You are an assistant that provides precise bilingual dictionary style Chinese definitions for English words.';
  const fallbackUserPrompt = `Word: ${input.word}\nPart of Speech: ${input.partOfSpeech}\nProvide a concise Chinese definition. Output only the definition sentence(s).`;
  const text = await generateText({
    systemPrompt: fallbackSystemPrompt,
    userPrompt: fallbackUserPrompt,
    image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
  });

  return DefineCapturedWordOutputSchema.parse({ definition: text.trim() });
}
