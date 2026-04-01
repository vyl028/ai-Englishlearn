"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface SwipeAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  color?: string;
  bgColor?: string;
  onClick: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
  threshold?: number;
}

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  className,
  disabled = false,
  threshold = 80,
}: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const hasActionsRef = useRef(leftActions.length > 0 || rightActions.length > 0);

  const maxLeftOffset = rightActions.length * threshold;
  const maxRightOffset = leftActions.length * threshold;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || !hasActionsRef.current) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;
    setIsSwiping(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping || disabled) return;

    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    const diff = currentXRef.current - startXRef.current;

    // Apply resistance at the edges
    let newTranslateX = diff;
    if (diff > 0 && leftActions.length === 0) {
      newTranslateX = Math.min(diff, 0);
    } else if (diff < 0 && rightActions.length === 0) {
      newTranslateX = Math.max(diff, 0);
    }

    // Add resistance at extremes
    if (diff > maxRightOffset) {
      newTranslateX = maxRightOffset + (diff - maxRightOffset) * 0.3;
    } else if (diff < -maxLeftOffset) {
      newTranslateX = -maxLeftOffset + (diff + maxLeftOffset) * 0.3;
    }

    setTranslateX(newTranslateX);
  }, [isSwiping, disabled, leftActions.length, rightActions.length, maxLeftOffset, maxRightOffset]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    setIsSwiping(false);
    const diff = currentXRef.current - startXRef.current;

    // Snap to actions or back to center
    if (diff > threshold / 2 && leftActions.length > 0) {
      setTranslateX(Math.min(diff, maxRightOffset * 0.6));
    } else if (diff < -threshold / 2 && rightActions.length > 0) {
      setTranslateX(Math.max(diff, -maxLeftOffset * 0.6));
    } else {
      setTranslateX(0);
    }

    startXRef.current = 0;
    currentXRef.current = 0;
  }, [isSwiping, threshold, leftActions.length, rightActions.length, maxLeftOffset, maxRightOffset]);

  const resetPosition = useCallback(() => {
    setTranslateX(0);
  }, []);

  const handleActionClick = useCallback((action: SwipeAction) => {
    action.onClick();
    resetPosition();
  }, [resetPosition]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  // Close swipe on click outside
  useEffect(() => {
    if (translateX === 0) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        resetPosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [translateX, resetPosition]);

  const hasLeftActions = leftActions.length > 0;
  const hasRightActions = rightActions.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden touch-pan-y select-none",
        className
      )}
    >
      {/* Left actions background */}
      {hasLeftActions && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 z-10"
          style={{
            opacity: translateX > 0 ? Math.min(translateX / threshold, 1) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s ease',
          }}
        >
          <div className="flex gap-1">
            {leftActions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-w-[60px] transition-transform",
                  action.bgColor || "bg-primary",
                  action.color || "text-primary-foreground"
                )}
                style={{
                  transform: `scale(${Math.min(translateX / (threshold * (index + 1)), 1)})`,
                }}
                title={action.label}
              >
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right actions background */}
      {hasRightActions && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 z-10"
          style={{
            opacity: translateX < 0 ? Math.min(-translateX / threshold, 1) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s ease',
          }}
        >
          <div className="flex gap-1">
            {rightActions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-lg min-w-[60px] transition-transform",
                  action.bgColor || "bg-destructive",
                  action.color || "text-destructive-foreground"
                )}
                style={{
                  transform: `scale(${Math.min(-translateX / (threshold * (index + 1)), 1)})`,
                }}
                title={action.label}
              >
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Card content */}
      <div
        className="relative z-20 bg-background"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
