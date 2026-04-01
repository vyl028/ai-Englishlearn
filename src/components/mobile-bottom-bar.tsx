"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

export interface MobileBottomBarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  onClick: () => void;
  disabled?: boolean;
}

export interface MobileBottomBarProps {
  actions: MobileBottomBarAction[];
  primaryAction?: MobileBottomBarAction;
  className?: string;
  visible?: boolean;
}

/**
 * 移动端底部操作栏组件
 * - 固定在屏幕底部
 * - 适合放置快捷操作按钮
 * - 适配安全区域
 */
export function MobileBottomBar({
  actions,
  primaryAction,
  className,
  visible = true,
}: MobileBottomBarProps) {
  const isMobile = useIsMobile();

  if (!visible) return null;

  // 桌面端不显示底部栏
  if (!isMobile) {
    return (
      <div className={cn("flex items-center justify-end gap-2 py-4", className)}>
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={action.variant || "outline"}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </Button>
        ))}
        {primaryAction && (
          <Button
            type="button"
            variant={primaryAction.variant || "default"}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.icon}
            <span className="ml-2">{primaryAction.label}</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 占位元素，防止内容被底部栏遮挡 */}
      <div className="h-20" />

      {/* 底部操作栏 */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t",
          "animate-in slide-in-from-bottom duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          {/* 次要操作按钮 */}
          <div className="flex items-center gap-2">
            {actions.slice(0, 2).map((action) => (
              <Button
                key={action.id}
                type="button"
                variant={action.variant || "outline"}
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.label}
              >
                {action.icon}
              </Button>
            ))}
          </div>

          {/* 主要操作按钮 */}
          {primaryAction && (
            <Button
              type="button"
              variant={primaryAction.variant || "default"}
              className="flex-1 h-11"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon}
              <span className="ml-2">{primaryAction.label}</span>
            </Button>
          )}
        </div>

        {/* 安全区域适配 */}
        <div className="h-safe-area-inset-bottom bg-background/95" />
      </div>
    </>
  );
}

/**
 * 移动端浮动操作按钮（FAB）
 * 用于主要操作的快捷入口
 */
export interface MobileFABProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  variant?: "default" | "secondary";
  position?: "bottom-right" | "bottom-center" | "bottom-left";
  className?: string;
  visible?: boolean;
}

export function MobileFAB({
  icon,
  label,
  onClick,
  variant = "default",
  position = "bottom-right",
  className,
  visible = true,
}: MobileFABProps) {
  const isMobile = useIsMobile();

  if (!visible || !isMobile) return null;

  const positionClasses = {
    "bottom-right": "right-4",
    "bottom-center": "left-1/2 -translate-x-1/2",
    "bottom-left": "left-4",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-20 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg",
        "transition-transform active:scale-95 hover:scale-105",
        "animate-in zoom-in-95 slide-in-from-bottom-4 duration-200",
        variant === "default"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        positionClasses[position],
        className
      )}
      style={{
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {icon}
      {label && <span className="font-medium">{label}</span>}
    </button>
  );
}

/**
 * 移动端快速操作网格
 * 用于显示多个快捷操作按钮
 */
export interface MobileQuickActionsProps {
  actions: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: "default" | "primary" | "secondary" | "destructive";
  }>;
  className?: string;
}

export function MobileQuickActions({ actions, className }: MobileQuickActionsProps) {
  const isMobile = useIsMobile();

  const colorClasses = {
    default: "bg-muted text-foreground hover:bg-muted/80",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };

  if (!isMobile) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={action.onClick}
          >
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-3", className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          className={cn(
            "flex flex-col items-center gap-2 p-3 rounded-xl transition-colors",
            colorClasses[action.color || "default"]
          )}
        >
          <div className="h-10 w-10 flex items-center justify-center">{action.icon}</div>
          <span className="text-xs font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
