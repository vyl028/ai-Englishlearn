"use client";

import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface MobileSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface MobileSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: MobileSelectOption[];
  placeholder?: string;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  title?: string;
}

/**
 * 移动端优化的选择器组件
 * - 桌面端：使用原生下拉选择
 * - 移动端：使用底部抽屉式选择，更适合触摸操作
 */
export function MobileSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "请选择...",
  label,
  helperText,
  disabled,
  className,
  triggerClassName,
  title,
}: MobileSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");

  const controlledValue = value !== undefined ? value : internalValue;
  const selectedOption = options.find((opt) => opt.value === controlledValue);

  const handleSelect = (optionValue: string) => {
    if (value === undefined) {
      setInternalValue(optionValue);
    }
    onValueChange?.(optionValue);
    setOpen(false);
  };

  // 桌面端使用原生 select
  if (!isMobile) {
    return (
      <div className={cn("w-full space-y-1.5", className)}>
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <select
          value={controlledValue}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground focus:outline-none",
            "focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }

  // 移动端使用抽屉式选择
  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-md border border-input",
              "bg-background px-3 py-2 text-left text-base ring-offset-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !controlledValue && "text-muted-foreground",
              triggerClassName
            )}
            style={{ fontSize: "16px" }}
          >
            <span className="truncate">{selectedOption?.label || placeholder}</span>
            <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[60vh] sm:h-auto p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">{title || label || "选择"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(60vh-60px)]">
            <div className="py-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 text-left",
                    "hover:bg-accent active:bg-accent/80 transition-colors",
                    "border-b last:border-b-0 border-border/50",
                    controlledValue === option.value && "bg-accent/50",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-base",
                      controlledValue === option.value && "font-medium"
                    )}>
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="text-sm text-muted-foreground mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {controlledValue === option.value && (
                    <Check className="h-5 w-5 text-primary shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}

/**
 * 移动端分组选择器（专用于单词分组选择）
 */
export interface MobileGroupSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  groups: Array<{ id: string; name: string; count?: number }>;
  placeholder?: string;
  label?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  allOptionCount?: number;
  className?: string;
}

export function MobileGroupSelect({
  value,
  onValueChange,
  groups,
  placeholder = "请选择分组...",
  label,
  showAllOption = true,
  allOptionLabel = "全部",
  allOptionCount,
  className,
}: MobileGroupSelectProps) {
  const options: MobileSelectOption[] = [
    ...(showAllOption
      ? [{ value: "__all__", label: `${allOptionLabel}（${allOptionCount ?? groups.reduce((sum, g) => sum + (g.count || 0), 0)}）` }]
      : []),
    ...groups.map((g) => ({
      value: g.id,
      label: `${g.name}（${g.count || 0}）`,
    })),
  ];

  return (
    <MobileSelect
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      label={label}
      title="选择分组"
      className={className}
    />
  );
}
