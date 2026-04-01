"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  showClearButton?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
}

/**
 * 移动端搜索栏组件
 * - 更大的输入区域，便于触摸
 * - 清晰的搜索图标
 * - 一键清除按钮
 * - 适配移动端键盘
 */
export function MobileSearchBar({
  value,
  onChange,
  placeholder = "搜索...",
  className,
  autoFocus = false,
  showClearButton = true,
  onFocus,
  onBlur,
  onSubmit,
}: MobileSearchBarProps) {
  const isMobile = useIsMobile();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSubmit?.();
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full",
        isMobile ? "h-11" : "h-10",
        className
      )}
    >
      {/* 搜索图标 */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <Search className={cn("shrink-0", isMobile ? "h-5 w-5" : "h-4 w-4")} />
      </div>

      {/* 输入框 */}
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className={cn(
          "flex w-full rounded-full border border-input bg-background",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2",
          isMobile ? "h-11 pl-10 pr-10 text-base" : "h-10 pl-9 pr-9 text-sm"
        )}
        style={{ fontSize: isMobile ? "16px" : undefined }}
      />

      {/* 清除按钮 */}
      {showClearButton && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded-full",
            isMobile ? "h-9 w-9" : "h-8 w-8"
          )}
          aria-label="清除搜索"
        >
          <X className={cn("shrink-0", isMobile ? "h-5 w-5" : "h-4 w-4")} />
        </Button>
      )}
    </div>
  );
}

/**
 * 移动端搜索筛选栏
 * 搜索 + 筛选条件的组合组件
 */
export interface MobileSearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileSearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
  className,
}: MobileSearchFilterBarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        <MobileSearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {(filters || actions) && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filters}
            {actions && <div className="flex-1" />}
            {actions}
          </div>
        )}
      </div>
    );
  }

  // 桌面端布局
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
        />
      </div>
      {filters}
      {actions}
    </div>
  );
}
