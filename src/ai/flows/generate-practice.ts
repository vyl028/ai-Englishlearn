'use server';

import { generateJsonArray } from '@/ai/llm';
import {
  GeneratePracticeInput,
  GeneratePracticeInputSchema,
  GeneratePracticeOutput,
  GeneratePracticeOutputSchema,
  PracticeQuestionType,
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
  switch (q?.type) {
    case 'fill_blank':
      return `Fill in the blank with the best answer.`;
    case 'reorder':
      return `Reorder the parts to make a correct sentence.`;
    case 'mcq':
      return `Choose the best answer to complete the sentence: ____`;
    default:
      return `Practice question.`;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildWordSlots(words: GeneratePracticeInput['words'], count: number) {
  if (!words || words.length === 0) return [];
  const shuffledWords = shuffle(words);
  if (count <= shuffledWords.length) return shuffledWords.slice(0, count);

  const out: typeof words = [];
  while (out.length < count) {
    out.push(...shuffle(words));
  }
  return out.slice(0, count);
}

function buildTypeSlots(allowedTypes: PracticeQuestionType[], count: number) {
  if (!allowedTypes || allowedTypes.length === 0) return [];

  const out: PracticeQuestionType[] = [];
  if (count >= allowedTypes.length) out.push(...allowedTypes);
  while (out.length < count) {
    out.push(allowedTypes[Math.floor(Math.random() * allowedTypes.length)]);
  }
  return shuffle(out).slice(0, count);
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

export async function generatePractice(
  input: GeneratePracticeInput,
  options?: { signal?: AbortSignal }
): Promise<GeneratePracticeOutput> {
  const parsed = GeneratePracticeInputSchema.parse(input);

  const questionCount = Math.min(30, Math.max(1, parsed.questionCount ?? 10));
  const allowedTypes: PracticeQuestionType[] = (parsed.allowedTypes && parsed.allowedTypes.length > 0)
    ? parsed.allowedTypes
    : ['mcq', 'fill_blank', 'reorder'];

  const glossary = parsed.words
    .map(w => `- ${w.word} (${w.partOfSpeech}): ${w.definition}`)
    .join('\n');

  const wordSlots = buildWordSlots(parsed.words, questionCount);
  const typeSlots = buildTypeSlots(allowedTypes, questionCount);
  const targets = shuffle(wordSlots.map((w, i) => ({ ...w, type: typeSlots[i] })));

  const systemPrompt = `You are an expert English teacher and exam designer for a Grade 9 student in mainland China.
You create high-quality vocabulary practice questions, and your MCQ questions resemble typical Chinese English exam multiple-choice cloze questions (single blank).
All prompts and sentences must be natural English.
All explanations must be Simplified Chinese.
You MUST output valid JSON only (no markdown, no extra commentary).`;

  const targetsText = targets
    .map((t, idx) => `${idx + 1}. type="${t.type}" word="${t.word}" (${t.partOfSpeech}): ${t.definition}`)
    .join('\n');

  const userPrompt = `Glossary (words you may use):
${glossary}

Now generate EXACTLY ${questionCount} practice questions, in the EXACT order of the targets below.
Targets:
${targetsText}

Return ONLY a JSON array with exactly ${questionCount} objects.
For each object, you MUST match the corresponding target's "type" and "word".

Each question object MUST include:
- "type": "mcq" | "fill_blank" | "reorder"
- "word": string (the target word)
- "promptEn": string (REQUIRED for ALL types; MUST NOT reveal or mention the target word; for fill_blank/reorder this should be a short generic instruction, not the sentence itself)
- "analysisZh": string (2-4 sentences, Simplified Chinese)
- "grammarZh": string (1-3 sentences, Simplified Chinese)
- "usageZh": string (1-3 sentences, include collocations/register/common mistakes)

For type="mcq":
- "promptEn": an exam-style stem (single sentence or short dialogue) containing EXACTLY ONE blank placeholder "____"
  - The stem MUST NOT include the target word (or any of its forms) anywhere outside the blank (no quotes/parentheses/hints).
- "options": array of 4 strings (single word or short phrase)
- "answerIndex": integer 0..3
\n
MCQ style examples (do NOT copy verbatim; create new contexts):
- promptEn: "Tom ____ to school by bike every day." options: ["go", "goes", "went", "going"]
- promptEn: "— I have two ____.\n— Really? What are their names?" options: ["cat", "cats", "cat's", "cats'"]

For type="fill_blank":
- "sentenceEn": an English sentence containing a blank placeholder "____" where the answer should go
- The sentence MUST NOT include the target word (or any of its forms) anywhere else besides the blank (no parentheses/hints).
- "acceptableAnswers": array of acceptable answers (include common variants if reasonable)

For type="reorder":
- "parts": array of sentence parts (6-10 parts preferred)
- "correctOrder": array of indices that uses every index exactly once
- Optional: "answerSentenceEn" (full correct sentence) and "translationZh" (Chinese translation)

Rules:
- The target word must appear in the correct answer for every question.
- Do NOT reveal the target word in any visible question text before answering (e.g., promptEn/sentenceEn). The target word may only appear in options/acceptableAnswers/parts as required by the question type.
- For type="mcq", do NOT use the style “Which sentence uses <word> correctly?”; instead, use Chinese-exam-style single-blank cloze questions.
- For type="mcq", the correct option MUST be the target word or its inflected form (tense/plural/comparative/etc). The other options should be plausible distractors (often other inflections or common confusions), with EXACTLY one correct.
- Keep sentences short and appropriate for Grade 9.
- If the same word appears multiple times, use different contexts.
- Avoid ambiguous reorder questions (must be uniquely solvable).
- Do NOT omit any required key. If unsure, still include the key with a best-effort value.`;

  const data = await generateJsonArray<GeneratePracticeOutput>({
    systemPrompt,
    userPrompt,
    signal: options?.signal,
    schemaHint: 'Return ONLY a valid JSON array of question objects, no markdown, no commentary.',
  });

  return GeneratePracticeOutputSchema.parse(coercePracticeOutput(data));
}
