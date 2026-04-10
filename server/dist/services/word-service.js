"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordService = void 0;
const database_1 = __importDefault(require("../config/database"));
class WordService {
    // 创建单词
    static async create(userId, data) {
        const enrichmentStr = data.enrichment ? JSON.stringify(data.enrichment) : null;
        const word = await database_1.default.word.create({
            data: {
                word: data.word,
                partOfSpeech: data.partOfSpeech,
                definition: data.definition,
                enrichment: enrichmentStr,
                groupId: data.groupId || null,
                photoData: data.photoData || null,
                userId,
            },
        });
        // 更新学习统计
        await database_1.default.learningStats.update({
            where: { userId },
            data: {
                totalWords: { increment: 1 },
            },
        });
        return word;
    }
    // 批量创建
    static async createBatch(userId, items) {
        const results = await database_1.default.$transaction(async (tx) => {
            const created = [];
            const skipped = [];
            for (const data of items) {
                try {
                    const enrichmentStr = data.enrichment ? JSON.stringify(data.enrichment) : null;
                    const word = await tx.word.create({
                        data: {
                            word: data.word,
                            partOfSpeech: data.partOfSpeech,
                            definition: data.definition,
                            enrichment: enrichmentStr,
                            groupId: data.groupId || null,
                            photoData: data.photoData || null,
                            userId,
                        },
                    });
                    created.push(word);
                }
                catch (error) {
                    // 重复或其他错误
                    skipped.push({ word: data.word, partOfSpeech: data.partOfSpeech, error: '可能已存在' });
                }
            }
            // 更新统计
            if (created.length > 0) {
                await tx.learningStats.update({
                    where: { userId },
                    data: {
                        totalWords: { increment: created.length },
                    },
                });
            }
            return { created, skipped };
        });
        return results;
    }
    // 获取列表
    static async findMany(userId, filters) {
        const { search, groupId, isMastered, page = 1, limit = 50 } = filters;
        const where = { userId };
        if (search) {
            where.OR = [
                { word: { contains: search, mode: 'insensitive' } },
                { definition: { contains: search, mode: 'insensitive' } },
                { partOfSpeech: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (groupId !== undefined) {
            if (groupId === 'ungrouped') {
                where.groupId = null;
            }
            else if (groupId !== 'all') {
                where.groupId = groupId;
            }
        }
        if (isMastered !== undefined) {
            where.isMastered = isMastered;
        }
        const skip = (page - 1) * limit;
        const [words, total] = await Promise.all([
            database_1.default.word.findMany({
                where,
                include: { group: true },
                orderBy: { capturedAt: 'desc' },
                skip,
                take: limit,
            }),
            database_1.default.word.count({ where }),
        ]);
        // 解析 enrichment JSON
        const formattedWords = words.map(w => ({
            ...w,
            enrichment: w.enrichment ? JSON.parse(w.enrichment) : null,
        }));
        return {
            words: formattedWords,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    // 获取单个
    static async findById(userId, id) {
        const word = await database_1.default.word.findFirst({
            where: { id, userId },
            include: { group: true },
        });
        if (!word)
            return null;
        return {
            ...word,
            enrichment: word.enrichment ? JSON.parse(word.enrichment) : null,
        };
    }
    // 更新
    static async update(userId, id, data) {
        const updateData = {};
        if (data.word !== undefined)
            updateData.word = data.word;
        if (data.partOfSpeech !== undefined)
            updateData.partOfSpeech = data.partOfSpeech;
        if (data.definition !== undefined)
            updateData.definition = data.definition;
        if (data.enrichment !== undefined)
            updateData.enrichment = JSON.stringify(data.enrichment);
        if (data.groupId !== undefined)
            updateData.groupId = data.groupId || null;
        if (data.isMastered !== undefined) {
            updateData.isMastered = data.isMastered;
            // 更新掌握统计
            const delta = data.isMastered ? 1 : -1;
            await database_1.default.learningStats.update({
                where: { userId },
                data: {
                    masteredWords: { increment: delta },
                },
            });
        }
        const word = await database_1.default.word.update({
            where: { id, userId },
            data: updateData,
        });
        return {
            ...word,
            enrichment: word.enrichment ? JSON.parse(word.enrichment) : null,
        };
    }
    // 删除
    static async delete(userId, id) {
        const word = await database_1.default.word.delete({
            where: { id, userId },
        });
        // 更新统计
        await database_1.default.learningStats.update({
            where: { userId },
            data: {
                totalWords: { decrement: 1 },
                ...(word.isMastered && { masteredWords: { decrement: 1 } }),
            },
        });
        return word;
    }
    // 批量删除
    static async deleteBatch(userId, ids) {
        const result = await database_1.default.$transaction(async (tx) => {
            const words = await tx.word.findMany({
                where: { id: { in: ids }, userId },
            });
            const masteredCount = words.filter(w => w.isMastered).length;
            await tx.word.deleteMany({
                where: { id: { in: ids }, userId },
            });
            await tx.learningStats.update({
                where: { userId },
                data: {
                    totalWords: { decrement: words.length },
                    masteredWords: { decrement: masteredCount },
                },
            });
            return { deleted: words.length };
        });
        return result;
    }
}
exports.WordService = WordService;
//# sourceMappingURL=word-service.js.map