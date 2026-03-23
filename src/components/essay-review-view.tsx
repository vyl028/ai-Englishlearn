"use client";

import * as React from "react";
import { ClipboardCopy, Download, History, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";

import { reviewEssayAction, extractTextFromFileAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { ReviewEssayOutput, EssayIssueCategory, EssayIssueSeverity } from "@/lib/types";
import { generateId } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ESSAY_TEXT_CHAR_LIMIT = 12000;
const ESSAY_TEXT_CHAR_WARN = 10500;

const ESSAY_REVIEW_DRAFT_STORAGE_KEY = "lexi-capture-essay-review-draft-v1";
const ESSAY_REVIEW_LAST_STORAGE_KEY = "lexi-capture-essay-review-last-v1";
const ESSAY_REVIEW_HISTORY_STORAGE_KEY = "lexi-capture-essay-review-history-v1";
const ESSAY_REVIEW_HISTORY_LIMIT = 10;

function categoryLabel(category: EssayIssueCategory) {
  switch (category) {
    case "grammar":
      return "语法";
    case "spelling":
      return "拼写";
    case "tense":
      return "时态";
    case "logic":
      return "逻辑";
    case "coherence":
      return "衔接";
    case "task_response":
      return "任务回应";
    case "word_choice":
      return "用词";
    case "punctuation":
      return "标点";
    case "style":
      return "风格";
    case "other":
    default:
      return "其他";
  }
}

function severityLabel(severity: EssayIssueSeverity) {
  switch (severity) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
    default:
      return "低";
  }
}

function formatBand(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(1).replace(/\.0$/, ".0");
}

function computeEssayTextStats(raw: string) {
  const trimmed = String(raw || "").trim();
  const charCount = trimmed.length;

  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

  const sentenceMatches = trimmed.match(/[.!?]+(?=\s|$)/g) || [];
  const sentenceCount = trimmed && sentenceMatches.length === 0 ? 1 : sentenceMatches.length;

  const paragraphs = trimmed
    ? trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
    : [];
  const paragraphCount = trimmed && paragraphs.length === 0 ? 1 : paragraphs.length;

  return { charCount, wordCount, sentenceCount, paragraphCount };
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

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSnippetRange(haystack: string, needle: string) {
  const text = String(haystack || "");
  const snippet = String(needle || "").trim();
  if (!text || !snippet) return null as null | { start: number; end: number };

  let index = text.indexOf(snippet);
  if (index >= 0) return { start: index, end: index + snippet.length };

  const textLower = text.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  index = textLower.indexOf(snippetLower);
  if (index >= 0) return { start: index, end: index + snippet.length };

  const parts = snippet.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    try {
      const pattern = parts.map(escapeRegExp).join("\\s+");
      const re = new RegExp(pattern, "i");
      const m = re.exec(text);
      if (m && typeof m.index === "number" && m[0]) return { start: m.index, end: m.index + m[0].length };
    } catch {
      // ignore
    }
  }

  return null;
}

function computeSimpleDiff(before: string, after: string) {
  const b = String(before || "");
  const a = String(after || "");

  let start = 0;
  const minLen = Math.min(a.length, b.length);
  while (start < minLen && a[start] === b[start]) start += 1;

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1;
    endB -= 1;
  }

  const beforePrefix = b.slice(0, start);
  const beforeChanged = b.slice(start, endB + 1);
  const beforeSuffix = b.slice(endB + 1);

  const afterPrefix = a.slice(0, start);
  const afterChanged = a.slice(start, endA + 1);
  const afterSuffix = a.slice(endA + 1);

  return {
    before: { prefix: beforePrefix, changed: beforeChanged, suffix: beforeSuffix },
    after: { prefix: afterPrefix, changed: afterChanged, suffix: afterSuffix },
  };
}

function buildEssayPreview(text: string, maxLen = 120) {
  const oneLine = String(text || "").trim().replace(/\s+/g, " ");
  if (!oneLine) return "";
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, Math.max(0, maxLen - 1))}…`;
}

type EssayReviewDraft = {
  taskPrompt: string;
  text: string;
  updatedAt: number;
};

type EssayReviewSaved = {
  id: string;
  taskPrompt: string;
  text: string;
  result: ReviewEssayOutput;
  savedAt: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readEssayReviewDraft(): EssayReviewDraft | null {
  const parsed = safeParseJson(localStorage.getItem(ESSAY_REVIEW_DRAFT_STORAGE_KEY));
  if (!isPlainObject(parsed)) return null;
  if (typeof parsed.taskPrompt !== "string") return null;
  if (typeof parsed.text !== "string") return null;
  const updatedAt = Number(parsed.updatedAt);
  if (!Number.isFinite(updatedAt)) return null;
  return { taskPrompt: parsed.taskPrompt, text: parsed.text, updatedAt };
}

function readEssayReviewLast(): EssayReviewSaved | null {
  const parsed = safeParseJson(localStorage.getItem(ESSAY_REVIEW_LAST_STORAGE_KEY));
  if (!isPlainObject(parsed)) return null;
  if (typeof parsed.taskPrompt !== "string") return null;
  if (typeof parsed.text !== "string") return null;
  if (!isPlainObject(parsed.result)) return null;
  if (typeof parsed.result.revisedTextEn !== "string") return null;
  const savedAt = Number(parsed.savedAt);
  if (!Number.isFinite(savedAt)) return null;
  const id = typeof parsed.id === "string" && parsed.id ? parsed.id : `last-${savedAt}`;
  return { id, taskPrompt: parsed.taskPrompt, text: parsed.text, result: parsed.result as ReviewEssayOutput, savedAt };
}

function readEssayReviewHistory(): EssayReviewSaved[] {
  const parsed = safeParseJson(localStorage.getItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];

  const items: EssayReviewSaved[] = [];
  for (const raw of parsed) {
    if (!isPlainObject(raw)) continue;
    if (typeof raw.taskPrompt !== "string") continue;
    if (typeof raw.text !== "string") continue;
    if (!isPlainObject(raw.result)) continue;
    if (typeof raw.result.revisedTextEn !== "string") continue;
    const savedAt = Number(raw.savedAt);
    if (!Number.isFinite(savedAt)) continue;
    const id = typeof raw.id === "string" && raw.id ? raw.id : `history-${savedAt}-${items.length}`;
    items.push({ id, taskPrompt: raw.taskPrompt, text: raw.text, result: raw.result as ReviewEssayOutput, savedAt });
  }

  items.sort((a, b) => b.savedAt - a.savedAt);
  return items.slice(0, ESSAY_REVIEW_HISTORY_LIMIT);
}

export function EssayReviewView() {
  const { toast } = useToast();
  const [taskPrompt, setTaskPrompt] = React.useState("");
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<ReviewEssayOutput | null>(null);
  const [resultTab, setResultTab] = React.useState<"score" | "issues" | "revised" | "compare">("score");
  const [issueCategoryFilter, setIssueCategoryFilter] = React.useState<"all" | EssayIssueCategory>("all");
  const [issueSeverityFilter, setIssueSeverityFilter] = React.useState<"all" | "unknown" | EssayIssueSeverity>("all");
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [highlightDiff, setHighlightDiff] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [history, setHistory] = React.useState<EssayReviewSaved[]>([]);
  const [pendingDeleteHistory, setPendingDeleteHistory] = React.useState<EssayReviewSaved | null>(null);
  const [confirmClearHistoryOpen, setConfirmClearHistoryOpen] = React.useState(false);
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [isParsingFile, setIsParsingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hasLoadedRef = React.useRef(false);
  const persistErrorToastShownRef = React.useRef(false);
  const originalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const pendingLocateSnippetRef = React.useRef<string | null>(null);

  const textStats = React.useMemo(() => computeEssayTextStats(text), [text]);

  const filteredIssues = React.useMemo(() => {
    if (!result?.issues) return [];
    return result.issues.filter((it) => {
      if (issueCategoryFilter !== "all" && it.category !== issueCategoryFilter) return false;
      if (issueSeverityFilter === "all") return true;
      if (issueSeverityFilter === "unknown") return !it.severity;
      return it.severity === issueSeverityFilter;
    });
  }, [result, issueCategoryFilter, issueSeverityFilter]);

  React.useEffect(() => {
    if (!result) return;
    setResultTab("score");
    setIssueCategoryFilter("all");
    setIssueSeverityFilter("all");
    setShowAllIssues(false);
    setHighlightDiff(false);
  }, [result]);

  React.useEffect(() => {
    setShowAllIssues(false);
  }, [issueCategoryFilter, issueSeverityFilter]);

  React.useEffect(() => {
    if (resultTab !== "compare") return;
    const snippet = pendingLocateSnippetRef.current;
    if (!snippet) return;
    pendingLocateSnippetRef.current = null;

    const essayText = text.trim();
    const range = findSnippetRange(essayText, snippet);
    if (!range) {
      toast({ variant: "destructive", title: "未找到原文片段", description: "无法在原文中定位该片段（可能原文已变更或模型返回不一致）。" });
      return;
    }

    const el = originalTextareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(range.start, range.end);
    el.scrollIntoView({ block: "center" });
  }, [resultTab, text, toast]);

  React.useEffect(() => {
    if (hasLoadedRef.current) return;
    try {
      const draft = readEssayReviewDraft();
      const last = readEssayReviewLast();
      const rawHistory = localStorage.getItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY);
      const storedHistory = readEssayReviewHistory();
      const draftAt = draft?.updatedAt ?? -1;
      const lastAt = last?.savedAt ?? -1;
      let nextHistory = storedHistory;

      if (rawHistory === null && storedHistory.length === 0 && last) {
        nextHistory = [last];
        try {
          localStorage.setItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        } catch (e) {
          console.error("Failed to migrate essay review last -> history", e);
        }
      }
      setHistory(nextHistory);

      if (draft && (!last || draftAt > lastAt)) {
        setTaskPrompt(draft.taskPrompt);
        setText(draft.text);
        setResult(null);
        toast({ title: "已恢复草稿", description: "已从本地恢复未提交的草稿内容。" });
      } else if (last) {
        setTaskPrompt(last.taskPrompt);
        setText(last.text);
        setResult(last.result);
        toast({ title: "已恢复上次结果", description: "已从本地恢复最近一次批改结果。" });
      }
    } catch (e) {
      console.error("Failed to load essay review draft/last", e);
    } finally {
      hasLoadedRef.current = true;
    }
  }, [toast]);

  React.useEffect(() => {
    if (!hasLoadedRef.current) return;
    const handle = window.setTimeout(() => {
      try {
        const hasContent = taskPrompt.trim().length > 0 || text.trim().length > 0;
        if (!hasContent) {
          localStorage.removeItem(ESSAY_REVIEW_DRAFT_STORAGE_KEY);
          return;
        }

        const draft: EssayReviewDraft = {
          taskPrompt,
          text,
          updatedAt: Date.now(),
        };
        localStorage.setItem(ESSAY_REVIEW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.error("Failed to persist essay review draft", e);
        if (!persistErrorToastShownRef.current) {
          persistErrorToastShownRef.current = true;
          toast({ variant: "destructive", title: "本地保存失败", description: "无法写入本地草稿（可能是浏览器存储空间不足）。" });
        }
      }
    }, 350);

    return () => window.clearTimeout(handle);
  }, [taskPrompt, text, toast]);

  const clearEssayReviewLocalData = () => {
    try {
      localStorage.removeItem(ESSAY_REVIEW_DRAFT_STORAGE_KEY);
      localStorage.removeItem(ESSAY_REVIEW_LAST_STORAGE_KEY);
      localStorage.removeItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear essay review local data", e);
    }

    setTaskPrompt("");
    setText("");
    setResult(null);
    setResultTab("score");
    setIssueCategoryFilter("all");
    setIssueSeverityFilter("all");
    setShowAllIssues(false);
    setHighlightDiff(false);
    setHistory([]);
    toast({ title: "已清空本模块数据", description: "已清空草稿、上次结果与历史记录（仅本机 localStorage）。" });
  };

  const resetAll = () => {
    setTaskPrompt("");
    setText("");
    setResult(null);
    setResultTab("score");
    setIssueCategoryFilter("all");
    setIssueSeverityFilter("all");
    setShowAllIssues(false);
    setHighlightDiff(false);
  };

  const clearHistoryOnly = () => {
    try {
      localStorage.setItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error("Failed to clear essay review history", e);
    }
    setHistory([]);
    toast({ title: "已清空历史记录", description: "已清空本模块最近批改历史（仅本机 localStorage）。" });
  };

  const loadHistoryItem = (item: EssayReviewSaved) => {
    setTaskPrompt(item.taskPrompt);
    setText(item.text);
    setResult(item.result);
    setHistoryOpen(false);
    toast({ title: "已载入历史记录", description: "已恢复该次批改的题目与结果（仅本机数据）。" });
  };

  const deleteHistoryItem = (item: EssayReviewSaved) => {
    const next = history.filter((it) => it.id !== item.id);
    setHistory(next);
    try {
      localStorage.setItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(next.slice(0, ESSAY_REVIEW_HISTORY_LIMIT)));
    } catch (e) {
      console.error("Failed to persist essay review history after delete", e);
    }
    toast({ title: "已删除一条历史记录", description: "该条记录已从本机 localStorage 删除。" });
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsParsingFile(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await extractTextFromFileAction(formData);
      if (res.success && res.data?.text) {
        setText(res.data.text);

        const warningText = (res.data.warnings || []).filter(Boolean).join("；");
        toast({
          title: "已读取文件",
          description: warningText ? warningText : `已读取：${res.data.filename || file.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "读取失败",
          description: res.error || "无法读取该文件，请重试。",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "读取出错",
        description: e?.message || "读取文件时发生未知错误。",
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleReview = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "请输入作文", description: "请粘贴或上传英文作文正文后再开始批改。" });
      return;
    }

    if (trimmed.length > ESSAY_TEXT_CHAR_LIMIT) {
      const stats = computeEssayTextStats(trimmed);
      toast({
        variant: "destructive",
        title: "文本过长",
        description: `当前正文约 ${stats.wordCount} 词 / ${stats.sentenceCount} 句 / ${stats.paragraphCount} 段，字符 ${stats.charCount}（> ${ESSAY_TEXT_CHAR_LIMIT}）。建议删减或分段提交。`,
      });
      return;
    }

    setIsReviewing(true);
    setResult(null);
    try {
      const res = await reviewEssayAction({ text: trimmed, taskPrompt: taskPrompt.trim() || undefined });
      if (res.success && res.data) {
        setResult(res.data);

        const saved: EssayReviewSaved = {
          id: generateId(),
          taskPrompt,
          text: trimmed,
          result: res.data,
          savedAt: Date.now(),
        };

        try {
          localStorage.setItem(ESSAY_REVIEW_LAST_STORAGE_KEY, JSON.stringify(saved));
        } catch (e) {
          console.error("Failed to persist essay review last result", e);
          if (!persistErrorToastShownRef.current) {
            persistErrorToastShownRef.current = true;
            toast({ variant: "destructive", title: "本地保存失败", description: "无法保存最近一次批改结果（可能是浏览器存储空间不足）。" });
          }
        }

        try {
          const existing = readEssayReviewHistory();
          const next = [saved, ...existing].slice(0, ESSAY_REVIEW_HISTORY_LIMIT);
          localStorage.setItem(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(next));
          setHistory(next);
        } catch (e) {
          console.error("Failed to persist essay review history", e);
        }

        toast({ title: "批改完成", description: "已生成评分、问题清单与优化建议。" });
      } else {
        toast({
          variant: "destructive",
          title: "批改失败",
          description: res.error || "作文批改失败，请稍后重试。",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "批改出错",
        description: e?.message || "作文批改时发生未知错误。",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const locateOriginalSnippet = (snippet: string) => {
    const cleaned = String(snippet || "").trim();
    if (!cleaned) return;
    pendingLocateSnippetRef.current = cleaned;
    setResultTab("compare");
  };

  const copyRevised = async () => {
    if (!result?.revisedTextEn) return;
    try {
      await navigator.clipboard.writeText(result.revisedTextEn);
      toast({ title: "已复制", description: "优化后的作文已复制到剪贴板。" });
    } catch {
      toast({ variant: "destructive", title: "复制失败", description: "浏览器可能不允许复制，请手动选择复制。" });
    }
  };

  const exportRevised = (format: "txt" | "md") => {
    if (!result?.revisedTextEn) return;
    const now = new Date();
    const stamp = formatDateForFilename(now);

    try {
      if (format === "txt") {
        downloadTextFile({
          filename: `essay_revised_${stamp}.txt`,
          content: result.revisedTextEn,
          mime: "text/plain;charset=utf-8",
        });
        toast({ title: "已导出", description: "已导出优化版 .txt 文件。" });
        return;
      }

      const mdParts: string[] = [];
      mdParts.push("# Revised Essay");
      mdParts.push("");
      mdParts.push(`- Band (ref): ${formatBand(result.overallBand)}`);
      mdParts.push(`- ExportedAt: ${now.toISOString()}`);
      mdParts.push("");
      if (taskPrompt.trim()) {
        mdParts.push("## Task Prompt");
        mdParts.push("");
        mdParts.push(taskPrompt.trim());
        mdParts.push("");
      }
      mdParts.push("## Revised Version");
      mdParts.push("");
      mdParts.push(result.revisedTextEn.trim());
      mdParts.push("");

      downloadTextFile({
        filename: `essay_revised_${stamp}.md`,
        content: mdParts.join("\n"),
        mime: "text/markdown;charset=utf-8",
      });
      toast({ title: "已导出", description: "已导出优化版 .md 文件。" });
    } catch (e) {
      console.error("Failed to export revised essay", e);
      toast({ variant: "destructive", title: "导出失败", description: "无法导出文件，请稍后重试。" });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>作文批改（雅思写作任务 2）</CardTitle>
        <CardDescription>
          支持粘贴或上传作文（.txt / .md / .docx / .pdf / 图片 OCR），AI 将给出评分、错误点、优化建议与示范句，并输出修改前后对照。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            作文内容会发送到大语言模型进行分析，请勿上传包含隐私或敏感信息的内容。PDF 若为扫描版可能无法正确提取文本；图片会进行 OCR 识别，建议检查识别结果并按需手动修正。
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertTitle>隐私与本地保存</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>
                为便于刷新恢复，本模块会在你的浏览器本地（localStorage）保存：草稿、上次批改结果与最近 {ESSAY_REVIEW_HISTORY_LIMIT} 次历史记录。你可以随时一键清空。
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空本模块数据
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清空本模块数据？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将删除本地保存的草稿、上次结果与历史记录（仅本机浏览器）。此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={clearEssayReviewLocalData}>确认清空</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">上传作文文件/图片</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleFilePick} disabled={isParsingFile || isReviewing} className="w-full sm:w-auto">
              {isParsingFile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在读取...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  选择文件
                </>
              )}
            </Button>
            <Input
              readOnly
              value={textStats.charCount > 0 ? `已载入正文（${textStats.charCount} 字符）` : "未载入"}
              className="text-muted-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">题目（可选）</div>
          <Textarea
            value={taskPrompt}
            onChange={(e) => {
              setTaskPrompt(e.target.value);
              setResult(null);
            }}
            placeholder="粘贴写作题目（英文）。留空则按通用雅思写作任务 2 要求评估。"
            className="min-h-[80px]"
            disabled={isReviewing || isParsingFile}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">作文正文（英文）</div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder="在此粘贴英文作文正文..."
            className="min-h-[220px]"
            disabled={isReviewing || isParsingFile}
          />

          {textStats.charCount > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <div>
                  字符：<span className="font-medium">{textStats.charCount}</span>
                </div>
                <div>
                  词数：<span className="font-medium">{textStats.wordCount}</span>
                </div>
                <div>
                  句数：<span className="font-medium">{textStats.sentenceCount}</span>
                </div>
                <div>
                  段落：<span className="font-medium">{textStats.paragraphCount}</span>
                </div>
              </div>
              {textStats.charCount > ESSAY_TEXT_CHAR_LIMIT ? (
                <div className="text-sm text-destructive">
                  已超过上限 {ESSAY_TEXT_CHAR_LIMIT} 字符，建议删减或拆分为多次提交（可按段落分段）。
                </div>
              ) : textStats.charCount > ESSAY_TEXT_CHAR_WARN ? (
                <div className="text-sm text-muted-foreground">
                  已接近上限 {ESSAY_TEXT_CHAR_LIMIT} 字符；若批改失败可适当删减或分段提交。
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={handleReview} disabled={isReviewing || isParsingFile} className="w-full sm:w-auto">
            {isReviewing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在批改...
              </>
            ) : (
              "开始批改"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={resetAll} disabled={isReviewing || isParsingFile} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            清空
          </Button>
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)} disabled={isReviewing || isParsingFile} className="w-full sm:w-auto">
            <History className="mr-2 h-4 w-4" />
            历史
            {history.length ? <span className="ml-2 text-xs text-muted-foreground">({history.length})</span> : null}
          </Button>
        </div>

        {result && (
          <Tabs value={resultTab} onValueChange={(v) => setResultTab(v as any)} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="score" className="shrink-0">评分</TabsTrigger>
              <TabsTrigger value="issues" className="shrink-0">问题</TabsTrigger>
              <TabsTrigger value="revised" className="shrink-0">优化后</TabsTrigger>
              <TabsTrigger value="compare" className="shrink-0">对照</TabsTrigger>
            </TabsList>

            <TabsContent value="score" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">总分</CardTitle>
                    <CardDescription>雅思写作任务 2（仅供参考）</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="text-3xl font-bold">{formatBand(result.overallBand)}</div>
                    {result.level?.cefr && (
                      <div className="text-sm text-muted-foreground mt-1">
                        分级：{result.level.cefr}
                        {result.level.commentZh ? `（${result.level.commentZh}）` : ""}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">分项</CardTitle>
                    <CardDescription>TR / CC / LR / GRA</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>任务回应（TR）</span>
                      <span className="font-medium">{formatBand(result.scores.taskResponse)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>连贯与衔接（CC）</span>
                      <span className="font-medium">{formatBand(result.scores.coherenceCohesion)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>词汇资源（LR）</span>
                      <span className="font-medium">{formatBand(result.scores.lexicalResource)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>语法范围与准确性（GRA）</span>
                      <span className="font-medium">{formatBand(result.scores.grammaticalRangeAccuracy)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">总体反馈</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{result.summaryZh}</div>

                  {(result.strengthsZh?.length || 0) > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">优点</div>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {result.strengthsZh!.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(result.weaknessesZh?.length || 0) > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">可改进点</div>
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {result.weaknessesZh!.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issues" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">问题清单与建议</CardTitle>
                  <CardDescription>包含语法/拼写/时态/逻辑等；可直接套用示范句。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  {result.issues?.length ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">类别</div>
                          <Select value={issueCategoryFilter} onValueChange={(v) => setIssueCategoryFilter(v as any)}>
                            <SelectTrigger>
                              <SelectValue placeholder="全部类别" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">全部类别</SelectItem>
                              <SelectItem value="grammar">语法</SelectItem>
                              <SelectItem value="spelling">拼写</SelectItem>
                              <SelectItem value="tense">时态</SelectItem>
                              <SelectItem value="logic">逻辑</SelectItem>
                              <SelectItem value="coherence">衔接</SelectItem>
                              <SelectItem value="task_response">任务回应</SelectItem>
                              <SelectItem value="word_choice">用词</SelectItem>
                              <SelectItem value="punctuation">标点</SelectItem>
                              <SelectItem value="style">风格</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">严重程度</div>
                          <Select value={issueSeverityFilter} onValueChange={(v) => setIssueSeverityFilter(v as any)}>
                            <SelectTrigger>
                              <SelectValue placeholder="全部" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">全部</SelectItem>
                              <SelectItem value="high">高</SelectItem>
                              <SelectItem value="medium">中</SelectItem>
                              <SelectItem value="low">低</SelectItem>
                              <SelectItem value="unknown">未标注</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={issueCategoryFilter === "all" && issueSeverityFilter === "all"}
                            onClick={() => {
                              setIssueCategoryFilter("all");
                              setIssueSeverityFilter("all");
                            }}
                          >
                            重置筛选
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            显示 <span className="font-medium text-foreground">{filteredIssues.length}</span> / {result.issues.length}
                          </div>
                        </div>
                      </div>

                      {filteredIssues.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          暂无符合筛选条件的问题。
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(showAllIssues ? filteredIssues : filteredIssues.slice(0, 24)).map((it, idx) => (
                            <div key={idx} className="rounded-md border p-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{categoryLabel(it.category)}</Badge>
                                  {it.severity && <Badge variant="outline">严重度：{severityLabel(it.severity)}</Badge>}
                                  {!it.severity && issueSeverityFilter === "unknown" && <Badge variant="outline">严重度：未标注</Badge>}
                                </div>
                                {it.original && (
                                  <Button type="button" size="sm" variant="outline" onClick={() => locateOriginalSnippet(it.original!)}>
                                    定位原文
                                  </Button>
                                )}
                              </div>

                              {it.original && (
                                <div className="text-sm">
                                  <div className="font-medium">原句/片段</div>
                                  <div className="text-muted-foreground whitespace-pre-wrap">{it.original}</div>
                                </div>
                              )}
                              <div className="text-sm">
                                <div className="font-medium">建议改写</div>
                                <div className="whitespace-pre-wrap">{it.suggestion}</div>
                              </div>
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{it.explanationZh}</div>
                              {(it.exampleEn || it.exampleZh) && (
                                <div className="text-sm space-y-1">
                                  <div className="font-medium">示范句</div>
                                  {it.exampleEn && <div className="whitespace-pre-wrap">{it.exampleEn}</div>}
                                  {it.exampleZh && <div className="text-muted-foreground whitespace-pre-wrap">{it.exampleZh}</div>}
                                </div>
                              )}
                            </div>
                          ))}

                          {filteredIssues.length > 24 && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="text-sm text-muted-foreground">
                                {showAllIssues ? "已显示全部问题。" : "已显示前 24 条问题。"}
                              </div>
                              <Button type="button" size="sm" variant="outline" onClick={() => setShowAllIssues((v) => !v)}>
                                {showAllIssues ? "收起" : "显示全部"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">模型未返回问题清单。</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revised" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">优化后的作文（英文）</CardTitle>
                  <CardDescription>保留原意并提升雅思写作任务 2 的表达、结构与准确性。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={copyRevised} className="w-full sm:w-auto">
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      复制优化版
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => exportRevised("txt")}
                      className="w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      导出 .txt
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => exportRevised("md")}
                      className="w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      导出 .md
                    </Button>
                  </div>
                  <Textarea readOnly value={result.revisedTextEn} className="min-h-[260px]" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compare" className="space-y-3 mt-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base">修改前后对照</CardTitle>
                  <CardDescription>原文 vs 优化文 + 关键改写对照。</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">修改前</div>
                      <Textarea ref={originalTextareaRef} readOnly value={text.trim()} className="min-h-[260px]" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">修改后</div>
                      <Textarea readOnly value={result.revisedTextEn} className="min-h-[260px]" />
                    </div>
                  </div>

                  {(result.beforeAfter?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-sm font-medium">关键改写对照</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">高亮差异</div>
                          <Switch checked={highlightDiff} onCheckedChange={(v) => setHighlightDiff(!!v)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {result.beforeAfter!.slice(0, 12).map((p, i) => {
                          const diff = highlightDiff ? computeSimpleDiff(p.before, p.after) : null;
                          const hasDiff = !!(diff && (diff.before.changed || diff.after.changed));

                          return (
                            <div key={i} className="rounded-md border p-3 space-y-2">
                              <div className="text-sm">
                                <div className="font-medium">Before</div>
                                <div className="text-muted-foreground whitespace-pre-wrap">
                                  {hasDiff ? (
                                    <>
                                      <span>{diff!.before.prefix}</span>
                                      {diff!.before.changed && (
                                        <mark className="rounded-sm bg-amber-200/60 dark:bg-amber-400/20 px-0.5">
                                          {diff!.before.changed}
                                        </mark>
                                      )}
                                      <span>{diff!.before.suffix}</span>
                                    </>
                                  ) : (
                                    p.before
                                  )}
                                </div>
                              </div>
                              <div className="text-sm">
                                <div className="font-medium">After</div>
                                <div className="whitespace-pre-wrap">
                                  {hasDiff ? (
                                    <>
                                      <span>{diff!.after.prefix}</span>
                                      {diff!.after.changed && (
                                        <mark className="rounded-sm bg-amber-200/60 dark:bg-amber-400/20 px-0.5">
                                          {diff!.after.changed}
                                        </mark>
                                      )}
                                      <span>{diff!.after.suffix}</span>
                                    </>
                                  ) : (
                                    p.after
                                  )}
                                </div>
                              </div>
                              {p.reasonZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.reasonZh}</div>}
                            </div>
                          );
                        })}
                        {result.beforeAfter!.length > 12 && (
                          <div className="text-sm text-muted-foreground">
                            已显示前 12 条关键改写（共 {result.beforeAfter!.length} 条）。
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>批改历史</DialogTitle>
              <DialogDescription>
                仅保存在本机浏览器 localStorage，最多保留最近 {ESSAY_REVIEW_HISTORY_LIMIT} 次。可载入任意一条继续查看/导出。
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                共 <span className="font-medium text-foreground">{history.length}</span> 条
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmClearHistoryOpen(true)} disabled={history.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                清空历史
              </Button>
            </div>

            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">暂无历史记录</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {history.map((it) => {
                  const preview = buildEssayPreview(it.text);
                  const savedAtText = new Date(it.savedAt).toLocaleString();
                  return (
                    <div key={it.id} className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Band {formatBand(it.result.overallBand)}</Badge>
                          <span className="text-xs text-muted-foreground">{savedAtText}</span>
                        </div>
                        {preview ? <div className="text-sm text-muted-foreground break-words">{preview}</div> : null}
                        {it.taskPrompt.trim() ? (
                          <div className="text-xs text-muted-foreground break-words">
                            Prompt: {buildEssayPreview(it.taskPrompt, 160)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button type="button" size="sm" onClick={() => loadHistoryItem(it)}>
                          载入
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPendingDeleteHistory(it)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!pendingDeleteHistory}
          onOpenChange={(open) => {
            if (!open) setPendingDeleteHistory(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除这条历史记录？</AlertDialogTitle>
              <AlertDialogDescription>该条记录将从本机 localStorage 删除，此操作不可撤销。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingDeleteHistory) return;
                  const target = pendingDeleteHistory;
                  setPendingDeleteHistory(null);
                  deleteHistoryItem(target);
                }}
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmClearHistoryOpen} onOpenChange={setConfirmClearHistoryOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认清空历史记录？</AlertDialogTitle>
              <AlertDialogDescription>将删除本模块所有历史记录（仅本机 localStorage），此操作不可撤销。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmClearHistoryOpen(false);
                  clearHistoryOnly();
                }}
              >
                确认清空
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
