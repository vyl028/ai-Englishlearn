"use client";

import * as React from "react";
import { Copy, Eye, ListPlus, Loader2, RotateCcw, Upload } from "lucide-react";

import { defineTermAutoAction, extractTextFromFileAction, studyArticleAction } from "@/app/actions";
import type { CapturedWord, DefineTermAutoOutput, StudyArticleOutput, WordEnrichment } from "@/lib/types";
import { extractTextFromImage } from "@/lib/ocr-utils";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ReadingQuestionsView } from "@/components/reading-questions-view";

interface ArticleReadingViewProps {
  words: CapturedWord[];
  onAddWords: (words: CapturedWord[]) => void;
}

function normalizeTermKey(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’()\[\]{}<>.,!?;:]+|[\s"'“”‘’()\[\]{}<>.,!?;:]+$/g, "");
}

function normalizePartOfSpeech(raw: string | undefined) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return undefined;
  if (v === "noun" || v === "n" || v === "n.") return "noun";
  if (v === "pronoun" || v === "pron" || v === "pron.") return "pronoun";
  if (v === "verb" || v === "v" || v === "v.") return "verb";
  if (v === "adjective" || v === "adj" || v === "adj.") return "adjective";
  if (v === "adverb" || v === "adv" || v === "adv.") return "adverb";
  if (v === "preposition" || v === "prep" || v === "prep.") return "preposition";
  if (v === "conjunction" || v === "conj" || v === "conj.") return "conjunction";
  if (v === "interjection" || v === "interj" || v === "interj.") return "interjection";
  if (v === "phrase") return "phrase";
  return undefined;
}

function hashFnv1a32(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function buildArticleReadingPersistKey(title: string, text: string) {
  const t = String(title || "").trim();
  const c = String(text || "").trim();
  if (!c) return undefined;
  const base = `${t}\n\n${c}`.trim();
  const h = hashFnv1a32(base).toString(36);
  const len = base.length.toString(36);
  return `article:${h}:${len}`;
}

export function ArticleReadingView({ words, onAddWords }: ArticleReadingViewProps) {
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [includeQuestions, setIncludeQuestions] = React.useState(false);
  const [questionCount, setQuestionCount] = React.useState(6);

  const [result, setResult] = React.useState<StudyArticleOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisProgress, setAnalysisProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [analysisMeta, setAnalysisMeta] = React.useState<{ chunkCount: number; paragraphCount: number; questionsLimited: boolean } | null>(null);
  const [isParsingFile, setIsParsingFile] = React.useState(false);
  const [addingKey, setAddingKey] = React.useState<string | null>(null);
  const [fileReadInfo, setFileReadInfo] = React.useState<{ filename?: string; warnings: string[] } | null>(null);
  const [fileWarningsOpen, setFileWarningsOpen] = React.useState(false);

  const [analysisOpen, setAnalysisOpen] = React.useState<string[]>([]);

  const [vocabFilter, setVocabFilter] = React.useState<"all" | "unadded" | "added">("all");

  const [bulkAddOpen, setBulkAddOpen] = React.useState(false);
  const [bulkCandidates, setBulkCandidates] = React.useState<Array<{ key: string; term: string; kind: "keyword" | "phrase"; meaningZh?: string }>>([]);
  const [bulkSelectedKeys, setBulkSelectedKeys] = React.useState<Set<string>>(() => new Set());
  const [bulkAdding, setBulkAdding] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [bulkFailures, setBulkFailures] = React.useState<Array<{ term: string; error: string }>>([]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<{
    key: string;
    term: string;
    kind: "keyword" | "phrase";
    pos?: string;
    meaningZh: string;
    noteZh?: string;
    exampleEn?: string;
  } | null>(null);
  const [previewGenerated, setPreviewGenerated] = React.useState<DefineTermAutoOutput | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const existingWordKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      const key = normalizeTermKey(w.word);
      if (key) set.add(key);
    }
    return set;
  }, [words]);

  const questionsPersistKey = React.useMemo(() => buildArticleReadingPersistKey(title, text), [title, text]);

  const wordbookEntriesByKey = React.useMemo(() => {
    const map = new Map<string, CapturedWord[]>();
    for (const w of words) {
      const key = normalizeTermKey(w.word);
      if (!key) continue;
      const prev = map.get(key);
      if (prev) prev.push(w);
      else map.set(key, [w]);
    }

    for (const items of map.values()) {
      items.sort((a, b) => String(a.partOfSpeech || "").localeCompare(String(b.partOfSpeech || "")));
    }

    return map;
  }, [words]);

  const allAnalysisExpanded = analysisOpen.includes("structure")
    && analysisOpen.includes("syntax")
    && analysisOpen.includes("hard");

  React.useEffect(() => {
    if (result) return;
    setAnalysisOpen([]);
    setAnalysisProgress(null);
    setAnalysisMeta(null);
    setBulkAddOpen(false);
    setBulkCandidates([]);
    setBulkSelectedKeys(new Set());
    setBulkFailures([]);
    setPreviewOpen(false);
    setPreviewItem(null);
    setPreviewGenerated(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, [result]);

  const resetAll = () => {
    setTitle("");
    setText("");
    setIncludeQuestions(false);
    setQuestionCount(6);
    setResult(null);
    setAnalysisProgress(null);
    setAnalysisMeta(null);
    setFileReadInfo(null);
    setFileWarningsOpen(false);
    setAnalysisOpen([]);
    setVocabFilter("all");
    setBulkAddOpen(false);
    setBulkCandidates([]);
    setBulkSelectedKeys(new Set());
    setBulkAdding(false);
    setBulkProgress(null);
    setBulkFailures([]);
    setPreviewOpen(false);
    setPreviewItem(null);
    setPreviewGenerated(null);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsParsingFile(true);
    setResult(null);
    setFileReadInfo(null);
    setFileWarningsOpen(false);

    try {
      // Check if file is an image
      const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);

      if (isImage) {
        // Use frontend OCR for images
        console.log("[ArticleReading] Detected image file, using frontend OCR");
        const reader = new FileReader();
        const imageDataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const extractedText = await extractTextFromImage(imageDataUri);

        if (!extractedText || extractedText.length < 10) {
          toast({
            variant: "destructive",
            title: "识别失败",
            description: "未能从图片中识别到足够文字，请尝试更清晰的图片或手动输入。",
          });
          return;
        }

        setText(extractedText);
        const warnings: string[] = [];
        setFileReadInfo({ filename: file.name, warnings });
        toast({
          title: "图片识别完成",
          description: `已从图片识别出 ${extractedText.length} 字符，请检查并按需修正。`,
        });
      } else {
        // Use backend for text/PDF/docx files
        const formData = new FormData();
        formData.append("file", file);
        const res = await extractTextFromFileAction(formData);
        if (res.success && res.data?.text) {
          setText(res.data.text);
          const warnings = (res.data.warnings || [])
            .map((w) => String(w || "").trim())
            .filter(Boolean);
          setFileReadInfo({ filename: res.data.filename || file.name, warnings });
          setFileWarningsOpen(warnings.length > 0);
          toast({
            title: "已读取文件",
            description: warnings.length > 0
              ? `已读取：${res.data.filename || file.name}（有 ${warnings.length} 条提示）`
              : `已读取：${res.data.filename || file.name}`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "读取失败",
            description: res.error || "无法读取该文件，请重试。",
          });
        }
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

  const copyFileWarnings = async () => {
    if (!fileReadInfo || fileReadInfo.warnings.length === 0) return;
    const lines = [
      fileReadInfo.filename ? `文件：${fileReadInfo.filename}` : "文件读取提示",
      ...fileReadInfo.warnings.map((w, i) => `${i + 1}. ${w}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "已复制", description: "已复制文件读取提示到剪贴板。" });
    } catch {
      toast({ variant: "destructive", title: "复制失败", description: "当前环境不支持剪贴板复制，请手动选择复制。" });
    }
  };

  const splitTextToParagraphs = (raw: string) => {
    const normalized = String(raw || "").trim().replace(/\r\n/g, "\n");
    if (!normalized) return [];

    let paragraphs = normalized
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1) {
      const lines = normalized
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length > 1) {
        const rebuilt: string[] = [];
        let current = "";
        for (const line of lines) {
          current = current ? `${current} ${line}` : line;
          const endsSentence = /[.!?]["')\]]?$/.test(line);
          if (current.length >= 900 || (current.length >= 600 && endsSentence)) {
            rebuilt.push(current.trim());
            current = "";
          }
        }
        if (current.trim()) rebuilt.push(current.trim());
        if (rebuilt.length > 1) paragraphs = rebuilt;
      }
    }

    return paragraphs.length > 0 ? paragraphs : [normalized];
  };

  const renderReadingMode = () => {
    const trimmed = text.trim();
    const paragraphs = splitTextToParagraphs(trimmed);

    return (
      <div className="space-y-3">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">阅读模式</CardTitle>
            <CardDescription>更像阅读器的原文展示（段落序号可用于对照题目定位）。</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {paragraphs.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无正文。</div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {title.trim() && <div className="text-lg font-semibold">{title.trim()}</div>}
                <div className="text-xs text-muted-foreground">
                  共 <span className="font-medium text-foreground">{paragraphs.length}</span> 段，{trimmed.length} 字符
                </div>
                <div className="space-y-4 text-sm leading-7 md:text-base">
                  {paragraphs.map((p, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-7 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">{i + 1}</div>
                      <div className="whitespace-pre-wrap">{p}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const mergeChunkStudyResults = (parts: Array<{
    startParagraphIndex: number;
    paragraphCount: number;
    output: StudyArticleOutput;
  }>, includeQuestions: boolean) => {
    const first = parts[0]?.output;
    if (!first) return null;

    if (parts.length === 1) {
      return {
        ...first,
        questions: includeQuestions ? first.questions : undefined,
      } satisfies StudyArticleOutput;
    }

    const mergedParagraphs: StudyArticleOutput["structure"]["paragraphs"] = [];
    const mergedRelations: NonNullable<StudyArticleOutput["structure"]["relations"]> = [];
    const mergedHighlights: NonNullable<StudyArticleOutput["syntax"]["highlights"]> = [];
    const mergedHard: StudyArticleOutput["hardSentences"] = [];
    const mergedKeywords: StudyArticleOutput["keywords"] = [];
    const mergedPhrases: NonNullable<StudyArticleOutput["phrases"]> = [];

    const overallIdeaPieces: string[] = [];
    const outlinePieces: string[] = [];
    const syntaxPieces: string[] = [];

    for (const part of parts) {
      const offset = Math.max(0, part.startParagraphIndex - 1);
      const endParagraphIndex = part.startParagraphIndex + Math.max(0, part.paragraphCount - 1);
      const rangeLabel = part.paragraphCount > 1
        ? `第 ${part.startParagraphIndex}-${endParagraphIndex} 段`
        : `第 ${part.startParagraphIndex} 段`;

      overallIdeaPieces.push(`${rangeLabel}：${part.output.structure.overallMainIdeaZh}`);
      if (part.output.structure.outlineZh) {
        outlinePieces.push(`${rangeLabel}：\n${part.output.structure.outlineZh}`);
      }
      syntaxPieces.push(`${rangeLabel}：\n${part.output.syntax.overviewZh}`);

      for (const p of part.output.structure.paragraphs) {
        mergedParagraphs.push({ ...p, index: p.index + offset });
      }

      if (Array.isArray(part.output.structure.relations)) {
        for (const rel of part.output.structure.relations) {
          mergedRelations.push({ ...rel, from: rel.from + offset, to: rel.to + offset });
        }
      }

      if (Array.isArray(part.output.syntax.highlights)) {
        mergedHighlights.push(...part.output.syntax.highlights);
      }

      mergedHard.push(...part.output.hardSentences);
      mergedKeywords.push(...part.output.keywords);
      if (Array.isArray(part.output.phrases)) mergedPhrases.push(...part.output.phrases);
    }

    const dedupKeywordMap = new Map<string, StudyArticleOutput["keywords"][number]>();
    for (const k of mergedKeywords) {
      const key = normalizeTermKey(k.term);
      if (!key) continue;
      if (!dedupKeywordMap.has(key)) dedupKeywordMap.set(key, k);
    }

    const dedupPhraseMap = new Map<string, NonNullable<StudyArticleOutput["phrases"]>[number]>();
    for (const p of mergedPhrases) {
      const key = normalizeTermKey(p.phrase);
      if (!key) continue;
      if (!dedupPhraseMap.has(key)) dedupPhraseMap.set(key, p);
    }

    const merged: StudyArticleOutput = {
      ...first,
      structure: {
        ...first.structure,
        overallMainIdeaZh: overallIdeaPieces.join("\n"),
        outlineZh: outlinePieces.length > 0 ? outlinePieces.join("\n\n") : undefined,
        paragraphs: mergedParagraphs,
        relations: mergedRelations.length > 0 ? mergedRelations : undefined,
      },
      syntax: {
        ...first.syntax,
        overviewZh: syntaxPieces.join("\n\n"),
        highlights: mergedHighlights.length > 0 ? mergedHighlights : undefined,
      },
      hardSentences: mergedHard,
      keywords: Array.from(dedupKeywordMap.values()),
      phrases: dedupPhraseMap.size > 0 ? Array.from(dedupPhraseMap.values()) : undefined,
      questions: includeQuestions ? first.questions : undefined,
    };

    return merged;
  };

  const handleAnalyze = async () => {
    console.log("[ArticleReadingView] handleAnalyze called, text:", text, "length:", text?.length);
    const trimmed = text.trim();
    console.log("[ArticleReadingView] trimmed text length:", trimmed?.length);
    if (!trimmed) {
      console.log("[ArticleReadingView] Empty text, returning");
      toast({ variant: "destructive", title: "请输入文章", description: "请粘贴或上传英文文章正文后再开始分析。" });
      return;
    }

    console.log("[ArticleReadingView] Starting analysis...");
    setIsAnalyzing(true);
    setAnalysisProgress(null);
    setAnalysisMeta(null);
    setResult(null);

    const baseTitle = title.trim() || undefined;
    console.log("[ArticleReadingView] baseTitle:", baseTitle, "includeQuestions:", includeQuestions);
    try {
      if (trimmed.length <= 16000) {
        console.log("[ArticleReadingView] Calling studyArticleAction...");
        const res = await studyArticleAction({
          title: baseTitle,
          text: trimmed,
          includeQuestions,
          questionCount,
        });
        console.log("[ArticleReadingView] studyArticleAction returned:", res);

        if (res.success && res.data) {
          console.log("[ArticleReadingView] Setting result data");
          setResult(res.data);
          toast({ title: "分析完成", description: "已生成结构、句法、难句拆解与词汇提取结果。" });
        } else {
          toast({
            variant: "destructive",
            title: "分析失败",
            description: res.error || "文章分析失败，请稍后重试。",
          });
        }
        return;
      }

      const MAX_CHUNK_CHARS = 12000;
      const paragraphs = splitTextToParagraphs(trimmed);
      if (paragraphs.length === 0) {
        toast({ variant: "destructive", title: "分析失败", description: "无法解析正文段落，请检查正文格式后重试。" });
        return;
      }

      const chunks: Array<{ startParagraphIndex: number; paragraphCount: number; text: string }> = [];
      let buffer: string[] = [];
      let bufferLen = 0;
      let startIndex = 1;

      for (let i = 0; i < paragraphs.length; i += 1) {
        const p = paragraphs[i];
        const addLen = (buffer.length > 0 ? 2 : 0) + p.length;

        if (buffer.length > 0 && bufferLen + addLen > MAX_CHUNK_CHARS) {
          chunks.push({
            startParagraphIndex: startIndex,
            paragraphCount: buffer.length,
            text: buffer.join("\n\n"),
          });
          buffer = [];
          bufferLen = 0;
          startIndex = i + 1;
        }

        buffer.push(p);
        bufferLen += addLen;
      }

      if (buffer.length > 0) {
        chunks.push({
          startParagraphIndex: startIndex,
          paragraphCount: buffer.length,
          text: buffer.join("\n\n"),
        });
      }

      if (chunks.length === 0) {
        toast({ variant: "destructive", title: "分析失败", description: "无法分段处理该文章，请检查正文格式后重试。" });
        return;
      }

      setAnalysisMeta({ chunkCount: chunks.length, paragraphCount: paragraphs.length, questionsLimited: includeQuestions && chunks.length > 1 });

      const outputs: Array<{ startParagraphIndex: number; paragraphCount: number; output: StudyArticleOutput }> = [];
      for (let i = 0; i < chunks.length; i += 1) {
        setAnalysisProgress({ current: i + 1, total: chunks.length });
        const chunk = chunks[i];
        const res = await studyArticleAction({
          title: baseTitle,
          text: chunk.text,
          includeQuestions: includeQuestions && i === 0,
          questionCount: includeQuestions && i === 0 ? questionCount : undefined,
        });

        if (!res.success || !res.data) {
          throw new Error(res.error || "文章分析失败，请稍后重试。");
        }

        outputs.push({ startParagraphIndex: chunk.startParagraphIndex, paragraphCount: chunk.paragraphCount, output: res.data });
      }

      const merged = mergeChunkStudyResults(outputs, includeQuestions);
      if (!merged) {
        toast({ variant: "destructive", title: "分析失败", description: "无法合并分段结果，请重试。" });
        return;
      }

      setResult(merged);
      toast({
        title: "分析完成",
        description: chunks.length > 1
          ? `长文已自动分段分析并合并结果（共 ${chunks.length} 段）。${includeQuestions ? "题目仅基于第 1 段生成。" : ""}`
          : "已生成结构、句法、难句拆解与词汇提取结果。",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "分析出错",
        description: e?.message || "文章分析时发生未知错误。",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const cleanTermForLookup = (raw: string) =>
    String(raw || "")
      .trim()
      .replace(/^[\s"'“”‘’()\[\]{}<>.,!?;:]+|[\s"'“”‘’()\[\]{}<>.,!?;:]+$/g, "");

  const buildCapturedWordsFromDefineOutput = (
    cleanedTerm: string,
    defined: DefineTermAutoOutput,
    capturedAt: Date
  ): CapturedWord[] => {
    const seenPos = new Set<string>();
    const newWords: CapturedWord[] = [];

    for (const it of defined) {
      const normalizedPos = normalizePartOfSpeech(it.partOfSpeech);
      const rawPos = String(it.partOfSpeech || "").trim();
      const partOfSpeech = normalizedPos || rawPos || (/\s/.test(cleanedTerm) ? "phrase" : "noun");
      const posKey = partOfSpeech.toLowerCase();
      if (seenPos.has(posKey)) continue;
      seenPos.add(posKey);

      const definition = String(it.definition || "").trim();
      if (!definition) continue;

      newWords.push({
        id: generateId(),
        word: cleanedTerm,
        partOfSpeech,
        definition,
        enrichment: it.enrichment,
        capturedAt,
      });
    }

    return newWords;
  };

  const dedupeCapturedWords = (items: CapturedWord[]) => {
    const unique: CapturedWord[] = [];
    const seen = new Set<string>();
    for (const w of items) {
      const termKey = normalizeTermKey(w.word);
      const posKey = String(w.partOfSpeech || "").trim().toLowerCase();
      const key = termKey && posKey ? `${termKey}|${posKey}` : "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(w);
    }
    return unique;
  };

  const hasEnrichmentContent = (enrichment?: WordEnrichment) => {
    if (!enrichment) return false;
    const hasLevel = !!(enrichment.level?.cefr || enrichment.level?.usageZh);
    const hasCollocations = Array.isArray(enrichment.collocations) && enrichment.collocations.length > 0;
    const hasSynonyms = Array.isArray(enrichment.synonyms) && enrichment.synonyms.length > 0;
    const hasAntonyms = Array.isArray(enrichment.antonyms) && enrichment.antonyms.length > 0;
    const hasExamples = Array.isArray(enrichment.examples) && enrichment.examples.length > 0;
    return hasLevel || hasCollocations || hasSynonyms || hasAntonyms || hasExamples;
  };

  const openVocabPreview = (item: NonNullable<typeof previewItem>) => {
    setPreviewItem(item);
    setPreviewGenerated(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewOpen(true);
  };

  const closeVocabPreview = () => {
    setPreviewOpen(false);
    setPreviewItem(null);
    setPreviewGenerated(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  const generateVocabPreview = async () => {
    if (!previewItem) return;
    const cleanedTerm = cleanTermForLookup(previewItem.term);
    const key = normalizeTermKey(cleanedTerm);
    if (!cleanedTerm || !key) {
      setPreviewError("词条为空或无效。");
      toast({ variant: "destructive", title: "无法生成", description: "该词条为空或无效，请重试。" });
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await defineTermAutoAction({ term: cleanedTerm });
      if (!res.success || !res.data) {
        setPreviewGenerated(null);
        setPreviewError(res.error || "无法生成词条内容，请稍后重试。");
        return;
      }
      setPreviewGenerated(res.data);
    } catch (e: any) {
      setPreviewGenerated(null);
      setPreviewError(e?.message || "生成词条时发生未知错误。");
    } finally {
      setPreviewLoading(false);
    }
  };

  const addPreviewToWordBook = () => {
    if (!previewItem || !previewGenerated) return;
    const cleanedTerm = cleanTermForLookup(previewItem.term);
    const key = normalizeTermKey(cleanedTerm);
    if (!cleanedTerm || !key) {
      toast({ variant: "destructive", title: "无法加入", description: "该词条为空或无效，请重试。" });
      return;
    }

    const newWords = buildCapturedWordsFromDefineOutput(cleanedTerm, previewGenerated, new Date());
    if (newWords.length === 0) {
      toast({ variant: "destructive", title: "加入失败", description: "模型未返回有效结果，请稍后重试。" });
      return;
    }

    onAddWords(newWords);
    toast({ title: "已加入单词本", description: `已为 “${cleanedTerm}” 生成释义并加入单词本。` });
    closeVocabPreview();
  };

  const bulkAddSelectedTerms = async () => {
    if (bulkAdding) return;

    const selected = bulkCandidates.filter((c) => bulkSelectedKeys.has(c.key));
    if (selected.length === 0) {
      toast({ variant: "destructive", title: "未选择词汇", description: "请先勾选要加入的词汇。" });
      return;
    }

    setBulkAdding(true);
    setBulkProgress({ done: 0, total: selected.length });
    setBulkFailures([]);

    try {
      const nextWords: CapturedWord[] = [];
      const failures: Array<{ term: string; error: string }> = [];

      for (let i = 0; i < selected.length; i += 1) {
        const item = selected[i];
        const cleanedTerm = cleanTermForLookup(item.term);
        const key = normalizeTermKey(cleanedTerm);

        if (!cleanedTerm || !key) {
          failures.push({ term: item.term, error: "词条为空或无效。" });
          setBulkProgress({ done: i + 1, total: selected.length });
          continue;
        }

        if (existingWordKeys.has(key)) {
          setBulkProgress({ done: i + 1, total: selected.length });
          continue;
        }

        try {
          const res = await defineTermAutoAction({ term: cleanedTerm });
          if (!res.success || !res.data) {
            failures.push({ term: cleanedTerm, error: res.error || "无法生成词条内容。" });
          } else {
            nextWords.push(...buildCapturedWordsFromDefineOutput(cleanedTerm, res.data, new Date()));
          }
        } catch (e: any) {
          failures.push({ term: cleanedTerm, error: e?.message || "生成词条时发生未知错误。" });
        } finally {
          setBulkProgress({ done: i + 1, total: selected.length });
        }
      }

      const uniqueWords = dedupeCapturedWords(nextWords);
      if (uniqueWords.length > 0) {
        onAddWords(uniqueWords);
      }

      setBulkFailures(failures);

      if (failures.length === 0) {
        toast({ title: "批量加入完成", description: `已加入 ${uniqueWords.length} 条词条。` });
        setBulkAddOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "批量加入部分失败",
          description: `已加入 ${uniqueWords.length} 条词条，失败 ${failures.length} 个（可在弹窗查看失败原因）。`,
        });
      }
    } finally {
      setBulkAdding(false);
      setBulkProgress(null);
    }
  };

  const addToWordBook = async (params: {
    term: string;
    meaningZh: string;
    pos?: string;
    noteZh?: string;
    exampleEn?: string;
    kind: "keyword" | "phrase";
  }) => {
    const cleanedTerm = cleanTermForLookup(params.term);
    const key = normalizeTermKey(cleanedTerm);
    if (!key) {
      toast({ variant: "destructive", title: "无法添加", description: "该词条为空或无效，请重试。" });
      return;
    }

    setAddingKey(key);
    try {
      const res = await defineTermAutoAction({ term: cleanedTerm });
      if (!res.success || !res.data) {
        toast({
          variant: "destructive",
          title: "加入失败",
          description: res.error || "无法生成词条内容，请稍后重试。",
        });
        return;
      }

      const newWords = buildCapturedWordsFromDefineOutput(cleanedTerm, res.data, new Date());
      if (newWords.length === 0) {
        toast({ variant: "destructive", title: "加入失败", description: "模型未返回有效结果，请稍后重试。" });
        return;
      }

      onAddWords(newWords);
      toast({ title: "已生成词条", description: `已为 “${cleanedTerm}” 生成释义，正在加入单词本...` });
    } finally {
      setAddingKey((prev) => (prev === key ? null : prev));
    }
  };

  const renderStructure = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">文章结构分析</CardTitle>
          <CardDescription>段落主旨 + 段落间逻辑关系</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">全文主旨</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.structure.overallMainIdeaZh}</div>
          </div>

          {r.structure.outlineZh && (
            <div className="space-y-1">
              <div className="text-sm font-medium">结构提纲</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.structure.outlineZh}</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">段落主旨</div>
            <div className="space-y-2">
              {(r.structure.paragraphs || []).map((p) => (
                <div key={p.index} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">第 {p.index} 段</Badge>
                    {p.roleZh && <Badge variant="outline">{p.roleZh}</Badge>}
                    {p.logicToPrevZh && <Badge variant="outline">与前文：{p.logicToPrevZh}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.mainIdeaZh}</div>
                </div>
              ))}
            </div>
          </div>

          {(r.structure.relations?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">逻辑关系（补充）</div>
              <div className="space-y-2">
                {(r.structure.relations || []).slice(0, 12).map((rel, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    第 {rel.from} 段 → 第 {rel.to} 段：{rel.relationZh}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSyntax = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">句法结构解析</CardTitle>
          <CardDescription>从句 / 时态 / 语态 / 修饰结构等</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{r.syntax.overviewZh}</div>

          {(r.syntax.highlights?.length || 0) > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">代表性句子讲解</div>
              <div className="space-y-2">
                {(r.syntax.highlights || []).map((h, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium whitespace-pre-wrap">{h.sentenceEn}</div>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {(h.pointsZh || []).slice(0, 6).map((pt, j) => (
                        <li key={j} className="whitespace-pre-wrap">{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderHardSentences = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">难句拆解与重组</CardTitle>
          <CardDescription>主干提取 + 从句拆解 + 简化与重写示范</CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {(r.hardSentences || []).map((s, i) => (
            <div key={i} className="rounded-md border p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">原句</div>
                <div className="text-sm whitespace-pre-wrap">{s.originalEn}</div>
                {s.translationZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">中文：{s.translationZh}</div>}
              </div>

              {(s.coreStructureEn || s.tenseVoiceZh) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {s.coreStructureEn && (
                    <div className="text-sm">
                      <div className="font-medium">主干</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.coreStructureEn}</div>
                    </div>
                  )}
                  {s.tenseVoiceZh && (
                    <div className="text-sm">
                      <div className="font-medium">时态/语态</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.tenseVoiceZh}</div>
                    </div>
                  )}
                </div>
              )}

              {(s.clauses?.length || 0) > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">从句/结构拆解</div>
                  <div className="space-y-2">
                    {(s.clauses || []).slice(0, 10).map((c, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="whitespace-pre-wrap">{c.clauseEn}</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">{c.functionZh}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.explanationZh && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{s.explanationZh}</div>
              )}

              {(s.simplifiedEn || s.rebuiltEn) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {s.simplifiedEn && (
                    <div className="text-sm">
                      <div className="font-medium">简化表达</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.simplifiedEn}</div>
                    </div>
                  )}
                  {s.rebuiltEn && (
                    <div className="text-sm">
                      <div className="font-medium">重组/更地道表达</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{s.rebuiltEn}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderVocabulary = (r: StudyArticleOutput) => {
    type VocabItem = {
      key: string;
      kind: "keyword" | "phrase";
      term: string;
      pos?: string;
      meaningZh: string;
      noteZh?: string;
      exampleEn?: string;
    };

    const keywordItems: VocabItem[] = (r.keywords || [])
      .map((k) => ({
        key: normalizeTermKey(k.term),
        kind: "keyword" as const,
        term: k.term,
        pos: k.pos,
        meaningZh: k.meaningZh,
        noteZh: k.noteZh,
        exampleEn: k.exampleEn,
      }))
      .filter((it) => !!it.key);

    const phraseItems: VocabItem[] = (r.phrases || [])
      .map((p) => ({
        key: normalizeTermKey(p.phrase),
        kind: "phrase" as const,
        term: p.phrase,
        meaningZh: p.meaningZh,
        noteZh: p.noteZh,
        exampleEn: p.exampleEn,
      }))
      .filter((it) => !!it.key);

    const allItems = [...keywordItems, ...phraseItems];
    const uniqueMap = new Map<string, VocabItem>();
    for (const it of allItems) {
      if (!uniqueMap.has(it.key)) uniqueMap.set(it.key, it);
    }
    const uniqueItems = Array.from(uniqueMap.values());

    const addedCount = uniqueItems.filter((it) => existingWordKeys.has(it.key)).length;
    const unaddedCount = uniqueItems.filter((it) => !existingWordKeys.has(it.key)).length;

    const matchesFilter = (it: VocabItem) => {
      const inBook = existingWordKeys.has(it.key);
      if (vocabFilter === "added") return inBook;
      if (vocabFilter === "unadded") return !inBook;
      return true;
    };

    const visibleKeywords = keywordItems.filter(matchesFilter);
    const visiblePhrases = phraseItems.filter(matchesFilter);

    const unaddedCandidates = uniqueItems
      .filter((it) => !existingWordKeys.has(it.key))
      .sort((a, b) => a.term.localeCompare(b.term));

    const openBulkDialog = () => {
      if (unaddedCandidates.length === 0) return;
      const candidates = unaddedCandidates.map((it) => ({
        key: it.key,
        term: it.term,
        kind: it.kind,
        meaningZh: it.meaningZh,
      }));
      setBulkCandidates(candidates);
      setBulkSelectedKeys(new Set(candidates.map((c) => c.key)));
      setBulkFailures([]);
      setBulkProgress(null);
      setBulkAddOpen(true);
    };

    const renderEnrichment = (enrichment?: WordEnrichment) => {
      if (!hasEnrichmentContent(enrichment)) {
        return <div className="text-xs text-muted-foreground">暂无拓展信息。</div>;
      }

      return (
        <div className="space-y-3">
          {(enrichment?.level?.cefr || enrichment?.level?.usageZh) && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">难度与用法</div>
              <div className="mt-1 text-sm">
                {enrichment.level?.cefr && <span className="mr-2">CEFR: {enrichment.level.cefr}</span>}
                {enrichment.level?.usageZh && <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{enrichment.level.usageZh}</div>}
              </div>
            </div>
          )}

          {Array.isArray(enrichment?.collocations) && (enrichment?.collocations?.length || 0) > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">常见搭配</div>
              <ul className="mt-1 space-y-1 text-sm">
                {(enrichment?.collocations || []).slice(0, 6).map((c, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    <span className="text-foreground">{c.phrase}</span>
                    {c.meaningZh ? ` — ${c.meaningZh}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(enrichment?.synonyms) && (enrichment?.synonyms?.length || 0) > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">同义词</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {(enrichment?.synonyms || []).slice(0, 10).join(", ")}
              </div>
            </div>
          )}

          {Array.isArray(enrichment?.antonyms) && (enrichment?.antonyms?.length || 0) > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">反义词</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {(enrichment?.antonyms || []).slice(0, 10).join(", ")}
              </div>
            </div>
          )}

          {Array.isArray(enrichment?.examples) && (enrichment?.examples?.length || 0) > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">例句</div>
              <ul className="mt-1 space-y-2 text-sm">
                {(enrichment?.examples || []).slice(0, 4).map((ex, idx) => (
                  <li key={idx}>
                    <div className="text-foreground whitespace-pre-wrap">{ex.en}</div>
                    {ex.zh && <div className="text-muted-foreground whitespace-pre-wrap">{ex.zh}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    };

    const renderPreviewEntries = (entries: Array<{ partOfSpeech: string; definition: string; enrichment?: WordEnrichment }>) => (
      <div className="space-y-3">
        {entries.map((e, idx) => (
          <div key={`${e.partOfSpeech}-${idx}`} className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{e.partOfSpeech}</Badge>
            </div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{e.definition}</div>
            {renderEnrichment(e.enrichment)}
          </div>
        ))}
      </div>
    );

    const renderVocabCard = (it: VocabItem) => {
      const inBook = existingWordKeys.has(it.key);
      return (
        <div key={`${it.kind}-${it.key}`} className="rounded-md border p-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{it.term}</span>
              {it.pos && <Badge variant="outline">{it.pos}</Badge>}
              {inBook && <Badge variant="secondary">已在单词本</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={bulkAdding}
                onClick={() => openVocabPreview({
                  key: it.key,
                  term: it.term,
                  kind: it.kind,
                  pos: it.pos,
                  meaningZh: it.meaningZh,
                  noteZh: it.noteZh,
                  exampleEn: it.exampleEn,
                })}
              >
                <Eye className="mr-2 h-4 w-4" />
                预览
              </Button>
              <Button
                type="button"
                size="sm"
                variant={inBook ? "secondary" : "outline"}
                disabled={inBook || bulkAdding || addingKey === it.key}
                onClick={() =>
                  void addToWordBook({
                    kind: it.kind,
                    term: it.term,
                    meaningZh: it.meaningZh,
                    pos: it.pos,
                    noteZh: it.noteZh,
                    exampleEn: it.exampleEn,
                  })
                }
              >
                {addingKey === it.key ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加入中...
                  </>
                ) : inBook ? (
                  "已在单词本"
                ) : (
                  "加入单词本"
                )}
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{it.meaningZh}</div>
          {it.noteZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{it.noteZh}</div>}
          {it.exampleEn && (
            <div className="text-sm whitespace-pre-wrap">
              <span className="text-muted-foreground">例句：</span>
              {it.exampleEn}
            </div>
          )}
        </div>
      );
    };

    const previewLocalEntries = previewItem ? wordbookEntriesByKey.get(previewItem.key) : undefined;
    const previewInBook = previewItem ? existingWordKeys.has(previewItem.key) : false;

    const previewGeneratedEntries = previewGenerated
      ? previewGenerated
        .map((it) => ({
          partOfSpeech: String(it.partOfSpeech || "").trim() || (/\s/.test(cleanTermForLookup(previewItem?.term || "")) ? "phrase" : "noun"),
          definition: String(it.definition || "").trim(),
          enrichment: it.enrichment,
        }))
        .filter((it) => !!it.definition)
      : [];

    const previewLocalConverted = (previewLocalEntries || []).map((w) => ({
      partOfSpeech: String(w.partOfSpeech || "").trim() || "unknown",
      definition: String(w.definition || "").trim(),
      enrichment: w.enrichment,
    }));

    return (
      <div className="space-y-3">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">关键词与核心短语</CardTitle>
            <CardDescription>按“已在单词本/未加入”筛选，并支持批量加入与本地预览。</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                共 <span className="font-medium text-foreground">{uniqueItems.length}</span> 个（已在单词本 {addedCount} / 未加入 {unaddedCount}）
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={vocabFilter === "all" ? "secondary" : "outline"} onClick={() => setVocabFilter("all")}>
                  全部（{uniqueItems.length}）
                </Button>
                <Button type="button" size="sm" variant={vocabFilter === "unadded" ? "secondary" : "outline"} onClick={() => setVocabFilter("unadded")}>
                  未加入（{unaddedCount}）
                </Button>
                <Button type="button" size="sm" variant={vocabFilter === "added" ? "secondary" : "outline"} onClick={() => setVocabFilter("added")}>
                  已在单词本（{addedCount}）
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={bulkAdding || unaddedCandidates.length === 0}
                  onClick={openBulkDialog}
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  批量加入未加入
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">关键词</div>
              {visibleKeywords.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无符合条件的关键词。</div>
              ) : (
                <div className="space-y-2">
                  {visibleKeywords.map((it) => renderVocabCard(it))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">核心短语</div>
              {phraseItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">本次未提取到核心短语。</div>
              ) : visiblePhrases.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无符合条件的短语。</div>
              ) : (
                <div className="space-y-2">
                  {visiblePhrases.map((it) => renderVocabCard(it))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={bulkAddOpen}
          onOpenChange={(v) => {
            if (bulkAdding) return;
            setBulkAddOpen(v);
            if (!v) {
              setBulkFailures([]);
              setBulkCandidates([]);
              setBulkSelectedKeys(new Set());
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>批量加入未加入词汇</DialogTitle>
              <DialogDescription>
                勾选要加入的词汇，一次性生成并加入单词本。
              </DialogDescription>
            </DialogHeader>

            <div className="shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  已选 <span className="font-medium text-foreground">{bulkSelectedKeys.size}</span> / {bulkCandidates.length}
                  {bulkProgress && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      进度：{bulkProgress.done}/{bulkProgress.total}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkAdding || bulkCandidates.length === 0}
                    onClick={() => setBulkSelectedKeys(new Set(bulkCandidates.map((c) => c.key)))}
                  >
                    全选
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkAdding || bulkCandidates.length === 0}
                    onClick={() => setBulkSelectedKeys(new Set())}
                  >
                    全不选
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-2">
                {bulkCandidates.map((c, idx) => (
                  <div key={c.key} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={bulkSelectedKeys.has(c.key)}
                        disabled={bulkAdding}
                        onCheckedChange={(checked) => {
                          setBulkSelectedKeys((prev) => {
                            const next = new Set(prev);
                            if (checked === true) next.add(c.key);
                            else next.delete(c.key);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.term}</span>
                          <Badge variant="outline" className="text-xs">{c.kind === "keyword" ? "关键词" : "短语"}</Badge>
                        </div>
                        {c.meaningZh && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{c.meaningZh}</div>}
                      </div>
                    </div>
                    {idx !== bulkCandidates.length - 1 && <Separator />}
                  </div>
                ))}
              </div>

              {bulkFailures.length > 0 && (
                <div className="mt-4 rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="text-sm font-medium">失败清单</div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                    {bulkFailures.slice(0, 12).map((f, i) => (
                      <li key={`${f.term}-${i}`} className="whitespace-pre-wrap">
                        {f.term}：{f.error}
                      </li>
                    ))}
                    {bulkFailures.length > 12 && <li>……（共 {bulkFailures.length} 条）</li>}
                  </ul>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" disabled={bulkAdding} onClick={() => setBulkAddOpen(false)}>
                关闭
              </Button>
              <Button type="button" disabled={bulkAdding || bulkSelectedKeys.size === 0} onClick={() => void bulkAddSelectedTerms()}>
                {bulkAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加入中...
                  </>
                ) : (
                  "加入选中"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={previewOpen}
          onOpenChange={(v) => {
            if (previewLoading) return;
            if (!v) closeVocabPreview();
            else setPreviewOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>词条预览</DialogTitle>
              <DialogDescription>
                {previewItem ? (
                  <span>
                    {previewItem.term}（{previewItem.kind === "keyword" ? "关键词" : "短语"}）
                  </span>
                ) : (
                  "查看释义与拓展信息。"
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-4">
                {previewItem && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{previewItem.term}</span>
                      {previewItem.pos && <Badge variant="outline">{previewItem.pos}</Badge>}
                      {previewInBook && <Badge variant="secondary">已在单词本</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{previewItem.meaningZh}</div>
                    {previewItem.noteZh && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{previewItem.noteZh}</div>}
                    {previewItem.exampleEn && (
                      <div className="text-sm whitespace-pre-wrap">
                        <span className="text-muted-foreground">例句：</span>
                        {previewItem.exampleEn}
                      </div>
                    )}
                  </div>
                )}

                {previewLocalConverted.length > 0 ? (
                  renderPreviewEntries(previewLocalConverted)
                ) : previewGeneratedEntries.length > 0 ? (
                  renderPreviewEntries(previewGeneratedEntries)
                ) : (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="text-sm font-medium">尚未生成预览</div>
                    <div className="text-sm text-muted-foreground">
                      当前词条未在单词本中，点击下方“生成并预览”即可查看释义与拓展信息。
                    </div>
                    {previewError && <div className="text-sm text-destructive whitespace-pre-wrap">{previewError}</div>}
                  </div>
                )}

                {previewLocalConverted.length === 0 && previewGeneratedEntries.length > 0 && previewError && (
                  <div className="text-sm text-destructive whitespace-pre-wrap">{previewError}</div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" disabled={previewLoading} onClick={closeVocabPreview}>
                关闭
              </Button>
              {previewLocalConverted.length === 0 && (
                <>
                  {previewGeneratedEntries.length > 0 ? (
                    <Button type="button" disabled={previewLoading} onClick={addPreviewToWordBook}>
                      加入单词本
                    </Button>
                  ) : (
                    <Button type="button" disabled={previewLoading || !previewItem} onClick={() => void generateVocabPreview()}>
                      {previewLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        "生成并预览"
                      )}
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderQuestions = (r: StudyArticleOutput) => (
    <div className="space-y-3">
      {(r.questions?.length || 0) > 0 ? (
        <>
          {analysisMeta?.questionsLimited && (
            <Alert>
              <AlertTitle>提示</AlertTitle>
              <AlertDescription>长文已分段分析，题目仅基于第 1 段生成。</AlertDescription>
            </Alert>
          )}
          <ReadingQuestionsView questions={r.questions!} persistKey={questionsPersistKey} />
        </>
      ) : (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">题目</CardTitle>
            <CardDescription>可在上方开启“生成题目”后重新分析。</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-sm text-muted-foreground">本次未生成题目。</div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>文章阅读</CardTitle>
        <CardDescription>
          上传或粘贴英文文章（支持图片识别），AI 将提供结构分析、句法讲解、难句拆解、关键词/短语提取，并可选生成题目帮助理解。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            文章内容会发送到大语言模型进行分析，请勿上传包含隐私或敏感信息的内容。PDF 若为扫描版可能无法正确提取文本；图片会进行 OCR 识别，建议检查识别结果并按需手动修正。
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">上传文章文件/图片</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleFilePick} disabled={isParsingFile || isAnalyzing} className="w-full sm:w-auto">
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
            <Input readOnly value={text ? `已载入正文（${text.length} 字符）` : "未载入"} className="text-muted-foreground" />
          </div>
        </div>

        {fileReadInfo && fileReadInfo.warnings.length > 0 && (
          <Collapsible open={fileWarningsOpen} onOpenChange={setFileWarningsOpen}>
            <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm">文件读取提示</CardTitle>
                    <CardDescription>
                      {fileReadInfo.filename ? `文件：${fileReadInfo.filename}` : "文件读取提示"}（{fileReadInfo.warnings.length} 条）
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyFileWarnings()}>
                      <Copy className="mr-2 h-4 w-4" />
                      复制
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button type="button" size="sm" variant="secondary">
                        {fileWarningsOpen ? "收起" : "展开"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pb-4">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {fileReadInfo.warnings.map((w, i) => (
                      <li key={i} className="whitespace-pre-wrap">{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">文章标题（可选）</div>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setResult(null);
            }}
            placeholder="例如：The Future of Education"
            disabled={isAnalyzing || isParsingFile}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">文章正文（英文）</div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder="在此粘贴英文文章正文..."
            className="min-h-[240px]"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck="false"
            disabled={isAnalyzing || isParsingFile}
          />
        </div>

        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">生成题目（可选）</div>
              <div className="text-xs text-muted-foreground">生成阅读理解题，便于检验理解与学习效果。</div>
            </div>
            <Switch
              checked={includeQuestions}
              onCheckedChange={(v) => {
                setIncludeQuestions(!!v);
                setResult(null);
              }}
              disabled={isAnalyzing || isParsingFile}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="questionCount">题目数量</Label>
              <Input
                id="questionCount"
                type="number"
                min={1}
                max={12}
                value={questionCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setQuestionCount(Math.max(1, Math.min(12, Math.floor(n))));
                  setResult(null);
                }}
                disabled={!includeQuestions || isAnalyzing || isParsingFile}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              建议 6 题左右；文章较长时可适当增加。
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={() => { console.log("[ArticleReadingView] Button clicked"); handleAnalyze(); }} disabled={isAnalyzing || isParsingFile} className="w-full sm:w-auto">
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {analysisProgress ? `正在分析（${analysisProgress.current}/${analysisProgress.total}）...` : "正在分析..."}
              </>
            ) : (
              "开始分析"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={resetAll} disabled={isAnalyzing || isParsingFile} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            清空
          </Button>
        </div>

        {result && (
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="reading" className="shrink-0">阅读</TabsTrigger>
              <TabsTrigger value="analysis" className="shrink-0">分析</TabsTrigger>
              <TabsTrigger value="vocab" className="shrink-0">词汇</TabsTrigger>
              <TabsTrigger value="questions" className="shrink-0">题目</TabsTrigger>
            </TabsList>

            <TabsContent value="reading" className="mt-4">
              {renderReadingMode()}
            </TabsContent>
            <TabsContent value="analysis" className="mt-4">
              <div className="space-y-3">
                {analysisMeta && analysisMeta.chunkCount > 1 && (
                  <Alert>
                    <AlertTitle>长文已分段分析</AlertTitle>
                    <AlertDescription>
                      已将正文按段落分为 <span className="font-medium">{analysisMeta.chunkCount}</span> 段进行分析并合并结果（共 {analysisMeta.paragraphCount} 段落）。
                      {analysisMeta.questionsLimited ? " 题目仅基于第 1 段生成。" : ""}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    分析结果默认折叠：可单独展开，或使用“展开全部”。
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAnalysisOpen(allAnalysisExpanded ? [] : ["structure", "syntax", "hard"])}
                  >
                    {allAnalysisExpanded ? "收起全部" : "展开全部"}
                  </Button>
                </div>

                <Accordion type="multiple" value={analysisOpen} onValueChange={setAnalysisOpen} className="w-full">
                  <AccordionItem value="structure">
                    <AccordionTrigger>结构（段落主旨与逻辑）</AccordionTrigger>
                    <AccordionContent>{renderStructure(result)}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="syntax">
                    <AccordionTrigger>句法（从句/时态/语态）</AccordionTrigger>
                    <AccordionContent>{renderSyntax(result)}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="hard">
                    <AccordionTrigger>难句（拆解与重组）</AccordionTrigger>
                    <AccordionContent>{renderHardSentences(result)}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>
            <TabsContent value="vocab" className="mt-4">
              {renderVocabulary(result)}
            </TabsContent>
            <TabsContent value="questions" className="mt-4">
              {renderQuestions(result)}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
