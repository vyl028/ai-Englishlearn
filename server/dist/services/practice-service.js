"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeService = void 0;
const database_1 = __importDefault(require("../config/database"));
class PracticeService {
    // ========== Practice Record CRUD ==========
    static async createPractice(userId, input) {
        const record = await database_1.default.practiceRecord.create({
            data: {
                userId,
                questionsJson: input.questionsJson,
                wordIds: JSON.stringify(input.wordIds),
                questionCount: input.questionCount,
            },
        });
        return record;
    }
    static async listPractices(userId, limit = 50, offset = 0) {
        const records = await database_1.default.practiceRecord.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                _count: {
                    select: { answers: true },
                },
            },
        });
        return records.map((r) => ({
            id: r.id,
            questionCount: r.questionCount,
            correctCount: r.correctCount,
            totalCount: r.totalCount,
            isSubmitted: r.isSubmitted,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            answerCount: r._count.answers,
        }));
    }
    static async getPracticeById(userId, id) {
        const record = await database_1.default.practiceRecord.findFirst({
            where: { id, userId },
            include: { answers: true },
        });
        if (!record)
            return null;
        return {
            id: record.id,
            questionsJson: record.questionsJson,
            wordIds: JSON.parse(record.wordIds || '[]'),
            questionCount: record.questionCount,
            correctCount: record.correctCount,
            totalCount: record.totalCount,
            isSubmitted: record.isSubmitted,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
            answers: record.answers.map((a) => ({
                id: a.id,
                questionIndex: a.questionIndex,
                questionType: a.questionType,
                word: a.word,
                promptEn: a.promptEn,
                userAnswer: a.userAnswer,
                correctAnswer: a.correctAnswer,
                isCorrect: a.isCorrect,
            })),
        };
    }
    static async submitPractice(userId, id, answers, correctCount, totalCount) {
        const record = await database_1.default.practiceRecord.findFirst({
            where: { id, userId },
        });
        if (!record) {
            throw new Error('Practice record not found');
        }
        if (record.isSubmitted) {
            throw new Error('Practice already submitted');
        }
        await database_1.default.$transaction(async (tx) => {
            // Create answers
            for (const ans of answers) {
                await tx.practiceAnswer.create({
                    data: {
                        practiceRecordId: id,
                        questionIndex: ans.questionIndex,
                        questionType: ans.questionType,
                        word: ans.word,
                        promptEn: ans.promptEn,
                        userAnswer: ans.userAnswer,
                        correctAnswer: ans.correctAnswer,
                        isCorrect: ans.isCorrect,
                    },
                });
            }
            // Update record
            await tx.practiceRecord.update({
                where: { id },
                data: {
                    correctCount,
                    totalCount,
                    isSubmitted: true,
                },
            });
        });
        return this.getPracticeById(userId, id);
    }
    static async deletePractice(userId, id) {
        const record = await database_1.default.practiceRecord.findFirst({
            where: { id, userId },
        });
        if (!record) {
            throw new Error('Practice record not found');
        }
        await database_1.default.practiceRecord.delete({
            where: { id },
        });
        return { deleted: true };
    }
}
exports.PracticeService = PracticeService;
//# sourceMappingURL=practice-service.js.map