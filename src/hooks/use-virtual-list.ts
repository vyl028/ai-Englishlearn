"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  containerHeight?: number;
}

interface VirtualListReturn {
  virtualItems: Array<{
    index: number;
    style: React.CSSProperties;
  }>;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollToIndex: (index: number) => void;
}

/**
 * 虚拟列表 Hook
 * 用于优化长列表渲染性能，只渲染可视区域的项
 *
 * @example
 * const { virtualItems, totalHeight, containerRef } = useVirtualList({
 *   itemCount: 1000,
 *   itemHeight: 80,
 *   overscan: 5,
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: '400px', overflow: 'auto' }}>
 *     <div style={{ height: totalHeight }}>
 *       {virtualItems.map(({ index, style }) => (
 *         <div key={index} style={{ ...style, position: 'absolute' }}>
 *           Item {index}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 */
export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 5,
  containerHeight = 400,
}: VirtualListOptions): VirtualListReturn {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算可视区域的开始和结束索引
  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { startIndex: start, endIndex: end };
  }, [scrollTop, itemHeight, containerHeight, overscan, itemCount]);

  // 生成虚拟列表项
  const virtualItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          height: itemHeight,
          left: 0,
          right: 0,
        },
      });
    }
    return items;
  }, [startIndex, endIndex, itemHeight]);

  // 总高度
  const totalHeight = useMemo(
    () => itemCount * itemHeight,
    [itemCount, itemHeight]
  );

  // 滚动处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 滚动到指定索引
  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;

      const targetScrollTop = index * itemHeight;
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    },
    [itemHeight]
  );

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    containerRef,
    scrollToIndex,
  };
}

/**
 * 动态高度虚拟列表 Hook
 * 用于列表项高度不固定的场景
 */
interface DynamicVirtualListOptions {
  itemCount: number;
  estimateItemHeight: (index: number) => number;
  overscan?: number;
  containerHeight?: number;
}

interface DynamicVirtualListReturn {
  virtualItems: Array<{
    index: number;
    style: React.CSSProperties;
  }>;
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  measureElement: (index: number, height: number) => void;
}

export function useDynamicVirtualList({
  itemCount,
  estimateItemHeight,
  overscan = 5,
  containerHeight = 400,
}: DynamicVirtualListOptions): DynamicVirtualListReturn {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算累积高度
  const { totalHeight, itemPositions } = useMemo(() => {
    let total = 0;
    const positions = new Map<number, { top: number; height: number }>();

    for (let i = 0; i < itemCount; i++) {
      const height = measuredHeights.get(i) || estimateItemHeight(i);
      positions.set(i, { top: total, height });
      total += height;
    }

    return { totalHeight: total, itemPositions: positions };
  }, [itemCount, measuredHeights, estimateItemHeight]);

  // 计算可视区域
  const virtualItems = useMemo(() => {
    const items = [];
    let currentTop = 0;

    for (let i = 0; i < itemCount; i++) {
      const position = itemPositions.get(i);
      if (!position) continue;

      const { top, height } = position;
      currentTop = top;

      // 检查是否在可视区域内（加上 overscan）
      const isInViewport =
        top + height >= scrollTop - containerHeight * overscan &&
        top <= scrollTop + containerHeight + containerHeight * overscan;

      if (isInViewport) {
        items.push({
          index: i,
          style: {
            position: 'absolute' as const,
            top,
            height,
            left: 0,
            right: 0,
          },
        });
      }
    }

    return items;
  }, [itemCount, itemPositions, scrollTop, containerHeight, overscan]);

  // 滚动处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 测量元素高度
  const measureElement = useCallback((index: number, height: number) => {
    setMeasuredHeights((prev) => {
      const next = new Map(prev);
      next.set(index, height);
      return next;
    });
  }, []);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    measureElement,
  };
}

/**
 * 无限滚动 Hook
 * 用于实现滚动到底部自动加载更多
 */
interface InfiniteScrollOptions {
  hasMore: boolean;
  onLoadMore: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface InfiniteScrollReturn {
  loaderRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
}

export function useInfiniteScroll({
  hasMore,
  onLoadMore,
  threshold = 100,
  disabled = false,
}: InfiniteScrollOptions): InfiniteScrollReturn {
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (disabled || !hasMore) {
      return;
    }

    const element = loaderRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoading) {
          setIsLoading(true);
          try {
            await onLoadMore();
          } finally {
            setIsLoading(false);
          }
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, onLoadMore, threshold, disabled, isLoading]);

  return {
    loaderRef,
    isLoading,
  };
}

/**
 * 列表项缓存 Hook
 * 用于优化列表项的渲染缓存
 */
export function useListItemCache<T>(items: T[], keyExtractor: (item: T) => string) {
  const cacheRef = useRef<Map<string, T>>(new Map());

  useEffect(() => {
    // 更新缓存
    items.forEach((item) => {
      const key = keyExtractor(item);
      cacheRef.current.set(key, item);
    });

    // 清理不再存在的项
    const currentKeys = new Set(items.map(keyExtractor));
    for (const key of cacheRef.current.keys()) {
      if (!currentKeys.has(key)) {
        cacheRef.current.delete(key);
      }
    }
  }, [items, keyExtractor]);

  const getCachedItem = useCallback(
    (key: string) => cacheRef.current.get(key),
    []
  );

  return {
    getCachedItem,
    cache: cacheRef.current,
  };
}
