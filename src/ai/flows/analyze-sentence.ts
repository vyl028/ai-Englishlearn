'use server';

/**
 * @fileOverview Analyze an English sentence/paragraph and extract candidate vocabulary for learning.
 */

import { generateJsonArray } from '@/ai/llm';
import {
  AnalyzeSentenceInput,
  AnalyzeSentenceInputSchema,
  AnalyzeSentenceOutput,
  AnalyzeSentenceOutputSchema,
} from '@/lib/types';

function normalizeToken(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '');
}

export async function analyzeSentence(input: AnalyzeSentenceInput): Promise<AnalyzeSentenceOutput> {
  const parsed = AnalyzeSentenceInputSchema.parse(input);
  const maxCandidates = parsed.maxCandidates ?? 25;
  const withExplanation = !!parsed.withExplanation;

  const excludeSet = new Set(
    (parsed.excludeWords || [])
      .map((w) => normalizeToken(w))
      .filter(Boolean)
  );

  const systemPrompt = `You are an English teacher and vocabulary coach for Chinese learners.
You analyze an English sentence or paragraph and extract useful vocabulary to learn.
You must output valid JSON only (no markdown, no extra commentary).`;

  const userPrompt = `Text (English):
${parsed.text}

Return a single JSON object with this shape:
{
  "textEn": string,
  "candidateWords": [
    {"surface": string, "lemma"?: string, "partOfSpeech"?: string, "reasonZh"?: string}
  ]${withExplanation ? `,
  "translationZh": string,
  "grammarNotesZh": string` : ''}
}

Rules:
- "textEn": return the normalized English text you analyzed (keep punctuation; keep \\n if multiple lines).
- candidateWords:
  - Return at most ${maxCandidates} items.
  - Avoid duplicates (case-insensitive).
  - Focus on content words (nouns/verbs/adjectives/adverbs) and useful phrases; avoid very common function words.
  - Prefer lemma in lowercase (base form). If unsure, omit lemma.
  - partOfSpeech should be one of: noun, pronoun, verb, adjective, adverb, preposition, conjunction, interjection (best effort).
  - Do NOT include words in this exclude list (case-insensitive): ${JSON.stringify(Array.from(excludeSet).slice(0, 200))}
${withExplanation ? `- translationZh: concise natural Chinese translation.
- grammarNotesZh: concise Chinese grammar + usage notes for the whole sentence/paragraph (bullet points allowed, no markdown).` : `- Do NOT include translationZh or grammarNotesZh keys.`}
`;

  const data = await generateJsonArray<AnalyzeSentenceOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys outside the specified object.',
  });

  const out = AnalyzeSentenceOutputSchema.parse(data);

  // Post-process candidates: normalize, dedupe, exclude, and enforce limits.
  const seen = new Set<string>();
  const cleanedCandidates = (out.candidateWords || [])
    .map((c) => {
      const surface = String(c.surface || '').trim();
      const lemmaRaw = typeof c.lemma === 'string' ? c.lemma : surface;
      const lemma = normalizeToken(lemmaRaw);
      return {
        ...c,
        surface,
        lemma: lemma || undefined,
        partOfSpeech: typeof c.partOfSpeech === 'string' ? c.partOfSpeech.trim() : undefined,
        reasonZh: typeof c.reasonZh === 'string' ? c.reasonZh.trim() : undefined,
      };
    })
    .filter((c) => c.surface && (c.lemma || normalizeToken(c.surface)))
    .filter((c) => {
      const key = c.lemma || normalizeToken(c.surface);
      if (!key) return false;
      if (excludeSet.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxCandidates);

  return AnalyzeSentenceOutputSchema.parse({
    textEn: String(out.textEn || parsed.text).trim(),
    candidateWords: cleanedCandidates,
    translationZh: withExplanation ? (out.translationZh ? String(out.translationZh).trim() : undefined) : undefined,
    grammarNotesZh: withExplanation ? (out.grammarNotesZh ? String(out.grammarNotesZh).trim() : undefined) : undefined,
  });
}

