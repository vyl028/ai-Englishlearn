"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { GenerateQuizOutput } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface QuizViewProps {
  quizData: { questions: GenerateQuizOutput };
  onBack: () => void;
}

export function QuizView({ quizData, onBack }: QuizViewProps) {
  const [answers, setAnswers] = React.useState<Record<number, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const handleAnswerChange = (questionIndex: number, selectedOption: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const getResultColor = (questionIndex: number, option: string) => {
    if (!submitted) return '';
    const question = quizData.questions[questionIndex];
    const isCorrect = option === question.answer;
    const isSelected = answers[questionIndex] === option;

    if (isCorrect) return 'text-green-600 font-bold';
    if (isSelected && !isCorrect) return 'text-red-600 line-through';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold font-headline">Weekly Quiz</h2>
      </div>
      {quizData.questions.map((q, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle>Question {index + 1}</CardTitle>
            <CardDescription>{q.question}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={answers[index] || ''}
              onValueChange={(value) => handleAnswerChange(index, value)}
              disabled={submitted}
            >
              {q.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`q${index}-o${optionIndex}`} />
                  <Label htmlFor={`q${index}-o${optionIndex}`} className={cn("flex items-center", getResultColor(index, option))}>
                    {option}
                    {submitted && option === q.answer && <CheckCircle className="ml-2 h-4 w-4 text-green-600" />}
                    {submitted && answers[index] === option && option !== q.answer && <XCircle className="ml-2 h-4 w-4 text-red-600" />}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {submitted && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold">答案解析:</p>
                <p className="text-sm text-muted-foreground">{q.analysis}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!submitted && (
        <Button onClick={handleSubmit} className="w-full">
          Submit Answers
        </Button>
      )}
    </div>
  );
}