"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { Portal } from "@radix-ui/react-portal";

interface ContextMenuItem {
  id: string;
  icon?: React.ReactNode;
  label: string;
  color?: 'default' | 'destructive';
  disabled?: boolean;
  onClick: () => void;
}

interface MobileContextMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  className?: string;
  disabled?: boolean;
  longPressDuration?: number;
}

export function MobileContextMenu({
  children,
  items,
  className,
  disabled = false,
  longPressDuration = 500,
}: MobileContextMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (disabled || isOpen) return;

      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;

      startPosRef.current = { x: clientX, y: clientY };
      hasTriggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        hasTriggeredRef.current = true;
        // Position menu near the touch point, but keep within viewport
        const menuX = Math.min(Math.max(clientX, 100), window.innerWidth - 100);
        const menuY = Math.min(Math.max(clientY, 150), window.innerHeight - 200);
        setPosition({ x: menuX, y: menuY });
        setIsOpen(true);
      }, longPressDuration);
    },
    [disabled, isOpen, longPressDuration]
  );

  const handleMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!startPosRef.current) return;

      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;

      const diffX = Math.abs(clientX - startPosRef.current.x);
      const diffY = Math.abs(clientY - startPosRef.current.y);

      // Cancel if moved too much
      if (diffX > 15 || diffY > 15) {
        clearTimer();
        startPosRef.current = null;
      }
    },
    [clearTimer]
  );

  const handleEnd = useCallback(
    (e: TouchEvent | MouseEvent) => {
      clearTimer();
      startPosRef.current = null;

      // Prevent default click if long press was triggered
      if (hasTriggeredRef.current) {
        e.preventDefault();
      }
    },
    [clearTimer]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    []
  );

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      item.onClick();
      setIsOpen(false);
    },
    []
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on scroll or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => setIsOpen(false);
    const handleResize = () => setIsOpen(false);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Setup long press handlers
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: true });
    element.addEventListener('touchend', handleEnd, { passive: false });
    element.addEventListener('touchcancel', handleEnd, { passive: true });
    element.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse events for desktop testing
    element.addEventListener('mousedown', handleStart as EventListener);
    element.addEventListener('mousemove', handleMove as EventListener);
    element.addEventListener('mouseup', handleEnd as EventListener);
    element.addEventListener('mouseleave', handleEnd as EventListener);

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleEnd);
      element.removeEventListener('mousedown', handleStart as EventListener);
      element.removeEventListener('mousemove', handleMove as EventListener);
      element.removeEventListener('mouseup', handleEnd as EventListener);
      element.removeEventListener('mouseleave', handleEnd as EventListener);
    };
  }, [handleStart, handleMove, handleEnd]);

  return (
    <>
      <div
        ref={containerRef}
        className={cn("touch-none", className)}
        onClick={handleClick}
      >
        {children}
      </div>

      {isOpen && (
        <Portal>
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/20 animate-in fade-in duration-150"
              onClick={handleClose}
            />

            {/* Menu */}
            <div
              className="fixed z-50 min-w-[200px] max-w-[280px] bg-popover rounded-lg shadow-lg border animate-in zoom-in-95 duration-100"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="py-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent",
                      item.color === 'destructive' && "text-destructive hover:text-destructive",
                      item.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {item.icon && (
                      <span className="flex-shrink-0">{item.icon}</span>
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Close hint */}
              <div className="px-4 py-2 border-t bg-muted/50 text-center text-xs text-muted-foreground">
                点击空白处关闭
              </div>
            </div>
          </>
        </Portal>
      )}
    </>
  );
}
