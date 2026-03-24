import { aiDebug } from './debug';

export class AiTimeoutError extends Error {
  override name = 'AiTimeoutError';
  constructor(message = 'AI 请求超时，请稍后重试。') {
    super(message);
  }
}

export class AiNetworkError extends Error {
  override name = 'AiNetworkError';
  constructor(message = '网络异常，无法连接 AI 服务，请检查网络或代理配置。') {
    super(message);
  }
}

export class AiHttpError extends Error {
  override name = 'AiHttpError';
  status: number;
  bodyText?: string;

  constructor(status: number, message: string, bodyText?: string) {
    super(message);
    this.status = status;
    this.bodyText = bodyText;
  }
}

function parseEnvNumber(name: string, fallback: number) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getDefaultAiTimeoutMs() {
  return parseEnvNumber('AI_TIMEOUT_MS', 60_000);
}

export function getDefaultAiMaxRetries() {
  return parseEnvNumber('AI_MAX_RETRIES', 2);
}

function getRetryAfterMs(resp: Response) {
  const raw = resp.headers.get('retry-after');
  if (!raw) return undefined;

  const asSeconds = Number.parseInt(raw, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());

  return undefined;
}

function computeBackoffMs(attemptIndex: number, baseDelayMs: number, maxDelayMs: number) {
  const exp = baseDelayMs * Math.pow(2, Math.max(0, attemptIndex));
  const capped = Math.min(maxDelayMs, exp);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.max(0, Math.round(capped * jitter));
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

export type FetchWithTimeoutRetryOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  debugLabel?: string;
};

export async function fetchWithTimeoutRetry(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutRetryOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? getDefaultAiMaxRetries();
  const timeoutMs = options.timeoutMs ?? getDefaultAiTimeoutMs();
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 5_000;

  const externalSignal: AbortSignal | undefined = options.signal ?? (init as any)?.signal;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }

    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) externalSignal.addEventListener('abort', onAbort, { once: true });

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });

      if (resp.ok) return resp;

      if (attempt < maxRetries && isRetryableStatus(resp.status)) {
        const retryAfterMs = getRetryAfterMs(resp);
        const backoffMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
        const delayMs = typeof retryAfterMs === 'number' ? Math.max(backoffMs, retryAfterMs) : backoffMs;
        aiDebug('[AI HTTP] %s status=%s retry=%s/%s delayMs=%s', options.debugLabel || url, resp.status, attempt + 1, maxRetries, delayMs);
        try {
          resp.body?.cancel();
        } catch {
          // ignore
        }
        await sleep(delayMs, externalSignal);
        continue;
      }

      return resp;
    } catch (err: any) {
      if (externalSignal?.aborted) throw err;
      if (timedOut) throw new AiTimeoutError();

      if (attempt < maxRetries) {
        const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
        aiDebug('[AI HTTP] %s networkError retry=%s/%s delayMs=%s msg=%s', options.debugLabel || url, attempt + 1, maxRetries, delayMs, String(err?.message || err));
        await sleep(delayMs, externalSignal);
        continue;
      }

      throw new AiNetworkError();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    }
  }

  throw new AiNetworkError();
}

export async function readResponseTextSafe(resp: Response, maxChars = 2_000) {
  try {
    const text = await resp.text();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + `\n…(truncated, ${text.length} chars total)`;
  } catch {
    return '';
  }
}

