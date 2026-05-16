export interface WordMasteryInput {
    wordId: string;
    isCorrect: boolean;
}
export declare class WordMasteryService {
    static recordAnswer(userId: string, input: WordMasteryInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        wordId: string;
        totalAppeared: number;
        totalCorrect: number;
        consecutiveCorrect: number;
        lastAnsweredAt: Date | null;
        masteryScore: number;
        isAutoMastered: boolean;
    } | null>;
    static recalculateMastery(userId: string, wordId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        wordId: string;
        totalAppeared: number;
        totalCorrect: number;
        consecutiveCorrect: number;
        lastAnsweredAt: Date | null;
        masteryScore: number;
        isAutoMastered: boolean;
    } | null>;
    static recalculateAll(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        wordId: string;
        totalAppeared: number;
        totalCorrect: number;
        consecutiveCorrect: number;
        lastAnsweredAt: Date | null;
        masteryScore: number;
        isAutoMastered: boolean;
    }[]>;
    static getMasteryStats(userId: string, wordId: string): Promise<{
        wordId: string;
        totalAppeared: number;
        totalCorrect: number;
        consecutiveCorrect: number;
        lastAnsweredAt: string | null;
        masteryScore: number;
        isAutoMastered: boolean;
    } | null>;
    static listMasteryStats(userId: string, options?: {
        minScore?: number;
        maxScore?: number;
        onlyAutoMastered?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        wordId: string;
        word: string;
        partOfSpeech: string;
        definition: string;
        isMastered: boolean;
        totalAppeared: number;
        totalCorrect: number;
        consecutiveCorrect: number;
        lastAnsweredAt: string | null;
        masteryScore: number;
        isAutoMastered: boolean;
    }[]>;
    static resetStats(userId: string, wordId?: string): Promise<{
        reset: boolean;
    }>;
}
//# sourceMappingURL=word-mastery-service.d.ts.map