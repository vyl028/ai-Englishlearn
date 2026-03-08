'use server';

/**
 * @fileOverview Deep language analysis for an English article to support reading and learning:
 * - Structure analysis (paragraph main ideas, logical relations)
 * - Syntax highlights (clauses/tense/voice, etc.)
 * - Hard sentence breakdown and rewrites
 * - Keywords and core phrases
 * - Optional reading comprehension questions (Chinese-exam style MCQ)
 */

import { generateJsonArray } from '@/ai/llm';
import {
  StudyArticleInput,
  StudyArticleInputSchema,
  StudyArticleOutput,
  StudyArticleOutputSchema,
} from '@/lib/types';

export async function studyArticle(input: StudyArticleInput): Promise<StudyArticleOutput> {
  const parsed = StudyArticleInputSchema.parse(input);
  const includeQuestions = !!parsed.includeQuestions;
  const questionCount = parsed.questionCount ?? 6;

  const systemPrompt = `You are an English reading teacher for Chinese students.
You help students understand authentic English articles with clear, structured guidance.
You must output valid JSON only (no markdown, no extra commentary).
All explanations must be in Simplified Chinese. Keep quoted sentences and rewrites in English.`;

  const userPrompt = `Analyze the following English article for reading and learning.

Title (optional):
${parsed.title ? parsed.title.trim() : '(none)'}

Article text (English):
${parsed.text.trim()}

Return ONE JSON object with this shape:
{
  "kind": "article_study",
  "titleEn"?: string,
  "structure": {
    "overallMainIdeaZh": string,
    "outlineZh"?: string,
    "paragraphs": [
      {"index": number, "mainIdeaZh": string, "roleZh"?: string, "logicToPrevZh"?: string}
    ],
    "relations"?: [
      {"from": number, "to": number, "relationZh": string}
    ]
  },
  "syntax": {
    "overviewZh": string,
    "highlights"?: [
      {"sentenceEn": string, "pointsZh": string[]}
    ]
  },
  "hardSentences": [
    {
      "originalEn": string,
      "translationZh"?: string,
      "coreStructureEn"?: string,
      "tenseVoiceZh"?: string,
      "clauses"?: [{"clauseEn": string, "functionZh": string}],
      "explanationZh"?: string,
      "simplifiedEn"?: string,
      "rebuiltEn"?: string
    }
  ],
  "keywords": [
    {"term": string, "pos"?: string, "meaningZh": string, "noteZh"?: string, "exampleEn"?: string}
  ],
  "phrases"?: [
    {"phrase": string, "meaningZh": string, "noteZh"?: string, "exampleEn"?: string}
  ]${includeQuestions ? `,
  "questions": [
    {"questionEn": string, "options": [string, string, string, string], "answerIndex": number, "analysisZh": string, "locate"?: {"paragraphIndex"?: number, "quoteEn"?: string}}
  ]` : ''}
}

Rules:
- Structure:
  - Identify paragraphs by blank lines. If there are no blank lines, infer paragraph boundaries logically.
  - Provide up to 12 paragraphs.
  - logicToPrevZh should be specific (e.g., 转折/因果/递进/举例/对比/让步/总结).
  - relations is optional; include only if helpful (<= 10).
- Syntax:
  - overviewZh: concise teacher-style overview of major grammar/syntax features in this article.
  - highlights: 4-8 representative sentences from the text, each with 2-4 points covering clauses/tense/voice/modifiers.
- Hard sentences:
  - Pick 4-8 difficult but meaningful sentences from the text.
  - For each: explain the main clause skeleton (coreStructureEn), clause breakdown, tense/voice, and give 1 simplified rewrite and 1 rebuilt/rephrased rewrite in English.
  - Keep rewrites faithful to the original meaning.
- Keywords & phrases:
  - keywords: 10-16 important words (avoid very common function words). Prefer content words.
  - phrases: 6-12 core phrases/collocations.
  - Provide concise Chinese meaning and a short usage note when useful.
- Questions (only if requested):
  - Generate ${questionCount} reading comprehension questions in the style of Chinese exams.
  - Each question must have 4 options and exactly 1 correct answer.
  - Questions and options MUST be in English. analysisZh MUST be in Chinese.
  - Do NOT prefix options with letters like "A."/"B." (the UI will add them).
  - Cover a mix of: main idea, detail, inference, vocabulary-in-context, author attitude/purpose.
- Output JSON only. Do NOT include markdown.`;

  const data = await generateJsonArray<StudyArticleOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys.',
  });

  return StudyArticleOutputSchema.parse(data);
}

