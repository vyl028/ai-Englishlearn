"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API 类型声明
type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

/**
 * 检测 Web Speech API 支持情况
 */
export function useSpeechSupport(): {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
} {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (e) {
        setError('无法启动语音识别');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}

/**
 * 语音合成 Hook
 */
export function useTextToSpeech(): {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, lang?: string) => void;
  stop: () => void;
} {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsSupported('speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string, lang = 'zh-CN') => {
    if (!('speechSynthesis' in window)) return;

    // 停止之前的语音
    window.speechSynthesis.cancel();

    utteranceRef.current = new SpeechSynthesisUtterance(text);
    utteranceRef.current.lang = lang;
    utteranceRef.current.rate = 1;
    utteranceRef.current.pitch = 1;

    utteranceRef.current.onstart = () => setIsSpeaking(true);
    utteranceRef.current.onend = () => setIsSpeaking(false);
    utteranceRef.current.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utteranceRef.current);
  }, []);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { isSupported, isSpeaking, speak, stop };
}

/**
 * 浏览器兼容性检测
 */
export function useBrowserCompatibility() {
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectedIssues: string[] = [];
    const ua = navigator.userAgent;

    // 检测 IE
    if (/MSIE|Trident/.test(ua)) {
      detectedIssues.push('IE浏览器不受支持，请使用现代浏览器');
    }

    // 检测旧版 Safari
    const safariMatch = ua.match(/Version\/(\d+).*Safari/);
    if (safariMatch && parseInt(safariMatch[1], 10) < 14) {
      detectedIssues.push('您的 Safari 版本较旧，建议升级以获得最佳体验');
    }

    // 检测旧版 Chrome
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    if (chromeMatch && parseInt(chromeMatch[1], 10) < 90) {
      detectedIssues.push('您的 Chrome 版本较旧，建议升级');
    }

    // 检测私有模式（部分功能可能受限）
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch {
      detectedIssues.push('检测到无痕/隐私模式，部分功能可能受限');
    }

    setIssues(detectedIssues);
  }, []);

  return issues;
}

/**
 * 触摸设备检测
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    setIsTouch(isTouchDevice);
  }, []);

  return isTouch;
}

/**
 * 减少动画偏好检测
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
