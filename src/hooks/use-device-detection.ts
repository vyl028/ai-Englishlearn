"use client";

import { useState, useEffect, useCallback } from 'react';

export interface DeviceCapabilities {
  // 基本能力
  camera: boolean;
  microphone: boolean;
  speechRecognition: boolean;
  touch: boolean;

  // 存储
  storage: {
    quota: number;
    usage: number;
    available: boolean;
  };

  // 性能
  memory: number; // GB
  cores: number;

  // 浏览器信息
  browser: {
    name: string;
    version: string;
    isSafari: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
  };

  // 屏幕
  screen: {
    width: number;
    height: number;
    dpr: number;
    colorScheme: 'light' | 'dark';
  };
}

/**
 * 检测设备能力
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    camera: false,
    microphone: false,
    speechRecognition: false,
    touch: false,
    storage: {
      quota: 0,
      usage: 0,
      available: false,
    },
    memory: 0,
    cores: 1,
    browser: {
      name: 'unknown',
      version: '',
      isSafari: false,
      isIOS: false,
      isAndroid: false,
      isMobile: false,
    },
    screen: {
      width: 0,
      height: 0,
      dpr: 1,
      colorScheme: 'light',
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detect = async () => {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        hardwareConcurrency?: number;
        storage?: {
          estimate: () => Promise<{ quota: number; usage: number }>;
        };
      };

      // 检测浏览器
      const ua = nav.userAgent.toLowerCase();
      const isSafari = /^((?!chrome|android).)*safari/i.test(nav.userAgent);
      const isIOS = /iphone|ipad|ipod/.test(ua);
      const isAndroid = /android/.test(ua);
      const isMobile = isIOS || isAndroid || /mobile/.test(ua);

      let browserName = 'unknown';
      let browserVersion = '';

      if (isSafari) {
        browserName = 'Safari';
        const match = nav.userAgent.match(/Version\/(\d+\.?\d*)/);
        browserVersion = match?.[1] || '';
      } else if (/chrome/.test(ua) && !/edge|edg/.test(ua)) {
        browserName = 'Chrome';
        const match = nav.userAgent.match(/Chrome\/(\d+\.?\d*)/);
        browserVersion = match?.[1] || '';
      } else if (/firefox/.test(ua)) {
        browserName = 'Firefox';
        const match = nav.userAgent.match(/Firefox\/(\d+\.?\d*)/);
        browserVersion = match?.[1] || '';
      } else if (/edge|edg/.test(ua)) {
        browserName = 'Edge';
        const match = nav.userAgent.match(/(?:Edge|Edg)\/(\d+\.?\d*)/);
        browserVersion = match?.[1] || '';
      }

      // 检测媒体设备
      let camera = false;
      let microphone = false;
      try {
        if (nav.mediaDevices?.enumerateDevices) {
          const devices = await nav.mediaDevices.enumerateDevices();
          camera = devices.some(d => d.kind === 'videoinput');
          microphone = devices.some(d => d.kind === 'audioinput');
        }
      } catch {
        // 忽略错误
      }

      // 检测语音识别
      const speechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

      // 检测触摸
      const touch = 'ontouchstart' in window || nav.maxTouchPoints > 0;

      // 检测存储
      let storage = { quota: 0, usage: 0, available: false };
      try {
        if (nav.storage?.estimate) {
          const estimate = await nav.storage.estimate();
          storage = {
            quota: estimate.quota || 0,
            usage: estimate.usage || 0,
            available: true,
          };
        }
      } catch {
        // 忽略错误
      }

      // 检测内存和核心数
      const memory = nav.deviceMemory || 0;
      const cores = nav.hardwareConcurrency || 1;

      // 屏幕信息
      const screen = {
        width: window.screen.width,
        height: window.screen.height,
        dpr: window.devicePixelRatio || 1,
        colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' as const : 'light' as const,
      };

      setCapabilities({
        camera,
        microphone,
        speechRecognition,
        touch,
        storage,
        memory,
        cores,
        browser: {
          name: browserName,
          version: browserVersion,
          isSafari,
          isIOS,
          isAndroid,
          isMobile,
        },
        screen,
      });
    };

    detect();
  }, []);

  return capabilities;
}

/**
 * 检测摄像头权限
 */
export function useCameraPermission() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const checkPermission = async () => {
      // 检查是否支持
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsSupported(false);
        setPermission('denied');
        return;
      }

      setIsSupported(true);

      // 检查权限状态
      try {
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setPermission(result.state as 'granted' | 'denied' | 'prompt');

          result.addEventListener('change', () => {
            setPermission(result.state as 'granted' | 'denied' | 'prompt');
          });
        }
      } catch {
        // 某些浏览器不支持查询摄像头权限
        setPermission('prompt');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermission('granted');
      return true;
    } catch {
      setPermission('denied');
      return false;
    }
  }, []);

  return { permission, isSupported, requestPermission };
}

/**
 * 检测麦克风权限
 */
export function useMicrophonePermission() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const checkPermission = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsSupported(false);
        setPermission('denied');
        return;
      }

      setIsSupported(true);

      try {
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermission(result.state as 'granted' | 'denied' | 'prompt');

          result.addEventListener('change', () => {
            setPermission(result.state as 'granted' | 'denied' | 'prompt');
          });
        }
      } catch {
        setPermission('prompt');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermission('granted');
      return true;
    } catch {
      setPermission('denied');
      return false;
    }
  }, []);

  return { permission, isSupported, requestPermission };
}

/**
 * 检测通知权限
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  return { permission, isSupported, requestPermission };
}

/**
 * 检测是否为低端设备
 */
export function useLowEndDevice(): boolean {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };

    // 内存小于 4GB 或核心数小于 4 认为是低端设备
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4;
    const lowCores = nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4;

    setIsLowEnd(lowMemory || lowCores);
  }, []);

  return isLowEnd;
}

/**
 * 检测功能支持情况
 */
export function useFeatureSupport() {
  return {
    // 存储
    localStorage: typeof window !== 'undefined' && !!window.localStorage,
    sessionStorage: typeof window !== 'undefined' && !!window.sessionStorage,
    indexedDB: typeof window !== 'undefined' && !!window.indexedDB,

    // 媒体
    getUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    webAudio: typeof window !== 'undefined' && !!window.AudioContext,
    webRTC: typeof window !== 'undefined' && !!window.RTCPeerConnection,

    // 传感器
    geolocation: typeof navigator !== 'undefined' && !!navigator.geolocation,
    deviceOrientation: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,

    // 其他
    serviceWorker: typeof navigator !== 'undefined' && !!navigator.serviceWorker,
    webShare: typeof navigator !== 'undefined' && !!navigator.share,
    clipboard: typeof navigator !== 'undefined' && !!navigator.clipboard,
    wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
  };
}
