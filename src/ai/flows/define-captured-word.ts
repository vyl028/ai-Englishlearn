'use server';

/**
 * @fileOverview Define a captured English word by providing its Chinese definition.
 */

import { generateText } from '@/ai/gemini';
import {
  DefineCapturedWordInput,
  DefineCapturedWordInputSchema,
  DefineCapturedWordOutput,
  DefineCapturedWordOutputSchema
} from '@/lib/types';

export async function defineCapturedWord(input: DefineCapturedWordInput): Promise<DefineCapturedWordOutput> {
  DefineCapturedWordInputSchema.parse(input);

  const systemPrompt = 'You are an assistant that provides precise bilingual dictionary style Chinese definitions for English words.';
  const userPrompt = `Word: ${input.word}\nPart of Speech: ${input.partOfSpeech}\nProvide a concise Chinese definition. Output only the definition sentence(s).`;

  const text = await generateText({
    systemPrompt,
    userPrompt,
    image: input.photoDataUri ? { dataUri: input.photoDataUri } : undefined,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  });

  const definition = text.trim();
  return DefineCapturedWordOutputSchema.parse({ definition });
}
