"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface MobileInputProps extends React.ComponentProps<"input"> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
}

/**
 * 移动端优化的输入框组件
 * - 更大的触摸目标（最小44px高度）
 - 清晰的标签位置
 * - 支持图标
 * - 适配移动端的字号（16px避免缩放）
 */
export const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, type, label, helperText, error, icon, ...props }, ref) => {
    const isMobile = useIsMobile();

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              // 基础样式
              "flex w-full rounded-md border border-input bg-background ring-offset-background",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              // 移动端优化：更大的触摸区域和字号
              isMobile ? "h-11 px-3 py-2.5 text-base" : "h-10 px-3 py-2 text-sm",
              // 图标间距
              icon && "pl-10",
              // 错误状态
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
            ref={ref}
            // 移动端优化：防止自动缩放
            style={{ fontSize: isMobile ? "16px" : undefined }}
            {...props}
          />
        </div>
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
MobileInput.displayName = "MobileInput";

/**
 * 移动端优化的文本域组件
 */
export interface MobileTextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const MobileTextarea = React.forwardRef<HTMLTextAreaElement, MobileTextareaProps>(
  ({ className, label, helperText, error, ...props }, ref) => {
    const isMobile = useIsMobile();

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <textarea
          className={cn(
            // 基础样式
            "flex w-full rounded-md border border-input bg-background ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            // 移动端优化
            isMobile ? "min-h-[100px] px-3 py-3 text-base" : "min-h-[80px] px-3 py-2 text-sm",
            // 错误状态
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          // 移动端优化：防止自动缩放
          style={{ fontSize: isMobile ? "16px" : undefined }}
          {...props}
        />
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
MobileTextarea.displayName = "MobileTextarea";
