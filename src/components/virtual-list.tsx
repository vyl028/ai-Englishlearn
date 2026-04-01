"use client";

import { useRef, useEffect, useState, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  itemHeight: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
}

/**
 * 虚拟列表组件
 * 只渲染可视区域的列表项，优化长列表性能
 */
function VirtualListInner<T>({
  items,
  renderItem,
  keyExtractor,
  itemHeight,
  containerHeight = 400,
  overscan = 3,
  className,
  onEndReached,
  hasMore = false,
  isLoadingMore = false,
  loadingComponent,
  emptyComponent,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 计算可视区域的开始和结束索引
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // 总高度
  const totalHeight = items.length * itemHeight;

  // 生成虚拟列表项
  const virtualItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = items[i];
    if (!item) continue;

    virtualItems.push(
      <div
        key={keyExtractor(item, i)}
        style={{
          position: "absolute",
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      >
        {renderItem(item, i)}
      </div>
    );
  }

  // 滚动处理
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const newScrollTop = containerRef.current.scrollTop;
    setScrollTop(newScrollTop);

    // 检测滚动结束
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    // 检测是否滚动到底部
    if (onEndReached && hasMore && !isLoadingMore) {
      const { scrollHeight, clientHeight } = containerRef.current;
      const scrollBottom = newScrollTop + clientHeight;
      const threshold = itemHeight * 2;

      if (scrollHeight - scrollBottom < threshold) {
        onEndReached();
      }
    }
  }, [onEndReached, hasMore, isLoadingMore, itemHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  // 空状态
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className
        )}
        style={{ height: containerHeight }}
      >
        {emptyComponent || (
          <p className="text-muted-foreground">暂无数据</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* 虚拟列表项 */}
        <div
          style={{
            opacity: isScrolling ? 0.8 : 1,
            transition: "opacity 0.1s",
          }}
        >
          {virtualItems}
        </div>

        {/* 加载更多指示器 */}
        {hasMore && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {isLoadingMore
              ? loadingComponent || (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )
              : null}
          </div>
        )}
      </div>
    </div>
  );
}

// 使用 memo 优化重渲染
export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;

/**
 * 优化的列表项组件
 * 使用 React.memo 避免不必要的重渲染
 */
interface ListItemProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const OptimizedListItem = memo(function OptimizedListItem({
  children,
  className,
  style,
}: ListItemProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
});

/**
 * 分页加载列表组件
 * 支持自动加载更多
 */
interface PaginatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
  className?: string;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
}

export function PaginatedList<T>({
  items,
  renderItem,
  keyExtractor,
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 100,
  className,
  loadingComponent,
  emptyComponent,
}: PaginatedListProps<T>) {
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, threshold]);

  if (items.length === 0 && !isLoading) {
    return (
      <div className={cn("py-8 text-center", className)}>
        {emptyComponent || (
          <p className="text-muted-foreground">暂无数据</p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </div>
      ))}

      {/* 加载更多触发器 */}
      <div ref={loaderRef} className="py-4">
        {isLoading &&
          (loadingComponent || (
            <div className="flex items-center justify-center">
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          ))}
      </div>
    </div>
  );
}

/**
 * 虚拟滚动容器
 * 为现有列表提供虚拟滚动能力
 */
interface VirtualScrollContainerProps {
  children: React.ReactNode;
  itemCount: number;
  itemHeight: number;
  containerHeight?: number;
  className?: string;
}

export function VirtualScrollContainer({
  children,
  itemCount,
  itemHeight,
  containerHeight = 400,
  className,
}: VirtualScrollContainerProps) {
  return (
    <div
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
    >
      <div style={{ height: itemCount * itemHeight }}>{children}</div>
    </div>
  );
}
