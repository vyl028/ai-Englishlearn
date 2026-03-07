import 'dotenv/config';

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

export async function generateJsonArray<T = any>(
  params: Omit<Parameters<typeof generateText>[0], 'options'> & { schemaHint?: string; model?: string; parse?: (raw: string) => T; }
): Promise<T> {
  const schemaHint = params.schemaHint || 'Return JSON only.';
  const raw = await generateText({
    ...params,
    userPrompt: params.userPrompt + `\n\n${schemaHint}`,
    options: { responseMimeType: 'application/json' },
  });

  try {
    return (params.parse ? params.parse(raw) : JSON.parse(raw)) as T;
  } catch (e) {
    const match = raw.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (match && match[2]) {
      try {
        return JSON.parse(match[2]) as T;
      } catch (parseError) {
        console.log('Invalid JSON substring:', match[2]);
        throw new Error(`Failed to parse extracted JSON substring from model response. Error: ${parseError}`);
      }
    }

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
        return JSON.parse(jsonSubstring) as T;
      } catch (parseError) {
        console.log('Invalid JSON substring:', jsonSubstring);
        throw new Error(`Failed to parse extracted JSON substring from model response. Error: ${parseError}`);
      }
    }

    throw new Error('Failed to parse or find valid JSON in model response');
  }
}

