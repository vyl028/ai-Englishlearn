"use client";

import { useEffect } from "react";
import { useIOSViewportHeight, useIsIOS } from "@/hooks/use-ios-fixes";
import { useBrowserCompatibility } from "@/hooks/use-speech";
import { useDeviceCapabilities, useLowEndDevice } from "@/hooks/use-device-detection";

/**
 * 全局兼容性修复组件
 * 自动应用各种浏览器兼容性修复
 */
export function GlobalCompatibilityFixes() {
  // iOS 修复
  useIOSViewportHeight();
  const isIOS = useIsIOS();

  // 低端设备优化
  const isLowEnd = useLowEndDevice();

  // 浏览器兼容性
  const issues = useBrowserCompatibility();
  const capabilities = useDeviceCapabilities();

  useEffect(() => {
    // 添加 CSS 类以便针对不同浏览器应用样式
    const html = document.documentElement;

    if (isIOS) {
      html.classList.add("ios");
    }

    if (isLowEnd) {
      html.classList.add("low-end");
    }

    if (capabilities.browser.isSafari) {
      html.classList.add("safari");
    }

    if (capabilities.browser.isAndroid) {
      html.classList.add("android");
    }

    // 检测触摸设备
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      html.classList.add("touch");
    } else {
      html.classList.add("no-touch");
    }

    // 打印兼容性警告到控制台
    if (issues.length > 0) {
      console.warn("[兼容性警告]", issues.join("\n"));
    }

    return () => {
      html.classList.remove(
        "ios",
        "low-end",
        "safari",
        "android",
        "touch",
        "no-touch"
      );
    };
  }, [isIOS, isLowEnd, capabilities.browser, issues]);

  return null;
}

/**
 * CSS 兼容性修复
 * 在 globals.css 中添加的修复样式
 */
export const compatibilityCSS = `
  /* iOS Safari 修复 */
  .ios {
    /* 禁用弹性滚动 */
    overscroll-behavior: none;
  }

  .ios input,
  .ios textarea {
    /* 修复 iOS 缩放问题 */
    font-size: 16px;
  }

  .ios button {
    /* 修复 iOS 按钮样式 */
    -webkit-appearance: none;
  }

  /* 低端设备优化 */
  .low-end * {
    /* 减少动画 */
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Safari 修复 */
  .safari {
    /* Safari 特定修复 */
  }

  /* Android 修复 */
  .android {
    /* Android 特定修复 */
  }

  /* 触摸设备优化 */
  .touch {
    /* 增大触摸目标 */
  }

  .no-touch {
    /* 鼠标悬停效果 */
  }

  /* 100vh 修复 */
  .h-screen-ios {
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);
  }

  .min-h-screen-ios {
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);
  }
`;
