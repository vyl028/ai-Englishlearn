import 'dotenv/config';

import type { ZodType } from 'zod';

import { aiDebug } from './debug';
import { parseJsonFromText } from './json';

export type AiProvider = 'gemini' | 'openai';

export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string; // e.g. 'application/json'
}

interface ImageInput { dataUri: string; }

export function getAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (raw === 'openai' || raw === 'gpt') return 'openai';
  if (raw === 'gemini' || raw === 'google') return 'gemini';

  // Auto-detect: if only OPENAI key is present, prefer openai.
  const hasGeminiKey = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  if (hasOpenAiKey && !hasGeminiKey) return 'openai';
  return 'gemini';
}

function getDefaultModel(provider: AiProvider) {
  if (provider === 'openai') return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export async function generateText(
  params: {
    systemPrompt?: string;
    userPrompt: string;
    image?: ImageInput; // data URI
    model?: string;
    options?: GenerateOptions;
    signal?: AbortSignal;
  }
): Promise<string> {
  const provider = getAiProvider();
  const model = params.model || getDefaultModel(provider);

  if (provider === 'openai') {
    const { generateText: openAiGenerateText } = await import('./openai');
    return openAiGenerateText({ ...params, model });
  }

  const { generateText: geminiGenerateText } = await import('./gemini');
  return geminiGenerateText({ ...params, model });
}

function truncateForRepair(raw: string, maxChars: number) {
  const text = String(raw || '');
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n…(truncated, ${text.length} chars total)`;
}

export type GenerateJsonParams<T> = Omit<Parameters<typeof generateText>[0], 'options'> & {
  schemaHint?: string;
  model?: string;
  parse?: (raw: string) => unknown;
  coerce?: (value: unknown) => unknown;
  schema?: ZodType<T, any, unknown>;
  repairAttempts?: number;
};

export async function generateJson<T = any>(params: GenerateJsonParams<T>): Promise<T> {
  const schemaHint = params.schemaHint || 'Return JSON only (no markdown, no extra commentary).';
  const repairAttempts = typeof params.repairAttempts === 'number' ? Math.max(0, params.repairAttempts) : 1;

  let prevRaw = '';
  let prevError = '';

  for (let attempt = 0; attempt <= repairAttempts; attempt++) {
    const isRepairAttempt = attempt > 0;
    const raw = await generateText({
      systemPrompt: isRepairAttempt
        ? `You are a strict JSON repair tool.
You MUST output valid JSON only (no markdown, no extra commentary, no code fences).
Fix the previous output to match the schema requirements.`
        : params.systemPrompt,
      userPrompt: isRepairAttempt
        ? `Schema requirements:
${schemaHint}

Previous output:
${truncateForRepair(prevRaw, 8_000)}

Error:
${prevError || '(unknown)'}

Return ONLY the corrected JSON.`
        : params.userPrompt + `\n\n${schemaHint}`,
      image: isRepairAttempt ? undefined : params.image,
      model: params.model,
      signal: params.signal,
      options: {
        responseMimeType: 'application/json',
        temperature: isRepairAttempt ? 0.2 : undefined,
      },
    });

    let value: unknown;
    try {
      value = params.parse ? params.parse(raw) : parseJsonFromText(raw);
    } catch (e: any) {
      prevRaw = raw;
      prevError = String(e?.message || e || 'Failed to parse JSON');
      aiDebug('[AI JSON] parse failed attempt=%s/%s err=%s', attempt, repairAttempts, prevError);
      if (attempt >= repairAttempts) {
        throw new Error('AI 返回的 JSON 无法解析，请稍后重试。');
      }
      continue;
    }

    const coerced = params.coerce ? params.coerce(value) : value;
    if (!params.schema) return coerced as T;

    const parsed = params.schema.safeParse(coerced);
    if (parsed.success) return parsed.data;

    prevRaw = raw;
    prevError = parsed.error?.message || 'Schema validation failed';
    aiDebug('[AI JSON] schema failed attempt=%s/%s err=%s', attempt, repairAttempts, prevError);

    if (attempt >= repairAttempts) {
      throw new Error('AI 返回的数据结构不符合要求，请稍后重试。');
    }
  }

  throw new Error('Unexpected generateJson fallthrough');
}

export async function generateJsonArray<T = any>(params: GenerateJsonParams<T>): Promise<T> {
  return generateJson<T>(params);
}

