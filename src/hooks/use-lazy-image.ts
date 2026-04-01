"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyImageOptions {
  src: string;
  placeholder?: string;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

interface UseLazyImageReturn {
  src: string;
  isLoaded: boolean;
  isInView: boolean;
  ref: React.RefObject<HTMLImageElement | null>;
}

/**
 * 图片懒加载 Hook
 * 使用 IntersectionObserver 实现图片懒加载
 *
 * @example
 * const { src, isLoaded, isInView, ref } = useLazyImage({
 *   src: '/path/to/image.jpg',
 *   placeholder: '/path/to/placeholder.jpg',
 *   threshold: 0.1,
 * });
 *
 * return <img ref={ref} src={src} className={isLoaded ? 'loaded' : 'loading'} />;
 */
export function useLazyImage({
  src,
  placeholder,
  threshold = 0.1,
  rootMargin = '50px',
  enabled = true,
}: UseLazyImageOptions): UseLazyImageReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadImage = useCallback(() => {
    if (!src || currentSrc === src) return;

    const img = new Image();
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      // 加载失败时保持占位图
      console.warn(`Failed to load image: ${src}`);
    };
  }, [src, currentSrc]);

  useEffect(() => {
    if (!enabled) {
      setCurrentSrc(src);
      setIsLoaded(true);
      return;
    }

    const element = imgRef.current;
    if (!element) return;

    // 如果图片已经在视口内（SSR场景）
    if ('complete' in element && element.complete && element.naturalHeight > 0) {
      setIsInView(true);
      loadImage();
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            loadImage();
            // 加载一次后就取消观察
            if (observerRef.current && element) {
              observerRef.current.unobserve(element);
            }
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current && element) {
        observerRef.current.unobserve(element);
      }
    };
  }, [enabled, threshold, rootMargin, loadImage]);

  return {
    src: currentSrc,
    isLoaded,
    isInView,
    ref: imgRef,
  };
}

/**
 * 批量懒加载 Hook
 * 用于列表中的多个图片懒加载
 */
export function useLazyImageBatch(
  items: Array<{ id: string; src: string }>,
  options: Omit<UseLazyImageOptions, 'src'> = {}
) {
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set());
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const { threshold = 0.1, rootMargin = '50px', enabled = true } = options;

    if (!enabled) {
      setVisibleItems(new Set(items.map((item) => item.id)));
      setLoadedItems(new Set(items.map((item) => item.id)));
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-lazy-id');
          if (id && entry.isIntersecting) {
            setVisibleItems((prev) => new Set([...prev, id]));
            setLoadedItems((prev) => new Set([...prev, id]));
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    // 观察所有元素
    itemRefs.current.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [items, options]);

  const setItemRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      const existing = itemRefs.current.get(id);
      if (existing) {
        observerRef.current?.unobserve(existing);
        itemRefs.current.delete(id);
      }
    }
  }, []);

  const isItemVisible = useCallback(
    (id: string) => visibleItems.has(id),
    [visibleItems]
  );

  const isItemLoaded = useCallback(
    (id: string) => loadedItems.has(id),
    [loadedItems]
  );

  return {
    setItemRef,
    isItemVisible,
    isItemLoaded,
    visibleItems,
    loadedItems,
  };
}
