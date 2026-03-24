export class AiJsonParseError extends Error {
  override name = 'AiJsonParseError';
  rawPreview: string;

  constructor(message: string, raw: string) {
    super(message);
    this.rawPreview = String(raw || '').slice(0, 800);
  }
}

function findFirstCodeFenceJson(raw: string) {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match?.[1] ? match[1] : undefined;
}

function extractFirstJsonSpan(raw: string) {
  const text = String(raw || '');
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let start = -1;
  if (firstBrace === -1) start = firstBracket;
  else if (firstBracket === -1) start = firstBrace;
  else start = Math.min(firstBrace, firstBracket);

  if (start === -1) return undefined;

  const stack: string[] = [];
  stack.push(text[start] === '{' ? '}' : ']');

  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        continue;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      stack.push('}');
      continue;
    }
    if (ch === '[') {
      stack.push(']');
      continue;
    }

    if ((ch === '}' || ch === ']') && ch === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

export function parseJsonFromText(raw: string): unknown {
  const text = String(raw || '').trim();
  if (!text) throw new AiJsonParseError('Empty model output', raw);

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const fenced = findFirstCodeFenceJson(text);
  if (fenced) {
    try {
      return JSON.parse(fenced.trim());
    } catch {
      const span = extractFirstJsonSpan(fenced);
      if (span) {
        try {
          return JSON.parse(span);
        } catch {
          // continue
        }
      }
    }
  }

  const span = extractFirstJsonSpan(text);
  if (span) {
    try {
      return JSON.parse(span);
    } catch {
      // continue
    }
  }

  throw new AiJsonParseError('Failed to parse JSON from model output', raw);
}
