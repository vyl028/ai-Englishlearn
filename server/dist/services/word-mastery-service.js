"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordMasteryService = void 0;
const database_1 = __importDefault(require("../config/database"));
// Mastery algorithm constants
const MASTERY_THRESHOLD = 80; // score >= 80 to be considered mastered
const MIN_APPEARANCES = 3; // at least 3 appearances to be considered
const CONSECUTIVE_CORRECT_THRESHOLD = 3; // 3 consecutive correct answers
const CORRECT_RATE_WEIGHT = 0.5;
const CONSECUTIVE_WEIGHT = 0.3;
const RECENCY_WEIGHT = 0.2;
class WordMasteryService {
    // ========== Record Practice Answer ==========
    static async recordAnswer(userId, input) {
        const now = new Date();
        const stats = await database_1.default.wordMasteryStats.upsert({
            where: {
                userId_wordId: {
                    userId,
                    wordId: input.wordId,
                },
            },
            create: {
                userId,
                wordId: input.wordId,
                totalAppeared: 1,
                totalCorrect: input.isCorrect ? 1 : 0,
                consecutiveCorrect: input.isCorrect ? 1 : 0,
                lastAnsweredAt: now,
                masteryScore: input.isCorrect ? 33 : 0,
                isAutoMastered: false,
            },
            update: {
                totalAppeared: { increment: 1 },
                totalCorrect: input.isCorrect ? { increment: 1 } : undefined,
                consecutiveCorrect: input.isCorrect
                    ? { increment: 1 }
                    : 0,
                lastAnsweredAt: now,
            },
        });
        // Recalculate mastery score
        const updated = await this.recalculateMastery(userId, input.wordId);
        return updated;
    }
    // ========== Recalculate Mastery Score ==========
    static async recalculateMastery(userId, wordId) {
        const stats = await database_1.default.wordMasteryStats.findUnique({
            where: {
                userId_wordId: {
                    userId,
                    wordId,
                },
            },
        });
        if (!stats)
            return null;
        // Calculate correct rate (0-100)
        const correctRate = stats.totalAppeared > 0
            ? Math.round((stats.totalCorrect / stats.totalAppeared) * 100)
            : 0;
        // Calculate consecutive correct score (0-100)
        const consecutiveScore = Math.min(stats.consecutiveCorrect * 33, 100);
        // Calculate recency score (0-100)
        let recencyScore = 0;
        if (stats.lastAnsweredAt) {
            const daysSinceLastAnswer = Math.floor((Date.now() - stats.lastAnsweredAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceLastAnswer <= 1)
                recencyScore = 100;
            else if (daysSinceLastAnswer <= 3)
                recencyScore = 80;
            else if (daysSinceLastAnswer <= 7)
                recencyScore = 60;
            else if (daysSinceLastAnswer <= 14)
                recencyScore = 40;
            else if (daysSinceLastAnswer <= 30)
                recencyScore = 20;
            else
                recencyScore = 0;
        }
        // Weighted mastery score
        const masteryScore = Math.round(correctRate * CORRECT_RATE_WEIGHT +
            consecutiveScore * CONSECUTIVE_WEIGHT +
            recencyScore * RECENCY_WEIGHT);
        // Auto-mastered logic:
        // 1. Mastery score >= threshold AND total appearances >= min appearances
        // 2. OR consecutive correct >= threshold AND total appearances >= 2
        const isAutoMastered = (masteryScore >= MASTERY_THRESHOLD && stats.totalAppeared >= MIN_APPEARANCES) ||
            (stats.consecutiveCorrect >= CONSECUTIVE_CORRECT_THRESHOLD && stats.totalAppeared >= 2);
        const updated = await database_1.default.wordMasteryStats.update({
            where: {
                userId_wordId: {
                    userId,
                    wordId,
                },
            },
            data: {
                masteryScore,
                isAutoMastered,
            },
        });
        // If auto-mastered, also update Word.isMastered
        if (isAutoMastered) {
            await database_1.default.word.updateMany({
                where: {
                    id: wordId,
                    userId,
                    isMastered: false,
                },
                data: {
                    isMastered: true,
                },
            });
        }
        return updated;
    }
    // ========== Batch Recalculate (for migration or periodic update) ==========
    static async recalculateAll(userId) {
        const statsList = await database_1.default.wordMasteryStats.findMany({
            where: { userId },
        });
        const results = [];
        for (const stats of statsList) {
            const updated = await this.recalculateMastery(userId, stats.wordId);
            if (updated)
                results.push(updated);
        }
        return results;
    }
    // ========== Get Mastery Stats ==========
    static async getMasteryStats(userId, wordId) {
        const stats = await database_1.default.wordMasteryStats.findUnique({
            where: {
                userId_wordId: {
                    userId,
                    wordId,
                },
            },
        });
        if (!stats)
            return null;
        return {
            wordId: stats.wordId,
            totalAppeared: stats.totalAppeared,
            totalCorrect: stats.totalCorrect,
            consecutiveCorrect: stats.consecutiveCorrect,
            lastAnsweredAt: stats.lastAnsweredAt?.toISOString() || null,
            masteryScore: stats.masteryScore,
            isAutoMastered: stats.isAutoMastered,
        };
    }
    static async listMasteryStats(userId, options) {
        const where = { userId };
        if (options?.onlyAutoMastered) {
            where.isAutoMastered = true;
        }
        if (options?.minScore !== undefined || options?.maxScore !== undefined) {
            where.masteryScore = {};
            if (options.minScore !== undefined)
                where.masteryScore.gte = options.minScore;
            if (options.maxScore !== undefined)
                where.masteryScore.lte = options.maxScore;
        }
        const statsList = await database_1.default.wordMasteryStats.findMany({
            where,
            orderBy: { masteryScore: 'desc' },
            take: options?.limit ?? 100,
            skip: options?.offset ?? 0,
            include: {
                word: {
                    select: {
                        word: true,
                        partOfSpeech: true,
                        definition: true,
                        isMastered: true,
                    },
                },
            },
        });
        return statsList.map((s) => ({
            wordId: s.wordId,
            word: s.word.word,
            partOfSpeech: s.word.partOfSpeech,
            definition: s.word.definition,
            isMastered: s.word.isMastered,
            totalAppeared: s.totalAppeared,
            totalCorrect: s.totalCorrect,
            consecutiveCorrect: s.consecutiveCorrect,
            lastAnsweredAt: s.lastAnsweredAt?.toISOString() || null,
            masteryScore: s.masteryScore,
            isAutoMastered: s.isAutoMastered,
        }));
    }
    // ========== Reset Stats ==========
    static async resetStats(userId, wordId) {
        if (wordId) {
            await database_1.default.wordMasteryStats.deleteMany({
                where: { userId, wordId },
            });
            // Reset Word.isMastered if it was auto-mastered
            await database_1.default.word.updateMany({
                where: { userId, id: wordId },
                data: { isMastered: false },
            });
        }
        else {
            // Get all auto-mastered word IDs first
            const autoMastered = await database_1.default.wordMasteryStats.findMany({
                where: { userId, isAutoMastered: true },
                select: { wordId: true },
            });
            const wordIds = autoMastered.map((s) => s.wordId);
            await database_1.default.wordMasteryStats.deleteMany({
                where: { userId },
            });
            if (wordIds.length > 0) {
                await database_1.default.word.updateMany({
                    where: { userId, id: { in: wordIds } },
                    data: { isMastered: false },
                });
            }
        }
        return { reset: true };
    }
}
exports.WordMasteryService = WordMasteryService;
//# sourceMappingURL=word-mastery-service.js.map