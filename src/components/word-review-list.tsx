
"use client";

import { useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek, formatDistanceToNow, subMonths, subWeeks } from 'date-fns';
import { BookOpen, Sparkles, Pencil, Trash, Newspaper, ListChecks, Folders, FolderInput, CheckCircle, Circle, Eye, EyeOff, Search, Copy, Loader2, RefreshCcw, GripVertical } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import type { CapturedWord, PracticeQuestionType, WordGroup } from '@/lib/types';
import { normalizeTermKey } from '@/lib/gamification';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useToast } from "@/hooks/use-toast";

interface WordReviewListProps {
  words: CapturedWord[];
  groups: WordGroup[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onReorderGroups: (nextGroups: WordGroup[]) => void;
  onMoveWordToGroup: (wordId: string, groupId: string) => void;
  onMoveWordsToGroup: (wordIds: string[], groupId: string) => void;
  onEditWord: (word: CapturedWord) => void;
  onDeleteWord: (word: CapturedWord) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onToggleMastered: (termKey: string, mastered: boolean) => void;
  onSetTermsMastered: (termKeys: string[], mastered: boolean) => void;
  onRegenerateWord: (word: CapturedWord) => Promise<{ success: boolean; error?: string }>;
  onGeneratePractice: (words: CapturedWord[], options: { questionCount: number; allowedTypes: PracticeQuestionType[] }) => void;
  onGenerateStory: (words: CapturedWord[]) => void;
}

type GeneratorMode = 'practice' | 'story';
type WordPickScope = 'group' | 'week' | 'month' | 'manual';
type MasteryFilter = 'all' | 'mastered' | 'unmastered';
type ReviewSort = 'newest' | 'oldest' | 'az';

const ALL_GROUP_ID = '__all__';
const UNGROUPED_GROUP_ID = '__ungrouped__';

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

const POS_ORDER = [
  'noun',
  'pronoun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'interjection',
  'phrase',
] as const;

function normalizePosKey(raw: string) {
  return String(raw || '').trim().toLowerCase();
}

function posOrderIndex(pos: string) {
  const key = normalizePosKey(pos);
  const idx = POS_ORDER.indexOf(key as any);
  return idx === -1 ? POS_ORDER.length : idx;
}

function includesNormalized(haystack: unknown, needle: string) {
  if (!needle) return true;
  if (haystack === null || haystack === undefined) return false;
  return String(haystack).toLowerCase().includes(needle);
}

function wordMatchesSearch(w: CapturedWord, normalizedSearch: string) {
  if (!normalizedSearch) return true;

  if (includesNormalized(w.word, normalizedSearch)) return true;
  if (includesNormalized(w.partOfSpeech, normalizedSearch)) return true;
  if (includesNormalized(w.definition, normalizedSearch)) return true;

  const e = (w as any)?.enrichment;
  if (!e) return false;

  if (includesNormalized(e?.level?.cefr, normalizedSearch)) return true;
  if (includesNormalized(e?.level?.usageZh, normalizedSearch)) return true;

  const collocations = Array.isArray(e?.collocations) ? e.collocations : [];
  for (const c of collocations) {
    if (includesNormalized(c?.phrase, normalizedSearch)) return true;
    if (includesNormalized(c?.meaningZh, normalizedSearch)) return true;
    if (includesNormalized(c?.exampleEn, normalizedSearch)) return true;
    if (includesNormalized(c?.exampleZh, normalizedSearch)) return true;
  }

  const synonyms = Array.isArray(e?.synonyms) ? e.synonyms : [];
  for (const s of synonyms) {
    if (includesNormalized(s, normalizedSearch)) return true;
  }

  const antonyms = Array.isArray(e?.antonyms) ? e.antonyms : [];
  for (const a of antonyms) {
    if (includesNormalized(a, normalizedSearch)) return true;
  }

  const examples = Array.isArray(e?.examples) ? e.examples : [];
  for (const ex of examples) {
    if (includesNormalized(ex?.en, normalizedSearch)) return true;
    if (includesNormalized(ex?.zh, normalizedSearch)) return true;
  }

  return false;
}

type TermGroup = {
  key: string;
  display: string;
  words: CapturedWord[];
  latestCapturedAt: Date;
};

function groupWordsByTerm(words: CapturedWord[]): TermGroup[] {
  const map = new Map<string, TermGroup>();

  for (const w of words) {
    const key = normalizeTermKey(w.word);
    if (!key) continue;
    const capturedAt = new Date(w.capturedAt);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { key, display: w.word, words: [w], latestCapturedAt: capturedAt });
      continue;
    }

    existing.words.push(w);
    if (!Number.isNaN(capturedAt.getTime()) && capturedAt.getTime() >= existing.latestCapturedAt.getTime()) {
      existing.latestCapturedAt = capturedAt;
      existing.display = w.word;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.latestCapturedAt.getTime() - a.latestCapturedAt.getTime());
}

function pickVariantsByPos(words: CapturedWord[]): CapturedWord[] {
  const map = new Map<string, CapturedWord>();

  for (const w of words) {
    const key = normalizePosKey(w.partOfSpeech);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, w);
      continue;
    }

    const tNew = new Date(w.capturedAt).getTime();
    const tOld = new Date(existing.capturedAt).getTime();
    if (tNew >= tOld) map.set(key, w);
  }

  return Array.from(map.values()).sort((a, b) => {
    const diff = posOrderIndex(a.partOfSpeech) - posOrderIndex(b.partOfSpeech);
    if (diff !== 0) return diff;
    return a.partOfSpeech.localeCompare(b.partOfSpeech);
  });
}

export function WordReviewList({
  words,
  groups,
  selectedGroupId,
  onSelectGroup,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onReorderGroups,
  onMoveWordToGroup,
  onMoveWordsToGroup,
  onEditWord,
  onDeleteWord,
  onDeleteWords,
  onToggleMastered,
  onSetTermsMastered,
  onRegenerateWord,
  onGeneratePractice,
  onGenerateStory,
}: WordReviewListProps) {
  const [definitionOpenKeys, setDefinitionOpenKeys] = useState<Set<string>>(new Set());
  const [variantSelection, setVariantSelection] = useState<Record<string, string>>({});
  const [reviewSearch, setReviewSearch] = useState('');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all');
  const [reviewSort, setReviewSort] = useState<ReviewSort>('newest');
  const { toast } = useToast();
  const [regeneratingWordIds, setRegeneratingWordIds] = useState<Set<string>>(new Set());

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedCardKeys, setBulkSelectedCardKeys] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveTargetGroupId, setBulkMoveTargetGroupId] = useState<string>(UNGROUPED_GROUP_ID);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [movingWord, setMovingWord] = useState<CapturedWord | null>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<string>(UNGROUPED_GROUP_ID);

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('practice');
  const [contextGroupWords, setContextGroupWords] = useState<CapturedWord[]>([]);
  const [wordPickScope, setWordPickScope] = useState<WordPickScope>('group');
  const [wordSearch, setWordSearch] = useState('');
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [storyConfirmOpen, setStoryConfirmOpen] = useState(false);
  const [generatorGroupId, setGeneratorGroupId] = useState<string>(selectedGroupId || ALL_GROUP_ID);

  const [questionCountText, setQuestionCountText] = useState('10');
  const [typeSelection, setTypeSelection] = useState<Record<PracticeQuestionType, boolean>>({
    mcq: true,
    fill_blank: true,
    reorder: true,
  });

  useEffect(() => {
    if (!bulkMode) setBulkSelectedCardKeys(new Set());
  }, [bulkMode]);

  useEffect(() => {
    setBulkSelectedCardKeys(new Set());
  }, [selectedGroupId]);

  useEffect(() => {
    if (!bulkMode) return;
    setBulkSelectedCardKeys(new Set());
  }, [reviewSearch, masteryFilter]);

  const selectedTypes = (Object.keys(typeSelection) as PracticeQuestionType[]).filter(t => typeSelection[t]);
  const questionCount = Math.min(30, Math.max(1, Number.parseInt(questionCountText || '10', 10) || 10));

  const groupIds = new Set(groups.map((g) => g.id));
  const getWordGroupId = (w: CapturedWord) => (typeof w.groupId === 'string' && groupIds.has(w.groupId) ? w.groupId : undefined);

  const allSortedWords = [...words].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  const viewWords = selectedGroupId === ALL_GROUP_ID
    ? allSortedWords
    : allSortedWords.filter((w) => getWordGroupId(w) === selectedGroupId);
  const normalizedReviewSearch = reviewSearch.trim().toLowerCase();

  const selectedWords = allSortedWords.filter(w => selectedWordIds.has(w.id));

  const now = new Date();
  const cutoffWeek = subWeeks(now, 1);
  const cutoffMonth = subMonths(now, 1);
  // Option B: recent ranges are across ALL words (跨分组).
  const recentWeekWords = allSortedWords.filter(w => new Date(w.capturedAt) >= cutoffWeek);
  const recentMonthWords = allSortedWords.filter(w => new Date(w.capturedAt) >= cutoffMonth);

  const normalizedSearch = wordSearch.trim().toLowerCase();
  const filteredWords = normalizedSearch.length === 0
    ? allSortedWords
    : allSortedWords.filter(w => {
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
  const groupedWords = viewWords.reduce((acc, word) => {
    const weekStart = getWeekStart(word.capturedAt);
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }
    acc[weekKey].push(word);
    return acc;
  }, {} as Record<string, CapturedWord[]>);

  const baseWeekKeys = Object.keys(groupedWords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const weekKeys = reviewSort === 'oldest' ? [...baseWeekKeys].reverse() : baseWeekKeys;

  const weekSections = weekKeys
    .map((weekKey) => {
      const termGroups = groupWordsByTerm(groupedWords[weekKey]);
      const afterSearch = normalizedReviewSearch.length === 0
        ? termGroups
        : termGroups.filter((tg) => tg.words.some((w) => wordMatchesSearch(w, normalizedReviewSearch)));
      const afterMastery = masteryFilter === 'all'
        ? afterSearch
        : afterSearch.filter((tg) => {
          const isMastered = tg.words.some((w) => w.mastered === true);
          return masteryFilter === 'mastered' ? isMastered : !isMastered;
        });
      const sorted = [...afterMastery].sort((a, b) => {
        if (reviewSort === 'az') return a.key.localeCompare(b.key);
        const diff = a.latestCapturedAt.getTime() - b.latestCapturedAt.getTime();
        return reviewSort === 'oldest' ? diff : -diff;
      });
      return { weekKey, groups: sorted };
    })
    .filter((s) => s.groups.length > 0);

  const visibleCards = weekSections.flatMap(({ weekKey, groups: list }) =>
    list.map((g) => ({
      cardKey: `${weekKey}::${g.key}`,
      weekKey,
      termKey: g.key,
      display: g.display,
      words: g.words,
    }))
  );

  const bulkSelectedCards = visibleCards.filter((c) => bulkSelectedCardKeys.has(c.cardKey));
  const bulkSelectedCardCount = bulkSelectedCards.length;
  const bulkSelectedWordIds = Array.from(new Set(bulkSelectedCards.flatMap((c) => c.words.map((w) => w.id))));
  const bulkSelectedTermKeys = Array.from(new Set(bulkSelectedCards.map((c) => c.termKey)));

  const getWeekRange = (weekKey: string) => {
    const weekStart = new Date(weekKey);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`;
  };

  const copyToClipboard = async (text: string, kind: "单词" | "释义") => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      toast({ title: "已复制", description: `${kind}已复制到剪贴板。` });
    } catch {
      toast({ variant: "destructive", title: "复制失败", description: "浏览器可能不允许复制，请手动选择复制。" });
    }
  };

  const handleRegenerate = async (w: CapturedWord) => {
    if (!w?.id) return;
    if (regeneratingWordIds.has(w.id)) return;

    setRegeneratingWordIds((prev) => {
      const next = new Set(prev);
      next.add(w.id);
      return next;
    });

    try {
      const result = await onRegenerateWord(w);
      if (result.success) {
        toast({ title: "已重新生成", description: `已更新 “${w.word}” 的释义与拓展信息。` });
      } else {
        toast({
          variant: "destructive",
          title: "重新生成失败",
          description: result.error || "发生未知错误，请稍后重试。",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "重新生成失败",
        description: error?.message || "发生未知错误，请稍后重试。",
      });
    } finally {
      setRegeneratingWordIds((prev) => {
        const next = new Set(prev);
        next.delete(w.id);
        return next;
      });
    }
  };

  const normalizeGroupName = (name: string) => String(name || '').trim().replace(/\s+/g, ' ');
  const GROUP_NAME_MAX_LEN = 30;

  const validateGroupName = (name: string, options?: { excludeId?: string }) => {
    const cleaned = normalizeGroupName(name);
    if (!cleaned) return "请输入分组名称。";
    if (cleaned.length > GROUP_NAME_MAX_LEN) return `分组名称过长（最多 ${GROUP_NAME_MAX_LEN} 个字符）。`;

    const target = cleaned.toLowerCase();
    const dup = groups.some((g) => {
      if (options?.excludeId && g.id === options.excludeId) return false;
      return normalizeGroupName(g.name).toLowerCase() === target;
    });
    if (dup) return "分组名称已存在，请换一个。";
    return null;
  };

  const newGroupNameClean = normalizeGroupName(newGroupName);
  const newGroupError = newGroupName.length > 0 ? validateGroupName(newGroupNameClean) : null;
  const editingGroupNameClean = normalizeGroupName(editingGroupName);
  const editingGroupError = editingGroupId ? validateGroupName(editingGroupNameClean, { excludeId: editingGroupId }) : null;

  const moveGroupOrder = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIdx = groups.findIndex((g) => g.id === fromId);
    const toIdx = groups.findIndex((g) => g.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...groups];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorderGroups(next);
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
      if (nextScope === 'group') {
        const targetGroupId = generatorGroupId || selectedGroupId || ALL_GROUP_ID;
        const groupWords = targetGroupId === ALL_GROUP_ID
          ? allSortedWords
          : allSortedWords.filter((w) => getWordGroupId(w) === targetGroupId);
        return setSelectionFromWords(groupWords);
      }
      if (nextScope === 'week') return setSelectionFromWords(recentWeekWords);
      if (nextScope === 'month') return setSelectionFromWords(recentMonthWords);
    };

    const openGenerator = (mode: GeneratorMode, weekWords: CapturedWord[]) => {
      setGeneratorMode(mode);
      setContextGroupWords(weekWords);
      // Default to manual selection (pre-selected words from the week card).
      setWordPickScope('manual');
      setSelectionFromWords(weekWords);
      setWordSearch('');
      setStoryConfirmOpen(false);
      setGeneratorGroupId(selectedGroupId || ALL_GROUP_ID);
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

    const openMoveDialog = (w: CapturedWord) => {
      setMovingWord(w);
      const curr = getWordGroupId(w);
      setMoveTargetGroupId(curr || UNGROUPED_GROUP_ID);
      setMoveOpen(true);
    };

    const setDefinitionOpen = (key: string, open: boolean) => {
      setDefinitionOpenKeys((prev) => {
        const next = new Set(prev);
        if (open) next.add(key);
        else next.delete(key);
        return next;
      });
    };

    const groupCounts = allSortedWords.reduce((acc, w) => {
      const gid = getWordGroupId(w);
      if (gid) acc[gid] = (acc[gid] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const groupToDelete = deleteGroupId ? groups.find((g) => g.id === deleteGroupId) : undefined;
    const deleteWordCount = groupToDelete ? (groupCounts[groupToDelete.id] || 0) : 0;

    const startRename = (g: WordGroup) => {
      setEditingGroupId(g.id);
      setEditingGroupName(g.name);
    };

    const cancelRename = () => {
      setEditingGroupId(null);
      setEditingGroupName('');
    };

  const saveRename = () => {
      if (!editingGroupId) return;
      const err = validateGroupName(editingGroupNameClean, { excludeId: editingGroupId });
      if (err) return;
      onRenameGroup(editingGroupId, editingGroupNameClean);
      cancelRename();
    };
   
    return (
      <TooltipProvider delayDuration={150}>
      <>
      <div className="space-y-6">
         <div className="flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
             <Sparkles className="h-6 w-6 text-primary" />
             <h2 className="text-2xl font-bold font-headline">我的单词本</h2>
           </div>
           <div className="flex items-center gap-2">
             <Button
               type="button"
               variant={bulkMode ? "secondary" : "outline"}
               size="sm"
               onClick={() => setBulkMode((prev) => !prev)}
               aria-label="批量选择"
               title="批量选择"
             >
               批量选择{bulkMode ? `（已选 ${bulkSelectedCardKeys.size}）` : ""}
             </Button>
           </div>
          </div>

         <div className="space-y-2">
           <div className="flex items-center justify-between gap-3">
             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
               <Label htmlFor="group-select" className="text-sm text-muted-foreground shrink-0">分组</Label>
               <Select value={selectedGroupId} onValueChange={onSelectGroup}>
                 <SelectTrigger id="group-select" className="w-full sm:w-[280px]">
                   <SelectValue placeholder="请选择分组..." />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value={ALL_GROUP_ID}>全部（{allSortedWords.length}）</SelectItem>
                   {groups.map((g) => (
                     <SelectItem key={g.id} value={g.id}>
                       {g.name}（{groupCounts[g.id] || 0}）
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <Button type="button" variant="outline" size="sm" onClick={() => setGroupManagerOpen(true)}>
               <Folders className="mr-2 h-4 w-4" />
               分组管理
             </Button>
           </div>
           <div className="text-xs text-muted-foreground">
             分组用于管理单词集合；下方仍按日期分周展示。
           </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="搜索：单词 / 释义 / 例句 / 同反义词 / 搭配…"
                  className="pl-8"
                />
              </div>

              <Select value={masteryFilter} onValueChange={(v) => setMasteryFilter(v as MasteryFilter)}>
                <SelectTrigger className="w-full sm:w-[140px]" aria-label="掌握筛选" title="掌握筛选">
                  <SelectValue placeholder="掌握筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="mastered">已掌握</SelectItem>
                  <SelectItem value="unmastered">未掌握</SelectItem>
                </SelectContent>
              </Select>

              <Select value={reviewSort} onValueChange={(v) => setReviewSort(v as ReviewSort)}>
                <SelectTrigger className="w-full sm:w-[140px]" aria-label="排序" title="排序">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新</SelectItem>
                  <SelectItem value="oldest">最旧</SelectItem>
                  <SelectItem value="az">A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkMode && (
              <div className="rounded-md border bg-card p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  已选 {bulkSelectedCardCount} 个卡片（{bulkSelectedWordIds.length} 条词条）
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkSelectedCardKeys(new Set(visibleCards.map((c) => c.cardKey)))}
                    disabled={visibleCards.length === 0}
                  >
                    全选当前结果
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkSelectedCardKeys(new Set())}
                    disabled={bulkSelectedCardKeys.size === 0}
                  >
                    清空选择
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkMoveTargetGroupId(groups.some((g) => g.id === selectedGroupId) ? selectedGroupId : UNGROUPED_GROUP_ID);
                      setBulkMoveOpen(true);
                    }}
                    disabled={bulkSelectedWordIds.length === 0}
                  >
                    批量移动分组
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (bulkSelectedTermKeys.length === 0) return;
                      onSetTermsMastered(bulkSelectedTermKeys, true);
                      toast({ title: "已标记已掌握", description: `已标记 ${bulkSelectedTermKeys.length} 个单词为已掌握。` });
                      setBulkSelectedCardKeys(new Set());
                    }}
                    disabled={bulkSelectedTermKeys.length === 0}
                  >
                    批量标记已掌握
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkSelectedWordIds.length === 0}
                  >
                    批量删除
                  </Button>
                </div>
              </div>
            )}
         </div>

       {viewWords.length === 0 ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
           <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
           <h3 className="mt-4 text-lg font-medium">
             {selectedGroupId === ALL_GROUP_ID ? '还没有收集到单词' : '当前分组还没有单词'}
           </h3>
           <p className="mt-1 text-sm text-muted-foreground">
             去「新增单词」添加你的第一个单词。
           </p>
         </div>
       ) : weekSections.length === 0 ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg bg-card">
           <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
           <h3 className="mt-4 text-lg font-medium">没有匹配结果</h3>
           <p className="mt-1 text-sm text-muted-foreground">
             试试清空搜索内容，或调整筛选/排序条件。
           </p>
         </div>
       ) : (
         <div className="space-y-8">
           {weekSections.map(({ weekKey, groups: weekTermGroups }) => (
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
                 {weekTermGroups.map((g) => {
                   const groupKey = `${weekKey}::${g.key}`;
                   const variants = pickVariantsByPos(g.words);
                   const selectedId = variantSelection[groupKey];
                   const selected = variants.find((w) => w.id === selectedId) || variants[0];
                   const isDefinitionOpen = definitionOpenKeys.has(groupKey);
                   const isMastered = g.words.some((w) => w.mastered === true);
                   const isRegenerating = regeneratingWordIds.has(selected.id);
                   const isCardSelected = bulkSelectedCardKeys.has(groupKey);
                   const enrichment = selected.enrichment;
                   const hasEnrichmentContent = (() => {
                     if (!enrichment) return false;
                     const hasLevel = !!(enrichment.level?.cefr || enrichment.level?.usageZh);
                     const hasCollocations = Array.isArray(enrichment.collocations) && enrichment.collocations.length > 0;
                     const hasSynonyms = Array.isArray(enrichment.synonyms) && enrichment.synonyms.length > 0;
                     const hasAntonyms = Array.isArray(enrichment.antonyms) && enrichment.antonyms.length > 0;
                     const hasExamples = Array.isArray(enrichment.examples) && enrichment.examples.length > 0;
                     return hasLevel || hasCollocations || hasSynonyms || hasAntonyms || hasExamples;
                   })();

                   const selectVariant = (id: string) => {
                     setVariantSelection((prev) => ({ ...prev, [groupKey]: id }));
                   };

                   return (
                     <Card key={groupKey} className="w-full">
                       <CardContent className="p-3">
                         <div className="flex items-center justify-between">
                           <div className="flex-grow flex items-center gap-2 overflow-hidden">
                             {bulkMode && (
                               <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                 <Checkbox
                                   checked={isCardSelected}
                                   onCheckedChange={(checked) => {
                                     const on = checked === true;
                                     setBulkSelectedCardKeys((prev) => {
                                       const next = new Set(prev);
                                       if (on) next.add(groupKey);
                                       else next.delete(groupKey);
                                       return next;
                                     });
                                   }}
                                   aria-label="选择该卡片"
                                   title="选择该卡片"
                                 />
                               </div>
                             )}
                             <span
                               className="font-bold text-lg cursor-pointer hover:underline"
                               onClick={() => handleWordClick(selected.word)}
                             >
                               {g.display}
                             </span>
                             {isMastered && (
                               <Badge
                                 variant="secondary"
                                 className="h-6 px-2 text-xs bg-primary/10 text-primary hover:bg-primary/10 shrink-0"
                               >
                                 已掌握
                               </Badge>
                             )}

                             {variants.length > 1 ? (
                               <>
                                 <div className="sm:hidden shrink-0">
                                   <Select value={selected.id} onValueChange={(id) => selectVariant(id)}>
                                     <SelectTrigger className="h-7 w-[120px]">
                                       <SelectValue placeholder="词性" />
                                     </SelectTrigger>
                                     <SelectContent>
                                       {variants.map((v) => (
                                         <SelectItem key={v.id} value={v.id} className="capitalize">
                                           {v.partOfSpeech}
                                         </SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                 </div>

                                 <div className="hidden sm:flex flex-wrap items-center gap-1 shrink-0">
                                   {variants.map((v) => (
                                     <Button
                                       key={v.id}
                                       type="button"
                                       size="sm"
                                       variant={v.id === selected.id ? "secondary" : "outline"}
                                       className="h-6 px-2 text-xs capitalize"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         selectVariant(v.id);
                                       }}
                                     >
                                       {v.partOfSpeech}
                                     </Button>
                                   ))}
                                 </div>
                               </>
                             ) : (
                               <Badge variant="secondary" className="capitalize shrink-0">{selected.partOfSpeech}</Badge>
                             )}

                             {isDefinitionOpen && <p className="text-muted-foreground truncate">{selected.definition}</p>}
                           </div>

                           <div className="flex items-center flex-shrink-0 ml-4">
                           <div className="text-xs text-muted-foreground mr-4 hidden sm:block">
                             {formatDistanceToNow(new Date(g.latestCapturedAt), { addSuffix: true })}
                           </div>
                            <div className="flex items-center gap-1 mr-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${isMastered ? "text-primary" : "text-muted-foreground"}`}
                                    aria-label={isMastered ? "取消掌握" : "标记为已掌握"}
                                    title={isMastered ? "已掌握（点击取消）" : "标记为已掌握"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleMastered(g.key, !isMastered);
                                    }}
                                  >
                                    {isMastered ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                    <span className="sr-only">{isMastered ? "取消掌握" : "标记为已掌握"}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isMastered ? "已掌握（点击取消）" : "标记为已掌握"}
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${isDefinitionOpen ? "text-foreground" : "text-muted-foreground"}`}
                                    aria-label={isDefinitionOpen ? "隐藏释义" : "显示释义"}
                                    title={isDefinitionOpen ? "隐藏释义" : "显示释义"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDefinitionOpen(groupKey, !isDefinitionOpen);
                                    }}
                                  >
                                    {isDefinitionOpen ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    <span className="sr-only">{isDefinitionOpen ? "隐藏释义" : "显示释义"}</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isDefinitionOpen ? "隐藏释义" : "显示释义"}
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                    aria-label="复制单词"
                                    title="复制单词"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void copyToClipboard(g.display, "单词");
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">复制单词</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>复制单词</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                    aria-label="复制释义"
                                    title="复制释义"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void copyToClipboard(selected.definition, "释义");
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">复制释义</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>复制释义</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                    aria-label="重新生成释义与拓展"
                                    title="重新生成"
                                    disabled={isRegenerating}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRegenerate(selected);
                                    }}
                                  >
                                    {isRegenerating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCcw className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">重新生成释义与拓展</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>重新生成</TooltipContent>
                              </Tooltip>
                            </div>

                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   type="button"
                                   variant="ghost"
                                   size="icon"
                                   className="h-8 w-8"
                                   aria-label="编辑单词"
                                   title="编辑单词"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     onEditWord(selected);
                                   }}
                                 >
                                   <Pencil className="h-4 w-4" />
                                   <span className="sr-only">编辑单词</span>
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>编辑</TooltipContent>
                             </Tooltip>

                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   type="button"
                                   variant="ghost"
                                   size="icon"
                                   className="h-8 w-8"
                                   aria-label="移动分组"
                                   title="移动分组"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     openMoveDialog(selected);
                                   }}
                                 >
                                   <FolderInput className="h-4 w-4" />
                                   <span className="sr-only">移动分组</span>
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>移动分组</TooltipContent>
                             </Tooltip>

                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   type="button"
                                   variant="ghost"
                                   size="icon"
                                   className="h-8 w-8 text-destructive/70 hover:text-destructive"
                                   aria-label="删除单词"
                                   title="删除单词"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     onDeleteWord(selected);
                                   }}
                                 >
                                   <Trash className="h-4 w-4" />
                                   <span className="sr-only">删除单词</span>
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>删除</TooltipContent>
                             </Tooltip>
                           </div>
                         </div>

                         <Accordion type="single" collapsible className="mt-2">
                           <AccordionItem value="details" className="border-none">
                             <AccordionTrigger className="py-2 text-sm">
                               了解更多
                             </AccordionTrigger>
                             <AccordionContent className="pb-1">
                               {!enrichment || !hasEnrichmentContent ? (
                                 <div className="space-y-2">
                                   <p className="text-muted-foreground">
                                     暂无 AI 拓展内容（可能是模型返回为空或解析失败）。你可以稍后点击“重新生成”。
                                   </p>
                                   <div>
                                     <Button
                                       type="button"
                                       size="sm"
                                       variant="outline"
                                       disabled={isRegenerating}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         void handleRegenerate(selected);
                                       }}
                                     >
                                       {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                       重新生成释义与拓展
                                     </Button>
                                   </div>
                                 </div>
                               ) : (
                                 <div className="space-y-3">
                                   {(enrichment.level?.cefr || enrichment.level?.usageZh) && (
                                     <div>
                                       <div className="text-xs font-semibold text-muted-foreground">难度与用法</div>
                                       <div className="text-sm">
                                         {enrichment.level?.cefr && (
                                           <span className="mr-2">CEFR: {enrichment.level.cefr}</span>
                                         )}
                                         {enrichment.level?.usageZh && (
                                           <p className="mt-1 text-muted-foreground">{enrichment.level.usageZh}</p>
                                         )}
                                       </div>
                                     </div>
                                   )}

                                   {Array.isArray(enrichment.collocations) && enrichment.collocations.length > 0 && (
                                     <div>
                                       <div className="text-xs font-semibold text-muted-foreground">常见搭配</div>
                                       <ul className="mt-1 space-y-1 text-sm">
                                         {enrichment.collocations.slice(0, 6).map((c, idx) => (
                                           <li key={idx} className="text-muted-foreground">
                                             <span className="text-foreground">{c.phrase}</span>
                                             {c.meaningZh ? ` — ${c.meaningZh}` : ''}
                                           </li>
                                         ))}
                                       </ul>
                                     </div>
                                   )}

                                   {(Array.isArray(enrichment.synonyms) && enrichment.synonyms.length > 0) && (
                                     <div>
                                       <div className="text-xs font-semibold text-muted-foreground">同义词</div>
                                       <div className="mt-1 text-sm text-muted-foreground">
                                         {enrichment.synonyms.slice(0, 10).join(', ')}
                                       </div>
                                     </div>
                                   )}

                                   {(Array.isArray(enrichment.antonyms) && enrichment.antonyms.length > 0) && (
                                     <div>
                                       <div className="text-xs font-semibold text-muted-foreground">反义词</div>
                                       <div className="mt-1 text-sm text-muted-foreground">
                                         {enrichment.antonyms.slice(0, 10).join(', ')}
                                       </div>
                                     </div>
                                   )}

                                   {Array.isArray(enrichment.examples) && enrichment.examples.length > 0 && (
                                     <div>
                                       <div className="text-xs font-semibold text-muted-foreground">例句</div>
                                       <ul className="mt-1 space-y-2 text-sm">
                                         {enrichment.examples.slice(0, 5).map((ex, idx) => (
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
                   );
                 })}
               </div>
             </div>
           ))}
         </div>
       )}
    </div>

    <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{generatorMode === 'practice' ? '生成练习' : '生成故事'}</DialogTitle>
          <DialogDescription>
            {generatorMode === 'practice' ? '选择单词范围、题型与题目数量。' : '选择用于生成故事的单词。'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-2">
            <div className="text-sm font-medium">选择单词</div>
            <RadioGroup
              value={wordPickScope}
              onValueChange={(v) => applyScope(v as WordPickScope)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div className="rounded-md border p-3 space-y-2 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="scope-group" value="group" />
                  <Label htmlFor="scope-group" className="cursor-pointer">分组</Label>
                </div>
                <Select
                  value={generatorGroupId}
                  onValueChange={(v) => {
                    setGeneratorGroupId(v);
                    setWordPickScope('group');
                    const groupWords = v === ALL_GROUP_ID
                      ? allSortedWords
                      : allSortedWords.filter((w) => getWordGroupId(w) === v);
                    setSelectionFromWords(groupWords);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择分组..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_GROUP_ID}>全部（{allSortedWords.length}）</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}（{groupCounts[g.id] || 0}）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  选择分组后将自动选中该分组内的全部单词（可继续手动调整）。
                </div>
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={wordSearch}
              onChange={(e) => setWordSearch(e.target.value)}
              placeholder="搜索单词 / 词性 / 释义..."
            />
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={selectAllFiltered}>
              全选
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={clearSelection}>
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

        <DialogFooter className="shrink-0">
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

    <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>批量移动分组</DialogTitle>
          <DialogDescription>
            将已选 {bulkSelectedCardCount} 个卡片内的 {bulkSelectedWordIds.length} 条词条移动到目标分组。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>目标分组</Label>
          <Select value={bulkMoveTargetGroupId} onValueChange={setBulkMoveTargetGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="请选择分组..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNGROUPED_GROUP_ID}>未分组（仅在“全部”中显示）</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setBulkMoveOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={bulkSelectedWordIds.length === 0}
            onClick={() => {
              if (bulkSelectedWordIds.length === 0) return;
              onMoveWordsToGroup(bulkSelectedWordIds, bulkMoveTargetGroupId);
              setBulkMoveOpen(false);
              setBulkSelectedCardKeys(new Set());
              toast({ title: "已移动分组", description: `已移动 ${bulkSelectedWordIds.length} 条词条。` });
            }}
          >
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认批量删除？</AlertDialogTitle>
          <AlertDialogDescription>
            将删除已选 {bulkSelectedCardCount} 个卡片内的 {bulkSelectedWordIds.length} 条词条。此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (bulkSelectedWordIds.length === 0) return;
              onDeleteWords(bulkSelectedWordIds);
              setBulkDeleteOpen(false);
              setBulkSelectedCardKeys(new Set());
              toast({ title: "已删除", description: `已删除 ${bulkSelectedWordIds.length} 条词条。` });
            }}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog
      open={groupManagerOpen}
      onOpenChange={(open) => {
        setGroupManagerOpen(open);
        if (!open) {
          cancelRename();
          setNewGroupName('');
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>分组管理</DialogTitle>
          <DialogDescription>
            新建、重命名或删除分组。删除分组后，该分组的单词会变为未分组（可在“全部”中查看并重新分配）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div className="space-y-2">
            <div className="text-sm font-medium">新建分组</div>
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="例如：九年级·Unit 3"
                />
                <Button
                  type="button"
                  disabled={!newGroupNameClean || !!validateGroupName(newGroupNameClean)}
                  onClick={() => {
                    const err = validateGroupName(newGroupNameClean);
                    if (err) return;
                    onAddGroup(newGroupNameClean);
                    setNewGroupName('');
                  }}
                >
                  创建
                </Button>
              </div>
              {newGroupError && <div className="text-xs text-destructive">{newGroupError}</div>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">已有分组</div>
              <div className="text-xs text-muted-foreground">可拖拽排序（仅影响显示顺序）</div>
            </div>
            <div className="space-y-2">
              {groups.map((g) => {
                const isEditing = editingGroupId === g.id;
                return (
                  <div
                    key={g.id}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      if (isEditing) return;
                      setDraggingGroupId(g.id);
                      setDragOverGroupId(null);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!draggingGroupId || draggingGroupId === g.id) return;
                      e.preventDefault();
                      setDragOverGroupId(g.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverGroupId === g.id) setDragOverGroupId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggingGroupId || draggingGroupId === g.id) return;
                      moveGroupOrder(draggingGroupId, g.id);
                      setDraggingGroupId(null);
                      setDragOverGroupId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingGroupId(null);
                      setDragOverGroupId(null);
                    }}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3 ${dragOverGroupId === g.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`shrink-0 text-muted-foreground ${isEditing ? "opacity-50" : "cursor-grab"}`} aria-hidden="true">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      {isEditing ? (
                        <div className="flex-1 space-y-1">
                          <Input
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            placeholder="请输入分组名称"
                          />
                          {editingGroupError && <div className="text-xs text-destructive">{editingGroupError}</div>}
                        </div>
                      ) : (
                        <>
                          <div className="font-medium truncate">{g.name}</div>
                          <span className="text-xs text-muted-foreground">
                            {groupCounts[g.id] || 0} 个单词
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      {isEditing ? (
                        <>
                          <Button type="button" size="sm" onClick={saveRename} disabled={!!editingGroupError}>
                            保存
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelRename}>
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => startRename(g)}>
                            重命名
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteGroupId(g.id)}
                          >
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => setGroupManagerOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => { if (!open) setDeleteGroupId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除分组？</AlertDialogTitle>
          <AlertDialogDescription>
            将删除分组“{groupToDelete?.name}”。该分组的 {deleteWordCount} 个单词将变为未分组（仅在“全部”中可见）。此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!deleteGroupId) return;
              onDeleteGroup(deleteGroupId);
              setDeleteGroupId(null);
            }}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={moveOpen} onOpenChange={(open) => { setMoveOpen(open); if (!open) setMovingWord(null); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>移动到分组</DialogTitle>
          <DialogDescription>
            将单词移动到指定分组中。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">单词</div>
            <div className="font-medium">{movingWord?.word}</div>
          </div>

          <div className="space-y-2">
            <Label>目标分组</Label>
            <Select value={moveTargetGroupId} onValueChange={setMoveTargetGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择分组..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNGROUPED_GROUP_ID}>未分组（仅在“全部”中显示）</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>取消</Button>
          <Button
            type="button"
            onClick={() => {
              if (!movingWord) return;
              onMoveWordToGroup(movingWord.id, moveTargetGroupId);
              setMoveOpen(false);
              setMovingWord(null);
            }}
          >
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
   </TooltipProvider>
   );
}
