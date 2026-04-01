"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export interface MobileListItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export interface MobileListProps {
  items: MobileListItem[];
  className?: string;
  itemClassName?: string;
  emptyText?: string;
  showDividers?: boolean;
  showChevrons?: boolean;
}

/**
 * 移动端列表组件
 * - 类似 iOS 设置页面的列表样式
 * - 支持图标、标题、副标题、元信息
 * - 适配触摸操作
 */
export function MobileList({
  items,
  className,
  itemClassName,
  emptyText = "暂无数据",
  showDividers = true,
  showChevrons = true,
}: MobileListProps) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background",
        !isMobile && "divide-y",
        className
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "group flex items-center gap-3",
            isMobile ? "px-4 py-3.5" : "px-3 py-2.5",
            item.onClick && !item.disabled && "cursor-pointer active:bg-accent/50",
            item.disabled && "opacity-50 cursor-not-allowed",
            showDividers && index !== items.length - 1 && "border-b",
            itemClassName
          )}
          onClick={item.onClick}
        >
          {/* 图标 */}
          {item.icon && (
            <div
              className={cn(
                "flex items-center justify-center shrink-0 text-muted-foreground",
                isMobile ? "w-8 h-8" : "w-6 h-6"
              )}
            >
              {item.icon}
            </div>
          )}

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "font-medium truncate",
                isMobile ? "text-base" : "text-sm"
              )}
            >
              {item.title}
            </div>
            {item.subtitle && (
              <div className="text-sm text-muted-foreground truncate mt-0.5">
                {item.subtitle}
              </div>
            )}
          </div>

          {/* 元信息和徽章 */}
          <div className="flex items-center gap-2 shrink-0">
            {item.meta && (
              <span className="text-sm text-muted-foreground">{item.meta}</span>
            )}
            {item.badge}
            {showChevrons && item.onClick && (
              <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 移动端分组列表
 * 带分组的列表展示
 */
export interface MobileGroupedListProps {
  groups: Array<{
    title?: string;
    footer?: string;
    items: MobileListItem[];
  }>;
  className?: string;
}

export function MobileGroupedList({ groups, className }: MobileGroupedListProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.title && (
            <div className="px-4 py-2 text-sm font-medium text-muted-foreground">
              {group.title}
            </div>
          )}
          <MobileList items={group.items} showDividers />
          {group.footer && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {group.footer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 移动端分页加载器
 */
export interface MobileLoadMoreProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  className?: string;
}

export function MobileLoadMore({
  hasMore,
  loading = false,
  onLoadMore,
  className,
}: MobileLoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className={cn("py-4 text-center", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={loading}
        className="h-11 px-6"
      >
        {loading ? "加载中..." : "加载更多"}
      </Button>
    </div>
  );
}

/**
 * 移动端虚拟列表容器
 * 用于优化长列表渲染性能
 */
export interface MobileVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  itemHeight: number;
  overscan?: number;
  className?: string;
  containerHeight?: number;
}

export function MobileVirtualList<T>({
  items,
  renderItem,
  keyExtractor,
  itemHeight,
  overscan = 5,
  className,
  containerHeight = 400,
}: MobileVirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-y-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item, startIndex + index)}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
