"use client";

import { useEffect, useState, useCallback } from 'react';

/**
 * iOS Safari 特定问题修复
 */

/**
 * 修复 iOS Safari 100vh 问题
 * 使用 window.innerHeight 替代 100vh
 */
export function useIOSViewportHeight(): string {
  const [vh, setVh] = useState('100vh');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateVH = () => {
      // 使用 window.innerHeight 获取实际视口高度
      const height = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${height}px`);
      setVh(`${window.innerHeight}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', updateVH);

    return () => {
      window.removeEventListener('resize', updateVH);
      window.removeEventListener('orientationchange', updateVH);
    };
  }, []);

  return vh;
}

/**
 * 检测是否为 iOS 设备
 */
export function useIsIOS(): boolean {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
    const isIOSSafari = isIOSDevice && /WebKit/.test(ua) && !/(CriOS|FxiOS|OPiOS|mercury)/.test(ua);

    setIsIOS(isIOSDevice || isIOSSafari);
  }, []);

  return isIOS;
}

/**
 * 修复 iOS 滚动穿透问题
 * 当显示弹窗/抽屉时，防止背景滚动
 */
export function usePreventBodyScroll(prevent: boolean) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (prevent) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [prevent]);
}

/**
 * 修复 iOS 点击延迟问题
 * 使用 FastClick 原理，在触摸结束时立即触发点击
 */
export function useFastClick(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // 只在 iOS 设备上使用
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndTime = Date.now();
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      // 如果触摸时间小于 300ms 且移动距离小于 10px，认为是点击
      const timeDiff = touchEndTime - touchStartTime;
      const distance = Math.sqrt(
        Math.pow(touchEndX - touchStartX, 2) + Math.pow(touchEndY - touchStartY, 2)
      );

      if (timeDiff < 300 && distance < 10) {
        // 立即触发点击事件
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'A' || target.tagName === 'BUTTON')) {
          e.preventDefault();
          target.click();
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref]);
}

/**
 * 修复 iOS Safari 日期输入问题
 * iOS Safari 不支持某些日期格式，需要格式化
 */
export function formatDateForIOS(date: Date | string | number): string {
  const d = new Date(date);
  // 使用 ISO 8601 格式，iOS Safari 兼容性最好
  return d.toISOString().split('T')[0];
}

/**
 * 检测 iOS 版本
 */
export function useIOSVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const ua = navigator.userAgent;
    const match = ua.match(/OS (\d+)_/);
    if (match) {
      setVersion(parseInt(match[1], 10));
    }
  }, []);

  return version;
}

/**
 * iOS 安全区域适配
 * 适配刘海屏等安全区域
 */
export function useIOSSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateSafeArea = () => {
      const styles = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(styles.getPropertyValue('--sat') || '0', 10),
        bottom: parseInt(styles.getPropertyValue('--sab') || '0', 10),
        left: parseInt(styles.getPropertyValue('--sal') || '0', 10),
        right: parseInt(styles.getPropertyValue('--sar') || '0', 10),
      });
    };

    updateSafeArea();
    window.addEventListener('orientationchange', updateSafeArea);

    return () => {
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  return safeArea;
}

/**
 * 修复 iOS 键盘弹出时的视口问题
 */
export function useIOSKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    const handleResize = () => {
      // iOS 键盘弹出时会改变视口高度
      const visualViewport = (window as Window & { visualViewport?: { height: number } }).visualViewport;
      if (visualViewport) {
        const heightDiff = window.innerHeight - visualViewport.height;
        if (heightDiff > 150) {
          setKeyboardHeight(heightDiff);
          setIsKeyboardOpen(true);
        } else {
          setKeyboardHeight(0);
          setIsKeyboardOpen(false);
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}

/**
 * iOS Safari 橡皮筋效果控制
 * 防止页面整体弹性滚动
 */
export function usePreventElasticScroll(shouldPrevent: boolean) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!shouldPrevent) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    const handleTouchMove = (e: TouchEvent) => {
      // 如果目标元素不可滚动，阻止默认行为
      const target = e.target as HTMLElement;
      const scrollable = target.closest('.scrollable');
      if (!scrollable) {
        e.preventDefault();
      }
    };

    document.body.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', handleTouchMove);
    };
  }, [shouldPrevent]);
}

/**
 * iOS 固定定位元素在键盘弹出时的处理
 */
export function useIOSFixedPosition() {
  const { isKeyboardOpen } = useIOSKeyboard();
  const [hideFixedElements, setHideFixedElements] = useState(false);

  useEffect(() => {
    // 键盘弹出时隐藏固定定位元素
    setHideFixedElements(isKeyboardOpen);
  }, [isKeyboardOpen]);

  return { hideFixedElements, isKeyboardOpen };
}
