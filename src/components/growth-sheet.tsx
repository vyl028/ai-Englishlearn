"use client";

import * as React from "react";
import { Award, Flame, Trophy } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type GrowthSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function getBadgeProgressText(id: BadgeId, state: GamificationState, stats: { masteredCount: number }) {
  const targets: Record<BadgeId, number> = {
    streak_3: 3,
    streak_7: 7,
    streak_14: 14,
    mastered_10: 10,
    mastered_100: 100,
  };

  const target = targets[id] || 1;
  const rawCurrent =
    id.startsWith("streak_") ? state.streak.longest : stats.masteredCount;
  const current = Math.max(0, Math.min(target, Math.floor(rawCurrent)));
  const percent = Math.max(0, Math.min(100, (current / target) * 100));

  return { current, target, percent, text: `${current}/${target}` };
}

export function GrowthSheet({ open, onOpenChange, gamification, words, defaultDays = 7 }: GrowthSheetProps) {
  const [days, setDays] = React.useState(() => defaultDays);

  const level = React.useMemo(() => getLevelInfo(gamification.xp), [gamification.xp]);
  const wordStats = React.useMemo(() => computeWordStats(words), [words]);

  const todayKey = formatDateKey(new Date());
  const checkedInToday = gamification.streak.lastActiveDate === todayKey;

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

  const rangeXp = React.useMemo(() => chartData.reduce((sum, d) => sum + d.xpEarned, 0), [chartData]);
  const rangeWords = React.useMemo(() => chartData.reduce((sum, d) => sum + d.wordsAdded, 0), [chartData]);
  const hasChartData = React.useMemo(
    () => chartData.some((d) => d.xpEarned > 0 || d.wordsAdded > 0),
    [chartData]
  );

  const badgeIds = React.useMemo(() => Object.keys(BADGE_META) as BadgeId[], []);

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
                <CardTitle className="text-base">打卡</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  今日：{checkedInToday ? <span className="text-foreground font-medium">已打卡</span> : "未打卡"}
                </div>
                <div className="text-sm text-muted-foreground">
                  当前连续：<span className="text-foreground font-medium">{gamification.streak.current}</span> 天
                </div>
                <div className="text-sm text-muted-foreground">
                  最长连续：<span className="text-foreground font-medium">{gamification.streak.longest}</span> 天
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
              <CardTitle className="text-base">勋章</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badgeIds.map((id) => {
                  const meta = BADGE_META[id];
                  const unlocked = gamification.unlockedBadges.includes(id);
                  const Icon = meta.icon;
                  const progress = getBadgeProgressText(id, gamification, { masteredCount: wordStats.masteredCount });
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
