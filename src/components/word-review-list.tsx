
"use client";

import { useState } from 'react';
import { format, startOfWeek, endOfWeek, formatDistanceToNow, subMonths, subWeeks } from 'date-fns';
import { BookOpen, Sparkles, Pencil, Trash, Newspaper, ListChecks } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import type { CapturedWord, PracticeQuestionType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

interface WordReviewListProps {
  words: CapturedWord[];
  onEditWord: (word: CapturedWord) => void;
  onDeleteWord: (word: CapturedWord) => void;
  onGeneratePractice: (words: CapturedWord[], options: { questionCount: number; allowedTypes: PracticeQuestionType[] }) => void;
  onGenerateStory: (words: CapturedWord[]) => void;
}

type GeneratorMode = 'practice' | 'story';
type WordPickScope = 'group' | 'week' | 'month' | 'manual';

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

export function WordReviewList({ words, onEditWord, onDeleteWord, onGeneratePractice, onGenerateStory }: WordReviewListProps) {
  const [showDefinition, setShowDefinition] = useState(false);

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('practice');
  const [contextGroupWords, setContextGroupWords] = useState<CapturedWord[]>([]);
  const [wordPickScope, setWordPickScope] = useState<WordPickScope>('group');
  const [wordSearch, setWordSearch] = useState('');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [storyConfirmOpen, setStoryConfirmOpen] = useState(false);

  const [questionCountText, setQuestionCountText] = useState('10');
  const [typeSelection, setTypeSelection] = useState<Record<PracticeQuestionType, boolean>>({
    mcq: true,
    fill_blank: true,
    reorder: true,
  });

  const selectedTypes = (Object.keys(typeSelection) as PracticeQuestionType[]).filter(t => typeSelection[t]);
  const questionCount = Math.min(30, Math.max(1, Number.parseInt(questionCountText || '10', 10) || 10));

  const sortedWords = [...words].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const selectedWords = sortedWords.filter(w => selectedWordIds.has(w.id));

  const now = new Date();
  const cutoffWeek = subWeeks(now, 1);
  const cutoffMonth = subMonths(now, 1);
  const recentWeekWords = sortedWords.filter(w => new Date(w.capturedAt) >= cutoffWeek);
  const recentMonthWords = sortedWords.filter(w => new Date(w.capturedAt) >= cutoffMonth);

  const normalizedSearch = wordSearch.trim().toLowerCase();
  const filteredWords = normalizedSearch.length === 0
    ? sortedWords
    : sortedWords.filter(w => {
      const word = w.word.toLowerCase();
      const pos = (w.partOfSpeech || '').toLowerCase();
      const def = (w.definition || '').toLowerCase();
      return word.includes(normalizedSearch) || pos.includes(normalizedSearch) || def.includes(normalizedSearch);
    });

  const storyTooManyThreshold = 12;
  const isStoryTooMany = generatorMode === 'story' && selectedWords.length > storyTooManyThreshold;
  const canGenerate = generatorMode === 'practice'
    ? selectedWords.length > 0 && selectedTypes.length > 0
    : selectedWords.length > 0;

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

   const setSelectionFromWords = (pickedWords: CapturedWord[]) => {
     setSelectedWordIds(new Set(pickedWords.map(w => w.id)));
   };

   const applyScope = (nextScope: WordPickScope) => {
     setWordPickScope(nextScope);
     if (nextScope === 'manual') return;
     if (nextScope === 'group') return setSelectionFromWords(contextGroupWords);
     if (nextScope === 'week') return setSelectionFromWords(recentWeekWords);
     if (nextScope === 'month') return setSelectionFromWords(recentMonthWords);
   };

   const openGenerator = (mode: GeneratorMode, weekWords: CapturedWord[]) => {
     setGeneratorMode(mode);
     setContextGroupWords(weekWords);
     setWordPickScope('group');
     setSelectionFromWords(weekWords);
     setWordSearch('');
     setStoryConfirmOpen(false);
     setGeneratorOpen(true);
   };

   const toggleWord = (id: string, checked: boolean) => {
     setSelectedWordIds(prev => {
       const next = new Set(prev);
       if (checked) next.add(id);
       else next.delete(id);
       return next;
     });
     if (wordPickScope !== 'manual') setWordPickScope('manual');
   };

   const selectAllFiltered = () => {
     setSelectedWordIds(prev => {
       const next = new Set(prev);
       filteredWords.forEach(w => next.add(w.id));
       return next;
     });
     if (wordPickScope !== 'manual') setWordPickScope('manual');
   };

   const clearSelection = () => {
     setSelectedWordIds(new Set());
     if (wordPickScope !== 'manual') setWordPickScope('manual');
   };

   const handleGenerate = () => {
     if (!canGenerate) return;
     if (generatorMode === 'practice') {
       onGeneratePractice(selectedWords, { questionCount, allowedTypes: selectedTypes });
       setGeneratorOpen(false);
       return;
     }

     // story
     if (isStoryTooMany) {
       setStoryConfirmOpen(true);
       return;
     }
     onGenerateStory(selectedWords);
     setGeneratorOpen(false);
   };
  
   return (
     <>
     <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold font-headline">我的单词本</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="show-definition" checked={showDefinition} onCheckedChange={setShowDefinition} />
            <Label htmlFor="show-definition">显示释义</Label>
          </div>
        </div>

      {words.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">还没有收集到单词</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            去「新增单词」添加你的第一个单词。
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
                  <Button variant="outline" size="sm" onClick={() => openGenerator('practice', groupedWords[weekKey])}>
                    <ListChecks className="h-4 w-4 mr-2" />
                    练习
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openGenerator('story', groupedWords[weekKey])}>
                    <Newspaper className="h-4 w-4 mr-2" />
                    故事
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {groupedWords[weekKey].map((word) => (
                  <Card key={word.id} className="w-full">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
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
                                  <span className="sr-only">编辑单词</span>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteWord(word); }}>
                                  <Trash className="h-4 w-4" />
                                  <span className="sr-only">删除单词</span>
                              </Button>
                          </div>
                      </div>

                      <Accordion type="single" collapsible className="mt-2">
                        <AccordionItem value="details" className="border-none">
                          <AccordionTrigger className="py-2 text-sm">
                            了解更多
                          </AccordionTrigger>
                          <AccordionContent className="pb-1">
                            {!word.enrichment ? (
                              <p className="text-muted-foreground">暂无 AI 拓展内容。</p>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground">难度与用法</div>
                                  <div className="text-sm">
                                    {word.enrichment.level?.cefr && (
                                      <span className="mr-2">CEFR: {word.enrichment.level.cefr}</span>
                                    )}
                                    {word.enrichment.level?.usageZh && (
                                      <p className="mt-1 text-muted-foreground">{word.enrichment.level.usageZh}</p>
                                    )}
                                  </div>
                                </div>

                                {Array.isArray(word.enrichment.collocations) && word.enrichment.collocations.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground">常见搭配</div>
                                    <ul className="mt-1 space-y-1 text-sm">
                                      {word.enrichment.collocations.slice(0, 6).map((c, idx) => (
                                        <li key={idx} className="text-muted-foreground">
                                          <span className="text-foreground">{c.phrase}</span>
                                          {c.meaningZh ? ` — ${c.meaningZh}` : ''}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {(Array.isArray(word.enrichment.synonyms) && word.enrichment.synonyms.length > 0) && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground">同义词</div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                      {word.enrichment.synonyms.slice(0, 10).join(', ')}
                                    </div>
                                  </div>
                                )}

                                {(Array.isArray(word.enrichment.antonyms) && word.enrichment.antonyms.length > 0) && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground">反义词</div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                      {word.enrichment.antonyms.slice(0, 10).join(', ')}
                                    </div>
                                  </div>
                                )}

                                {Array.isArray(word.enrichment.examples) && word.enrichment.examples.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground">例句</div>
                                    <ul className="mt-1 space-y-2 text-sm">
                                      {word.enrichment.examples.slice(0, 5).map((ex, idx) => (
                                        <li key={idx}>
                                          <div className="text-foreground">{ex.en}</div>
                                          <div className="text-muted-foreground">{ex.zh}</div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{generatorMode === 'practice' ? '生成练习' : '生成故事'}</DialogTitle>
          <DialogDescription>
            {generatorMode === 'practice' ? '选择单词范围、题型与题目数量。' : '选择用于生成故事的单词。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">选择单词</div>
            <RadioGroup
              value={wordPickScope}
              onValueChange={(v) => applyScope(v as WordPickScope)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center gap-2 rounded-md border p-2">
                <RadioGroupItem id="scope-group" value="group" />
                <Label htmlFor="scope-group" className="cursor-pointer">当前分组（{contextGroupWords.length}）</Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <RadioGroupItem id="scope-week" value="week" />
                <Label htmlFor="scope-week" className="cursor-pointer">最近一周（{recentWeekWords.length}）</Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <RadioGroupItem id="scope-month" value="month" />
                <Label htmlFor="scope-month" className="cursor-pointer">最近一个月（{recentMonthWords.length}）</Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <RadioGroupItem id="scope-manual" value="manual" />
                <Label htmlFor="scope-manual" className="cursor-pointer">手动选择</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={wordSearch}
              onChange={(e) => setWordSearch(e.target.value)}
              placeholder="搜索单词 / 词性 / 释义..."
            />
            <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
              全选
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
              清空
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">已选 {selectedWordIds.size} 个单词</div>

          <ScrollArea className="h-60 rounded-md border">
            <div className="p-2 space-y-1">
              {filteredWords.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">没有匹配的单词</div>
              ) : (
                filteredWords.map((w) => {
                  const checked = selectedWordIds.has(w.id);
                  return (
                    <div key={w.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/40">
                      <Checkbox
                        id={`pick-${w.id}`}
                        checked={checked}
                        onCheckedChange={(v) => toggleWord(w.id, v === true)}
                      />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`pick-${w.id}`} className="flex items-center gap-2 cursor-pointer">
                          <span className="font-medium">{w.word}</span>
                          <Badge variant="secondary" className="capitalize shrink-0">{w.partOfSpeech}</Badge>
                        </Label>
                        <div className="text-xs text-muted-foreground truncate">{w.definition}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {selectedWords.length === 0 && (
            <div className="text-sm text-destructive">请至少选择一个单词。</div>
          )}

          {generatorMode === 'story' && isStoryTooMany && (
            <div className="text-sm text-muted-foreground">
              你选择了 {selectedWords.length} 个单词，故事可能会更长，生成也可能更慢。
            </div>
          )}

          {generatorMode === 'practice' && (
          <>
          <div className="space-y-2">
            <div className="text-sm font-medium">题型</div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-mcq"
                  checked={typeSelection.mcq}
                  onCheckedChange={(checked) => setTypeSelection(prev => ({ ...prev, mcq: checked === true }))}
                />
                <Label htmlFor="type-mcq">选择题（单项选择）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-fill"
                  checked={typeSelection.fill_blank}
                  onCheckedChange={(checked) => setTypeSelection(prev => ({ ...prev, fill_blank: checked === true }))}
                />
                <Label htmlFor="type-fill">填空题</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-reorder"
                  checked={typeSelection.reorder}
                  onCheckedChange={(checked) => setTypeSelection(prev => ({ ...prev, reorder: checked === true }))}
                />
                <Label htmlFor="type-reorder">句子重组题</Label>
              </div>
            </div>
            {selectedTypes.length === 0 && (
              <div className="text-sm text-destructive">请至少选择一种题型。</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="question-count">题目数量</Label>
            <Input
              id="question-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={questionCountText}
              onChange={(e) => setQuestionCountText(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">默认 10 题，最多 30 题。</div>
          </div>
          </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setGeneratorOpen(false)}>取消</Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {generatorMode === 'practice' ? '生成练习' : '生成故事'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={storyConfirmOpen} onOpenChange={setStoryConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>单词数量较多</AlertDialogTitle>
          <AlertDialogDescription>
            你选择了 {selectedWords.length} 个单词，生成故事可能更慢，甚至失败。是否继续生成？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>返回调整</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            onGenerateStory(selectedWords);
            setStoryConfirmOpen(false);
            setGeneratorOpen(false);
          }}>
            继续生成
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
   );
}
