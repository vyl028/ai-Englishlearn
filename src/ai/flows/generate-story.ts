'use server';

import { generateJsonArray } from '@/ai/llm';
import {
  GenerateStoryInput,
  GenerateStoryInputSchema,
  GenerateStoryOutput,
  GenerateStoryOutputSchema,
} from '@/lib/types';

export async function generateStory(
  input: GenerateStoryInput,
  options?: { signal?: AbortSignal }
): Promise<GenerateStoryOutput> {
  GenerateStoryInputSchema.parse(input);

  const wordsToInclude = input.words.map(w => `- ${w.word} (${w.partOfSpeech}): ${w.definition}`).join('\n');

  const systemPrompt = `You are an expert English storyteller writing for a Grade 9 student in mainland China.
Your task is to write a short, engaging story that incorporates all of the following English words.
The story's difficulty should be appropriate for a junior high school student (Grade 9).
After writing the story, you MUST provide a title for it and a complete Chinese translation.
Your output MUST be a single, valid JSON object containing "title", "story", and "translation" fields.`;

  const userPrompt = `Words to include:\n${wordsToInclude}\n\nGenerate the story now.`;

  const data = await generateJsonArray<GenerateStoryOutput>({
    systemPrompt,
    userPrompt,
    signal: options?.signal,
    schemaHint: 'Return ONLY a valid JSON object with "title", "story", and "translation" fields, no markdown, no commentary.'
  });

  return GenerateStoryOutputSchema.parse(data);
}
