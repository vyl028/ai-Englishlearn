"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export type NetworkState = 'online' | 'offline';
export type NetworkType = '4g' | '3g' | '2g' | 'slow-2g' | 'wifi' | 'unknown';
export type NetworkQuality = 'good' | 'moderate' | 'poor' | 'unknown';

export interface NetworkStatus {
  state: NetworkState;
  type: NetworkType;
  quality: NetworkQuality;
  downlink: number; // Mbps
  rtt: number; // ms
  effectiveType: string;
}

// Network Information API 类型
interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  downlink?: number;
  downlinkMax?: number;
  rtt?: number;
  saveData?: boolean;
  onchange?: (() => void) | null;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/**
 * 网络状态检测 Hook
 * 检测在线/离线状态、网络类型、速度等
 *
 * @example
 * const { isOnline, networkType, isSlowNetwork, downlink } = useNetwork();
 * if (!isOnline) return <OfflineAlert />;
 * if (isSlowNetwork) return <LowQualityImage />;
 */
export function useNetwork(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    state: 'online',
    type: 'unknown',
    quality: 'unknown',
    downlink: 0,
    rtt: 0,
    effectiveType: '4g',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

    const updateNetworkStatus = () => {
      const isOnline = navigator.onLine;

      let networkType: NetworkType = 'unknown';
      let quality: NetworkQuality = 'unknown';
      let downlink = 0;
      let rtt = 0;
      let effectiveType = '4g';

      if (connection) {
        // 获取网络类型
        if (connection.type === 'wifi') {
          networkType = 'wifi';
        } else if (connection.effectiveType) {
          networkType = connection.effectiveType;
        }

        // 获取下行速度 (Mbps)
        downlink = connection.downlink || 0;

        // 获取往返时延 (ms)
        rtt = connection.rtt || 0;

        effectiveType = connection.effectiveType || '4g';

        // 判断网络质量
        if (downlink > 1.5 || effectiveType === '4g') {
          quality = 'good';
        } else if (downlink > 0.5 || effectiveType === '3g') {
          quality = 'moderate';
        } else {
          quality = 'poor';
        }
      }

      setStatus({
        state: isOnline ? 'online' : 'offline',
        type: networkType,
        quality,
        downlink,
        rtt,
        effectiveType,
      });
    };

    // 初始检测
    updateNetworkStatus();

    // 监听在线/离线事件
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 监听网络变化
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  return status;
}

/**
 * 检测是否为慢网环境
 */
export function useSlowNetwork(threshold: '2g' | '3g' = '2g'): boolean {
  const { type, effectiveType } = useNetwork();

  if (threshold === '2g') {
    return type === '2g' || type === 'slow-2g' || effectiveType === '2g' || effectiveType === 'slow-2g';
  }

  return type === '2g' || type === 'slow-2g' || type === '3g' ||
         effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g';
}

/**
 * 网络请求重试 Hook
 * 自动重试失败的请求，支持指数退避
 */
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export function useRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryCondition = () => true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const result = await fn();
        setIsLoading(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === maxRetries || !retryCondition(lastError)) {
          break;
        }

        setRetryCount(attempt + 1);

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));

        // 指数退避
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    setError(lastError);
    setIsLoading(false);
    return null;
  }, [fn, maxRetries, initialDelay, maxDelay, backoffMultiplier, retryCondition]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    execute,
    cancel,
    isLoading,
    error,
    retryCount,
  };
}

/**
 * 请求超时控制 Hook
 */
export function useTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000
): [() => Promise<T | null>, () => void, boolean] {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    setIsTimedOut(false);

    return new Promise((resolve, reject) => {
      // 设置超时
      timeoutRef.current = setTimeout(() => {
        setIsTimedOut(true);
        reject(new Error('请求超时'));
      }, timeoutMs);

      fn()
        .then((result) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          resolve(result);
        })
        .catch((error) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          reject(error);
        });
    });
  }, [fn, timeoutMs]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return [execute, cancel, isTimedOut];
}

/**
 * 图片质量自适应 Hook
 * 根据网络状况选择合适的图片质量
 */
export function useAdaptiveImageQuality(): {
  quality: 'high' | 'medium' | 'low';
  shouldLazyLoad: boolean;
} {
  const { quality, type } = useNetwork();

  if (quality === 'poor' || type === '2g' || type === 'slow-2g') {
    return { quality: 'low', shouldLazyLoad: true };
  }

  if (quality === 'moderate' || type === '3g') {
    return { quality: 'medium', shouldLazyLoad: true };
  }

  return { quality: 'high', shouldLazyLoad: false };
}

/**
 * 网络请求队列 Hook
 * 管理并发请求数量
 */
export function useRequestQueue(maxConcurrent: number = 3) {
  const [pendingCount, setPendingCount] = useState(0);
  const queueRef = useRef<(() => Promise<void>)[]>([]);
  const runningCountRef = useRef(0);

  const enqueue = useCallback(<T,>(
    request: () => Promise<T>
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const task = async () => {
        runningCountRef.current++;
        setPendingCount(runningCountRef.current);

        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          runningCountRef.current--;
          setPendingCount(runningCountRef.current);

          // 处理队列中的下一个请求
          const next = queueRef.current.shift();
          if (next) {
            next();
          }
        }
      };

      if (runningCountRef.current < maxConcurrent) {
        task();
      } else {
        queueRef.current.push(task);
      }
    });
  }, [maxConcurrent]);

  return {
    enqueue,
    pendingCount,
  };
}

export default useNetwork;
