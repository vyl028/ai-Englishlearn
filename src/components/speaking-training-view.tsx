"use client";

import * as React from "react";
import { Bot, Download, Loader2, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { recordSpeakingTrainingAttempt } from "@/lib/speaking-training-stats";
import { cn, generateId } from "@/lib/utils";
import type { SpeakingChatIssue, SpeakingChatMessage } from "@/lib/types";
import { aiApi } from "@/lib/api-client";

type SpeechSessionKind = "target" | "attempt" | "chat";
type SpeakingSubView = "training" | "chat";

type AlignOp =
  | { type: "equal"; expected: string; heard: string }
  | { type: "substitute"; expected: string; heard: string }
  | { type: "delete"; expected: string }
  | { type: "insert"; heard: string };

type SpeakingTargetLevel = "A2" | "B1" | "B2" | "C1";

type SpeakingChatScenario = {
  id: string;
  labelZh: string;
  scenarioEn: string;
};

const SPEAKING_CHAT_SCENARIOS: SpeakingChatScenario[] = [
  {
    id: "small_talk",
    labelZh: "日常闲聊",
    scenarioEn: "Casual small talk. Be friendly and natural. Ask simple follow-up questions.",
  },
  {
    id: "school",
    labelZh: "校园生活",
    scenarioEn: "A conversation at school. Topics: classes, homework, friends, clubs, plans.",
  },
  {
    id: "travel",
    labelZh: "旅行出行",
    scenarioEn: "Travel conversation. Topics: directions, transport, hotels, sightseeing.",
  },
  {
    id: "restaurant",
    labelZh: "餐厅点餐",
    scenarioEn: "Restaurant conversation. Topics: ordering food, preferences, problems, payment.",
  },
  {
    id: "ielts",
    labelZh: "IELTS 口语",
    scenarioEn: "IELTS speaking practice. Ask/answer like a real examiner but keep it conversational.",
  },
];

const SPEAKING_SETTINGS_STORAGE_KEY = "lexi-capture-speaking-settings-v1";

type SpeakingSettings = {
  version: 1;
  voiceUri?: string;
  rate?: number;
  volume?: number;
  autoSpeakAi?: boolean;
  pushToTalk?: boolean;
  chatScenarioId?: string;
  chatLevel?: SpeakingTargetLevel;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeRate(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.6, Math.min(1.2, n));
}

function normalizeVolume(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function isSpeakingTargetLevel(v: unknown): v is SpeakingTargetLevel {
  return v === "A2" || v === "B1" || v === "B2" || v === "C1";
}

function normalizeChatScenarioId(v: unknown) {
  const id = typeof v === "string" ? v.trim() : "";
  if (!id) return SPEAKING_CHAT_SCENARIOS[0]?.id || "small_talk";
  return SPEAKING_CHAT_SCENARIOS.some((s) => s.id === id) ? id : (SPEAKING_CHAT_SCENARIOS[0]?.id || "small_talk");
}

function readSpeakingSettings(): SpeakingSettings {
  if (typeof window === "undefined") return { version: 1 };
  const raw = safeParseJson(window.localStorage.getItem(SPEAKING_SETTINGS_STORAGE_KEY));
  if (!isRecord(raw)) return { version: 1 };

  return {
    version: 1,
    voiceUri: typeof raw.voiceUri === "string" ? raw.voiceUri : undefined,
    rate: normalizeRate(raw.rate, 1),
    volume: normalizeVolume(raw.volume, 1),
    autoSpeakAi: typeof raw.autoSpeakAi === "boolean" ? raw.autoSpeakAi : undefined,
    pushToTalk: typeof raw.pushToTalk === "boolean" ? raw.pushToTalk : undefined,
    chatScenarioId: normalizeChatScenarioId(raw.chatScenarioId),
    chatLevel: isSpeakingTargetLevel(raw.chatLevel) ? raw.chatLevel : undefined,
  };
}

function writeSpeakingSettings(settings: SpeakingSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPEAKING_SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, version: 1 }));
  } catch {
    // ignore
  }
}

function formatDateForFilename(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadTextFile(params: { filename: string; content: string; mime: string }) {
  const blob = new Blob([params.content], { type: params.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type SpeakingChatTurnState = {
  id: string;
  userTextEn: string;
  assistantReplyEn?: string;
  feedbackZh?: string;
  correctedUserEn?: string;
  issues?: SpeakingChatIssue[];
  scoreOverall?: number;
  createdAt: number;
};

function normalizeForEval(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2019’]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  const norm = normalizeForEval(text);
  return norm ? norm.split(" ").filter(Boolean) : [];
}

function alignTokens(expected: string[], heard: string[]) {
  const n = expected.length;
  const m = heard.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const subCost = expected[i - 1] === heard[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // delete
        dp[i][j - 1] + 1, // insert
        dp[i - 1][j - 1] + subCost // substitute/equal
      );
    }
  }

  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const subCost = expected[i - 1] === heard[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + subCost) {
        if (subCost === 0) ops.push({ type: "equal", expected: expected[i - 1], heard: heard[j - 1] });
        else ops.push({ type: "substitute", expected: expected[i - 1], heard: heard[j - 1] });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ type: "delete", expected: expected[i - 1] });
      i--;
      continue;
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: "insert", heard: heard[j - 1] });
      j--;
      continue;
    }
    // Fallback (shouldn't happen)
    if (i > 0) {
      ops.push({ type: "delete", expected: expected[i - 1] });
      i--;
    } else if (j > 0) {
      ops.push({ type: "insert", heard: heard[j - 1] });
      j--;
    }
  }

  ops.reverse();

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let correct = 0;
  for (const op of ops) {
    if (op.type === "equal") correct++;
    if (op.type === "substitute") substitutions++;
    if (op.type === "delete") deletions++;
    if (op.type === "insert") insertions++;
  }

  const N = Math.max(1, expected.length);
  const wer = (substitutions + deletions + insertions) / N;
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - wer))));

  return { ops, substitutions, deletions, insertions, correct, wer, score };
}

function renderHeardOpsPreview(ops: AlignOp[]) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  for (const op of ops) {
    if (op.type === "delete") continue;
    const heard = "heard" in op ? String(op.heard || "").trim() : "";
    if (!heard) continue;

    const cls =
      op.type === "equal"
        ? "bg-transparent"
        : op.type === "substitute"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
          : "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100";

    const title =
      op.type === "substitute"
        ? `${(op as any).expected} → ${heard}`
        : op.type === "insert"
          ? `多读：${heard}`
          : undefined;

    nodes.push(
      <span key={i++} className={cn("rounded px-1 py-0.5", cls)} title={title}>
        {heard}
      </span>
    );
  }

  return nodes.length > 0 ? <div className="flex flex-wrap gap-1 leading-6">{nodes}</div> : <span className="text-muted-foreground">-</span>;
}

function buildSuggestions(params: {
  expectedText: string;
  heardText: string;
  align: ReturnType<typeof alignTokens>;
}) {
  const expectedTokens = tokenize(params.expectedText);
  const heardTokens = tokenize(params.heardText);

  if (expectedTokens.length === 0) return ["请先设置“目标文本”（英文），再开始跟读评测。"];
  if (heardTokens.length === 0) {
    return [
      "没有识别到有效语音内容。请检查麦克风权限/环境噪音，或靠近麦克风再试一次。",
      "建议说慢一点、分词更清晰（尤其是词尾 -s/-ed），并在开始后立刻开口。",
    ];
  }

  const suggestions: string[] = [];
  if (params.align.score >= 90) {
    suggestions.push("匹配度很高：保持当前语速与节奏即可。");
  } else if (params.align.score >= 70) {
    suggestions.push("整体不错：可以适当放慢，确保每个词的重音更清晰。");
  } else {
    suggestions.push("建议放慢语速并分词朗读，优先把每个单词读清楚，再尝试连读。");
  }

  const missing = params.align.ops.filter((o) => o.type === "delete").map((o) => (o as any).expected as string);
  const extra = params.align.ops.filter((o) => o.type === "insert").map((o) => (o as any).heard as string);
  const subs = params.align.ops
    .filter((o) => o.type === "substitute")
    .map((o) => `${(o as any).expected} → ${(o as any).heard}`);

  if (missing.length > 0) suggestions.push(`可能漏读：${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`);
  if (extra.length > 0) suggestions.push(`可能多读/重复/噪声：${extra.slice(0, 10).join(", ")}${extra.length > 10 ? "…" : ""}`);
  if (subs.length > 0) suggestions.push(`重点练习易混淆处：${subs.slice(0, 10).join("；")}${subs.length > 10 ? "…" : ""}`);

  suggestions.push("提示：本评估基于 ASR 转写的近似结果，受口音、语速、环境噪音与浏览器模型影响。");
  return suggestions;
}

function buildChatHistoryFromTurns(turns: SpeakingChatTurnState[]): SpeakingChatMessage[] {
  const out: SpeakingChatMessage[] = [];
  for (const t of turns) {
    const userText = String(t.userTextEn || "").trim();
    if (userText) out.push({ role: "user", contentEn: userText });
    const assistantText = typeof t.assistantReplyEn === "string" ? t.assistantReplyEn.trim() : "";
    if (assistantText) out.push({ role: "assistant", contentEn: assistantText });
  }
  return out.slice(-12);
}

function isLikelySecureContext() {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  // 允许 localhost 和局域网 IP（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
  if (host === "localhost" || host === "127.0.0.1") return true;
  // 检查局域网 IP
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

function getSpeechRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickDefaultEnglishVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) || voices[0] || null;
}

export function SpeakingTrainingView() {
  const { toast } = useToast();

  const [subView, setSubView] = React.useState<SpeakingSubView>("training");

  const [settingsReady, setSettingsReady] = React.useState(false);

  const [targetText, setTargetText] = React.useState("");
  const [heardText, setHeardText] = React.useState("");
  const [interimText, setInterimText] = React.useState("");

  const [sessionKind, setSessionKind] = React.useState<SpeechSessionKind | null>(null);
  const [asrError, setAsrError] = React.useState<string | null>(null);
  const [attemptCandidates, setAttemptCandidates] = React.useState<string[]>([]);
  const [attemptCandidateIndex, setAttemptCandidateIndex] = React.useState<number>(0);

  const [chatScenarioId, setChatScenarioId] = React.useState<string>(SPEAKING_CHAT_SCENARIOS[0]?.id || "small_talk");
  const [chatScenarioQuery, setChatScenarioQuery] = React.useState("");
  const [chatLevel, setChatLevel] = React.useState<SpeakingTargetLevel>("B1");
  const [chatDraft, setChatDraft] = React.useState<string>("");
  const [chatTurns, setChatTurns] = React.useState<SpeakingChatTurnState[]>([]);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [isChatting, setIsChatting] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = React.useState<string>("");
  const [rate, setRate] = React.useState<number>(1);
  const [volume, setVolume] = React.useState<number>(1);
  const [autoSpeakAi, setAutoSpeakAi] = React.useState<boolean>(true);
  const [pushToTalk, setPushToTalk] = React.useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [ttsKey, setTtsKey] = React.useState<string | null>(null);
  const ttsSessionRef = React.useRef(0);

  const [score, setScore] = React.useState<number | null>(null);
  const [wer, setWer] = React.useState<number | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [ops, setOps] = React.useState<AlignOp[]>([]);

  const recognitionRef = React.useRef<any | null>(null);
  const finalTranscriptRef = React.useRef<string>("");
  const finalCandidatesRef = React.useRef<string[]>([]);
  const lastDisplayRef = React.useRef<string>("");

  const supportsAsr = React.useMemo(() => !!getSpeechRecognitionCtor(), []);
  const supportsTts = React.useMemo(() => typeof window !== "undefined" && "speechSynthesis" in window, []);

  React.useEffect(() => {
    const s = readSpeakingSettings();
    if (typeof s.voiceUri === "string" && s.voiceUri.trim()) setVoiceUri(s.voiceUri);
    if (typeof s.rate === "number") setRate(s.rate);
    if (typeof s.volume === "number") setVolume(s.volume);
    if (typeof s.autoSpeakAi === "boolean") setAutoSpeakAi(s.autoSpeakAi);
    if (typeof s.pushToTalk === "boolean") setPushToTalk(s.pushToTalk);
    if (typeof s.chatScenarioId === "string" && s.chatScenarioId.trim()) setChatScenarioId(s.chatScenarioId);
    if (isSpeakingTargetLevel(s.chatLevel)) setChatLevel(s.chatLevel);
    setSettingsReady(true);
  }, []);

  React.useEffect(() => {
    if (!settingsReady) return;
    writeSpeakingSettings({
      version: 1,
      voiceUri: voiceUri ? voiceUri : undefined,
      rate,
      volume,
      autoSpeakAi,
      pushToTalk,
      chatScenarioId,
      chatLevel,
    });
  }, [autoSpeakAi, chatLevel, chatScenarioId, pushToTalk, rate, settingsReady, voiceUri, volume]);

  const chatScenarioEn = React.useMemo(() => {
    return SPEAKING_CHAT_SCENARIOS.find((s) => s.id === chatScenarioId)?.scenarioEn || "";
  }, [chatScenarioId]);

  const chatScenarioMeta = React.useMemo(() => {
    return SPEAKING_CHAT_SCENARIOS.find((s) => s.id === chatScenarioId) || SPEAKING_CHAT_SCENARIOS[0];
  }, [chatScenarioId]);

  const filteredChatScenarios = React.useMemo(() => {
    const q = chatScenarioQuery.trim().toLowerCase();
    if (!q) return SPEAKING_CHAT_SCENARIOS;

    const hits = SPEAKING_CHAT_SCENARIOS.filter((s) => {
      const hay = `${s.labelZh} ${s.id} ${s.scenarioEn}`.toLowerCase();
      return hay.includes(q);
    });

    const selected = chatScenarioMeta;
    if (selected && !hits.some((s) => s.id === selected.id)) return [selected, ...hits];
    return hits;
  }, [chatScenarioMeta, chatScenarioQuery]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chatTurns.length, isChatting]);

  React.useEffect(() => {
    if (!supportsTts) return;
    const synth = window.speechSynthesis;

    const update = () => {
      const v = synth.getVoices() || [];
      setVoices(v);
      const voiceOk = !!voiceUri && v.some((vv) => vv.voiceURI === voiceUri);
      if (!voiceOk) {
        const picked = pickDefaultEnglishVoice(v);
        if (picked?.voiceURI) setVoiceUri(picked.voiceURI);
      }
    };

    update();
    synth.addEventListener?.("voiceschanged", update);
    return () => {
      synth.removeEventListener?.("voiceschanged", update);
    };
  }, [supportsTts, voiceUri]);

  const stopTts = React.useCallback(() => {
    if (!supportsTts) return;
    ttsSessionRef.current += 1;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setTtsKey(null);
  }, [supportsTts]);

  const speakText = React.useCallback((raw: string, key?: string) => {
    if (!supportsTts) return;
    const text = String(raw || "").trim();
    if (!text) return;

    stopTts();

    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(text);
    const picked = voices.find((v) => v.voiceURI === voiceUri) || pickDefaultEnglishVoice(voices);
    if (picked) utter.voice = picked;
    if (picked?.lang) utter.lang = picked.lang;
    utter.rate = rate;
    utter.volume = volume;

    const sessionId = ttsSessionRef.current;
    setTtsKey(key || null);

    utter.onend = () => {
      if (ttsSessionRef.current !== sessionId) return;
      setIsSpeaking(false);
      setTtsKey(null);
    };
    utter.onerror = () => {
      if (ttsSessionRef.current !== sessionId) return;
      setIsSpeaking(false);
      setTtsKey(null);
    };

    setIsSpeaking(true);
    synth.speak(utter);
  }, [supportsTts, voices, voiceUri, rate, volume, stopTts]);

  const speak = React.useCallback(() => {
    const text = targetText.trim();
    if (!text) return;
    speakText(text, "tts:target");
  }, [speakText, targetText]);

  const cancelRecognition = React.useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort?.();
    } catch {
      // ignore
    } finally {
      recognitionRef.current = null;
      setSessionKind(null);
      setInterimText("");
    }
  }, []);

  const finishRecognition = React.useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop?.();
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    return () => {
      stopTts();
      cancelRecognition();
    };
  }, [cancelRecognition, stopTts]);

  const applyAttemptTranscript = React.useCallback((transcript: string) => {
    const finalText = String(transcript || "").trim();
    setHeardText(finalText);
    const align = alignTokens(tokenize(targetText), tokenize(finalText));
    setOps(align.ops);
    setScore(align.score);
    setWer(align.wer);
    setSuggestions(buildSuggestions({ expectedText: targetText, heardText: finalText, align }));
  }, [targetText]);

  const resetChat = React.useCallback(() => {
    setChatDraft("");
    setChatTurns([]);
    setChatError(null);
  }, []);

  const exportChatTxt = React.useCallback(() => {
    if (chatTurns.length === 0) return;
    const now = new Date();
    const scenarioLabel = chatScenarioMeta?.labelZh || chatScenarioId;

    const lines: string[] = [];
    lines.push("LexiCapture - AI 对话导出");
    lines.push(`时间：${now.toLocaleString()}`);
    lines.push(`场景：${scenarioLabel}`);
    lines.push(`目标水平：${chatLevel}`);
    lines.push("");

    for (const t of chatTurns) {
      lines.push(`You: ${t.userTextEn}`);
      if (t.assistantReplyEn) lines.push(`AI: ${t.assistantReplyEn}`);
      if (typeof t.scoreOverall === "number") lines.push(`Score: ${t.scoreOverall}/100`);
      if (t.correctedUserEn) lines.push(`Corrected: ${t.correctedUserEn}`);
      if (t.feedbackZh) {
        lines.push("Feedback(Zh):");
        lines.push(t.feedbackZh);
      }
      if (t.issues && t.issues.length > 0) {
        lines.push("Issues:");
        for (const it of t.issues.slice(0, 12)) {
          const type = it.type ? `(${it.type}) ` : "";
          lines.push(`- ${type}${it.suggestion}${it.reasonZh ? `（${it.reasonZh}）` : ""}`);
        }
      }
      lines.push("");
    }

    downloadTextFile({
      filename: `lexicapture_speaking_chat_${formatDateForFilename(now)}.txt`,
      content: lines.join("\n"),
      mime: "text/plain;charset=utf-8",
    });
  }, [chatLevel, chatScenarioId, chatScenarioMeta, chatTurns]);

  const exportChatJson = React.useCallback(() => {
    if (chatTurns.length === 0) return;
    const now = new Date();
    const data = {
      kind: "lexicapture_speaking_chat_export",
      version: 1,
      exportedAt: now.toISOString(),
      scenario: {
        id: chatScenarioId,
        labelZh: chatScenarioMeta?.labelZh || "",
        promptEn: chatScenarioEn || "",
      },
      targetLevel: chatLevel,
      turns: chatTurns.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        userTextEn: t.userTextEn,
        assistantReplyEn: t.assistantReplyEn || "",
        feedbackZh: t.feedbackZh || "",
        correctedUserEn: t.correctedUserEn,
        issues: t.issues,
        scoreOverall: t.scoreOverall,
      })),
    };

    downloadTextFile({
      filename: `lexicapture_speaking_chat_${formatDateForFilename(now)}.json`,
      content: JSON.stringify(data, null, 2),
      mime: "application/json;charset=utf-8",
    });
  }, [chatLevel, chatScenarioEn, chatScenarioId, chatScenarioMeta, chatTurns]);

  const sendChat = React.useCallback(async (raw: string) => {
    const text = String(raw || "").trim();
    if (!text) return;

    if (text.length > 600) {
      toast({
        variant: "destructive",
        title: "内容过长",
        description: "单次发言建议不超过 600 个字符（可分多次说/发）。",
      });
      return;
    }

    const turnId = generateId();
    const history = buildChatHistoryFromTurns(chatTurns);

    setChatError(null);
    setIsChatting(true);
    setChatDraft("");
    setChatTurns((prev) => [
      ...prev,
      {
        id: turnId,
        userTextEn: text,
        createdAt: Date.now(),
      },
    ]);

    try {
      const res = await aiApi.speakingChat({
        scenario: chatScenarioEn || undefined,
        userTextEn: text,
        history: history.length > 0 ? history : undefined,
        targetLevel: chatLevel,
      });

      if (!res.success || !res.data) {
        const msg = res.error?.message || "口语对话失败，请稍后重试。";
        setChatError(msg);
        setChatTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  assistantReplyEn: "Sorry, I couldn't respond right now. Please try again.",
                  feedbackZh: msg,
                }
              : t
          )
        );
        return;
      }

      const data = res.data;
      setChatTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                assistantReplyEn: data.assistantReplyEn,
                feedbackZh: data.feedbackZh,
                correctedUserEn: data.correctedUserEn,
                issues: data.issues,
                scoreOverall: data.scoreOverall,
              }
            : t
        )
      );
       if (supportsTts && autoSpeakAi) {
         speakText(data.assistantReplyEn || "", `tts:ai:${turnId}`);
       }
    } catch (e: any) {
      const msg = e?.message || "口语对话时发生未知错误。";
      setChatError(msg);
      setChatTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                assistantReplyEn: "Sorry, I couldn't respond right now. Please try again.",
                feedbackZh: msg,
              }
            : t
        )
      );
    } finally {
      setIsChatting(false);
    }
  }, [autoSpeakAi, chatLevel, chatScenarioEn, chatTurns, speakText, supportsTts, toast]);

  const startRecognition = React.useCallback(async (kind: SpeechSessionKind) => {
    setAsrError(null);
    setInterimText("");
    finalTranscriptRef.current = "";
    finalCandidatesRef.current = [];
    lastDisplayRef.current = "";
    if (kind === "attempt") {
      setAttemptCandidates([]);
      setAttemptCandidateIndex(0);
    }

    stopTts();
    cancelRecognition();

    if (!supportsAsr) {
      setAsrError("当前浏览器不支持语音识别（ASR）。建议使用 Edge/Chrome。");
      return;
    }
    if (!isLikelySecureContext()) {
      setAsrError("语音识别通常需要 HTTPS 或 localhost。请使用 https 访问或在本机 localhost 打开。");
      return;
    }

    // 请求麦克风权限（手机浏览器需要显式请求）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      setAsrError("无法访问麦克风。请在浏览器设置中允许麦克风权限。");
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setAsrError("当前浏览器不支持语音识别（ASR）。");
      return;
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    setSessionKind(kind);

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      try {
        const finals: string[] = [];
        const interims: string[] = [];
        let firstFinalAlternatives: string[] | null = null;

        const results = event?.results;
        if (!results) return;

        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          const alt = res?.[0];
          const t = String(alt?.transcript || "").trim();
          if (!t) continue;

          if (res.isFinal) {
            finals.push(t);
            if (!firstFinalAlternatives) {
              const alts: string[] = [];
              const len = typeof res?.length === "number" ? res.length : 0;
              for (let k = 0; k < len; k++) {
                const tk = String(res?.[k]?.transcript || "").trim();
                if (tk) alts.push(tk);
              }
              if (alts.length > 0) firstFinalAlternatives = alts;
            }
          } else {
            interims.push(t);
          }
        }

        const finalText = finals.join(" ").replace(/\s+/g, " ").trim();
        finalTranscriptRef.current = finalText;
        if (firstFinalAlternatives && finals.length <= 1) {
          const unique: string[] = [];
          const seen = new Set<string>();
          for (const a of firstFinalAlternatives) {
            const cleaned = a.replace(/\s+/g, " ").trim();
            if (!cleaned) continue;
            const key = cleaned.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(cleaned);
          }
          finalCandidatesRef.current = unique.slice(0, 5);
        }

        const display = [...finals, ...interims].join(" ").replace(/\s+/g, " ").trim();
        lastDisplayRef.current = display;
        setInterimText(display);
      } catch {
        // ignore
      }
    };

    rec.onerror = (event: any) => {
      const code = String(event?.error || "").trim();
      if (code === "not-allowed" || code === "service-not-allowed") {
        setAsrError("麦克风权限被拒绝。请在浏览器地址栏右侧/设置中允许麦克风后重试。");
      } else if (code === "no-speech") {
        setAsrError("没有检测到语音。请点击开始后立即开口，并尽量靠近麦克风。");
      } else {
        setAsrError(code ? `语音识别错误：${code}` : "语音识别发生未知错误。");
      }
      cancelRecognition();
    };

    rec.onend = () => {
      const finalText = (finalTranscriptRef.current || lastDisplayRef.current || "").trim();
      const candidates = (finalCandidatesRef.current && finalCandidatesRef.current.length > 0)
        ? finalCandidatesRef.current
        : (finalText ? [finalText] : []);

      recognitionRef.current = null;
      setSessionKind(null);
      setInterimText("");

      if (candidates.length === 0) return;

      if (kind === "target") {
        setTargetText(candidates[0]!);
        setHeardText("");
        setScore(null);
        setWer(null);
        setSuggestions([]);
        setOps([]);
        return;
      }

      if (kind === "chat") {
        void sendChat(candidates[0]!);
        return;
      }

      const expectedTokens = tokenize(targetText);
      let bestIdx = 0;
      let bestScore = -1;
      for (let idx = 0; idx < candidates.length; idx++) {
        const cand = candidates[idx]!;
        const a = alignTokens(expectedTokens, tokenize(cand));
        if (a.score > bestScore) {
          bestScore = a.score;
          bestIdx = idx;
        }
      }

      try {
        recordSpeakingTrainingAttempt({ score: bestScore });
      } catch {
        // ignore
      }

      setAttemptCandidates(candidates);
      setAttemptCandidateIndex(bestIdx);
      applyAttemptTranscript(candidates[bestIdx]!);
    };

    try {
      rec.start();
    } catch (e: any) {
      setAsrError(e?.message || "无法启动语音识别。");
      cancelRecognition();
    }
  }, [applyAttemptTranscript, cancelRecognition, sendChat, stopTts, supportsAsr]);

  const canEvaluate = targetText.trim().length > 0;

  const voiceOptions = React.useMemo(() => {
    const en = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
    return en.length > 0 ? en : voices;
  }, [voices]);

  const attemptCandidateSummaries = React.useMemo(() => {
    const expectedTokens = tokenize(targetText);
    return attemptCandidates.map((c, idx) => {
      const align = alignTokens(expectedTokens, tokenize(c));
      const missing = align.ops.filter((o) => o.type === "delete").map((o) => (o as any).expected as string);
      const extra = align.ops.filter((o) => o.type === "insert").map((o) => (o as any).heard as string);
      const sub = align.ops
        .filter((o) => o.type === "substitute")
        .map((o) => `${(o as any).expected} → ${(o as any).heard}`);
      return { idx, text: c, align, missing, extra, sub };
    });
  }, [attemptCandidates, targetText]);

  const missingWords = React.useMemo(
    () => ops.filter((o) => o.type === "delete").map((o) => (o as any).expected as string),
    [ops]
  );
  const extraWords = React.useMemo(
    () => ops.filter((o) => o.type === "insert").map((o) => (o as any).heard as string),
    [ops]
  );
  const subs = React.useMemo(
    () =>
      ops
        .filter((o) => o.type === "substitute")
        .map((o) => `${(o as any).expected} → ${(o as any).heard}`),
    [ops]
  );

  const isTargetSpeaking = isSpeaking && ttsKey === "tts:target";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>听说训练</CardTitle>
        <CardDescription>在下方选择“跟读训练”或“AI 对话”，进行口语输入、示范朗读与改进反馈。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            语音识别依赖浏览器能力（Edge 效果更好）。首次使用会请求麦克风权限；通常需要 HTTPS 或 localhost 才能使用。
          </AlertDescription>
        </Alert>

        {(!supportsAsr || asrError) && (
          <Alert variant="destructive">
            <AlertTitle>{!supportsAsr ? "不支持语音识别" : "语音识别不可用"}</AlertTitle>
            <AlertDescription>
              {!supportsAsr ? "当前浏览器不支持 Web Speech API 的语音识别。" : asrError}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">语音设置</div>
              <div className="text-xs text-muted-foreground">影响语音输入与 AI 回复朗读；会自动保存在本机浏览器。</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">按住说话</div>
                <div className="text-xs text-muted-foreground truncate">按下开始，松开结束（移动端友好）</div>
              </div>
              <Switch
                checked={pushToTalk}
                onCheckedChange={setPushToTalk}
                disabled={!supportsAsr || sessionKind !== null}
                aria-label="切换按住说话模式"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">自动朗读 AI 回复</div>
                <div className="text-xs text-muted-foreground truncate">回复生成后自动播放（可手动停止）</div>
              </div>
              <Switch
                checked={autoSpeakAi}
                onCheckedChange={setAutoSpeakAi}
                disabled={!supportsTts || sessionKind !== null}
                aria-label="切换自动朗读 AI 回复"
              />
            </div>
          </div>
        </div>

        <Tabs
          value={subView}
          onValueChange={(v) => {
            stopTts();
            cancelRecognition();
            setSubView(v === "chat" ? "chat" : "training");
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="training">跟读训练</TabsTrigger>
            <TabsTrigger value="chat">AI 对话</TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="space-y-4">
            <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1">
              <Label htmlFor="targetText">目标文本（英文）</Label>
              <div className="text-xs text-muted-foreground">你可以手动输入，也可以点击“语音输入”自动录入。</div>
            </div>
              <div className="flex gap-2">
                {sessionKind === "target" ? (
                  <Button type="button" variant="outline" size="sm" onClick={finishRecognition}>
                    <Square className="mr-2 h-4 w-4" />
                    停止
                  </Button>
                ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!supportsAsr || sessionKind !== null}
                  onClick={pushToTalk ? undefined : () => startRecognition("target")}
                  onPointerDown={
                    pushToTalk
                      ? (e) => {
                        if (e.pointerType === "mouse" && e.button !== 0) return;
                        e.preventDefault();
                        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                        startRecognition("target");
                      }
                      : undefined
                  }
                  onPointerUp={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        finishRecognition();
                      }
                      : undefined
                  }
                  onPointerCancel={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        cancelRecognition();
                      }
                      : undefined
                  }
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {pushToTalk ? "按住说话" : "语音输入"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!targetText && !heardText && !score && !interimText}
                onClick={() => {
                  stopTts();
                  cancelRecognition();
                  setTargetText("");
                  setHeardText("");
                  setScore(null);
                  setWer(null);
                  setSuggestions([]);
                  setOps([]);
                  setAttemptCandidates([]);
                  setAttemptCandidateIndex(0);
                  setAsrError(null);
                  setInterimText("");
                }}
              >
                清空
              </Button>
            </div>
          </div>
          <Textarea
            id="targetText"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck="false"
            value={targetText}
            onChange={(e) => {
              setTargetText(e.target.value);
              setScore(null);
              setWer(null);
              setSuggestions([]);
              setOps([]);
            }}
            placeholder="例如：I take the bus to school every day."
            className="min-h-[120px]"
          />

          {sessionKind === "target" && (
            <div className="space-y-2">
              <Label>实时识别（预览）</Label>
              <Input readOnly value={interimText || "…"} className="text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                {pushToTalk ? "提示：松开即可结束并写入目标文本。" : "提示：识别结束后会写入目标文本。"}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">示范朗读（TTS）</div>
              <div className="text-xs text-muted-foreground">点击播放，先听一遍，再跟读。</div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={isTargetSpeaking ? "outline" : "default"}
                disabled={!supportsTts || !targetText.trim() || sessionKind !== null}
                onClick={() => {
                  if (isTargetSpeaking) stopTts();
                  else speak();
                }}
              >
                {isTargetSpeaking ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                {isTargetSpeaking ? "停止" : "播放"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>语音</Label>
              <Select value={voiceUri} onValueChange={setVoiceUri} disabled={!supportsTts || voiceOptions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="选择语音" />
                </SelectTrigger>
                <SelectContent>
                  {voiceOptions.slice(0, 50).map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supportsTts &&
                voices.length > 0 &&
                voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en")).length === 0 && (
                <div className="text-xs text-muted-foreground">未找到英文语音，将使用系统默认语音。</div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>语速</Label>
                <div className="text-xs text-muted-foreground">{rate.toFixed(2)}x</div>
              </div>
              <Slider
                min={0.6}
                max={1.2}
                step={0.05}
                value={[rate]}
                onValueChange={(v) => setRate(v[0] ?? 1)}
                disabled={!supportsTts}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>音量</Label>
                <div className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[volume]}
                onValueChange={(v) => setVolume(v[0] ?? 1)}
                disabled={!supportsTts}
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">跟读评测（ASR）</div>
              <div className="text-xs text-muted-foreground">点击开始后朗读目标文本；结束后会给出近似匹配度与建议。</div>
            </div>
              <div className="flex gap-2">
                {sessionKind === "attempt" ? (
                  <Button type="button" size="sm" variant="outline" onClick={finishRecognition}>
                    <Square className="mr-2 h-4 w-4" />
                    停止
                  </Button>
                ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!supportsAsr || !canEvaluate || sessionKind !== null}
                  onClick={pushToTalk ? undefined : () => startRecognition("attempt")}
                  onPointerDown={
                    pushToTalk
                      ? (e) => {
                        if (e.pointerType === "mouse" && e.button !== 0) return;
                        e.preventDefault();
                        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                        startRecognition("attempt");
                      }
                      : undefined
                  }
                  onPointerUp={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        finishRecognition();
                      }
                      : undefined
                  }
                  onPointerCancel={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        cancelRecognition();
                      }
                      : undefined
                  }
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {pushToTalk ? "按住跟读" : "开始跟读"}
                </Button>
              )}
            </div>
          </div>

          {sessionKind === "attempt" && (
            <div className="space-y-2">
              <Label>实时识别（预览）</Label>
              <Input readOnly value={interimText || "…"} className="text-muted-foreground" />
            </div>
          )}

          {(heardText || score !== null) && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>识别结果</Label>
                <Textarea readOnly value={heardText} className="min-h-[80px]" />
              </div>

              {attemptCandidates.length > 1 && (
                <div className="space-y-2">
                  <Label>识别候选（点击切换）</Label>
                  <div className="space-y-2">
                    {attemptCandidateSummaries.map((s) => {
                      const selected = s.idx === attemptCandidateIndex;
                      return (
                        <button
                          key={s.idx}
                          type="button"
                          className={cn(
                            "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/20",
                            selected ? "border-primary bg-primary/5" : "bg-background"
                          )}
                          onClick={() => {
                            setAttemptCandidateIndex(s.idx);
                            applyAttemptTranscript(s.text);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="text-sm font-medium">候选 {s.idx + 1}</div>
                              <div className="text-xs text-muted-foreground">
                                漏读 {s.align.deletions} · 多读 {s.align.insertions} · 替换 {s.align.substitutions}
                              </div>
                            </div>
                            <Badge variant={selected ? "secondary" : "outline"} className="shrink-0">
                              {s.align.score}%
                            </Badge>
                          </div>

                          <div className="mt-2 text-sm">{renderHeardOpsPreview(s.align.ops)}</div>

                          {(s.missing.length > 0 || s.extra.length > 0 || s.sub.length > 0) && (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {s.missing.length > 0 && (
                                <div>
                                  漏读：{s.missing.slice(0, 10).join(", ")}
                                  {s.missing.length > 10 ? "…" : ""}
                                </div>
                              )}
                              {s.extra.length > 0 && (
                                <div>
                                  多读：{s.extra.slice(0, 10).join(", ")}
                                  {s.extra.length > 10 ? "…" : ""}
                                </div>
                              )}
                              {s.sub.length > 0 && (
                                <div>
                                  替换：{s.sub.slice(0, 6).join("；")}
                                  {s.sub.length > 6 ? "…" : ""}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">已默认选择匹配度最高的候选，可手动切换。</div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>匹配度</Label>
                  <div className="text-sm font-medium">{score ?? 0}%</div>
                </div>
                <Progress value={score ?? 0} />
                {typeof wer === "number" && (
                  <div className="text-xs text-muted-foreground">WER：{wer.toFixed(2)}（越低越好）</div>
                )}
              </div>

              {(missingWords.length > 0 || extraWords.length > 0 || subs.length > 0) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">差异概览</div>
                  <div className="flex flex-wrap gap-2">
                    {missingWords.length > 0 && (
                      <Badge variant="secondary">漏读 {missingWords.length}</Badge>
                    )}
                    {extraWords.length > 0 && (
                      <Badge variant="secondary">多读 {extraWords.length}</Badge>
                    )}
                    {subs.length > 0 && <Badge variant="secondary">替换 {subs.length}</Badge>}
                  </div>
                  {missingWords.length > 0 && (
                    <div className="text-xs text-muted-foreground">漏读：{missingWords.slice(0, 12).join(", ")}{missingWords.length > 12 ? "…" : ""}</div>
                  )}
                  {extraWords.length > 0 && (
                    <div className="text-xs text-muted-foreground">多读：{extraWords.slice(0, 12).join(", ")}{extraWords.length > 12 ? "…" : ""}</div>
                  )}
                  {subs.length > 0 && (
                    <div className="text-xs text-muted-foreground">替换：{subs.slice(0, 8).join("；")}{subs.length > 8 ? "…" : ""}</div>
                  )}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">改进建议</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {suggestions.map((s, idx) => (
                      <li key={idx} className="whitespace-pre-wrap">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 对话（口语）
              </div>
              <div className="text-xs text-muted-foreground">
                说一句英语，AI 会用英语继续对话，并用中文给出纠错与改进建议（基于转写文本，不包含音频评估）。
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={chatTurns.length === 0 || isChatting || sessionKind !== null}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      exportChatTxt();
                    }}
                  >
                    导出 TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      exportChatJson();
                    }}
                  >
                    导出 JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="sm" variant="outline" onClick={resetChat} disabled={isChatting || sessionKind !== null}>
                清空对话
              </Button>
            </div>
          </div>

          <Alert>
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>
              你说的话会被浏览器转写为文字，并发送到大语言模型生成回复与反馈，请勿包含隐私或敏感信息。
            </AlertDescription>
          </Alert>

          {chatError && (
            <Alert variant="destructive">
              <AlertTitle>对话出错</AlertTitle>
              <AlertDescription>{chatError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <Label>场景</Label>
              <Input
                value={chatScenarioQuery}
                onChange={(e) => setChatScenarioQuery(e.target.value)}
                placeholder="搜索场景（例如：校园 / IELTS）"
                disabled={isChatting || sessionKind !== null}
              />
              <div className="flex flex-wrap gap-2">
                {filteredChatScenarios.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={s.id === chatScenarioId ? "secondary" : "outline"}
                    className="h-8"
                    disabled={isChatting || sessionKind !== null}
                    onClick={() => {
                      setChatScenarioId(s.id);
                      resetChat();
                    }}
                  >
                    {s.labelZh}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>目标水平</Label>
              <Select value={chatLevel} onValueChange={(v) => setChatLevel(v as SpeakingTargetLevel)} disabled={isChatting || sessionKind !== null}>
                <SelectTrigger>
                  <SelectValue placeholder="选择水平" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A2">A2（基础）</SelectItem>
                  <SelectItem value="B1">B1（中级）</SelectItem>
                  <SelectItem value="B2">B2（中高级）</SelectItem>
                  <SelectItem value="C1">C1（高级）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="h-[340px] rounded-md border bg-background">
            <div className="p-3 space-y-3">
              {chatTurns.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  还没有对话内容。点击“开始说话”说一句，或在下方输入一句英文后发送。
                </div>
              ) : (
                chatTurns.map((t) => (
                  <div key={t.id} className="space-y-2">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground mb-1">你</div>
                      <div className="whitespace-pre-wrap">{t.userTextEn}</div>

                      {(t.feedbackZh || t.correctedUserEn || (t.issues?.length || 0) > 0 || typeof t.scoreOverall === "number") && (
                        <Accordion type="single" collapsible className="mt-2">
                          <AccordionItem value="details" className="border-none">
                            <AccordionTrigger className="py-2 text-sm">查看评价与纠错</AccordionTrigger>
                            <AccordionContent className="pb-1">
                              <div className="rounded-md border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-muted-foreground">反馈与纠错（中文）</div>
                                  {typeof t.scoreOverall === "number" && (
                                    <Badge variant="secondary">评分 {t.scoreOverall}</Badge>
                                  )}
                                </div>
                                {t.correctedUserEn && (
                                  <div className="text-sm">
                                    <div className="font-medium">更自然表达（英文）</div>
                                    <div className="text-muted-foreground whitespace-pre-wrap">{t.correctedUserEn}</div>
                                  </div>
                                )}
                                {t.feedbackZh && (
                                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{t.feedbackZh}</div>
                                )}
                                {(t.issues?.length || 0) > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium">重点问题</div>
                                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                      {t.issues!.slice(0, 6).map((it, idx) => (
                                        <li key={idx} className="whitespace-pre-wrap">
                                          {it.suggestion}
                                          {it.reasonZh ? `（${it.reasonZh}）` : ""}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>

                    <div className="rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs text-muted-foreground">AI（英文回复）</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!supportsTts || !t.assistantReplyEn || sessionKind !== null}
                          onClick={() => {
                            const k = `tts:ai:${t.id}`;
                            if (isSpeaking && ttsKey === k) stopTts();
                            else speakText(t.assistantReplyEn || "", k);
                          }}
                        >
                          {isSpeaking && ttsKey === `tts:ai:${t.id}` ? (
                            <VolumeX className="mr-2 h-4 w-4" />
                          ) : (
                            <Volume2 className="mr-2 h-4 w-4" />
                          )}
                          {isSpeaking && ttsKey === `tts:ai:${t.id}` ? "停止" : "播放"}
                        </Button>
                      </div>
                      <div className="whitespace-pre-wrap">
                        {t.assistantReplyEn ? t.assistantReplyEn : (isChatting ? "AI 正在回复..." : "（等待回复）")}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div className="space-y-1">
                <Label htmlFor="chatDraft">你想说的话（英文）</Label>
                <div className="text-xs text-muted-foreground">可输入文字，或用语音说一句后自动发送。</div>
              </div>
              {sessionKind === "chat" ? (
                <Button type="button" size="sm" variant="outline" onClick={finishRecognition}>
                  <Square className="mr-2 h-4 w-4" />
                  停止说话
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!supportsAsr || sessionKind !== null || isChatting}
                  onClick={pushToTalk ? undefined : () => startRecognition("chat")}
                  onPointerDown={
                    pushToTalk
                      ? (e) => {
                        if (e.pointerType === "mouse" && e.button !== 0) return;
                        e.preventDefault();
                        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                        startRecognition("chat");
                      }
                      : undefined
                  }
                  onPointerUp={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        finishRecognition();
                      }
                      : undefined
                  }
                  onPointerCancel={
                    pushToTalk
                      ? (e) => {
                        e.preventDefault();
                        cancelRecognition();
                      }
                      : undefined
                  }
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {pushToTalk ? "按住说话" : "开始说话"}
                </Button>
              )}
            </div>

            {sessionKind === "chat" && (
              <Input readOnly value={interimText || "…"} className="text-muted-foreground" />
            )}

            <Textarea
              id="chatDraft"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="例如：I want to improve my speaking. Can we practice?"
              className="min-h-[80px]"
              disabled={isChatting || sessionKind !== null}
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                onClick={() => sendChat(chatDraft)}
                disabled={isChatting || sessionKind !== null || !chatDraft.trim()}
                className="w-full sm:w-auto"
              >
                {isChatting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在发送...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    发送
                  </>
                )}
              </Button>
            </div>
          </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
