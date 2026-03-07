'use server';

import { generateJsonArray } from '@/ai/gemini';
import {
  GenerateQuizInput,
  GenerateQuizInputSchema,
  GenerateQuizOutput,
  GenerateQuizOutputSchema,
} from '@/lib/types';

export async function generateQuiz(input: GenerateQuizInput): Promise<{ questions: GenerateQuizOutput }> {
  GenerateQuizInputSchema.parse(input);

  const wordsToTest = input.words.map(w => `- ${w.word} (${w.partOfSpeech}): ${w.definition}`).join('\n');

  const systemPrompt = `You are an expert English teacher creating a quiz for a Grade 9 student in mainland China.
Based on the following list of English words and their definitions, create one challenging multiple-choice question for each word.
The questions should test the student's understanding of the word's meaning and usage in context.
For each question, you MUST provide all of the following fields: "question", "options", "answer", "analysis", and "word".`;
  
  const userPrompt = `Words to test:\n${wordsToTest}\n\nGenerate the quiz questions now.`;

  const data = await generateJsonArray<GenerateQuizOutput>({
    systemPrompt,
    userPrompt,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    schemaHint: 'Return ONLY a valid JSON array of question objects, no markdown, no commentary.'
  });

  const parsedData = GenerateQuizOutputSchema.parse(data);
  return { questions: parsedData };
}