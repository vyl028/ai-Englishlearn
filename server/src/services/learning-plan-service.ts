import prisma from '../config/database';
import { UserStatsService } from './user-stats-service';

// ========== Types ==========

export type EvaluationDimension = {
  score: number;
  label: string;
  details: Record<string, number | string>;
};

export type EvaluationReport = {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  dimensions: {
    vocabulary: EvaluationDimension;
    practice: EvaluationDimension;
    activity: EvaluationDimension;
  };
  weakPoints: string[];
  strengths: string[];
};

export type RecommendedWord = {
  wordId: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  masteryScore: number;
  reason: 'weak' | 'at_risk' | 'consecutive_wrong';
};

export type PlanTask = {
  id: string;
  type: 'review_words' | 'practice' | 'read_article' | 'story' | 'speaking' | 'capture_words';
  title: string;
  description: string;
  targetCount?: number;
  wordIds?: string[];
  questionTypes?: string[];
  estimatedMinutes: number;
};

export type LearningPlanOutput = {
  id: string;
  dateKey: string;
  planType: 'daily' | 'weekly';
  status: string;
  evaluationSnapshot: {
    overallScore: number;
    vocabularyScore: number;
    practiceScore: number;
    activityScore: number;
  };
  title: string;
  tasks: PlanTask[];
};

// ========== Constants ==========

const VOCABULARY_WEIGHT = 0.40;
const PRACTICE_WEIGHT = 0.35;
const ACTIVITY_WEIGHT = 0.25;

const MASTERY_WEAK_THRESHOLD = 50;
const MASTERY_AT_RISK_THRESHOLD = 80;
const AT_RISK_DAYS = 7;

// ========== Helpers ==========

function formatDateKey(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ========== Service ==========

export class LearningPlanService {
  // ===== Evaluation =====

  static async generateEvaluation(userId: string): Promise<EvaluationReport> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // --- Vocabulary dimension ---
    const allMastery = await prisma.wordMasteryStats.findMany({
      where: { userId },
      include: {
        word: {
          select: { word: true, partOfSpeech: true, definition: true, isMastered: true },
        },
      },
    });

    const totalWords = allMastery.length;
    const masteredWords = allMastery.filter((m) => m.isAutoMastered || m.word.isMastered).length;
    const weakWords = allMastery.filter((m) => m.masteryScore < MASTERY_WEAK_THRESHOLD);
    const atRiskWords = allMastery.filter((m) => {
      if (m.masteryScore >= MASTERY_AT_RISK_THRESHOLD) return false;
      if (!m.lastAnsweredAt) return true;
      const daysSince = Math.floor((now.getTime() - m.lastAnsweredAt.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince > AT_RISK_DAYS;
    });

    // Recent new words (words captured in last 7 days without mastery stats or with very few appearances)
    const recentWords = await prisma.word.findMany({
      where: {
        userId,
        capturedAt: { gte: sevenDaysAgo },
      },
    });

    const masteryRate = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
    const vocabularyScore = Math.min(100, Math.round(
      masteryRate * 0.6 +
      Math.max(0, 100 - weakWords.length * 5) * 0.25 +
      Math.max(0, 100 - atRiskWords.length * 5) * 0.15
    ));

    // --- Practice dimension ---
    const recentAnswers = await prisma.practiceAnswer.findMany({
      where: {
        practiceRecord: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
      },
    });

    const totalRecentAnswers = recentAnswers.length;
    const correctRecentAnswers = recentAnswers.filter((a) => a.isCorrect).length;
    const overallCorrectRate = totalRecentAnswers > 0
      ? Math.round((correctRecentAnswers / totalRecentAnswers) * 100)
      : 0;

    // By question type
    const byType: Record<string, { total: number; correct: number }> = {};
    for (const a of recentAnswers) {
      const t = a.questionType || 'unknown';
      if (!byType[t]) byType[t] = { total: 0, correct: 0 };
      byType[t].total++;
      if (a.isCorrect) byType[t].correct++;
    }
    const byTypeRate: Record<string, number> = {};
    for (const [t, { total, correct }] of Object.entries(byType)) {
      byTypeRate[t] = total > 0 ? Math.round((correct / total) * 100) : 0;
    }

    // Practice frequency: count unique practice records in last 7 days
    const recentPracticeRecords = await prisma.practiceRecord.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
    });
    const weeklyPracticeCount = recentPracticeRecords.length;

    // Practice score
    let practiceScore = 0;
    if (totalRecentAnswers === 0) {
      // No practice data: base score from frequency (encourage practice)
      practiceScore = Math.min(60, weeklyPracticeCount * 15);
    } else {
      const correctRateScore = overallCorrectRate;
      const typeBalance = Object.keys(byTypeRate).length >= 3 ? 100 : Object.keys(byTypeRate).length * 33;
      const frequencyScore = Math.min(100, weeklyPracticeCount * 20);
      practiceScore = Math.round(correctRateScore * 0.5 + typeBalance * 0.2 + frequencyScore * 0.3);
    }

    // --- Activity dimension ---
    const stats = await UserStatsService.getLearningStats(userId);
    const goals = await UserStatsService.getGrowthGoals(userId);

    const streakDays = stats.streak.current;

    // Weekly active days (from daily stats)
    const weekStart = getWeekStart(now);
    let weeklyActiveDays = 0;
    let weeklyXp = 0;
    let weeklyWords = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = formatDateKey(d);
      if (stats.daily[key]) {
        weeklyActiveDays++;
        weeklyXp += stats.daily[key].xpEarned || 0;
        weeklyWords += stats.daily[key].wordsAdded || 0;
      }
    }

    const xpAchievementRate = goals.weeklyXpGoal > 0
      ? Math.round((weeklyXp / goals.weeklyXpGoal) * 100)
      : 0;
    const wordsAchievementRate = goals.weeklyWordsGoal > 0
      ? Math.round((weeklyWords / goals.weeklyWordsGoal) * 100)
      : 0;
    const avgAchievementRate = Math.round((xpAchievementRate + wordsAchievementRate) / 2);

    const activityScore = Math.round(
      Math.min(100, streakDays * 10) * 0.3 +
      Math.min(100, weeklyActiveDays * 15) * 0.3 +
      Math.min(100, avgAchievementRate) * 0.4
    );

    // --- Overall ---
    const overallScore = Math.round(
      vocabularyScore * VOCABULARY_WEIGHT +
      practiceScore * PRACTICE_WEIGHT +
      activityScore * ACTIVITY_WEIGHT
    );

    // --- Trend (compare with last week's overall if available) ---
    const lastWeekPlan = await prisma.learningPlan.findFirst({
      where: { userId, planType: 'daily' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (lastWeekPlan) {
      try {
        const snap = JSON.parse(lastWeekPlan.evaluationSnapshot);
        const prev = snap.overallScore || 0;
        if (overallScore > prev + 5) trend = 'up';
        else if (overallScore < prev - 5) trend = 'down';
      } catch { /* ignore */ }
    }

    // --- Weak points & strengths ---
    const weakPoints: string[] = [];
    const strengths: string[] = [];

    if (weakWords.length >= 5) weakPoints.push(`薄弱词汇较多（${weakWords.length}个），建议加强复习`);
    if (atRiskWords.length >= 5) weakPoints.push(`遗忘风险词汇${atRiskWords.length}个，需要及时巩固`);
    if (overallCorrectRate < 60 && totalRecentAnswers > 0) weakPoints.push('练习题正确率偏低，建议回顾错题');
    if (weeklyPracticeCount < 2) weakPoints.push('本周练习次数较少，建议保持每日练习');
    if (avgAchievementRate < 50) weakPoints.push('本周目标达成率不足50%，可适当调整目标');

    if (masteryRate >= 70) strengths.push(`词汇掌握率达到${masteryRate}%`);
    if (overallCorrectRate >= 80) strengths.push('练习题正确率优秀');
    if (streakDays >= 7) strengths.push(`已连续学习${streakDays}天，保持得非常好`);
    if (avgAchievementRate >= 100) strengths.push('本周目标已达成');

    return {
      overallScore,
      trend,
      dimensions: {
        vocabulary: {
          score: vocabularyScore,
          label: vocabularyScore >= 80 ? '优秀' : vocabularyScore >= 60 ? '良好' : '需加强',
          details: {
            totalWords,
            masteredWords,
            masteryRate,
            weakWords: weakWords.length,
            atRiskWords: atRiskWords.length,
            recentNewWords: recentWords.length,
          },
        },
        practice: {
          score: practiceScore,
          label: practiceScore >= 80 ? '优秀' : practiceScore >= 60 ? '良好' : '需加强',
          details: {
            overallCorrectRate,
            weeklyPracticeCount,
            totalRecentAnswers,
            ...byTypeRate,
          },
        },
        activity: {
          score: activityScore,
          label: activityScore >= 80 ? '活跃' : activityScore >= 60 ? '一般' : '偏低',
          details: {
            streakDays,
            weeklyActiveDays,
            weeklyXp,
            weeklyWords,
            xpAchievementRate,
            wordsAchievementRate,
          },
        },
      },
      weakPoints: weakPoints.length > 0 ? weakPoints : ['暂无明显的薄弱点，继续保持'],
      strengths: strengths.length > 0 ? strengths : ['学习之路刚刚开始，加油'],
    };
  }

  // ===== Recommendations =====

  static async generateRecommendations(userId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // --- Recommended words to review ---
    const allMastery = await prisma.wordMasteryStats.findMany({
      where: { userId },
      include: {
        word: {
          select: { word: true, partOfSpeech: true, definition: true },
        },
      },
    });

    const recommendedWords: RecommendedWord[] = [];

    for (const m of allMastery) {
      let reason: RecommendedWord['reason'] | null = null;
      if (m.masteryScore < MASTERY_WEAK_THRESHOLD) {
        reason = 'weak';
      } else if (m.masteryScore < MASTERY_AT_RISK_THRESHOLD) {
        const daysSince = m.lastAnsweredAt
          ? Math.floor((now.getTime() - m.lastAnsweredAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        if (daysSince > AT_RISK_DAYS) reason = 'at_risk';
      }
      if (m.consecutiveCorrect === 0 && m.totalAppeared >= 2) {
        reason = 'consecutive_wrong';
      }

      if (reason) {
        recommendedWords.push({
          wordId: m.wordId,
          word: m.word.word,
          partOfSpeech: m.word.partOfSpeech,
          definition: m.word.definition,
          masteryScore: m.masteryScore,
          reason,
        });
      }
    }

    // Sort: weak > consecutive_wrong > at_risk, then by masteryScore asc
    const reasonOrder = { weak: 0, consecutive_wrong: 1, at_risk: 2 };
    recommendedWords.sort((a, b) => {
      const ra = reasonOrder[a.reason];
      const rb = reasonOrder[b.reason];
      if (ra !== rb) return ra - rb;
      return a.masteryScore - b.masteryScore;
    });

    // --- Recommended question types ---
    const recentAnswers = await prisma.practiceAnswer.findMany({
      where: {
        practiceRecord: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
      },
    });

    const typeStats: Record<string, { total: number; correct: number }> = {};
    for (const a of recentAnswers) {
      const t = a.questionType || 'unknown';
      if (!typeStats[t]) typeStats[t] = { total: 0, correct: 0 };
      typeStats[t].total++;
      if (a.isCorrect) typeStats[t].correct++;
    }

    const typeRates = Object.entries(typeStats).map(([type, { total, correct }]) => ({
      type,
      rate: total > 0 ? Math.round((correct / total) * 100) : 0,
      total,
    }));
    typeRates.sort((a, b) => a.rate - b.rate);

    const weakType = typeRates.length > 0 ? typeRates[0].type : 'mcq';
    const recommendedTypes = [weakType];
    // Add a balanced type if we have data
    if (typeRates.length >= 2 && typeRates[1].rate < 90) {
      recommendedTypes.push(typeRates[1].type);
    }
    // Always include a well-performed type for confidence building
    const strongType = typeRates.find((t) => t.rate >= 70 && !recommendedTypes.includes(t.type));
    if (strongType) recommendedTypes.push(strongType.type);
    if (recommendedTypes.length < 2) {
      const allTypes = ['mcq', 'fill_blank', 'reorder'];
      for (const t of allTypes) {
        if (!recommendedTypes.includes(t)) recommendedTypes.push(t);
      }
    }

    // --- Goal adjustment suggestion ---
    const stats = await UserStatsService.getLearningStats(userId);
    const goals = await UserStatsService.getGrowthGoals(userId);
    const weekStart = getWeekStart(now);
    let weeklyXp = 0;
    let weeklyWords = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = formatDateKey(d);
      if (stats.daily[key]) {
        weeklyXp += stats.daily[key].xpEarned || 0;
        weeklyWords += stats.daily[key].wordsAdded || 0;
      }
    }

    const xpRate = goals.weeklyXpGoal > 0 ? weeklyXp / goals.weeklyXpGoal : 0;
    const wordsRate = goals.weeklyWordsGoal > 0 ? weeklyWords / goals.weeklyWordsGoal : 0;
    const avgRate = (xpRate + wordsRate) / 2;

    let goalSuggestion: string | null = null;
    if (avgRate > 1.2) {
      goalSuggestion = `你已连续超额完成目标，建议将周 XP 目标提升至 ${Math.round(goals.weeklyXpGoal * 1.2)}，周新词目标提升至 ${Math.round(goals.weeklyWordsGoal * 1.2)}`;
    } else if (avgRate < 0.4) {
      goalSuggestion = `本周目标达成率偏低，建议将周 XP 目标降低至 ${Math.round(goals.weeklyXpGoal * 0.7)}，周新词目标降低至 ${Math.round(goals.weeklyWordsGoal * 0.7)}`;
    }

    return {
      recommendedWords: recommendedWords.slice(0, 20),
      recommendedTypes: recommendedTypes.slice(0, 3),
      goalSuggestion,
    };
  }

  // ===== Daily Plan Generation =====

  static async generateDailyPlan(userId: string): Promise<LearningPlanOutput> {
    const now = new Date();
    const dateKey = formatDateKey(now);

    const evaluation = await this.generateEvaluation(userId);
    const recommendations = await this.generateRecommendations(userId);

    const tasks: PlanTask[] = [];
    let estimatedMinutes = 0;

    // Task 1: Review words (if any recommended)
    if (recommendations.recommendedWords.length > 0) {
      const reviewCount = Math.min(15, recommendations.recommendedWords.length);
      const selectedWords = recommendations.recommendedWords.slice(0, reviewCount);
      tasks.push({
        id: generateTaskId(),
        type: 'review_words',
        title: `复习 ${reviewCount} 个重点词汇`,
        description: selectedWords.map((w) => `${w.word} (${w.masteryScore}分)`).join('、'),
        targetCount: reviewCount,
        wordIds: selectedWords.map((w) => w.wordId),
        estimatedMinutes: Math.max(5, reviewCount * 1),
      });
      estimatedMinutes += Math.max(5, reviewCount * 1);
    }

    // Task 2: Practice with recommended types
    const practiceCount = 10;
    tasks.push({
      id: generateTaskId(),
      type: 'practice',
      title: `完成 ${practiceCount} 道练习题`,
      description: `重点题型：${recommendations.recommendedTypes.map(t => typeLabel(t)).join('、')}`,
      targetCount: practiceCount,
      questionTypes: recommendations.recommendedTypes,
      estimatedMinutes: 10,
    });
    estimatedMinutes += 10;

    // Task 3: Capture new words (if vocabulary is small or weekly goal not met)
    const stats = await UserStatsService.getLearningStats(userId);
    const goals = await UserStatsService.getGrowthGoals(userId);
    const weekStart = getWeekStart(now);
    let weeklyWords = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = formatDateKey(d);
      if (stats.daily[key]) weeklyWords += stats.daily[key].wordsAdded || 0;
    }

    if ((evaluation.dimensions.vocabulary.details.totalWords as number) < 20 || weeklyWords < goals.weeklyWordsGoal * 0.5) {
      tasks.push({
        id: generateTaskId(),
        type: 'capture_words',
        title: '采集新单词',
        description: '通过拍照或手动输入添加 5-10 个新单词',
        targetCount: 5,
        estimatedMinutes: 5,
      });
      estimatedMinutes += 5;
    }

    // Task 4: Reading or Story (if practice is strong)
    if (evaluation.dimensions.practice.score >= 70) {
      tasks.push({
        id: generateTaskId(),
        type: 'read_article',
        title: '阅读一篇英文文章',
        description: '选择感兴趣的短文进行深度阅读分析',
        estimatedMinutes: 10,
      });
      estimatedMinutes += 10;
    }

    const title = estimatedMinutes <= 15
      ? '今日轻量计划'
      : estimatedMinutes <= 30
        ? '今日标准计划'
        : '今日挑战计划';

    // Persist
    const plan = await prisma.learningPlan.upsert({
      where: {
        userId_dateKey_planType: {
          userId,
          dateKey,
          planType: 'daily',
        },
      },
      create: {
        userId,
        dateKey,
        planType: 'daily',
        status: 'pending',
        evaluationSnapshot: JSON.stringify({
          overallScore: evaluation.overallScore,
          vocabularyScore: evaluation.dimensions.vocabulary.score,
          practiceScore: evaluation.dimensions.practice.score,
          activityScore: evaluation.dimensions.activity.score,
        }),
        title,
        tasks: JSON.stringify(tasks),
      },
      update: {
        evaluationSnapshot: JSON.stringify({
          overallScore: evaluation.overallScore,
          vocabularyScore: evaluation.dimensions.vocabulary.score,
          practiceScore: evaluation.dimensions.practice.score,
          activityScore: evaluation.dimensions.activity.score,
        }),
        title,
        tasks: JSON.stringify(tasks),
      },
    });

    return {
      id: plan.id,
      dateKey: plan.dateKey,
      planType: plan.planType as 'daily' | 'weekly',
      status: plan.status,
      evaluationSnapshot: JSON.parse(plan.evaluationSnapshot),
      title: plan.title,
      tasks: JSON.parse(plan.tasks),
    };
  }

  // ===== CRUD =====

  static async getTodayPlan(userId: string): Promise<LearningPlanOutput | null> {
    const dateKey = formatDateKey(new Date());
    const plan = await prisma.learningPlan.findUnique({
      where: {
        userId_dateKey_planType: {
          userId,
          dateKey,
          planType: 'daily',
        },
      },
    });

    if (!plan) return null;

    return {
      id: plan.id,
      dateKey: plan.dateKey,
      planType: plan.planType as 'daily' | 'weekly',
      status: plan.status,
      evaluationSnapshot: JSON.parse(plan.evaluationSnapshot),
      title: plan.title,
      tasks: JSON.parse(plan.tasks),
    };
  }

  static async getOrCreateTodayPlan(userId: string): Promise<LearningPlanOutput> {
    const existing = await this.getTodayPlan(userId);
    if (existing) return existing;
    return this.generateDailyPlan(userId);
  }

  static async updatePlanStatus(userId: string, planId: string, status: string) {
    const plan = await prisma.learningPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) throw new Error('PLAN_NOT_FOUND');

    const updated = await prisma.learningPlan.update({
      where: { id: planId },
      data: { status },
    });

    return {
      id: updated.id,
      dateKey: updated.dateKey,
      planType: updated.planType,
      status: updated.status,
      evaluationSnapshot: JSON.parse(updated.evaluationSnapshot),
      title: updated.title,
      tasks: JSON.parse(updated.tasks),
    };
  }

  static async listPlanHistory(userId: string, limit = 30) {
    const plans = await prisma.learningPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return plans.map((p) => ({
      id: p.id,
      dateKey: p.dateKey,
      planType: p.planType,
      status: p.status,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    mcq: '选择题',
    fill_blank: '填空题',
    reorder: '句子重组',
  };
  return map[type] || type;
}
