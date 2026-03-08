'use server';

/**
 * @fileOverview Analyze an image to decide whether it contains standalone words or an English sentence/paragraph.
 * - If words: return up to 8 word definitions (Chinese) with optional compact enrichment.
 * - If sentence/paragraph: return transcribed English text + candidate vocabulary (<= maxCandidates).
 */

import { generateJsonArray } from '@/ai/llm';
import {
  AnalyzeImageInput,
  AnalyzeImageInputSchema,
  AnalyzeImageOutput,
  AnalyzeImageOutputSchema,
  ExtractWordAndDefineOutputSchema,
} from '@/lib/types';

function normalizeToken(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '');
}

export async function analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
  const parsed = AnalyzeImageInputSchema.parse(input);
  const maxCandidates = parsed.maxCandidates ?? 25;

  const excludeSet = new Set(
    (parsed.excludeWords || [])
      .map((w) => normalizeToken(w))
      .filter(Boolean)
  );

  const systemPrompt = `You are an OCR expert and bilingual English learning assistant.
You read an image and decide whether it contains standalone English vocabulary words or an English sentence/paragraph.
You must output valid JSON only (no markdown, no extra commentary).`;

  const userPrompt = `Analyze the image and return ONE JSON object using ONE of the following shapes:

1) Word list mode (if the image is mostly standalone words, labels, or a short word list):
{
  "kind": "word",
  "words": [
    {"word": string, "partOfSpeech": string, "definition": string, "enrichment"?: {...}}
  ]
}

2) Sentence/paragraph mode (if the image contains a full English sentence or paragraph):
{
  "kind": "sentence",
  "textEn": string,
  "candidateWords": [
    {"surface": string, "lemma"?: string, "partOfSpeech"?: string, "reasonZh"?: string}
  ]
}

Rules:
- Return JSON only.
- For kind="word":
  - Return at most 8 items.
  - Avoid duplicates (case-insensitive).
  - Do NOT include words in this exclude list (case-insensitive): ${JSON.stringify(Array.from(excludeSet).slice(0, 200))}
  - definition: concise Chinese dictionary-style definition (no markdown).
  - enrichment (optional) must be compact:
    - collocations: 2-4
    - synonyms/antonyms: 2-4 each
    - examples: 1-2
    - usageZh <= 80 Chinese characters
- For kind="sentence":
  - textEn: transcribe the English text as accurately as possible (keep punctuation; use \\n for line breaks).
  - candidateWords: return at most ${maxCandidates} useful vocabulary items (avoid very common function words).
  - Avoid duplicates (case-insensitive).
  - Prefer lemma in lowercase (base form). If unsure, omit lemma.
  - partOfSpeech best effort (noun/verb/adjective/adverb/...).
  - Do NOT include words in this exclude list (case-insensitive): ${JSON.stringify(Array.from(excludeSet).slice(0, 200))}
`;

  const data = await generateJsonArray<AnalyzeImageOutput>({
    systemPrompt,
    userPrompt,
    image: { dataUri: parsed.photoDataUri },
    schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys.',
  });

  const out = AnalyzeImageOutputSchema.parse(data);

  if (out.kind === 'word') {
    const seen = new Set<string>();
    const cleaned = (out.words || [])
      .map((w) => ({
        ...w,
        word: String(w.word || '').trim(),
        partOfSpeech: String(w.partOfSpeech || '').trim(),
        definition: String(w.definition || '').trim(),
      }))
      .filter((w) => w.word && w.partOfSpeech && w.definition)
      .filter((w) => {
        const key = normalizeToken(w.word);
        if (!key) return false;
        if (excludeSet.has(key)) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);

    return AnalyzeImageOutputSchema.parse({
      kind: 'word',
      words: ExtractWordAndDefineOutputSchema.parse(cleaned),
    });
  }

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

  return AnalyzeImageOutputSchema.parse({
    kind: 'sentence',
    textEn: String(out.textEn || '').trim(),
    candidateWords: cleanedCandidates,
  });
}

