import 'dotenv/config';

import { aiDebug } from './debug';
import { AiHttpError, fetchWithTimeoutRetry, readResponseTextSafe } from './http';

/**
 * Gemini (Generative Language API) thin wrapper supporting optional proxy base URL.
 * All requests use `fetch`, so AbortSignal/timeouts work consistently.
 */

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const HAS_PROXY_BASE_URL = !!process.env.GEMINI_BASE_URL;
const BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string; // e.g. 'application/json'
}

interface ImageInput { dataUri: string; }

export async function generateText(
  {
    systemPrompt,
    userPrompt,
    image,
    model = 'gemini-2.5-flash',
    options = {},
    signal,
  }: {
    systemPrompt?: string;
    userPrompt: string;
    image?: ImageInput; // data URI
    model?: string;
    options?: GenerateOptions;
    signal?: AbortSignal;
  }
): Promise<string> {
  if (signal?.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }
  if (!API_KEY) throw new Error('未配置 GOOGLE_API_KEY / GEMINI_API_KEY（或环境变量未生效）。');

  const reqBody: any = {
    contents: [
      {
        role: 'user',
        parts: [
          ...(systemPrompt ? [{ text: systemPrompt }] : []),
          { text: userPrompt },
          ...(image ? (() => {
            const [meta, b64] = image.dataUri.split(',');
            const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/png';
            return [{ inlineData: { data: b64, mimeType: mime } }];
          })() : []),
        ],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      topP: options.topP,
      topK: options.topK,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: options.responseMimeType,
    },
  };

  const url = HAS_PROXY_BASE_URL
    ? `${BASE_URL}/v1beta/models/${model}:generateContent`
    : `${BASE_URL}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (HAS_PROXY_BASE_URL) headers['x-goog-api-key'] = API_KEY;

  aiDebug('[Gemini] base=%s model=%s image=%s', BASE_URL, model, image ? 'yes' : 'no');

  const resp = await fetchWithTimeoutRetry(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
    },
    { signal, debugLabel: '[Gemini] generateContent' }
  );

  if (!resp.ok) {
    const txt = await readResponseTextSafe(resp);
    aiDebug('[Gemini] HTTP error %s: %s', resp.status, txt);

    const message =
      resp.status === 401 || resp.status === 403
        ? 'AI 配置错误：GOOGLE_API_KEY / GEMINI_API_KEY 无效或缺失。'
        : resp.status === 429
          ? 'AI 当前繁忙（429），已自动重试仍失败，请稍后再试。'
          : resp.status >= 500
            ? `AI 服务暂时不可用（${resp.status}），已自动重试仍失败，请稍后再试。`
            : `Gemini 请求失败（${resp.status}），请稍后重试。`;

    throw new AiHttpError(resp.status, message, txt);
  }
  let json: any;
  try {
    json = await resp.json();
  } catch (parseErr: any) {
    throw new Error('Gemini 返回了无法解析的 JSON 响应。');
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
  return text;
}
