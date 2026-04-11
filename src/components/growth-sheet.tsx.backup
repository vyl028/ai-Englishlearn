"use client";

import * as React from "react";
import { Award, Download, Flame, RotateCcw, Target, Trophy } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CapturedWord } from "@/lib/types";
import type { BadgeId, GamificationState } from "@/lib/gamification";
import { computeWordStats, formatDateKey, getLevelInfo, getRecentDateKeys } from "@/lib/gamification";
import { readGrowthGoals, writeGrowthGoals } from "@/lib/growth-goals";
import { readLearningEventsStore, type LearningEvent } from "@/lib/learning-events";
import { readSpeakingTrainingStatsStore } from "@/lib/speaking-training-stats";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

type GrowthSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetGrowthData: () => void;
  gamification: GamificationState;
  words: CapturedWord[];
  defaultDays?: number;
};

const BADGE_META: Record<
  BadgeId,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  streak_3: { title: "连续打卡 3 天", description: "连续 3 天完成任意学习任务。", icon: Flame },
  streak_7: { title: "连续打卡 7 天", description: "连续 7 天完成任意学习任务。", icon: Flame },
  streak_14: { title: "连续打卡 14 天", description: "连续 14 天完成任意学习任务。", icon: Flame },
  mastered_10: { title: "掌握 10 个单词", description: "将 10 个单词标记为“已掌握”。", icon: Award },
  mastered_100: { title: "掌握 100 个单词", description: "将 100 个单词标记为“已掌握”。", icon: Trophy },
};

function getBadgeProgressText(id: BadgeId, params: { streakCurrent: number; masteredCount: number }) {
  const targets: Record<BadgeId, number> = {
    streak_3: 3,
    streak_7: 7,
    streak_14: 14,
    mastered_10: 10,
    mastered_100: 100,
  };

  const target = targets[id] || 1;
  const rawCurrent =
    id.startsWith("streak_") ? params.streakCurrent : params.masteredCount;
  const current = Math.max(0, Math.min(target, Math.floor(rawCurrent)));
  const percent = Math.max(0, Math.min(100, (current / target) * 100));

  return { current, target, percent, text: `${current}/${target}` };
}

function formatLearningEventLabel(event: LearningEvent) {
  switch (event.type) {
    case "words_added":
      return `新增单词 +${event.count}`;
    case "practice_completed":
      return `完成练习 ${event.correctCount}/${event.totalCount}`;
    case "story_generated":
      return `生成故事（用词 ${event.wordCount}）`;
    default:
      return "学习记录";
  }
}

export function GrowthSheet({
  open,
  onOpenChange,
  onResetGrowthData,
  gamification,
  words,
  defaultDays = 7,
}: GrowthSheetProps) {
  const [days, setDays] = React.useState(() => defaultDays);
  const [speakingStatsStore, setSpeakingStatsStore] = React.useState(() => readSpeakingTrainingStatsStore());
  const [growthGoals, setGrowthGoals] = React.useState(() => readGrowthGoals());
  const [learningEventsStore, setLearningEventsStore] = React.useState(() => readLearningEventsStore());
  const [showAllLearningEvents, setShowAllLearningEvents] = React.useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false);
  const { toast } = useToast();

  const level = React.useMemo(() => getLevelInfo(gamification.xp), [gamification.xp]);
  const wordStats = React.useMemo(() => computeWordStats(words), [words]);

  const todayKey = formatDateKey(new Date());
  const checkedInToday = gamification.streak.lastActiveDate === todayKey;
  const yesterdayKey = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateKey(d);
  }, [todayKey]);
  const canKeepStreakToday = gamification.streak.lastActiveDate === yesterdayKey;
  const displayCurrentStreak = checkedInToday || canKeepStreakToday ? gamification.streak.current : 0;

  React.useEffect(() => {
    if (!open) return;
    setSpeakingStatsStore(readSpeakingTrainingStatsStore());
    setGrowthGoals(readGrowthGoals());
    setLearningEventsStore(readLearningEventsStore());
    setShowAllLearningEvents(false);
  }, [open]);

  const masteryRatio = wordStats.uniqueCount > 0 ? wordStats.masteredCount / wordStats.uniqueCount : 0;
  const masteryPercent = Math.round(masteryRatio * 100);

  const dateKeys = React.useMemo(() => getRecentDateKeys(days, new Date()), [days, todayKey]);
  const chartData = React.useMemo(() => {
    return dateKeys.map((k) => {
      const stats = gamification.daily[k] || { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 };
      return {
        date: k.slice(5),
        xpEarned: stats.xpEarned,
        wordsAdded: stats.wordsAdded,
      };
    });
  }, [dateKeys, gamification.daily]);

  const weekKeys = React.useMemo(() => getRecentDateKeys(7, new Date()), [todayKey]);
  const weekSummary = React.useMemo(() => {
    let xpEarned = 0;
    let wordsAdded = 0;
    let practiceCompleted = 0;
    let storiesGenerated = 0;
    let activeDays = 0;

    for (const k of weekKeys) {
      const d = gamification.daily[k];
      if (!d) continue;
      xpEarned += d.xpEarned || 0;
      wordsAdded += d.wordsAdded || 0;
      practiceCompleted += d.practiceCompleted || 0;
      storiesGenerated += d.storiesGenerated || 0;
      if ((d.xpEarned || 0) > 0) activeDays += 1;
    }

    return { xpEarned, wordsAdded, practiceCompleted, storiesGenerated, activeDays };
  }, [weekKeys, gamification.daily]);

  const speakingKeys = React.useMemo(() => getRecentDateKeys(7, new Date()), [todayKey]);
  const speakingSummary = React.useMemo(() => {
    let attempts = 0;
    let scoreSum = 0;
    for (const k of speakingKeys) {
      const d = speakingStatsStore.days[k];
      if (!d) continue;
      attempts += d.attempts || 0;
      scoreSum += d.scoreSum || 0;
    }
    const avgScore = attempts > 0 ? Math.round(scoreSum / attempts) : null;
    return { attempts, avgScore };
  }, [speakingKeys, speakingStatsStore.days]);

  const speakingChartData = React.useMemo(() => {
    return speakingKeys.map((k) => {
      const d = speakingStatsStore.days[k];
      const attempts = d?.attempts || 0;
      const avgScore = attempts > 0 ? Math.round((d?.scoreSum || 0) / attempts) : null;
      return { date: k.slice(5), attempts, avgScore };
    });
  }, [speakingKeys, speakingStatsStore.days]);

  const rangeXp = React.useMemo(() => chartData.reduce((sum, d) => sum + d.xpEarned, 0), [chartData]);
  const rangeWords = React.useMemo(() => chartData.reduce((sum, d) => sum + d.wordsAdded, 0), [chartData]);
  const hasChartData = React.useMemo(
    () => chartData.some((d) => d.xpEarned > 0 || d.wordsAdded > 0),
    [chartData]
  );

  const badgeIds = React.useMemo(() => Object.keys(BADGE_META) as BadgeId[], []);
  const nextBadge = React.useMemo(() => {
    const locked = badgeIds.filter((id) => !gamification.unlockedBadges.includes(id));
    if (locked.length === 0) return null;

    const candidates = locked.map((id) => {
      const progress = getBadgeProgressText(id, { streakCurrent: displayCurrentStreak, masteredCount: wordStats.masteredCount });
      const remaining = Math.max(0, progress.target - progress.current);
      return { id, progress, remaining };
    });

    candidates.sort((a, b) => {
      if (b.progress.percent !== a.progress.percent) return b.progress.percent - a.progress.percent;
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      return a.id.localeCompare(b.id);
    });

    return candidates[0] || null;
  }, [badgeIds, gamification.unlockedBadges, displayCurrentStreak, wordStats.masteredCount]);

  const weeklyXpPercent =
    growthGoals.weeklyXpGoal > 0 ? Math.min(100, (weekSummary.xpEarned / growthGoals.weeklyXpGoal) * 100) : 0;
  const weeklyWordsPercent =
    growthGoals.weeklyWordsGoal > 0 ? Math.min(100, (weekSummary.wordsAdded / growthGoals.weeklyWordsGoal) * 100) : 0;

  const learningEventFormatter = React.useMemo(() => {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>成长</SheetTitle>
          <SheetDescription>等级、勋章与学习曲线会随着你的学习自动更新。</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto space-y-6 pr-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">本周摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">获得 XP</div>
                  <div className="text-2xl font-bold">{weekSummary.xpEarned}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">新增单词</div>
                  <div className="text-2xl font-bold">{weekSummary.wordsAdded}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">完成练习</div>
                  <div className="text-2xl font-bold">{weekSummary.practiceCompleted}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">生成故事</div>
                  <div className="text-2xl font-bold">{weekSummary.storiesGenerated}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {weekSummary.activeDays === 0 ? (
                  <span>本周还没有学习记录，先从“新增单词”开始吧。</span>
                ) : (
                  <span>本周学习 {weekSummary.activeDays} / 7 天。</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">本周目标</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">口径：近 7 天滚动统计（非自然周）。目标填 0 表示不设置。</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span>XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {growthGoals.weeklyXpGoal > 0
                        ? `${weekSummary.xpEarned}/${growthGoals.weeklyXpGoal}（${Math.round(weeklyXpPercent)}%）`
                        : `${weekSummary.xpEarned}（未设置）`}
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999999}
                      className="h-8 w-28"
                      value={growthGoals.weeklyXpGoal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === "" ? 0 : Number(raw);
                        const next = {
                          ...growthGoals,
                          weeklyXpGoal: Number.isFinite(n) ? Math.max(0, Math.min(999999, Math.floor(n))) : growthGoals.weeklyXpGoal,
                        };
                        setGrowthGoals(next);
                        writeGrowthGoals(next);
                      }}
                    />
                  </div>
                </div>
                <Progress value={weeklyXpPercent} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span>新增单词</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {growthGoals.weeklyWordsGoal > 0
                        ? `${weekSummary.wordsAdded}/${growthGoals.weeklyWordsGoal}（${Math.round(weeklyWordsPercent)}%）`
                        : `${weekSummary.wordsAdded}（未设置）`}
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999999}
                      className="h-8 w-28"
                      value={growthGoals.weeklyWordsGoal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === "" ? 0 : Number(raw);
                        const next = {
                          ...growthGoals,
                          weeklyWordsGoal: Number.isFinite(n) ? Math.max(0, Math.min(999999, Math.floor(n))) : growthGoals.weeklyWordsGoal,
                        };
                        setGrowthGoals(next);
                        writeGrowthGoals(next);
                      }}
                    />
                  </div>
                </div>
                <Progress value={weeklyWordsPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">等级</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div className="text-2xl font-bold">Lv. {level.level}</div>
                <div className="text-sm text-muted-foreground">
                  总 XP：<span className="font-medium text-foreground">{level.xp}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={level.progress * 100} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    本级：{level.xpIntoLevel} / {level.xpForNextLevel}
                  </span>
                  <span>还差 {level.xpToNextLevel} XP 升级</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">今日打卡</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  状态：
                  {checkedInToday ? (
                    <span className="ml-1 text-foreground font-medium">已打卡</span>
                  ) : canKeepStreakToday ? (
                    <span className="ml-1 text-foreground font-medium">未打卡（补上即可延续）</span>
                  ) : gamification.streak.lastActiveDate ? (
                    <span className="ml-1 text-foreground font-medium">未打卡（已断签）</span>
                  ) : (
                    <span className="ml-1 text-foreground font-medium">未开始</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  当前连续：<span className="text-foreground font-medium">{displayCurrentStreak}</span> 天
                </div>
                <div className="text-sm text-muted-foreground">
                  最长连续：<span className="text-foreground font-medium">{gamification.streak.longest}</span> 天
                </div>
                <div className="text-xs text-muted-foreground pt-1 space-y-1">
                  <div>怎么算打卡：当天完成任意学习任务（会获得 XP）即可。</div>
                  <div>如何保持连续：每天至少打卡 1 次；漏 1 天会从 1 重新开始。</div>
                  {checkedInToday ? null : (
                    <div>上次打卡：{gamification.streak.lastActiveDate || "-"}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">掌握度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="text-2xl font-bold">{masteryPercent}%</div>
                  <div className="text-sm text-muted-foreground">
                    {wordStats.masteredCount} / {wordStats.uniqueCount}
                  </div>
                </div>
                <Progress value={masteryRatio * 100} />
                <div className="text-xs text-muted-foreground">按“已掌握”标记的单词数量计算（去重）。</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">下一个勋章</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextBadge ? (
                (() => {
                  const meta = BADGE_META[nextBadge.id];
                  const Icon = meta.icon;
                  const remaining = nextBadge.remaining;
                  const hint =
                    nextBadge.id.startsWith("streak_")
                      ? remaining <= 0
                        ? "已满足条件，下一次学习会自动解锁。"
                        : `再连续学习 ${remaining} 天即可解锁。`
                      : remaining <= 0
                        ? "已满足条件，刷新后会自动同步。"
                        : `再标记 ${remaining} 个单词为“已掌握”即可解锁。`;
                  return (
                    <div className="rounded-lg border p-3 flex gap-3 items-start">
                      <div className="mt-0.5 text-muted-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{meta.title}</div>
                          <Badge variant="outline" className="shrink-0">
                            进行中
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{meta.description}</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>进度</span>
                            <span>{nextBadge.progress.text}</span>
                          </div>
                          <Progress value={nextBadge.progress.percent} className="h-2" />
                        </div>
                        <div className="text-xs text-muted-foreground">{hint}</div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-muted-foreground">已解锁全部勋章，太强了！</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">学习曲线</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    近 {days} 天：获得 XP <span className="text-foreground font-medium">{rangeXp}</span>，新增单词{" "}
                    <span className="text-foreground font-medium">{rangeWords}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[7, 14, 30].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={days === d ? "secondary" : "outline"}
                      className="h-8 px-3"
                      onClick={() => setDays(d)}
                    >
                      {d} 天
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {hasChartData ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="xp"
                        width={36}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="words"
                        orientation="right"
                        width={28}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const xp = payload.find((p) => p.dataKey === "xpEarned")?.value ?? 0;
                          const w = payload.find((p) => p.dataKey === "wordsAdded")?.value ?? 0;
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                              <div className="font-medium">{label}</div>
                              <div className="text-muted-foreground mt-1 space-y-0.5">
                                <div>获得 XP：{xp}</div>
                                <div>新增单词：{w}</div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        yAxisId="words"
                        dataKey="wordsAdded"
                        name="新增单词"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="xp"
                        type="monotone"
                        dataKey="xpEarned"
                        name="获得 XP"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] w-full flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
                  还没有学习记录，去新增单词或做一次练习吧。
                </div>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-1))]" />
                  新增单词
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-[hsl(var(--chart-2))]" />
                  获得 XP
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">学习时间线</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">记录新增单词 / 完成练习 / 生成故事的摘要（本地）。</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningEventsStore.events.length > 0 ? (
                <div className="space-y-2">
                  {(showAllLearningEvents ? learningEventsStore.events : learningEventsStore.events.slice(0, 10)).map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{formatLearningEventLabel(e)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {learningEventFormatter.format(new Date(e.at))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {learningEventsStore.events.length > 10 ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllLearningEvents((v) => !v)}
                      >
                        {showAllLearningEvents ? "收起" : `查看更多（${learningEventsStore.events.length} 条）`}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">还没有时间线记录，去新增单词/做练习/生成故事吧。</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">听说训练</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    近 7 天：练习{" "}
                    <span className="text-foreground font-medium">{speakingSummary.attempts}</span> 次，平均分{" "}
                    <span className="text-foreground font-medium">{speakingSummary.avgScore === null ? "-" : `${speakingSummary.avgScore}%`}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {speakingSummary.attempts > 0 ? (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={speakingChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="count" width={36} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis
                        yAxisId="score"
                        orientation="right"
                        width={36}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const attempts = payload.find((p) => p.dataKey === "attempts")?.value ?? 0;
                          const avg = payload.find((p) => p.dataKey === "avgScore")?.value ?? null;
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                              <div className="font-medium">{label}</div>
                              <div className="text-muted-foreground mt-1 space-y-0.5">
                                <div>练习次数：{attempts}</div>
                                <div>平均分：{avg === null ? "-" : `${avg}%`}</div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        yAxisId="count"
                        dataKey="attempts"
                        name="练习次数"
                        fill="hsl(var(--chart-3))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="avgScore"
                        name="平均分"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] w-full flex items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
                  还没有跟读练习记录，去“听说训练”完成一次跟读评测吧。
                </div>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(var(--chart-3))]" />
                  练习次数
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-4 bg-[hsl(var(--chart-4))]" />
                  平均分
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                注：仅记录“跟读评测”的次数与分数（本地），不保存音频与转写内容。
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">勋章</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badgeIds.map((id) => {
                  const meta = BADGE_META[id];
                  const unlocked = gamification.unlockedBadges.includes(id);
                  const Icon = meta.icon;
                  const progress = getBadgeProgressText(id, { streakCurrent: displayCurrentStreak, masteredCount: wordStats.masteredCount });
                  return (
                    <div
                      key={id}
                      className={cn(
                        "rounded-lg border p-3 flex gap-3 items-start transition-colors",
                        unlocked ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/30"
                      )}
                    >
                      <div className={cn("mt-0.5", unlocked ? "text-primary" : "text-muted-foreground")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{meta.title}</div>
                          <Badge variant={unlocked ? "secondary" : "outline"} className="shrink-0">
                            {unlocked ? "已获得" : "未获得"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{meta.description}</div>
                        {!unlocked && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>进度</span>
                              <span>{progress.text}</span>
                            </div>
                            <Progress value={progress.percent} className="h-2" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                提示：任意学习行为都会自动“打卡”，勋章一旦获得将永久保留。
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导出与重置</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="text-sm text-muted-foreground">可导出成长数据 JSON，或仅重置成长相关数据（不影响单词本与分组）。</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const payload = {
                      schema: "lexi-capture-growth-export-v1",
                      exportedAt: new Date().toISOString(),
                      gamification,
                      growthGoals: readGrowthGoals(),
                      learningEvents: readLearningEventsStore(),
                      speakingTrainingStats: readSpeakingTrainingStatsStore(),
                    };
                    const json = JSON.stringify(payload, null, 2);
                    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
                    a.download = `lexi-growth-${safeTs}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: "已导出成长数据", description: "已生成并下载 JSON 文件。" });
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出 JSON
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置成长数据
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置成长数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，将清空等级/打卡/曲线/时间线/听说训练统计等成长数据，但不会删除单词本与分组。注意：与单词状态相关的“掌握类勋章”会按当前“已掌握”数量自动重新解锁。
              建议重置前先导出 JSON 备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onResetGrowthData();
                setSpeakingStatsStore(readSpeakingTrainingStatsStore());
                setGrowthGoals(readGrowthGoals());
                setLearningEventsStore(readLearningEventsStore());
                setShowAllLearningEvents(false);
                setConfirmResetOpen(false);
                toast({ title: "已重置成长数据", description: "单词本与分组未受影响。" });
              }}
            >
              重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
