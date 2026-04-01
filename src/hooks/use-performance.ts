"use client";

import { useEffect, useState, useCallback } from 'react';

// 类型声明
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

/**
 * 性能指标 Hook
 * 用于监控和报告页面性能指标
 */
export function usePerformance() {
  const [metrics, setMetrics] = useState({
    fcp: 0, // First Contentful Paint
    lcp: 0, // Largest Contentful Paint
    fid: 0, // First Input Delay
    cls: 0, // Cumulative Layout Shift
    ttfb: 0, // Time to First Byte
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    // TTFB 计算
    const calculateTTFB = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.startTime;
        setMetrics((prev) => ({
          ...prev,
          ttfb,
        }));
      }
    };

    // 监听性能指标
    if ('PerformanceObserver' in window) {
      try {
        // LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          setMetrics((prev) => ({
            ...prev,
            lcp: lastEntry.startTime,
          }));
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const firstInputEntry = entry as PerformanceEventTiming;
            setMetrics((prev) => ({
              ...prev,
              fid: firstInputEntry.processingStart - firstInputEntry.startTime,
            }));
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as LayoutShift;
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }
          setMetrics((prev) => ({
            ...prev,
            cls: clsValue,
          }));
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // FCP
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const paintEntry = entry as PerformancePaintTiming;
            if (paintEntry.name === 'first-contentful-paint') {
              setMetrics((prev) => ({
                ...prev,
                fcp: paintEntry.startTime,
              }));
            }
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        calculateTTFB();

        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
          fcpObserver.disconnect();
        };
      } catch (e) {
        // 某些浏览器可能不支持某些 entry types
        console.warn('PerformanceObserver not fully supported:', e);
      }
    }

    calculateTTFB();
  }, []);

  return metrics;
}

/**
 * 图片加载性能监控 Hook
 */
export function useImagePerformance() {
  const [loadedImages, setLoadedImages] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  const registerImage = useCallback(() => {
    setTotalImages((prev) => prev + 1);
  }, []);

  const markImageLoaded = useCallback(() => {
    setLoadedImages((prev) => prev + 1);
  }, []);

  const progress = totalImages > 0 ? (loadedImages / totalImages) * 100 : 0;

  return {
    loadedImages,
    totalImages,
    progress,
    registerImage,
    markImageLoaded,
  };
}

/**
 * 资源加载状态 Hook
 */
export function useResourceLoading() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLoad = () => {
      setProgress(100);
      setTimeout(() => setIsLoading(false), 100);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);

      // 模拟进度
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      return () => {
        window.removeEventListener('load', handleLoad);
        clearInterval(interval);
      };
    }
  }, []);

  return { isLoading, progress };
}

// Network Information API 类型
interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/**
 * 检测是否为慢网环境
 */
export function useSlowNetwork() {
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    // 检测网络类型
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

    if (connection) {
      const checkConnection = () => {
        const effectiveType = connection.effectiveType;
        // 2g 或 slow-2g 认为是慢网
        setIsSlowNetwork(effectiveType === '2g' || effectiveType === 'slow-2g');
      };

      checkConnection();
      connection.addEventListener('change', checkConnection);

      return () => {
        connection.removeEventListener('change', checkConnection);
      };
    }
  }, []);

  return isSlowNetwork;
}

// Performance Memory API 类型
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * 内存使用监控 Hook（实验性）
 */
export function useMemoryUsage() {
  const [memory, setMemory] = useState({
    used: 0,
    total: 0,
    limit: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const performanceMemory = (performance as Performance & { memory?: PerformanceMemory }).memory;

    if (!performanceMemory) return;

    const updateMemory = () => {
      setMemory({
        used: Math.round(performanceMemory.usedJSHeapSize / 1048576), // MB
        total: Math.round(performanceMemory.totalJSHeapSize / 1048576),
        limit: Math.round(performanceMemory.jsHeapSizeLimit / 1048576),
      });
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);

    return () => clearInterval(interval);
  }, []);

  return memory;
}
