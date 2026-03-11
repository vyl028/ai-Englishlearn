"use client";

import * as React from "react";
import { CheckCircle, XCircle } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

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
}

export function ReadingQuestionsView({ questions }: ReadingQuestionsViewProps) {
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const isCorrect = (q: ReadingQuestion, idx: number) => answers[idx] === q.answerIndex;

  const correctCount = React.useMemo(() => {
    if (!submitted) return 0;
    return questions.filter((q, idx) => isCorrect(q, idx)).length;
  }, [questions, answers, submitted]);

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{questions.length}</span> 题
        </div>
        {submitted ? (
          <div className="text-sm text-muted-foreground">
            得分：<span className="font-semibold text-foreground">{correctCount}</span> / {questions.length}
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            重置作答
          </Button>
        )}
      </div>

      {questions.map((q, index) => {
        const correct = submitted ? isCorrect(q, index) : undefined;
        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">第 {index + 1} 题</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">{q.questionEn}</CardDescription>
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
                          {(q.locate?.paragraphIndex || q.locate?.quoteEn) && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {q.locate?.paragraphIndex && <div>定位：第 {q.locate.paragraphIndex} 段</div>}
                              {q.locate?.quoteEn && <div className="whitespace-pre-wrap">原文：{q.locate.quoteEn}</div>}
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
