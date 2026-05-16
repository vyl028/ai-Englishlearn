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
export declare class LearningPlanService {
    static generateEvaluation(userId: string): Promise<EvaluationReport>;
    static generateRecommendations(userId: string): Promise<{
        recommendedWords: RecommendedWord[];
        recommendedTypes: string[];
        goalSuggestion: string | null;
    }>;
    static generateDailyPlan(userId: string): Promise<LearningPlanOutput>;
    static getTodayPlan(userId: string): Promise<LearningPlanOutput | null>;
    static getOrCreateTodayPlan(userId: string): Promise<LearningPlanOutput>;
    static updatePlanStatus(userId: string, planId: string, status: string): Promise<{
        id: string;
        dateKey: string;
        planType: string;
        status: string;
        evaluationSnapshot: any;
        title: string;
        tasks: any;
    }>;
    static listPlanHistory(userId: string, limit?: number): Promise<{
        id: string;
        dateKey: string;
        planType: string;
        status: string;
        title: string;
        createdAt: string;
    }[]>;
}
//# sourceMappingURL=learning-plan-service.d.ts.map