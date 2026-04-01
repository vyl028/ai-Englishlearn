/**
 * AI 请求重试工具
 * 为 AI 相关请求提供重试机制
 */

import { extractWordAndDefineAction, defineTermAutoAction } from "@/app/actions";

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const defaultConfig: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * 带重试的 AI 请求包装器
 * @param fn 要执行的异步函数
 * @param config 重试配置
 * @returns 执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, backoffMultiplier } = {
    ...defaultConfig,
    ...config,
  };

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        throw lastError;
      }

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 指数退避
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * 带重试的图片分析请求
 */
export async function extractWordWithRetry(
  dataUri: string,
  config?: RetryConfig
) {
  return withRetry(() => extractWordAndDefineAction(dataUri), config);
}

/**
 * 带重试的单词释义生成请求
 */
export async function defineTermWithRetry(
  term: string,
  config?: RetryConfig
) {
  return withRetry(() => defineTermAutoAction({ term }), config);
}

/**
 * 网络错误检测
 * 判断错误是否为网络相关错误
 */
export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("failed to fetch") ||
    message.includes("network error")
  );
}

/**
 * 可重试错误检测
 * 判断错误是否应该重试
 */
export function isRetryableError(error: Error): boolean {
  // 网络错误通常可以重试
  if (isNetworkError(error)) return true;

  const message = error.message.toLowerCase();
  // 服务端临时错误可以重试
  if (message.includes("429") || message.includes("too many requests"))
    return true;
  if (message.includes("503") || message.includes("service unavailable"))
    return true;
  if (message.includes("502") || message.includes("bad gateway")) return true;
  if (message.includes("504") || message.includes("gateway timeout"))
    return true;

  return false;
}
