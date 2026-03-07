'use server';

import { generateJsonArray } from '@/ai/llm';
import {
  GeneratePracticeInput,
  GeneratePracticeInputSchema,
  GeneratePracticeOutput,
  GeneratePracticeOutputSchema,
} from '@/lib/types';

function pickString(...values: any[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

function buildFallbackPromptEn(q: any): string {
  const word = typeof q?.word === 'string' && q.word.trim() ? q.word.trim() : 'the word';
  switch (q?.type) {
    case 'fill_blank':
      return `Fill in the blank with the correct form of "${word}".`;
    case 'reorder':
      return `Reorder the parts to make a correct sentence using "${word}".`;
    case 'mcq':
      return `Choose the best answer for "${word}".`;
    default:
      return `Practice question about "${word}".`;
  }
}

function coercePracticeOutput(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;

  return raw.map((q: any) => {
    if (!q || typeof q !== 'object') return q;
    const next: any = { ...q };

    if (typeof next.word !== 'string') next.word = pickString(q.word, q.targetWord, q.target) || '';

    if (typeof next.promptEn !== 'string' || !next.promptEn.trim()) {
      next.promptEn =
        pickString(
          q.promptEn,
          q.prompt,
          q.question,
          q.questionEn,
          q.prompt_en,
          q.promptEN,
          q.promptEnglish,
        ) || buildFallbackPromptEn(next);
    }

    if (typeof next.analysisZh !== 'string' || !next.analysisZh.trim()) {
      next.analysisZh = pickString(q.analysisZh, q.analysis, q.explanationZh, q.explainZh) || '（AI 未返回解析）';
    }
    if (typeof next.grammarZh !== 'string' || !next.grammarZh.trim()) {
      next.grammarZh = pickString(q.grammarZh, q.grammar, q.grammarNotesZh) || '（AI 未返回语法讲解）';
    }
    if (typeof next.usageZh !== 'string' || !next.usageZh.trim()) {
      next.usageZh = pickString(q.usageZh, q.usage, q.usageNotesZh) || '（AI 未返回用法讲解）';
    }

    return next;
  });
}

export async function generatePractice(input: GeneratePracticeInput): Promise<GeneratePracticeOutput> {
  GeneratePracticeInputSchema.parse(input);

  const wordsToTest = input.words
    .map(w => `- ${w.word} (${w.partOfSpeech}): ${w.definition}`)
    .join('\n');

  const systemPrompt = `You are an expert English teacher and exam designer for a Grade 9 student in mainland China.
You create high-quality practice questions for vocabulary learning.
All prompts and sentences must be natural English.
All explanations must be Simplified Chinese.
You MUST output valid JSON only (no markdown, no extra commentary).`;

  const userPrompt = `Create practice questions for the following words:
\n${wordsToTest}
\n
Return ONLY a JSON array. For EACH word, generate EXACTLY 3 questions in this order:
1) type="mcq" (multiple-choice)
2) type="fill_blank" (fill in the blank)
3) type="reorder" (sentence reordering)
\n
Each question object MUST include:
- "type": "mcq" | "fill_blank" | "reorder"
- "word": string (the target word)
- "promptEn": string (REQUIRED for ALL types; for fill_blank/reorder this should be a short instruction, not the sentence itself)
- "analysisZh": string (detailed explanation, include why correct and why wrong where relevant)
- "grammarZh": string (grammar points used in the question/sentence)
- "usageZh": string (vocabulary usage notes: collocations, register, common mistakes)
\n
For type="mcq":
- "options": array of 4 strings
- "answerIndex": integer 0..3
\n
For type="fill_blank":
- "sentenceEn": an English sentence containing a blank placeholder "____" where the answer should go
- "acceptableAnswers": array of acceptable answers (include common variants if reasonable)
\n
For type="reorder":
- "parts": array of sentence parts (6-10 parts is preferred)
- "correctOrder": array of indices that uses every index exactly once
- Optional: "answerSentenceEn" (full correct sentence) and "translationZh" (Chinese translation)
\n
Rules:
- The target word must appear in the correct answer for every question.
- Keep sentences short and appropriate for Grade 9.
- Avoid ambiguous reorder questions (must be uniquely solvable).
- Do not repeat the exact same sentence across different question types.
- Do NOT omit any required key. If unsure, still include the key with a best-effort value.`;

  const data = await generateJsonArray<GeneratePracticeOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY a valid JSON array of question objects, no markdown, no commentary.',
  });

  return GeneratePracticeOutputSchema.parse(coercePracticeOutput(data));
}
