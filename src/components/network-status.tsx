"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetwork, useSlowNetwork, type NetworkStatus } from "@/hooks/use-network";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NetworkIndicatorProps {
  className?: string;
  showText?: boolean;
}

/**
 * 网络状态指示器
 * 显示当前网络连接状态
 */
export function NetworkIndicator({ className, showText = false }: NetworkIndicatorProps) {
  const { state, type, quality } = useNetwork();

  if (state === "offline") {
    return (
      <div className={cn("flex items-center gap-1.5 text-destructive", className)}>
        <WifiOff className="h-4 w-4" />
        {showText && <span className="text-sm">离线</span>}
      </div>
    );
  }

  const getIconColor = () => {
    if (quality === "poor") return "text-amber-500";
    if (quality === "moderate") return "text-yellow-500";
    return "text-green-500";
  };

  const getNetworkLabel = () => {
    if (type === "wifi") return "WiFi";
    if (type === "4g") return "4G";
    if (type === "3g") return "3G";
    if (type === "2g") return "2G";
    return "网络";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5", getIconColor(), className)}>
            <Wifi className="h-4 w-4" />
            {showText && <span className="text-sm">{getNetworkLabel()}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>网络类型: {type}</p>
          <p>连接质量: {quality === "good" ? "良好" : quality === "moderate" ? "一般" : "较差"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 离线提示横幅
 * 当网络断开时显示
 */
export function OfflineBanner({ className }: { className?: string }) {
  const { state } = useNetwork();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (state === "offline") {
      setIsVisible(true);
    } else {
      // 网络恢复后延迟隐藏
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2",
        "animate-in slide-in-from-top duration-300",
        className
      )}
    >
      <div className="flex items-center justify-center gap-2 max-w-7xl mx-auto">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">
          {state === "offline"
            ? "网络已断开，请检查网络连接"
            : "网络已恢复"}
        </span>
        {state === "offline" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-destructive-foreground hover:text-destructive-foreground hover:bg-destructive-foreground/10"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 弱网提示
 * 当网络质量较差时显示
 */
export function SlowNetworkAlert({ className }: { className?: string }) {
  const isSlowNetwork = useSlowNetwork("3g");
  const [dismissed, setDismissed] = useState(false);

  if (!isSlowNetwork || dismissed) return null;

  return (
    <div
      className={cn(
        "bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4",
        "flex items-start gap-3",
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">当前网络较慢</p>
        <p className="text-xs text-amber-700 mt-1">
          检测到您的网络连接较慢，部分功能可能加载较慢。建议切换到更快的网络以获得更好的体验。
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-100 shrink-0"
        onClick={() => setDismissed(true)}
      >
        知道了
      </Button>
    </div>
  );
}

/**
 * 加载状态提示
 * 显示当前正在加载的请求数量
 */
export function LoadingIndicator({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 bg-background border rounded-lg shadow-lg px-3 py-2",
        "flex items-center gap-2 text-sm",
        "animate-in slide-in-from-bottom-4 duration-200",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span>正在加载... ({count})</span>
    </div>
  );
}

/**
 * 请求失败重试提示
 */
interface RetryAlertProps {
  error: Error | null;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onCancel: () => void;
  className?: string;
}

export function RetryAlert({
  error,
  retryCount,
  maxRetries,
  onRetry,
  onCancel,
  className,
}: RetryAlertProps) {
  if (!error) return null;

  return (
    <div
      className={cn(
        "bg-destructive/10 border border-destructive/20 rounded-lg p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">请求失败</p>
          <p className="text-xs text-destructive/80 mt-1">
            {error.message}
            {retryCount > 0 && (
              <span className="ml-1">(已重试 {retryCount}/{maxRetries} 次)</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {retryCount < maxRetries ? (
              <Button size="sm" variant="destructive" onClick={onRetry}>
                重试
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={onRetry}>
                再次尝试
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onCancel}>
              取消
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 全局网络状态组件
 * 整合所有网络状态提示
 */
export function GlobalNetworkStatus() {
  return (
    <>
      <OfflineBanner />
    </>
  );
}

/**
 * 网络感知图片组件
 * 根据网络状况选择合适的图片质量
 */
interface AdaptiveImageProps {
  src: string;
  lowQualitySrc?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function AdaptiveImage({
  src,
  lowQualitySrc,
  alt,
  className,
  priority = false,
}: AdaptiveImageProps) {
  const { quality } = useNetwork();

  const imageSrc =
    quality === "poor" && lowQualitySrc ? lowQualitySrc : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
    />
  );
}
