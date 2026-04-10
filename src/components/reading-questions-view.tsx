"use client";

import * as React from "react";
import { CheckCircle, XCircle } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const READING_QUESTION_STATS_STORAGE_KEY = "lexi-capture-reading-question-stats-v1";
const MAX_STATS_ENTRIES = 80;

type ReadingQuestionStats = {
  attempts: number;
  best: number;
  last: number;
  total: number;
  bestAt?: number;
  lastAt?: number;
};

function safeParseJsonObject(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, any>;
  } catch {
    return {};
  }
}

function readStatsStore(): Record<string, ReadingQuestionStats> {
  const obj = safeParseJsonObject(localStorage.getItem(READING_QUESTION_STATS_STORAGE_KEY));
  const store: Record<string, ReadingQuestionStats> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof key !== "string" || !key) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const attempts = Number((value as any).attempts);
    const best = Number((value as any).best);
    const last = Number((value as any).last);
    const total = Number((value as any).total);
    const bestAt = typeof (value as any).bestAt === "number" ? (value as any).bestAt : undefined;
    const lastAt = typeof (value as any).lastAt === "number" ? (value as any).lastAt : undefined;

    if (!Number.isFinite(attempts) || attempts < 0) continue;
    if (!Number.isFinite(best) || best < 0) continue;
    if (!Number.isFinite(last) || last < 0) continue;
    if (!Number.isFinite(total) || total <= 0) continue;

    store[key] = { attempts, best, last, total, bestAt, lastAt };
  }

  return store;
}

function writeStatsStore(store: Record<string, ReadingQuestionStats>) {
  const entries = Object.entries(store);
  if (entries.length > MAX_STATS_ENTRIES) {
    entries.sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0));
    store = Object.fromEntries(entries.slice(0, MAX_STATS_ENTRIES));
  }

  localStorage.setItem(READING_QUESTION_STATS_STORAGE_KEY, JSON.stringify(store));
}

export type ReadingQuestion = {
  questionEn: string;
  options: string[];
  answerIndex: number;
  analysisZh: string;
  locate?: {
    paragraphIndex?: number;
    quoteEn?: string;
  };
};

interface ReadingQuestionsViewProps {
  questions: ReadingQuestion[];
  persistKey?: string;
}

export function ReadingQuestionsView({ questions, persistKey }: ReadingQuestionsViewProps) {
  const { toast } = useToast();
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [wrongOnly, setWrongOnly] = React.useState(false);
  const [stats, setStats] = React.useState<ReadingQuestionStats | null>(null);

  const persistedThisRoundRef = React.useRef(false);

  const isCorrect = (q: ReadingQuestion, idx: number) => {
    // If not submitted, not correct/wrong yet
    if (!submitted) return false;
    // If no answer selected, treat as wrong
    if (typeof answers[idx] !== "number") return false;
    return answers[idx] === q.answerIndex;
  };

  const correctCount = React.useMemo(() => {
    if (!submitted) return 0;
    return questions.filter((q, idx) => isCorrect(q, idx)).length;
  }, [questions, answers, submitted]);

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    setWrongOnly(false);
    persistedThisRoundRef.current = false;
  };

  React.useEffect(() => {
    if (!persistKey) {
      setStats(null);
      persistedThisRoundRef.current = false;
      return;
    }

    try {
      const store = readStatsStore();
      setStats(store[persistKey] || null);
    } catch {
      setStats(null);
    }
    persistedThisRoundRef.current = false;
  }, [persistKey]);

  React.useEffect(() => {
    if (!persistKey) return;
    if (!submitted) return;
    if (persistedThisRoundRef.current) return;
    persistedThisRoundRef.current = true;

    try {
      const total = questions.length;
      const score = correctCount;
      const now = Date.now();
      const store = readStatsStore();
      const prev = store[persistKey];

      const next: ReadingQuestionStats = prev
        ? {
          ...prev,
          attempts: prev.attempts + 1,
          last: score,
          total,
          lastAt: now,
          best: score > prev.best ? score : prev.best,
          bestAt: score > prev.best ? now : prev.bestAt,
        }
        : {
          attempts: 1,
          best: score,
          last: score,
          total,
          bestAt: now,
          lastAt: now,
        };

      store[persistKey] = next;
      writeStatsStore(store);
      setStats(next);
    } catch (e: any) {
      console.error("Failed to persist reading question stats", e);
    }
  }, [persistKey, submitted, correctCount, questions.length]);

  const clearStats = () => {
    if (!persistKey) return;
    try {
      const store = readStatsStore();
      if (store[persistKey]) {
        delete store[persistKey];
        writeStatsStore(store);
      }
      setStats(null);
      toast({ title: "已清除记录", description: "已清除本篇文章的阅读题记录。" });
    } catch {
      toast({ variant: "destructive", title: "清除失败", description: "无法清除记录，请稍后重试。" });
    }
  };

  const questionItems = questions.map((q, index) => ({ q, index }));
  const visibleItems = submitted && wrongOnly
    ? questionItems.filter(({ q, index }) => !isCorrect(q, index))
    : questionItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            共 <span className="font-medium text-foreground">{questions.length}</span> 题
          </div>
          {persistKey && stats && (
            <div className="text-xs text-muted-foreground">
              本篇记录：练习 {stats.attempts} 次 · 最佳 {stats.best}/{stats.total} · 上次 {stats.last}/{stats.total}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {submitted ? (
            <>
              <div className="text-sm text-muted-foreground mr-1">
                得分：<span className="font-semibold text-foreground">{correctCount}</span> / {questions.length}
              </div>
              <Button
                type="button"
                variant={wrongOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setWrongOnly((v) => !v)}
              >
                只看错题
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                重做
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              重置作答
            </Button>
          )}
          {persistKey && stats && (
            <Button type="button" variant="ghost" size="sm" onClick={clearStats}>
              清除记录
            </Button>
          )}
        </div>
      </div>

      {submitted && wrongOnly && visibleItems.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">全部答对了。</div>
      )}

      {visibleItems.map(({ q, index }) => {
        const correct = submitted ? isCorrect(q, index) : undefined;
        const hasParagraphIndex = typeof q.locate?.paragraphIndex === "number";
        const hasQuote = typeof q.locate?.quoteEn === "string" && q.locate.quoteEn.trim().length > 0;
        const hasLocate = hasParagraphIndex || hasQuote;
        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">第 {index + 1} 题</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">{q.questionEn}</CardDescription>
                </div>
                {submitted && (
                  <div className="pt-1 flex flex-col items-center gap-1">
                    {correct ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    )}
                    {submitted && typeof answers[index] !== "number" && (
                      <span className="text-xs text-rose-600 dark:text-rose-400">未作答</span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <RadioGroup
                value={typeof answers[index] === "number" ? String(answers[index]) : ""}
                onValueChange={(value) => setAnswers((prev) => ({ ...prev, [index]: Number(value) }))}
                disabled={submitted}
              >
                {q.options.map((option, optionIndex) => {
                  const isCorrectOption = optionIndex === q.answerIndex;
                  const isSelected = answers[index] === optionIndex;

                  const className = submitted
                    ? isCorrectOption
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : isSelected
                        ? "text-rose-600 dark:text-rose-400 line-through"
                        : "text-muted-foreground"
                    : "";

                  return (
                    <div key={optionIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={String(optionIndex)} id={`rq${index}-o${optionIndex}`} />
                      <Label htmlFor={`rq${index}-o${optionIndex}`} className={cn("flex items-center gap-2", className)}>
                        <span className="font-mono text-xs text-muted-foreground">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        <span>{option}</span>
                        {submitted && isCorrectOption && (
                          <CheckCircle className="ml-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {submitted && isSelected && !isCorrectOption && (
                          <XCircle className="ml-2 h-4 w-4 text-rose-600 dark:text-rose-400" />
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {submitted && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="text-sm text-muted-foreground">
                    正确答案：{" "}
                    <span className="text-foreground">
                      {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
                    </span>
                  </div>

                  <Accordion type="single" collapsible>
                    <AccordionItem value="explain" className="border-none">
                      <AccordionTrigger className="py-2 text-sm">答案与解析</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {hasLocate && (
                            <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground space-y-2">
                              <div className="font-semibold text-foreground">定位依据</div>
                              {hasParagraphIndex && <div>段落：第 {q.locate!.paragraphIndex} 段</div>}
                              {hasQuote && (
                                <div className="whitespace-pre-wrap leading-relaxed">
                                  <span className="font-medium text-foreground">原文：</span>
                                  {q.locate!.quoteEn}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{q.analysisZh}</div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!submitted && questions.length > 0 && (
        <Button type="button" onClick={() => setSubmitted(true)} className="w-full">
          提交答案
        </Button>
      )}
    </div>
  );
}
