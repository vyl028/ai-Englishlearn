import 'dotenv/config';
import { GoogleGenerativeAI, GenerativeModel, SchemaType } from "@google/generative-ai";

/**
 * Gemini (google/genai) thin wrapper supporting optional proxy base URL.
 * If GEMINI_BASE_URL is set, we'll manually construct fetch calls to that base.
 * Otherwise we fall back to the official SDK client methods.
 */

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('[Gemini] Missing GOOGLE_API_KEY (or GEMINI_API_KEY). Requests will fail.');
}

const BASE_URL = process.env.GEMINI_BASE_URL?.replace(/\/$/, '');
if (BASE_URL) {
  console.log('[Gemini] Proxy base URL enabled:', BASE_URL);
} else {
  console.log('[Gemini] Using direct Google endpoint (no GEMINI_BASE_URL).');
}

let sdkClient: GoogleGenerativeAI | null = null;
function getSdkClient() {
  if (!sdkClient) {
    sdkClient = new GoogleGenerativeAI(API_KEY || '');
  }
  return sdkClient;
}

export function getModel(modelName = 'gemini-2.5-flash'): GenerativeModel | null {
  if (BASE_URL) return null; // we will use manual fetch mode
  return getSdkClient().getGenerativeModel({ model: modelName });
}

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
  if (!API_KEY) throw new Error('No GOOGLE_API_KEY / GEMINI_API_KEY provided');

  // If no proxy base, use SDK.
  if (!BASE_URL) {
    try {
      console.log('[Gemini] Mode=sdk model=%s image=%s', model, image ? 'yes' : 'no');
      const modelInstance = getModel(model)!;
      const parts: any[] = [];
      if (systemPrompt) parts.push({ text: systemPrompt });
      parts.push({ text: userPrompt });
      if (image) {
        const [meta, b64] = image.dataUri.split(',');
        const mime = meta.match(/data:(.*);base64/)?.[1] || 'image/png';
        parts.push({ inlineData: { data: b64, mimeType: mime } });
      }
      const result = await modelInstance.generateContent({ contents: [{ role: 'user', parts }] });
      return result.response.text();
    } catch (e: any) {
      console.error('[Gemini] SDK generate error:', e?.message || e);
      throw e;
    }
  }

  // Proxy mode manual fetch
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

  console.log('[Gemini] Mode=proxy model=%s image=%s', model, image ? 'yes' : 'no');
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify(reqBody),
      signal,
    });
  } catch (netErr: any) {
    console.error('[Gemini] Network error calling proxy:', netErr?.message || netErr);
    throw new Error('Network failure reaching GEMINI_BASE_URL');
  }

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('[Gemini] Proxy HTTP error %s: %s', resp.status, txt);
    throw new Error(`Gemini proxy error ${resp.status}: ${txt}`);
  }
  let json: any;
  try {
    json = await resp.json();
  } catch (parseErr: any) {
    console.error('[Gemini] Failed to parse JSON from proxy response:', parseErr?.message || parseErr);
    throw new Error('Invalid JSON from Gemini proxy');
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
  return text;
}

export async function generateJsonArray<T = any>(params: Omit<Parameters<typeof generateText>[0], 'options'> & { schemaHint?: string; model?: string; parse?: (raw: string) => T; }) : Promise<T> {
  const schemaHint = params.schemaHint || 'Return JSON only.';
  const raw = await generateText({
    ...params,
    userPrompt: params.userPrompt + `\n\n${schemaHint}`,
    options: { responseMimeType: 'application/json' },
  });
  try {
    return (params.parse ? params.parse(raw) : JSON.parse(raw)) as T;
  } catch (e) {
    // fallback: attempt to extract JSON substring from markdown code block
    const match = raw.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (match && match[2]) {
      try {
        return JSON.parse(match[2]);
      } catch (parseError) {
        console.log('Invalid JSON substring:', match[2]);
        throw new Error(`Failed to parse extracted JSON substring from model response. Error: ${parseError}`);
      }
    }
    
    // fallback: attempt to extract JSON substring by brackets/braces
    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');

    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && lastBracket !== -1) {
      startIndex = firstBracket;
      endIndex = lastBracket;
    } else if (firstBrace !== -1 && lastBrace !== -1) {
      startIndex = firstBrace;
      endIndex = lastBrace;
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonSubstring = raw.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(jsonSubstring);
      } catch (parseError) {
        console.log('Invalid JSON substring:', jsonSubstring);
        // The extracted substring is still not valid JSON
        throw new Error(`Failed to parse extracted JSON substring from model response. Error: ${parseError}`);
      }
    }

    throw new Error('Failed to parse or find valid JSON in model response');
  }
}
