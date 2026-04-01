"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderSrc?: string;
  threshold?: number;
  rootMargin?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * 懒加载图片组件
 * - 使用 IntersectionObserver 实现懒加载
 * - 加载前显示骨架屏占位
 * - 支持加载动画过渡
 *
 * @example
 * <LazyImage
 *   src="/path/to/image.jpg"
 *   alt="Description"
 *   className="w-full h-48"
 *   containerClassName="rounded-lg overflow-hidden"
 * />
 */
export function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  placeholderSrc,
  threshold = 0.1,
  rootMargin = "50px",
  objectFit = "cover",
  priority = false,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [currentSrc, setCurrentSrc] = useState(priority ? src : placeholderSrc || "");
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      setCurrentSrc(src);
      return;
    }

    const element = imgRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setCurrentSrc(src);
            observerRef.current?.unobserve(element);
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
      observerRef.current?.unobserve(element);
    };
  }, [src, priority, threshold, rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    onError?.();
  };

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {/* 骨架屏占位 */}
      {!isLoaded && (
        <Skeleton className="absolute inset-0" />
      )}

      {/* 图片 */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        style={{ objectFit }}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
      />

      {/* 加载动画指示器 */}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/**
 * 响应式懒加载图片
 * 根据屏幕大小加载不同尺寸的图片
 */
interface ResponsiveLazyImageProps extends Omit<LazyImageProps, "src"> {
  srcSet: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    default: string;
  };
  sizes?: string;
}

export function ResponsiveLazyImage({
  srcSet,
  sizes = "100vw",
  ...props
}: ResponsiveLazyImageProps) {
  const [src, setSrc] = useState(srcSet.default);

  useEffect(() => {
    const updateSrc = () => {
      const width = window.innerWidth;
      if (width >= 1280 && srcSet.xl) {
        setSrc(srcSet.xl);
      } else if (width >= 1024 && srcSet.lg) {
        setSrc(srcSet.lg);
      } else if (width >= 768 && srcSet.md) {
        setSrc(srcSet.md);
      } else if (width >= 640 && srcSet.sm) {
        setSrc(srcSet.sm);
      } else {
        setSrc(srcSet.default);
      }
    };

    updateSrc();
    window.addEventListener("resize", updateSrc);
    return () => window.removeEventListener("resize", updateSrc);
  }, [srcSet]);

  return <LazyImage {...props} src={src} />;
}

/**
 * 背景图片懒加载
 * 用于需要懒加载的背景图片场景
 */
interface LazyBackgroundProps {
  src: string;
  className?: string;
  children?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  fallbackColor?: string;
}

export function LazyBackground({
  src,
  className,
  children,
  threshold = 0.1,
  rootMargin = "50px",
  fallbackColor = "hsl(var(--muted))",
}: LazyBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // 预加载图片
            const img = new Image();
            img.src = src;
            img.onload = () => setIsLoaded(true);
            observerRef.current?.unobserve(element);
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
      observerRef.current?.unobserve(element);
    };
  }, [src, threshold, rootMargin]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{
        backgroundColor: fallbackColor,
        backgroundImage: isLoaded ? `url(${src})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "opacity 300ms",
      }}
    >
      {isInView && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {children}
    </div>
  );
}
