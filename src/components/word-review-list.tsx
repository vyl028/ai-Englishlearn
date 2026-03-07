
"use client";

import { useState } from 'react';
import { format, startOfWeek, endOfWeek, formatDistanceToNow } from 'date-fns';
import { BookOpen, Sparkles, Pencil, Trash, FileText, Newspaper } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import type { CapturedWord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface WordReviewListProps {
  words: CapturedWord[];
  onEditWord: (word: CapturedWord) => void;
  onDeleteWord: (word: CapturedWord) => void;
  onGenerateQuiz: (words: CapturedWord[]) => void;
  onGenerateStory: (words: CapturedWord[]) => void;
}

const groupWordsByWeek = (words: CapturedWord[]) => {
  if (!words || words.length === 0) {
    return {};
  }
  // Sort words by date descending
  const sortedWords = [...words].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

  const grouped: Record<string, CapturedWord[]> = {};

  sortedWords.forEach(word => {
    const weekStart = startOfWeek(new Date(word.capturedAt), { weekStartsOn: 1 }); // Monday as start of the week
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    if (!grouped[weekKey]) {
      grouped[weekKey] = [];
    }
    grouped[weekKey].push(word);
  });

  return grouped;
};

export function WordReviewList({ words, onEditWord, onDeleteWord, onGenerateQuiz, onGenerateStory }: WordReviewListProps) {
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showDefinitions, setShowDefinitions] = useState<{ [key: string]: boolean }>({});
  const [showDefinition, setShowDefinition] = useState(false);

  const formatWeekRange = (startDate: Date, endDate: Date) => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = String(startDate.getFullYear()).slice(-2);
    
    // If same month and year, show "Mon day - day, 'YY"
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, '${year}`;
    }
    
    // Different months, show "Mon day - Mon day, 'YY"
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, '${year}`;
  };

  const getWeekStart = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    return new Date(start.setDate(diff));
  };

  const getWeekEnd = (date: Date) => {
    const end = new Date(date);
    const day = end.getDay();
    const diff = end.getDate() - day + 6;
    return new Date(end.setDate(diff));
  };

  // Group words by week
  const groupedWords = words.reduce((acc, word) => {
    const weekStart = getWeekStart(word.capturedAt);
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }
    acc[weekKey].push(word);
    return acc;
  }, {} as { [key: string]: typeof words });

  const weekKeys = Object.keys(groupedWords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const getWeekRange = (weekKey: string) => {
    const weekStart = new Date(weekKey);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`;
  };
 
   const handleWordClick = (word: string) => {
     const url = `https://dictionary.cambridge.org/zhs/%E8%AF%8D%E5%85%B8/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/${encodeURIComponent(word)}`;
     window.open(url, '_blank');
   };
 
   return (
     <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold font-headline">Your Captured Words</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="show-definition" checked={showDefinition} onCheckedChange={setShowDefinition} />
            <Label htmlFor="show-definition">Show Definition</Label>
          </div>
        </div>

      {words.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No words captured yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Go to "New Words" to add your first word.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {weekKeys.map((weekKey) => (
            <div key={weekKey}>
              <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-foreground mb-3">
          {formatWeekRange(getWeekStart(new Date(weekKey)), getWeekEnd(new Date(weekKey)))}
        </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onGenerateQuiz(groupedWords[weekKey])}>
                    <FileText className="h-4 w-4 mr-2" />
                    Quiz
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onGenerateStory(groupedWords[weekKey])}>
                    <Newspaper className="h-4 w-4 mr-2" />
                    Story
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {groupedWords[weekKey].map((word) => (
                  <Card key={word.id} className="w-full">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex-grow flex items-center gap-2 overflow-hidden">
                            <span className="font-bold text-lg cursor-pointer hover:underline" onClick={() => handleWordClick(word.word)}>{word.word}</span>
                            <Badge variant="secondary" className="capitalize shrink-0">{word.partOfSpeech}</Badge>
                            {showDefinition && <p className="text-muted-foreground truncate">{word.definition}</p>}
                        </div>
                        <div className="flex items-center flex-shrink-0 ml-4">
                            <div className="text-xs text-muted-foreground mr-4 hidden sm:block">
                                {formatDistanceToNow(new Date(word.capturedAt), { addSuffix: true })}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEditWord(word); }}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit Word</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteWord(word); }}>
                                <Trash className="h-4 w-4" />
                                <span className="sr-only">Delete Word</span>
                            </Button>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
