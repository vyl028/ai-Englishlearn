"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface MobileSegmentedControlProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SegmentedOption[];
  className?: string;
  size?: "default" | "sm" | "lg";
  fullWidth?: boolean;
}

/**
 * 移动端分段控制器组件
 * - 类似于 iOS 的 Segmented Control
 * - 适合用于切换视图或筛选条件
 * - 在移动端比单选按钮更易于操作
 */
export function MobileSegmentedControl({
  value,
  defaultValue,
  onValueChange,
  options,
  className,
  size = "default",
  fullWidth = true,
}: MobileSegmentedControlProps) {
  const isMobile = useIsMobile();
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");

  const controlledValue = value !== undefined ? value : internalValue;

  const handleSelect = (optionValue: string) => {
    const option = options.find((opt) => opt.value === optionValue);
    if (option?.disabled) return;

    if (value === undefined) {
      setInternalValue(optionValue);
    }
    onValueChange?.(optionValue);
  };

  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-10 text-sm",
    lg: "h-12 text-base",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center p-1 bg-muted rounded-lg",
        fullWidth && "w-full",
        className
      )}
    >
      {options.map((option) => {
        const isActive = controlledValue === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => handleSelect(option.value)}
            className={cn(
              // 基础样式
              "relative flex items-center justify-center gap-1.5 font-medium",
              "transition-all duration-150 ease-out rounded-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // 尺寸
              sizeClasses[size],
              // 宽度
              fullWidth ? "flex-1" : "px-4",
              // 状态样式
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              // 禁用状态
              option.disabled && "opacity-50 cursor-not-allowed hover:text-muted-foreground"
            )}
            aria-pressed={isActive}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 移动端筛选标签组
 * 用于多个筛选条件的组合展示
 */
export interface FilterChip {
  value: string;
  label: string;
  count?: number;
}

export interface MobileFilterChipsProps {
  options: FilterChip[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function MobileFilterChips({
  options,
  selected,
  onChange,
  multiple = false,
  className,
}: MobileFilterChipsProps) {
  const toggleChip = (value: string) => {
    if (multiple) {
      const newSelected = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      onChange(newSelected);
    } else {
      onChange(selected.includes(value) ? [] : [value]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleChip(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
              "transition-colors duration-150 border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-muted-foreground"
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  isSelected
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
