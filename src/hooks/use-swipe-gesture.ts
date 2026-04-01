"use client";

import { useCallback, useEffect, useRef } from 'react';

interface SwipeOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export function useSwipeGesture<T extends HTMLElement>(options: SwipeOptions) {
  const {
    threshold = 50,
    onSwipeLeft,
    onSwipeRight,
    onSwipeStart,
    onSwipeEnd,
  } = options;

  const ref = useRef<T>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    isSwiping.current = false;
    onSwipeStart?.();
  }, [onSwipeStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!startX.current && !startY.current) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - startX.current;
    const diffY = touch.clientY - startY.current;
    const elapsed = Date.now() - startTime.current;

    // Detect if this is a horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && elapsed < 300) {
      isSwiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!startX.current) return;

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - startX.current;
    const diffY = touch.clientY - startY.current;
    const elapsed = Date.now() - startTime.current;

    // Only handle quick horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY) && elapsed < 300) {
      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    }

    startX.current = 0;
    startY.current = 0;
    isSwiping.current = false;
    onSwipeEnd?.();
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeEnd]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, isSwiping };
}
