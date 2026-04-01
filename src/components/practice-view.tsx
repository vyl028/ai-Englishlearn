"use client";

import * as React from "react";
import { ArrowLeft, CheckCircle, GripVertical, XCircle } from "lucide-react";

import type { GeneratePracticeOutput, PracticeQuestion } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PracticeViewProps {
  practiceData: { questions: GeneratePracticeOutput };
  onBack: () => void;
  onSubmitted?: (result: { correctCount: number; totalCount: number }) => void;
  onRegenerate?: () => void;
  busy?: boolean;
}

type AnswerState = {
  mcq?: number;
  blank?: string;
  reorder?: number[];
};

function normalizeAnswer(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function joinSentence(parts: string[]) {
  return parts
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+’/g, "’")
    .replace(/\s+'/g, "'");
}

function getTypeLabel(type: PracticeQuestion["type"]) {
  switch (type) {
    case "mcq":
      return "选择题";
    case "fill_blank":
      return "填空题";
    case "reorder":
      return "句子重组";
    default:
      return type;
  }
}

export function PracticeView({ practiceData, onBack, onSubmitted, onRegenerate, busy }: PracticeViewProps) {
  const [answers, setAnswers] = React.useState<Record<number, AnswerState>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [wrongOnly, setWrongOnly] = React.useState(false);
  const [explanationOnly, setExplanationOnly] = React.useState(false);

  const [unansweredOpen, setUnansweredOpen] = React.useState(false);
  const [unansweredCount, setUnansweredCount] = React.useState(0);
  const [firstUnansweredIndex, setFirstUnansweredIndex] = React.useState<number | null>(null);

  const [appHeaderHeight, setAppHeaderHeight] = React.useState(56);
  const [draggingReorder, setDraggingReorder] = React.useState<{ questionIndex: number; fromPos: number } | null>(null);
  const [dragOverReorder, setDragOverReorder] = React.useState<{ questionIndex: number; overPos: number } | null>(null);

  const questionRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  React.useEffect(() => {
    const header = document.getElementById("app-header");
    if (!header) return;

    const update = () => {
      const h = Math.round(header.getBoundingClientRect().height);
      setAppHeaderHeight(Number.isFinite(h) && h > 0 ? h : 56);
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setWrongOnly(false);
    setExplanationOnly(false);
    setUnansweredOpen(false);
    setUnansweredCount(0);
    setFirstUnansweredIndex(null);
    setDraggingReorder(null);
    setDragOverReorder(null);
  }, [practiceData.questions]);

  const setAnswer = (questionIndex: number, patch: Partial<AnswerState>) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: { ...prev[questionIndex], ...patch },
    }));
  };

  const getReorderOrder = (q: PracticeQuestion, questionIndex: number) => {
    if (q.type !== "reorder") return [];
    const a = answers[questionIndex];
    const order = Array.isArray(a?.reorder) ? a!.reorder! : [];
    if (order.length === q.parts.length) return order;
    return q.parts.map((_, idx) => idx);
  };

  const isCorrect = (q: PracticeQuestion, questionIndex: number) => {
    if (q.type === "mcq") {
      const a = answers[questionIndex];
      return typeof a?.mcq === "number" && a.mcq === q.answerIndex;
    }

    if (q.type === "fill_blank") {
      const a = answers[questionIndex];
      const user = normalizeAnswer(a.blank || "");
      const accepted = q.acceptableAnswers.map(normalizeAnswer);
      return user.length > 0 && accepted.includes(user);
    }

    if (q.type === "reorder") {
      const order = getReorderOrder(q, questionIndex);
      return order.length === q.correctOrder.length && arraysEqual(order, q.correctOrder);
    }

    return false;
  };

  const isAnswered = (q: PracticeQuestion, questionIndex: number) => {
    if (q.type === "mcq") return typeof answers[questionIndex]?.mcq === "number";
    if (q.type === "fill_blank") return normalizeAnswer(answers[questionIndex]?.blank || "").length > 0;
    if (q.type === "reorder") return getReorderOrder(q, questionIndex).length === q.parts.length;
    return false;
  };

  const totalCount = practiceData.questions.length;

  const answeredCount = practiceData.questions.filter((q, idx) => isAnswered(q, idx)).length;
  const correctCount = submitted ? practiceData.questions.filter((q, idx) => isCorrect(q, idx)).length : 0;

  const submitNow = () => {
    const correct = practiceData.questions.filter((q, idx) => isCorrect(q, idx)).length;
    setSubmitted(true);
    onSubmitted?.({ correctCount: correct, totalCount: totalCount });
  };

  const requestSubmit = () => {
    const missing = practiceData.questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q, idx }) => !isAnswered(q, idx))
      .map(({ idx }) => idx);

    if (missing.length > 0) {
      setUnansweredCount(missing.length);
      setFirstUnansweredIndex(missing[0]);
      setUnansweredOpen(true);
      return;
    }

    submitNow();
  };

  const resetAll = () => {
    setAnswers({});
    setSubmitted(false);
    setWrongOnly(false);
    setExplanationOnly(false);
    setUnansweredOpen(false);
    setUnansweredCount(0);
    setFirstUnansweredIndex(null);
    setDraggingReorder(null);
    setDragOverReorder(null);
  };

  const renderExplanation = (q: PracticeQuestion, options?: { alwaysOpen?: boolean }) => {
    const body = (
      <div className="space-y-3 text-sm">
        {options?.alwaysOpen && <div className="font-semibold">答案与解析</div>}
        <div>
          <div className="font-semibold">详细解析</div>
          <div className="text-muted-foreground whitespace-pre-wrap">{q.analysisZh}</div>
        </div>
        <div>
          <div className="font-semibold">语法讲解</div>
          <div className="text-muted-foreground whitespace-pre-wrap">{q.grammarZh}</div>
        </div>
        <div>
          <div className="font-semibold">用法讲解</div>
          <div className="text-muted-foreground whitespace-pre-wrap">{q.usageZh}</div>
        </div>
      </div>
    );

    if (options?.alwaysOpen) return body;

    return (
      <Accordion type="single" collapsible>
        <AccordionItem value="explain" className="border-none">
          <AccordionTrigger className="py-2 text-sm">答案与解析</AccordionTrigger>
          <AccordionContent>{body}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const interactionDisabled = submitted || busy === true;
  const showAnswerArea = !submitted || !explanationOnly;

  const questionItems = practiceData.questions.map((q, index) => ({ q, index }));
  const visibleItems = submitted && wrongOnly
    ? questionItems.filter(({ q, index }) => !isCorrect(q, index))
    : questionItems;

  return (
    <div className="space-y-6">
      <div
        className="sticky z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ top: appHeaderHeight }}
      >
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            disabled={busy}
            aria-label="返回单词本"
            title="返回单词本"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold font-headline leading-tight truncate">练习</h2>
                <div className="text-xs text-muted-foreground">
                  已答 <span className="font-medium text-foreground">{answeredCount}</span> / {totalCount}
                  {submitted && (
                    <>
                      {" "}
                      · 得分 <span className="font-semibold text-foreground">{correctCount}</span> / {totalCount}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end w-full sm:w-auto">
                {submitted && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={wrongOnly ? "secondary" : "outline"}
                      onClick={() => setWrongOnly((v) => !v)}
                      disabled={busy}
                      aria-label="只看错题"
                      title="只看错题"
                    >
                      只看错题
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={explanationOnly ? "secondary" : "outline"}
                      onClick={() => setExplanationOnly((v) => !v)}
                      disabled={busy}
                      aria-label="只看解析"
                      title="只看解析"
                    >
                      只看解析
                    </Button>
                  </>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetAll}
                  disabled={busy}
                  aria-label="重做本套题"
                  title="重做本套题"
                >
                  重做本套题
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={!onRegenerate || busy}
                  aria-label="再生成一套"
                  title="再生成一套"
                >
                  再生成一套
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {submitted && wrongOnly && visibleItems.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">全部答对了。</div>
      )}

      {visibleItems.map(({ q, index }) => {
        const correct = submitted ? isCorrect(q, index) : undefined;
        return (
          <div
            key={index}
            ref={(el) => {
              questionRefs.current[index] = el;
            }}
            style={{ scrollMarginTop: appHeaderHeight + 140 }}
          >
            <Card
              tabIndex={q.type === "mcq" && !interactionDisabled ? 0 : undefined}
              onKeyDown={
                q.type === "mcq"
                  ? (e) => {
                      if (interactionDisabled) return;
                      const key = e.key.toLowerCase();
                      const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
                      const picked = map[key];
                      if (typeof picked !== "number") return;
                      e.preventDefault();
                      setAnswer(index, { mcq: picked });
                    }
                  : undefined
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span>第 {index + 1} 题</span>
                      <Badge variant="secondary">{getTypeLabel(q.type)}</Badge>
                    </CardTitle>
                    <CardDescription className="whitespace-pre-wrap">
                      {q.type === "mcq" ? q.promptEn : q.type === "fill_blank" ? q.sentenceEn : q.promptEn}
                    </CardDescription>
                  </div>
                  {submitted && (
                    <div className="pt-1 shrink-0">
                      {correct ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {q.type === "mcq" && showAnswerArea && (
                  <div className="space-y-2">
                    <RadioGroup
                      value={typeof answers[index]?.mcq === "number" ? String(answers[index]?.mcq) : ""}
                      onValueChange={(value) => setAnswer(index, { mcq: Number(value) })}
                      disabled={interactionDisabled}
                    >
                      {q.options.map((option, optionIndex) => {
                        const isCorrectOption = optionIndex === q.answerIndex;
                        const isSelected = answers[index]?.mcq === optionIndex;

                        const className = submitted
                          ? isCorrectOption
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : isSelected
                              ? "text-rose-600 dark:text-rose-400 line-through"
                              : "text-muted-foreground"
                          : "";

                        return (
                          <div key={optionIndex} className="flex items-center space-x-2">
                            <RadioGroupItem value={String(optionIndex)} id={`q${index}-o${optionIndex}`} />
                            <Label htmlFor={`q${index}-o${optionIndex}`} className={cn("flex items-center gap-2", className)}>
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
                    {!submitted && (
                      <div className="text-xs text-muted-foreground">提示：可按键盘 A / B / C / D 选择。</div>
                    )}
                  </div>
                )}

                {q.type === "fill_blank" && showAnswerArea && (
                  <div className="space-y-2">
                    <Label>你的答案</Label>
                    <Input
                      value={answers[index]?.blank || ""}
                      onChange={(e) => setAnswer(index, { blank: e.target.value })}
                      disabled={interactionDisabled}
                      placeholder="请输入答案..."
                    />
                  </div>
                )}

                {q.type === "reorder" && showAnswerArea && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground">拖拽碎片排序</div>
                    <div className="rounded-md border overflow-hidden">
                      {getReorderOrder(q, index).map((partIndex, pos) => {
                        const isOver =
                          dragOverReorder?.questionIndex === index && dragOverReorder.overPos === pos;
                        const isDragging =
                          draggingReorder?.questionIndex === index && draggingReorder.fromPos === pos;
                        return (
                          <div
                            key={`${partIndex}-${pos}`}
                            draggable={!interactionDisabled}
                            onDragStart={(e) => {
                              if (interactionDisabled) return;
                              setDraggingReorder({ questionIndex: index, fromPos: pos });
                              setDragOverReorder(null);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(pos));
                            }}
                            onDragOver={(e) => {
                              if (interactionDisabled) return;
                              if (draggingReorder?.questionIndex !== index) return;
                              e.preventDefault();
                              setDragOverReorder({ questionIndex: index, overPos: pos });
                            }}
                            onDragLeave={() => {
                              if (dragOverReorder?.questionIndex === index && dragOverReorder.overPos === pos) {
                                setDragOverReorder(null);
                              }
                            }}
                            onDrop={(e) => {
                              if (interactionDisabled) return;
                              e.preventDefault();
                              const fromPos =
                                draggingReorder?.questionIndex === index
                                  ? draggingReorder.fromPos
                                  : Number(e.dataTransfer.getData("text/plain"));
                              if (!Number.isFinite(fromPos)) return;
                              if (fromPos === pos) return;

                              const curr = getReorderOrder(q, index);
                              const next = [...curr];
                              const [moved] = next.splice(fromPos, 1);
                              next.splice(pos, 0, moved);
                              setAnswer(index, { reorder: next });
                              setDraggingReorder(null);
                              setDragOverReorder(null);
                            }}
                            onDragEnd={() => {
                              setDraggingReorder(null);
                              setDragOverReorder(null);
                            }}
                            className={cn(
                              "flex items-start gap-2 px-3 py-2 border-b last:border-b-0 bg-background",
                              !interactionDisabled && "cursor-grab",
                              isOver && "bg-muted/60",
                              isDragging && "opacity-60"
                            )}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden="true" />
                            <div className="text-sm">{q.parts[partIndex]}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={interactionDisabled}
                        onClick={() => setAnswer(index, { reorder: q.parts.map((_, i) => i) })}
                      >
                        重置顺序
                      </Button>
                      <div className="text-xs text-muted-foreground truncate">
                        当前句子：{" "}
                        <span className="text-foreground">
                          {joinSentence(getReorderOrder(q, index).map((i) => q.parts[i]))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {submitted && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    {q.type === "mcq" && (
                      <div className="text-sm text-muted-foreground">
                        正确答案：{" "}
                        <span className="text-foreground">
                          {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
                        </span>
                      </div>
                    )}

                    {q.type === "fill_blank" && (
                      <div className="text-sm text-muted-foreground">
                        正确答案：<span className="text-foreground">{q.acceptableAnswers.join(" / ")}</span>
                      </div>
                    )}

                    {q.type === "reorder" && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>
                          正确句子：{" "}
                          <span className="text-foreground">
                            {q.answerSentenceEn || joinSentence(q.correctOrder.map((i) => q.parts[i]))}
                          </span>
                        </div>
                        {q.translationZh && (
                          <div>
                            中文：<span className="text-foreground">{q.translationZh}</span>
                          </div>
                        )}
                        <div>
                          你的句子：{" "}
                          <span className="text-foreground">
                            {joinSentence(getReorderOrder(q, index).map((i) => q.parts[i]))}
                          </span>
                        </div>
                      </div>
                    )}

                    {renderExplanation(q, { alwaysOpen: explanationOnly })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {!submitted && (
        <Button onClick={requestSubmit} className="w-full" disabled={busy}>
          提交答案
        </Button>
      )}

      <AlertDialog open={unansweredOpen} onOpenChange={setUnansweredOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>还有题目未作答</AlertDialogTitle>
            <AlertDialogDescription>
              还有 {unansweredCount} 道题未作答。你可以先跳到第一道未作答题，或仍然提交查看解析。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续作答</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnansweredOpen(false);
                if (typeof firstUnansweredIndex === "number") {
                  window.setTimeout(() => {
                    questionRefs.current[firstUnansweredIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }
              }}
            >
              跳到未作答
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setUnansweredOpen(false);
                submitNow();
              }}
            >
              仍然提交
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
