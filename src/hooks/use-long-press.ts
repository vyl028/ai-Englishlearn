"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

interface LongPressOptions {
  threshold?: number;
  onLongPress?: (e: TouchEvent | MouseEvent) => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
}

export function useLongPress<T extends HTMLElement>(options: LongPressOptions) {
  const { threshold = 500, onLongPress, onPressStart, onPressEnd } = options;

  const ref = useRef<T>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressing, setIsPressing] = useState(false);
  const hasTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (e: TouchEvent | MouseEvent) => {
      // Get position for touch or mouse
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;

      startPosRef.current = { x: clientX, y: clientY };
      hasTriggeredRef.current = false;
      setIsPressing(true);
      onPressStart?.();

      timerRef.current = setTimeout(() => {
        hasTriggeredRef.current = true;
        onLongPress?.(e);
        setIsPressing(false);
        onPressEnd?.();
      }, threshold);
    },
    [threshold, onLongPress, onPressStart, onPressEnd]
  );

  const handleMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!startPosRef.current) return;

      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;

      const diffX = Math.abs(clientX - startPosRef.current.x);
      const diffY = Math.abs(clientY - startPosRef.current.y);

      // Cancel if moved too much
      if (diffX > 10 || diffY > 10) {
        clearTimer();
        setIsPressing(false);
        startPosRef.current = null;
        onPressEnd?.();
      }
    },
    [clearTimer, onPressEnd]
  );

  const handleEnd = useCallback(
    (e: TouchEvent | MouseEvent) => {
      clearTimer();

      // Prevent click if long press was triggered
      if (hasTriggeredRef.current) {
        e.preventDefault();
      }

      setIsPressing(false);
      startPosRef.current = null;
      onPressEnd?.();
    },
    [clearTimer, onPressEnd]
  );

  const handleContextMenu = useCallback((e: Event) => {
    // Prevent native context menu on mobile long press
    if (hasTriggeredRef.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Touch events
    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: true });
    element.addEventListener('touchend', handleEnd, { passive: false });
    element.addEventListener('touchcancel', handleEnd, { passive: true });
    element.addEventListener('contextmenu', handleContextMenu);

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
      element.removeEventListener('contextmenu', handleContextMenu);
      element.removeEventListener('mousedown', handleStart as EventListener);
      element.removeEventListener('mousemove', handleMove as EventListener);
      element.removeEventListener('mouseup', handleEnd as EventListener);
      element.removeEventListener('mouseleave', handleEnd as EventListener);
    };
  }, [handleStart, handleMove, handleEnd, handleContextMenu]);

  return { ref, isPressing };
}
