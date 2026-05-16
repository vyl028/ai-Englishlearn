"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  learningPlanApi,
  type EvaluationReport,
  type LearningPlanData,
  type RecommendedWord,
} from "@/lib/api-client";

import {
  Target,
  Calendar,
  Lightbulb,
  BookOpen,
  Dumbbell,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Circle,
  ArrowRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  ThumbsUp,
  Zap,
  BrainCircuit,
} from "lucide-react";

interface LearningPlanViewProps {
  onStartPractice?: (wordIds?: string[], questionTypes?: string[]) => void;
  onNavigate?: (view: string) => void;
}

export function LearningPlanView({ onStartPractice, onNavigate }: LearningPlanViewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("evaluation");
  const [evalLoading, setEvalLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const [todayPlan, setTodayPlan] = useState<LearningPlanData | null>(null);
  const [recommendWords, setRecommendWords] = useState<RecommendedWord[]>([]);
  const [recommendTypes, setRecommendTypes] = useState<string[]>([]);
  const [goalSuggestion, setGoalSuggestion] = useState<string | null>(null);

  const fetchEvaluation = useCallback(async () => {
    setEvalLoading(true);
    try {
      const res = await learningPlanApi.getEvaluation();
      if (res.success && res.data) {
        setEvaluation(res.data);
      } else {
        toast({ title: "获取评价失败", description: res.error?.message || "未知错误" });
      }
    } catch (e) {
      toast({ title: "获取评价失败", description: "网络请求异常" });
    } finally {
      setEvalLoading(false);
    }
  }, [toast]);

  const fetchTodayPlan = useCallback(async () => {
    setPlanLoading(true);
    try {
      const res = await learningPlanApi.getTodayPlan();
      if (res.success && res.data) {
        setTodayPlan(res.data);
      } else {
        toast({ title: "获取计划失败", description: res.error?.message || "未知错误" });
      }
    } catch (e) {
      toast({ title: "获取计划失败", description: "网络请求异常" });
    } finally {
      setPlanLoading(false);
    }
  }, [toast]);

  const fetchRecommendations = useCallback(async () => {
    try {
      // For now, we don't have a dedicated recommendations endpoint;
      // derive from evaluation + plan data.
      // We can extract recommended words from the first review_words task in the plan.
      const planRes = await learningPlanApi.getTodayPlan();
      if (planRes.success && planRes.data) {
        const reviewTask = planRes.data.tasks.find((t) => t.type === "review_words");
        if (reviewTask && reviewTask.wordIds) {
          // We need word details; for now just mock from plan description
          // In a real implementation we'd call a dedicated endpoint.
          setRecommendWords([]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchEvaluation();
    fetchTodayPlan();
  }, [fetchEvaluation, fetchTodayPlan]);

  const handleGeneratePlan = async () => {
    setPlanLoading(true);
    try {
      const res = await learningPlanApi.generatePlan("daily");
      if (res.success && res.data) {
        setTodayPlan(res.data);
        toast({ title: "计划已重新生成" });
      } else {
        toast({ title: "生成失败", description: res.error?.message });
      }
    } catch {
      toast({ title: "生成失败", description: "网络请求异常" });
    } finally {
      setPlanLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!todayPlan) return;
    try {
      const res = await learningPlanApi.updatePlanStatus(todayPlan.id, status);
      if (res.success && res.data) {
        setTodayPlan(res.data);
        toast({ title: status === "completed" ? "计划已完成" : "状态已更新" });
      }
    } catch {
      toast({ title: "更新失败" });
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const totalMinutes = todayPlan?.tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) || 0;

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">学习计划</h2>
        <Badge variant="outline" className="gap-1">
          <Target className="h-3 w-3" />
          智能推荐
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="evaluation">学习效果</TabsTrigger>
          <TabsTrigger value="plan">今日计划</TabsTrigger>
          <TabsTrigger value="recommend">智能推荐</TabsTrigger>
        </TabsList>

        {/* ===== Evaluation Tab ===== */}
        <TabsContent value="evaluation" className="space-y-4">
          {evalLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : evaluation ? (
            <>
              {/* Overall Score */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">综合学习效果评分</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-5xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                          {evaluation.overallScore}
                        </span>
                        <span className="text-muted-foreground">/ 100</span>
                        {getTrendIcon(evaluation.trend)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">较上周</p>
                      <p className="text-lg font-medium">
                        {evaluation.trend === "up" ? "上升" : evaluation.trend === "down" ? "下降" : "持平"}
                      </p>
                    </div>
                  </div>
                  <Progress value={evaluation.overallScore} className="mt-4 h-2" />
                </CardContent>
              </Card>

              {/* Dimensions */}
              <div className="grid gap-4 md:grid-cols-3">
                <DimensionCard
                  icon={<BookOpen className="h-5 w-5" />}
                  title="词汇健康度"
                  score={evaluation.dimensions.vocabulary.score}
                  label={evaluation.dimensions.vocabulary.label}
                  details={evaluation.dimensions.vocabulary.details}
                  weight={40}
                />
                <DimensionCard
                  icon={<Dumbbell className="h-5 w-5" />}
                  title="练习表现"
                  score={evaluation.dimensions.practice.score}
                  label={evaluation.dimensions.practice.label}
                  details={evaluation.dimensions.practice.details}
                  weight={35}
                />
                <DimensionCard
                  icon={<Flame className="h-5 w-5" />}
                  title="学习活跃度"
                  score={evaluation.dimensions.activity.score}
                  label={evaluation.dimensions.activity.label}
                  details={evaluation.dimensions.activity.details}
                  weight={25}
                />
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      优势
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.strengths.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      待加强
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.weakPoints.map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Circle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                暂无评价数据，请先完成一些学习活动
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Plan Tab ===== */}
        <TabsContent value="plan" className="space-y-4">
          {planLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : todayPlan ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{todayPlan.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        预计总时长 {totalMinutes} 分钟 · {todayPlan.tasks.length} 个任务
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleGeneratePlan}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        重新生成
                      </Button>
                      {todayPlan.status !== "completed" && (
                        <Button size="sm" onClick={() => handleUpdateStatus("completed")}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          全部完成
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {todayPlan.tasks.map((task, idx) => (
                  <Card key={task.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {task.type === "review_words" && <BookOpen className="h-5 w-5 text-blue-500" />}
                            {task.type === "practice" && <Dumbbell className="h-5 w-5 text-purple-500" />}
                            {task.type === "read_article" && <Lightbulb className="h-5 w-5 text-green-500" />}
                            {task.type === "story" && <Zap className="h-5 w-5 text-yellow-500" />}
                            {task.type === "speaking" && <Flame className="h-5 w-5 text-orange-500" />}
                            {task.type === "capture_words" && <BrainCircuit className="h-5 w-5 text-cyan-500" />}
                          </div>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Clock className="h-3 w-3" />
                                {task.estimatedMinutes} 分钟
                              </Badge>
                              {task.targetCount && (
                                <Badge variant="outline" className="text-xs">
                                  目标 {task.targetCount} 个
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {task.type === "practice" && onStartPractice && (
                            <Button
                              size="sm"
                              onClick={() =>
                                onStartPractice(task.wordIds, task.questionTypes)
                              }
                            >
                              开始
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                          {task.type === "capture_words" && onNavigate && (
                            <Button size="sm" variant="outline" onClick={() => onNavigate("capture")}>
                              去采集
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                          {task.type === "read_article" && onNavigate && (
                            <Button size="sm" variant="outline" onClick={() => onNavigate("article")}>
                              去阅读
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <p className="text-muted-foreground">今日计划尚未生成</p>
                <Button onClick={handleGeneratePlan}>
                  <Calendar className="h-4 w-4 mr-1" />
                  生成今日计划
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Recommend Tab ===== */}
        <TabsContent value="recommend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                练习题型建议
              </CardTitle>
              <CardDescription>基于你近期的答题表现，优先练习薄弱题型</CardDescription>
            </CardHeader>
            <CardContent>
              {todayPlan?.tasks.find((t) => t.type === "practice")?.questionTypes ? (
                <div className="flex flex-wrap gap-2">
                  {todayPlan.tasks
                    .find((t) => t.type === "practice")!
                    .questionTypes!.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t === "mcq" && "选择题"}
                        {t === "fill_blank" && "填空题"}
                        {t === "reorder" && "句子重组"}
                        {t === "unknown" && t}
                      </Badge>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无数据，请先完成一些练习</p>
              )}
            </CardContent>
          </Card>

          {todayPlan?.tasks.find((t) => t.type === "review_words") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  建议复习的单词
                </CardTitle>
                <CardDescription>优先掌握薄弱词汇和遗忘风险词</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {todayPlan.tasks.find((t) => t.type === "review_words")?.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {todayPlan.tasks
                    .find((t) => t.type === "review_words")!
                    .wordIds?.map((wid, i) => (
                      <Badge key={wid} variant="outline">
                        单词 {i + 1}
                      </Badge>
                    )) ?? (
                    <span className="text-sm text-muted-foreground">暂无推荐</span>
                  )}
                </div>
                {onStartPractice && (
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() =>
                      onStartPractice(
                        todayPlan.tasks.find((t) => t.type === "review_words")?.wordIds,
                        undefined
                      )
                    }
                  >
                    用这些单词生成练习
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DimensionCard({
  icon,
  title,
  score,
  label,
  details,
  weight,
}: {
  icon: React.ReactNode;
  title: string;
  score: number;
  label: string;
  details: Record<string, number | string>;
  weight: number;
}) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    return "text-red-500";
  };
  const getBar = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm">{title}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            权重 {weight}%
          </Badge>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className={`text-3xl font-bold ${getColor(score)}`}>{score}</span>
          <Badge variant="secondary" className="mb-1">
            {label}
          </Badge>
        </div>
        <Progress value={score} className={`mt-2 h-1.5 ${getBar(score)}`} />
        <Separator className="my-3" />
        <div className="space-y-1">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{detailLabel(key)}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function detailLabel(key: string): string {
  const map: Record<string, string> = {
    totalWords: "总词量",
    masteredWords: "已掌握",
    masteryRate: "掌握率",
    weakWords: "薄弱词",
    atRiskWords: "遗忘风险",
    recentNewWords: "近7天新词",
    overallCorrectRate: "整体正确率",
    weeklyPracticeCount: "本周练习次数",
    totalRecentAnswers: "近7天答题数",
    mcq: "选择题正确率",
    fill_blank: "填空题正确率",
    reorder: "重组题正确率",
    streakDays: "连击天数",
    weeklyActiveDays: "本周活跃天数",
    weeklyXp: "本周 XP",
    weeklyWords: "本周新词",
    xpAchievementRate: "XP 达成率",
    wordsAchievementRate: "新词达成率",
  };
  return map[key] || key;
}
