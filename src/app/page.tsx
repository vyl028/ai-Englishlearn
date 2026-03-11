
"use client";

import { useState, useEffect } from 'react';
import { Loader2, Trash, Trophy } from 'lucide-react';
import { AppSidebar } from "@/components/app-sidebar";
import { WordCaptureForm } from '@/components/word-capture-form';
import { WordReviewList } from '@/components/word-review-list';
import { EditWordDialog } from '@/components/edit-word-dialog';
import { PracticeView } from '@/components/practice-view';
import { StoryView } from '@/components/story-view';
import { GrowthSheet } from '@/components/growth-sheet';
import { EssayReviewView } from '@/components/essay-review-view';
import { ArticleReadingView } from '@/components/article-reading-view';
import { SpeakingTrainingView } from '@/components/speaking-training-view';
import { ThemeToggle } from "@/components/theme-toggle";
import type { CapturedWord, GeneratePracticeOutput, PracticeQuestionType, WordGroup, GenerateStoryOutput } from '@/lib/types';
import { getViewDescription, getViewLabel, type AppView } from "@/lib/app-view";
import { applyLearningEvent, createDefaultGamificationState, GAMIFICATION_STORAGE_KEY, getLevelInfo, normalizeGamificationState, normalizeTermKey, syncBadgesWithWords, type GamificationState } from '@/lib/gamification';
import { Button } from '@/components/ui/button';
import { exportStoryPdfAction, generatePracticeAction, generateStoryAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn, generateId } from '@/lib/utils';
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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

const WORDS_STORAGE_KEY = 'lexi-capture-words';
const GROUPS_STORAGE_KEY = 'lexi-capture-groups';
const SELECTED_GROUP_STORAGE_KEY = 'lexi-capture-selected-group';

const ALL_GROUP_ID = '__all__';
const UNGROUPED_GROUP_ID = '__ungrouped__';

export default function Home() {
  const [words, setWords] = useState<CapturedWord[]>([]);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(ALL_GROUP_ID);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AppView>('capture');
  const [editingWord, setEditingWord] = useState<CapturedWord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<CapturedWord | null>(null);
  const [practiceData, setPracticeData] = useState<{ questions: GeneratePracticeOutput } | null>(null);
  const [storyData, setStoryData] = useState<GenerateStoryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gamification, setGamification] = useState<GamificationState>(() => createDefaultGamificationState());
  const [growthOpen, setGrowthOpen] = useState(false);
  const { toast } = useToast();
  const levelInfo = getLevelInfo(gamification.xp);

  useEffect(() => {
    const normalizeGroups = (raw: any): WordGroup[] => {
      const parsed = Array.isArray(raw) ? raw : [];
      const cleaned = parsed
        .filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
        .map((g) => ({ id: String(g.id), name: String(g.name).trim() }))
        // Reserved id and legacy "default" group id are not treated as user-defined groups.
        .filter((g) => g.id !== ALL_GROUP_ID && g.id !== 'default' && g.name.length > 0);

      const unique: WordGroup[] = [];
      const seen = new Set<string>();
      for (const g of cleaned) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        unique.push(g);
      }
      return unique;
    };

    const readJson = (key: string) => {
      try {
        const txt = localStorage.getItem(key);
        if (!txt) return undefined;
        return JSON.parse(txt);
      } catch {
        return undefined;
      }
    };

    try {
      const storedGroups = normalizeGroups(readJson(GROUPS_STORAGE_KEY));
      setGroups(storedGroups);

      const groupIds = new Set(storedGroups.map((g) => g.id));
      const storedSelected = localStorage.getItem(SELECTED_GROUP_STORAGE_KEY);
      if (storedSelected && (storedSelected === ALL_GROUP_ID || groupIds.has(storedSelected))) {
        setSelectedGroupId(storedSelected);
      } else {
        setSelectedGroupId(ALL_GROUP_ID);
      }

      const rawWords = readJson(WORDS_STORAGE_KEY);
      if (Array.isArray(rawWords)) {
        const normalized = rawWords
          .filter((w) => w && typeof w.id === 'string')
          .map((w: any) => {
            const capturedAt = new Date(w.capturedAt);
            const groupId = typeof w.groupId === 'string' && groupIds.has(w.groupId) ? w.groupId : undefined;
            return {
              ...w,
              capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
              groupId,
            } as CapturedWord;
          });
        setWords(normalized);
      }

      const rawGamification = readJson(GAMIFICATION_STORAGE_KEY);
      setGamification(normalizeGamificationState(rawGamification));
    } catch (error) {
      console.error("Failed to parse words from localStorage", error);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Save to localStorage, even if it's an empty array to clear it.
    if (!hydrated) return;
    try {
      localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words));
    } catch (error) {
      console.error("Failed to save words to localStorage", error);
    }
  }, [words]);

  useEffect(() => {
    if (!hydrated) return;
    setGamification((prev) => syncBadgesWithWords(prev, words));
  }, [words]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (error) {
      console.error("Failed to save groups to localStorage", error);
    }
  }, [groups]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(gamification));
    } catch (error) {
      console.error("Failed to save gamification state to localStorage", error);
    }
  }, [gamification]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, selectedGroupId);
    } catch (error) {
      console.error("Failed to save selected group to localStorage", error);
    }
  }, [selectedGroupId]);

  const addWordsToBook = (incoming: CapturedWord[], options?: { navigateToReview?: boolean }) => {
    const autoGroupId = groups.some((g) => g.id === selectedGroupId) ? selectedGroupId : undefined;
    const wordsToSave = incoming.map(({ photoDataUri, ...word }) => ({ ...word, groupId: autoGroupId }));
    setWords((prevWords) => [...wordsToSave, ...prevWords]);
    if (wordsToSave.length > 0) {
      setGamification((prev) => applyLearningEvent(prev, { type: "words_added", count: wordsToSave.length }));
    }
    if (options?.navigateToReview) setView('review');
  };
  
  const handleWordAdded = (newWord: CapturedWord) => {
    addWordsToBook([newWord], { navigateToReview: true });
  };

  const handleMultipleWordsAdded = (newWords: CapturedWord[]) => {
    addWordsToBook(newWords, { navigateToReview: true });
  };

  const handleAddWordsFromArticle = (newWords: CapturedWord[]) => {
    addWordsToBook(newWords, { navigateToReview: false });
  };

  const handleToggleMastered = (termKey: string, mastered: boolean) => {
    const key = normalizeTermKey(termKey);
    if (!key) return;

    const anyMatch = words.some((w) => normalizeTermKey(w.word) === key);
    if (!anyMatch) return;

    const wasMastered = words.some((w) => normalizeTermKey(w.word) === key && w.mastered === true);

    setWords((prev) =>
      prev.map((w) => (normalizeTermKey(w.word) === key ? { ...w, mastered } : w))
    );

    if (mastered === true && !wasMastered) {
      setGamification((prev) => applyLearningEvent(prev, { type: "mastery_marked", termKey: key }));
    }
  };

  const handleEditWord = (word: CapturedWord) => {
    setEditingWord(word);
    setIsEditDialogOpen(true);
  };

  const handleWordUpdated = (updatedWord: CapturedWord) => {
    setWords(words.map(w => w.id === updatedWord.id ? updatedWord : w));
    setEditingWord(null);
  };

  const handleDeleteWord = (word: CapturedWord) => {
    setWordToDelete(word);
  };

  const confirmDelete = () => {
    if (wordToDelete) {
      setWords(words.filter(w => w.id !== wordToDelete.id));
      setWordToDelete(null);
    }
  };

  const cancelDelete = () => {
    setWordToDelete(null);
  };

  const handleAddGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newGroup: WordGroup = { id: generateId(), name: trimmed };
    setGroups((prev) => [...prev, newGroup]);
    setSelectedGroupId(newGroup.id);
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)));
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setWords((prev) => prev.map((w) => (w.groupId === groupId ? { ...w, groupId: undefined } : w)));
    setSelectedGroupId((prev) => (prev === groupId ? ALL_GROUP_ID : prev));
  };

  const handleMoveWordToGroup = (wordId: string, groupId: string) => {
    if (!groupId) return;
    setWords((prev) => prev.map((w) => {
      if (w.id !== wordId) return w;
      if (groupId === UNGROUPED_GROUP_ID) return { ...w, groupId: undefined };
      if (!groups.some((g) => g.id === groupId)) return w;
      return { ...w, groupId };
    }));
  };

  const handleGeneratePractice = async (
    practiceWords: CapturedWord[],
    options: { questionCount: number; allowedTypes: PracticeQuestionType[] }
  ) => {
    setIsLoading(true);
    toast({ title: "正在生成练习...", description: "AI 正在生成题目，请稍等片刻。" });
    const input = {
      words: practiceWords.map(({ word, partOfSpeech, definition }) => ({ word, partOfSpeech, definition })),
      questionCount: options.questionCount,
      allowedTypes: options.allowedTypes,
    };
    const result = await generatePracticeAction(input);
    if (result.success && result.data) {
      setPracticeData(result.data);
      setView('practice');
    } else {
      toast({
        variant: "destructive",
        title: "练习生成失败",
        description: result.error || "发生未知错误，请稍后重试。",
      });
    }
    setIsLoading(false);
  };

  const handleGenerateStory = async (storyWords: CapturedWord[]) => {
    setIsLoading(true);
    toast({ title: "正在生成故事...", description: "AI 正在生成故事内容，请稍等片刻。" });
    const input = {
      words: storyWords.map(({ word, partOfSpeech, definition }) => ({ word, partOfSpeech, definition })),
    };
    const result = await generateStoryAction(input);
    if (result.success && result.data) {
      setStoryData(result.data);
      setView('story');
      setGamification((prev) => applyLearningEvent(prev, { type: "story_generated" }));
      toast({ title: "故事已生成", description: "已在页面中展示，可点击右上角导出 PDF。" });
    } else {
      toast({
        variant: "destructive",
        title: "故事生成失败",
        description: result.error || "发生未知错误，请稍后重试。",
      });
    }
    setIsLoading(false);
  };

  const handleExportStoryPdf = async (data: GenerateStoryOutput) => {
    const result = await exportStoryPdfAction(data);
    if (result.success && result.data?.pdfDataUri) {
      const safeTitle = (data.title || 'story').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.href = result.data.pdfDataUri;
      link.download = `${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "PDF 已导出", description: `已下载：${safeTitle}.pdf` });
    } else {
      toast({
        variant: "destructive",
        title: "导出失败",
        description: result.error || "导出 PDF 时发生未知错误，请稍后重试。",
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-medium">AI 正在处理中...</h3>
          <p className="text-sm text-muted-foreground">请稍等片刻。</p>
        </div>
      );
    }

    switch (view) {
      case 'capture':
        return <WordCaptureForm onWordAdded={handleWordAdded} onMultipleWordsAdded={handleMultipleWordsAdded} />;
      case 'review':
        return (
          <WordReviewList
            words={words}
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onMoveWordToGroup={handleMoveWordToGroup}
            onEditWord={handleEditWord}
            onDeleteWord={handleDeleteWord}
            onToggleMastered={handleToggleMastered}
            onGeneratePractice={handleGeneratePractice}
            onGenerateStory={handleGenerateStory}
          />
        );
      case 'practice':
        if (practiceData) {
          return (
            <PracticeView
              practiceData={practiceData}
              onBack={() => setView('review')}
              onSubmitted={({ correctCount, totalCount }) => {
                setGamification((prev) =>
                  applyLearningEvent(prev, { type: "practice_completed", correctCount, totalCount })
                );
              }}
            />
          );
        }
        return null;
      case 'story':
        if (storyData) {
          return (
            <StoryView
              storyData={storyData}
              onBack={() => setView('review')}
              onExportPdf={() => handleExportStoryPdf(storyData)}
            />
          );
        }
        return null;
      case 'essay':
        return <EssayReviewView />;
      case 'article':
        return <ArticleReadingView words={words} onAddWords={handleAddWordsFromArticle} />;
      case 'speaking':
        return <SpeakingTrainingView />;
      default:
        return null;
    }
  };

  const contentMaxWidthClass =
    view === "essay" || view === "article" || view === "speaking" ? "max-w-5xl" : "max-w-3xl";
  const viewDescription = getViewDescription(view);

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar view={view} onNavigate={setView} />
      <SidebarInset>
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight truncate">{getViewLabel(view)}</div>
              {viewDescription && (
                <div className="hidden sm:block text-xs text-muted-foreground truncate">
                  {viewDescription}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 gap-2"
                onClick={() => setGrowthOpen(true)}
                title={`成长：Lv.${levelInfo.level}，还差 ${levelInfo.xpToNextLevel} XP 升级`}
              >
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-semibold">Lv.{levelInfo.level}</span>
                <span className="hidden md:inline-flex items-center ml-1 w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <span
                    className="h-full bg-primary"
                    style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                  />
                </span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className={cn("mx-auto w-full", contentMaxWidthClass)}>{renderContent()}</div>
        </div>
      </SidebarInset>

      <EditWordDialog
        word={editingWord}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onWordUpdated={handleWordUpdated}
      />
      <AlertDialog open={!!wordToDelete} onOpenChange={() => cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，将永久删除单词 <span className="font-bold">“{wordToDelete?.word}”</span>。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash className="mr-2 h-4 w-4" />
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GrowthSheet
        open={growthOpen}
        onOpenChange={setGrowthOpen}
        gamification={gamification}
        words={words}
        defaultDays={7}
      />
    </SidebarProvider>
  );
}
