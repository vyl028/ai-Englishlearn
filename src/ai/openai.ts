import 'dotenv/config';

/**
 * OpenAI / OpenAI-compatible Chat Completions wrapper.
 *
 * Env:
 * - OPENAI_API_KEY (required)
 * - OPENAI_BASE_URL (optional, default: https://api.openai.com/v1)
 * - OPENAI_MODEL (optional, default: gpt-4o-mini)
 */

export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string; // ignored for OpenAI-compatible APIs (kept for shared signature)
}

interface ImageInput { dataUri: string; }

function getBaseUrl() {
  return (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
}

export async function generateText(
  {
    systemPrompt,
    userPrompt,
    image,
    model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No OPENAI_API_KEY provided');

  const baseUrl = getBaseUrl();
  console.log('[OpenAI] model=%s image=%s base=%s', model, image ? 'yes' : 'no', baseUrl);

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  if (image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: image.dataUri } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  const body: any = {
    model,
    messages,
    temperature: options.temperature,
    top_p: options.topP,
    max_tokens: options.maxOutputTokens,
  };

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (netErr: any) {
    console.error('[OpenAI] Network error:', netErr?.message || netErr);
    throw new Error('Network failure reaching OPENAI_BASE_URL');
  }

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('[OpenAI] HTTP error %s: %s', resp.status, txt);
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

  const json: any = await resp.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean).join('\n');
  }
  return '';
}

