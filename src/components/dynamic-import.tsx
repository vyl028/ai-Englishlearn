"use client";

import { Suspense, lazy, ComponentType } from "react";
import { PageSkeleton, FormSkeleton } from "@/components/skeleton-card";

/**
 * 动态导入包装器
 * 用于按需加载组件，减少初始加载时间
 *
 * @example
 * const WordReviewList = dynamicImport(() => import("./word-review-list"), {
 *   loading: "list"
 * });
 */
export function dynamicImport<
  T extends ComponentType<any>
>(
  factory: () => Promise<{ default: T }>,
  options: {
    loading?: "none" | "spinner" | "list" | "page" | "form" | React.ReactNode;
    ssr?: boolean;
  } = {}
) {
  const { loading = "spinner", ssr = true } = options;

  const LazyComponent = lazy(factory);

  const LoadingFallback = () => {
    if (loading === "none") return null;
    if (loading === "list") return <div className="p-4">加载中...</div>;
    if (loading === "page") return <PageSkeleton />;
    if (loading === "form") return <FormSkeleton />;
    if (typeof loading === "string") {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return <>{loading}</>;
  };

  return function DynamicComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * 预加载函数
 * 用于提前加载可能需要的组件
 */
export function preloadComponent<
  T extends ComponentType<any>
>(factory: () => Promise<{ default: T }>) {
  const LazyComponent = lazy(factory);
  // 触发加载
  LazyComponent;
}
