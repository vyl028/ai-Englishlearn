"use client";

import * as React from "react";
import { Bot, Loader2, Mic, Send, Square, Volume2, VolumeX } from "lucide-react";

import { speakingChatAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";
import type { SpeakingChatIssue, SpeakingChatMessage } from "@/lib/types";

type SpeechSessionKind = "target" | "attempt" | "chat";

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
  return host === "localhost" || host === "127.0.0.1";
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

  const [targetText, setTargetText] = React.useState("");
  const [heardText, setHeardText] = React.useState("");
  const [interimText, setInterimText] = React.useState("");

  const [sessionKind, setSessionKind] = React.useState<SpeechSessionKind | null>(null);
  const [asrError, setAsrError] = React.useState<string | null>(null);
  const [attemptCandidates, setAttemptCandidates] = React.useState<string[]>([]);
  const [attemptCandidateIndex, setAttemptCandidateIndex] = React.useState<number>(0);

  const [chatScenarioId, setChatScenarioId] = React.useState<string>(SPEAKING_CHAT_SCENARIOS[0]?.id || "small_talk");
  const [chatLevel, setChatLevel] = React.useState<SpeakingTargetLevel>("B1");
  const [chatDraft, setChatDraft] = React.useState<string>("");
  const [chatTurns, setChatTurns] = React.useState<SpeakingChatTurnState[]>([]);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [isChatting, setIsChatting] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = React.useState<string>("");
  const [rate, setRate] = React.useState<number>(1);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

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

  const chatScenarioEn = React.useMemo(() => {
    return SPEAKING_CHAT_SCENARIOS.find((s) => s.id === chatScenarioId)?.scenarioEn || "";
  }, [chatScenarioId]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chatTurns.length, isChatting]);

  React.useEffect(() => {
    if (!supportsTts) return;
    const synth = window.speechSynthesis;

    const update = () => {
      const v = synth.getVoices() || [];
      setVoices(v);
      if (!voiceUri) {
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
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supportsTts]);

  const speakText = React.useCallback((raw: string) => {
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

    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    synth.speak(utter);
  }, [supportsTts, voices, voiceUri, rate, stopTts]);

  const speak = React.useCallback(() => {
    const text = targetText.trim();
    if (!text) return;
    speakText(text);
  }, [speakText, targetText]);

  const stopRecognition = React.useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.stop?.();
      rec.abort?.();
    } catch {
      // ignore
    } finally {
      recognitionRef.current = null;
      setSessionKind(null);
      setInterimText("");
    }
  }, []);

  React.useEffect(() => {
    return () => {
      stopTts();
      stopRecognition();
    };
  }, [stopRecognition, stopTts]);

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
      const res = await speakingChatAction({
        scenario: chatScenarioEn || undefined,
        userTextEn: text,
        history: history.length > 0 ? history : undefined,
        targetLevel: chatLevel,
      });

      if (!res.success || !res.data) {
        const msg = res.error || "口语对话失败，请稍后重试。";
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
  }, [chatLevel, chatScenarioEn, chatTurns, toast]);

  const startRecognition = React.useCallback((kind: SpeechSessionKind) => {
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
    stopRecognition();

    if (!supportsAsr) {
      setAsrError("当前浏览器不支持语音识别（ASR）。建议使用 Edge/Chrome。");
      return;
    }
    if (!isLikelySecureContext()) {
      setAsrError("语音识别通常需要 HTTPS 或 localhost。请使用 https 访问或在本机 localhost 打开。");
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
      stopRecognition();
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

      setAttemptCandidates(candidates);
      setAttemptCandidateIndex(bestIdx);
      applyAttemptTranscript(candidates[bestIdx]!);
    };

    try {
      rec.start();
    } catch (e: any) {
      setAsrError(e?.message || "无法启动语音识别。");
      stopRecognition();
    }
  }, [applyAttemptTranscript, sendChat, stopRecognition, stopTts, supportsAsr]);

  const canEvaluate = targetText.trim().length > 0;

  const voiceOptions = React.useMemo(() => {
    const en = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
    return en.length > 0 ? en : voices;
  }, [voices]);

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>听说训练</CardTitle>
        <CardDescription>使用浏览器的语音识别（ASR）与语音合成（TTS）进行跟读训练与近似评估。</CardDescription>
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

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1">
              <Label htmlFor="targetText">目标文本（英文）</Label>
              <div className="text-xs text-muted-foreground">你可以手动输入，也可以点击“语音输入”自动录入。</div>
            </div>
            <div className="flex gap-2">
              {sessionKind === "target" ? (
                <Button type="button" variant="outline" size="sm" onClick={stopRecognition}>
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!supportsAsr || sessionKind !== null}
                  onClick={() => startRecognition("target")}
                >
                  <Mic className="mr-2 h-4 w-4" />
                  语音输入
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!targetText && !heardText && !score && !interimText}
                onClick={() => {
                  stopTts();
                  stopRecognition();
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
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">示范朗读（TTS）</div>
              <div className="text-xs text-muted-foreground">点击播放，先听一遍，再跟读。</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={!supportsTts || !targetText.trim() || isSpeaking} onClick={speak}>
                <Volume2 className="mr-2 h-4 w-4" />
                播放
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!supportsTts || !isSpeaking} onClick={stopTts}>
                <VolumeX className="mr-2 h-4 w-4" />
                停止
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
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
                <Button type="button" size="sm" variant="outline" onClick={stopRecognition}>
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!supportsAsr || !canEvaluate || sessionKind !== null}
                  onClick={() => startRecognition("attempt")}
                >
                  <Mic className="mr-2 h-4 w-4" />
                  开始跟读
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
                <div className="space-y-1">
                  <Label>识别候选（可切换）</Label>
                  <Select
                    value={String(attemptCandidateIndex)}
                    onValueChange={(v) => {
                      const idx = Number(v);
                      if (!Number.isFinite(idx)) return;
                      if (!attemptCandidates[idx]) return;
                      setAttemptCandidateIndex(idx);
                      applyAttemptTranscript(attemptCandidates[idx]!);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择候选" />
                    </SelectTrigger>
                    <SelectContent>
                      {attemptCandidates.map((c, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {c.length > 80 ? `${c.slice(0, 80)}…` : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">已默认选择匹配度最高的候选。</div>
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

        <Separator />

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
            <div className="space-y-1">
              <Label>场景</Label>
              <Select
                value={chatScenarioId}
                onValueChange={(v) => {
                  setChatScenarioId(v);
                  resetChat();
                }}
                disabled={isChatting || sessionKind !== null}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择对话场景" />
                </SelectTrigger>
                <SelectContent>
                  {SPEAKING_CHAT_SCENARIOS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.labelZh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    </div>

                    <div className="rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs text-muted-foreground">AI（英文回复）</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!t.assistantReplyEn || isSpeaking || sessionKind !== null}
                          onClick={() => speakText(t.assistantReplyEn || "")}
                        >
                          <Volume2 className="mr-2 h-4 w-4" />
                          播放
                        </Button>
                      </div>
                      <div className="whitespace-pre-wrap">
                        {t.assistantReplyEn ? t.assistantReplyEn : (isChatting ? "AI 正在回复..." : "（等待回复）")}
                      </div>
                    </div>

                    {(t.feedbackZh || t.correctedUserEn || (t.issues?.length || 0) > 0 || typeof t.scoreOverall === "number") && (
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
                    )}
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
                <Button type="button" size="sm" variant="outline" onClick={stopRecognition}>
                  <Square className="mr-2 h-4 w-4" />
                  停止说话
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!supportsAsr || sessionKind !== null || isChatting}
                  onClick={() => startRecognition("chat")}
                >
                  <Mic className="mr-2 h-4 w-4" />
                  开始说话
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
              <Button
                type="button"
                variant="outline"
                onClick={stopTts}
                disabled={!supportsTts || !isSpeaking}
                className="w-full sm:w-auto"
              >
                <VolumeX className="mr-2 h-4 w-4" />
                停止朗读
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
