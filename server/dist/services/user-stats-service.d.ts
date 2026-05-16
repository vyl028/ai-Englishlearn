export type GamificationDayStats = {
    xpEarned: number;
    wordsAdded: number;
    practiceCompleted: number;
    storiesGenerated: number;
};
export type GamificationState = {
    version: 1;
    xp: number;
    unlockedBadges: string[];
    streak: {
        current: number;
        longest: number;
        lastActiveDate?: string;
    };
    totals: {
        wordsAdded: number;
        practiceCompleted: number;
        storiesGenerated: number;
        masteredMarked: number;
    };
    daily: Record<string, GamificationDayStats>;
};
export type LearningEventInput = {
    type: 'words_added';
    count: number;
    at?: Date;
} | {
    type: 'practice_completed';
    correctCount: number;
    totalCount: number;
    at?: Date;
} | {
    type: 'story_generated';
    wordCount?: number;
    at?: Date;
} | {
    type: 'mastery_marked';
    termKey?: string;
    at?: Date;
};
export declare class UserStatsService {
    static getLearningStats(userId: string): Promise<GamificationState>;
    static updateLearningStats(userId: string, state: GamificationState): Promise<void>;
    static recordLearningEvent(userId: string, event: LearningEventInput): Promise<GamificationState>;
    private static addXp;
    private static addDayStat;
    private static pruneDaily;
    static getGrowthGoals(userId: string): Promise<{
        weeklyXpGoal: number;
        weeklyWordsGoal: number;
    }>;
    static updateGrowthGoals(userId: string, goals: {
        weeklyXpGoal: number;
        weeklyWordsGoal: number;
    }): Promise<void>;
    static getReadingStats(userId: string, articleKey: string): Promise<{
        attempts: number;
        best: number;
        last: number;
        total: number;
        bestAt: number | undefined;
        lastAt: number | undefined;
    } | null>;
    static updateReadingStats(userId: string, articleKey: string, score: number, total: number): Promise<void>;
    static getSpeakingStats(userId: string, dateKey: string): Promise<{
        attempts: number;
        scoreSum: number;
        best: number;
        last: number;
        lastAt: number | undefined;
    } | null>;
    static getAllSpeakingStats(userId: string): Promise<{
        days: Record<string, {
            attempts: number;
            scoreSum: number;
            best: number;
            last: number;
            lastAt?: number;
        }>;
    }>;
    static recordSpeakingAttempt(userId: string, dateKey: string, score: number, at?: Date): Promise<void>;
    static getLearningEvents(userId: string, limit?: number): Promise<{
        id: string;
        type: string;
        count: number | null;
        correctCount: number | null;
        totalCount: number | null;
        wordCount: number | null;
        at: number;
    }[]>;
    static addLearningEvent(userId: string, event: LearningEventInput): Promise<void>;
    static clearLearningEvents(userId: string): Promise<void>;
    static resetAllStats(userId: string): Promise<void>;
}
//# sourceMappingURL=user-stats-service.d.ts.map