"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showActions?: boolean;
  lines?: number;
}

/**
 * 骨架屏卡片组件
 * 用于内容加载时的占位显示
 *
 * @example
 * <SkeletonCard showImage showActions lines={2} />
 */
export function SkeletonCard({
  className,
  showImage = false,
  showActions = false,
  lines = 2,
}: SkeletonCardProps) {
  return (
    <div className={cn("space-y-3 p-4 rounded-lg border bg-card", className)}>
      {/* 头部：图片 + 标题 */}
      <div className="flex items-start gap-3">
        {showImage && (
          <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      {showActions && (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      )}
    </div>
  );
}

/**
 * 单词卡片骨架屏
 * 专门用于 WordCard 的加载占位
 */
export function WordCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-3 rounded-lg border bg-card", className)}>
      {/* 单词和词性 */}
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-14" />
      </div>

      {/* 释义 */}
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3" />

      {/* 操作栏 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}

/**
 * 列表骨架屏
 * 用于列表加载时的占位
 */
interface ListSkeletonProps {
  count?: number;
  className?: string;
  itemClassName?: string;
  showImage?: boolean;
  showActions?: boolean;
}

export function ListSkeleton({
  count = 3,
  className,
  itemClassName,
  showImage = false,
  showActions = false,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard
          key={i}
          className={itemClassName}
          showImage={showImage}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

/**
 * 页面骨架屏
 * 用于整个页面加载时的占位
 */
interface PageSkeletonProps {
  className?: string;
  showHeader?: boolean;
  showSidebar?: boolean;
}

export function PageSkeleton({
  className,
  showHeader = true,
  showSidebar = false,
}: PageSkeletonProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* 顶部栏 */}
      {showHeader && (
        <div className="h-16 border-b px-4 flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      )}

      <div className="flex">
        {/* 侧边栏 */}
        {showSidebar && (
          <div className="w-64 min-h-[calc(100vh-4rem)] border-r p-4 hidden lg:block">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        )}

        {/* 主内容区 */}
        <div className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 标题区 */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* 操作栏 */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>

            {/* 内容列表 */}
            <ListSkeleton count={5} showActions />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 表单骨架屏
 * 用于表单加载时的占位
 */
export function FormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* 标题 */}
      <Skeleton className="h-7 w-1/3" />

      {/* 输入字段 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-11 w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-32 w-full" />
      </div>

      {/* 按钮 */}
      <div className="flex items-center justify-end gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
