'use server';

/**
 * @fileOverview Review an IELTS Writing Task 2 essay and return structured feedback:
 * - Band scores (TR/CC/LR/GRA) + overall
 * - Issues (grammar/spelling/tense/logic/...)
 * - Suggestions + example sentences
 * - Revised essay text (English)
 * - Before/after key rewrites
 */

import { generateJsonArray } from '@/ai/llm';
import {
  ReviewEssayInput,
  ReviewEssayInputSchema,
  ReviewEssayOutput,
  ReviewEssayOutputSchema,
} from '@/lib/types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

function normalizeBand(raw: unknown) {
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(num)) return 0;
  return clamp(roundToHalf(num), 0, 9);
}

export async function reviewEssay(input: ReviewEssayInput): Promise<ReviewEssayOutput> {
  const parsed = ReviewEssayInputSchema.parse(input);

  const systemPrompt = `You are an IELTS Writing Task 2 examiner and an English writing coach for Chinese learners.
You must return valid JSON only (no markdown, no extra commentary).
Feedback language: Chinese (简体中文). Essay text and rewrite snippets: English.`;

  const userPrompt = `IELTS Writing Task 2 prompt (optional, English):
${parsed.taskPrompt ? parsed.taskPrompt.trim() : '(none)'}

Essay (English):
${parsed.text.trim()}

Return ONE JSON object with this shape:
{
  "kind": "ielts_task2_review",
  "scores": {
    "taskResponse": number,
    "coherenceCohesion": number,
    "lexicalResource": number,
    "grammaticalRangeAccuracy": number,
    "overallBand": number
  },
  "overallBand": number,
  "level": { "cefr": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"Unknown", "commentZh"?: string },
  "summaryZh": string,
  "strengthsZh": string[],
  "weaknessesZh": string[],
  "issues": [
    {
      "category": "grammar"|"spelling"|"tense"|"logic"|"coherence"|"task_response"|"word_choice"|"punctuation"|"style"|"other",
      "original"?: string,
      "suggestion": string,
      "explanationZh": string,
      "exampleEn"?: string,
      "exampleZh"?: string,
      "severity"?: "low"|"medium"|"high"
    }
  ],
  "beforeAfter": [
    { "before": string, "after": string, "reasonZh"?: string }
  ],
  "revisedTextEn": string
}

Rules:
- Score scale: 0 to 9, allow 0.5 steps.
- overallBand MUST be the average of the four criteria, rounded to nearest 0.5.
- Detect and explain: grammar, spelling, tense, and logic/coherence issues when present.
- Provide 8-20 issues; avoid duplicates; prefer actionable items.
- Provide 6-10 beforeAfter pairs (impactful changes).
- revisedTextEn: rewrite the whole essay to improve task response, coherence, and accuracy, while preserving the original meaning; keep clear paragraphing.
- Return JSON only.`;

  const data = await generateJsonArray<ReviewEssayOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys.',
  });

  const out = ReviewEssayOutputSchema.parse(data);
  const scores = out.scores;

  const tr = normalizeBand(scores.taskResponse);
  const cc = normalizeBand(scores.coherenceCohesion);
  const lr = normalizeBand(scores.lexicalResource);
  const gra = normalizeBand(scores.grammaticalRangeAccuracy);
  const overall = roundToHalf((tr + cc + lr + gra) / 4);

  return ReviewEssayOutputSchema.parse({
    ...out,
    overallBand: overall,
    scores: {
      taskResponse: tr,
      coherenceCohesion: cc,
      lexicalResource: lr,
      grammaticalRangeAccuracy: gra,
      overallBand: overall,
    },
  });
}

