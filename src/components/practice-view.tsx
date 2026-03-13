"use client";

import * as React from "react";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

import type { GeneratePracticeOutput, PracticeQuestion } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface PracticeViewProps {
  practiceData: { questions: GeneratePracticeOutput };
  onBack: () => void;
  onSubmitted?: (result: { correctCount: number; totalCount: number }) => void;
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

export function PracticeView({ practiceData, onBack, onSubmitted }: PracticeViewProps) {
  const [answers, setAnswers] = React.useState<Record<number, AnswerState>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const setAnswer = (questionIndex: number, patch: Partial<AnswerState>) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: { ...prev[questionIndex], ...patch },
    }));
  };

  const isCorrect = (q: PracticeQuestion, questionIndex: number) => {
    const a = answers[questionIndex];
    if (!a) return false;

    if (q.type === "mcq") {
      return a.mcq === q.answerIndex;
    }

    if (q.type === "fill_blank") {
      const user = normalizeAnswer(a.blank || "");
      const accepted = q.acceptableAnswers.map(normalizeAnswer);
      return user.length > 0 && accepted.includes(user);
    }

    if (q.type === "reorder") {
      const order = a.reorder || [];
      return order.length === q.correctOrder.length && arraysEqual(order, q.correctOrder);
    }

    return false;
  };

  const correctCount = React.useMemo(() => {
    if (!submitted) return 0;
    return practiceData.questions.filter((q, idx) => isCorrect(q, idx)).length;
  }, [practiceData.questions, answers, submitted]);

  const handleSubmit = () => {
    const correct = practiceData.questions.filter((q, idx) => isCorrect(q, idx)).length;
    setSubmitted(true);
    onSubmitted?.({ correctCount: correct, totalCount: practiceData.questions.length });
  };

  const renderExplanation = (q: PracticeQuestion) => (
    <Accordion type="single" collapsible>
      <AccordionItem value="explain" className="border-none">
        <AccordionTrigger className="py-2 text-sm">答案与解析</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 text-sm">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="返回单词本" title="返回单词本">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-between w-full gap-3">
          <h2 className="text-2xl font-bold font-headline">练习</h2>
          {submitted && (
            <div className="text-sm text-muted-foreground">
              得分：<span className="font-semibold text-foreground">{correctCount}</span> / {practiceData.questions.length}
            </div>
          )}
        </div>
      </div>

      {practiceData.questions.map((q, index) => {
        const correct = submitted ? isCorrect(q, index) : undefined;
        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <span>第 {index + 1} 题</span>
                    <Badge variant="secondary">{getTypeLabel(q.type)}</Badge>
                  </CardTitle>
                  {q.type === "mcq" && <CardDescription className="whitespace-pre-wrap">{q.promptEn}</CardDescription>}
                </div>
                {submitted && (
                  <div className="pt-1">
                    {correct ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {q.type === "mcq" && (
                <RadioGroup
                  value={typeof answers[index]?.mcq === "number" ? String(answers[index]?.mcq) : ""}
                  onValueChange={(value) => setAnswer(index, { mcq: Number(value) })}
                  disabled={submitted}
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
              )}

              {q.type === "fill_blank" && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{q.sentenceEn}</div>
                  <div className="space-y-2">
                    <Label>你的答案</Label>
                    <Input
                      value={answers[index]?.blank || ""}
                      onChange={(e) => setAnswer(index, { blank: e.target.value })}
                      disabled={submitted}
                      placeholder="请输入答案..."
                    />
                  </div>
                  {submitted && (
                    <div className="text-sm text-muted-foreground">
                      正确答案：<span className="text-foreground">{q.acceptableAnswers.join(" / ")}</span>
                    </div>
                  )}
                </div>
              )}

              {q.type === "reorder" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">你的选择</div>
                    <div className="flex flex-wrap gap-2">
                      {(answers[index]?.reorder || []).map((partIndex, i) => (
                        <Button
                          key={`${partIndex}-${i}`}
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={submitted}
                          onClick={() => {
                            const curr = answers[index]?.reorder || [];
                            const next = curr.filter((_, idx) => idx !== i);
                            setAnswer(index, { reorder: next });
                          }}
                        >
                          {q.parts[partIndex]}
                        </Button>
                      ))}
                      {(answers[index]?.reorder || []).length === 0 && (
                        <span className="text-sm text-muted-foreground">未选择任何碎片。</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={submitted}
                        onClick={() => setAnswer(index, { reorder: [] })}
                      >
                        重置
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">可选碎片</div>
                    <div className="flex flex-wrap gap-2">
                      {q.parts.map((p, partIndex) => {
                        const curr = answers[index]?.reorder || [];
                        const used = curr.includes(partIndex);
                        return (
                          <Button
                            key={partIndex}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={submitted || used}
                            onClick={() => setAnswer(index, { reorder: [...curr, partIndex] })}
                          >
                            {p}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {submitted && (
                    <div className="space-y-1 text-sm">
                      <div className="text-muted-foreground">
                        正确句子：{" "}
                        <span className="text-foreground">
                          {q.answerSentenceEn || joinSentence(q.correctOrder.map(i => q.parts[i]))}
                        </span>
                      </div>
                      {q.translationZh && (
                        <div className="text-muted-foreground">
                          中文：<span className="text-foreground">{q.translationZh}</span>
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        你的句子：{" "}
                        <span className="text-foreground">
                          {joinSentence((answers[index]?.reorder || []).map(i => q.parts[i]))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {submitted && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  {q.type === "mcq" && (
                    <div className="text-sm text-muted-foreground mb-3">
                      正确答案：{" "}
                      <span className="text-foreground">
                        {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
                      </span>
                    </div>
                  )}
                  {renderExplanation(q)}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!submitted && (
        <Button onClick={handleSubmit} className="w-full">
          提交答案
        </Button>
      )}
    </div>
  );
}
