"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupService = void 0;
const database_1 = __importDefault(require("../config/database"));
class GroupService {
    // 创建分组
    static async create(userId, data) {
        // 获取当前最大 order
        const maxOrder = await database_1.default.group.aggregate({
            where: { userId },
            _max: { order: true },
        });
        const group = await database_1.default.group.create({
            data: {
                name: data.name,
                order: data.order ?? (maxOrder._max.order ?? 0) + 1,
                userId,
            },
        });
        return group;
    }
    // 获取列表
    static async findMany(userId) {
        const groups = await database_1.default.group.findMany({
            where: { userId },
            orderBy: { order: 'asc' },
            include: {
                _count: {
                    select: { words: true },
                },
            },
        });
        return groups.map(g => ({
            ...g,
            wordCount: g._count.words,
            _count: undefined,
        }));
    }
    // 获取单个
    static async findById(userId, id) {
        const group = await database_1.default.group.findFirst({
            where: { id, userId },
            include: {
                _count: {
                    select: { words: true },
                },
            },
        });
        if (!group)
            return null;
        return {
            ...group,
            wordCount: group._count.words,
            _count: undefined,
        };
    }
    // 更新
    static async update(userId, id, data) {
        const group = await database_1.default.group.update({
            where: { id, userId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.order !== undefined && { order: data.order }),
            },
        });
        return group;
    }
    // 删除
    static async delete(userId, id) {
        // 删除分组后，该分组的单词变为未分组
        await database_1.default.group.delete({
            where: { id, userId },
        });
        return { success: true };
    }
    // 重新排序
    static async reorder(userId, groupIds) {
        await database_1.default.$transaction(groupIds.map((id, index) => database_1.default.group.update({
            where: { id, userId },
            data: { order: index },
        })));
        return { success: true };
    }
}
exports.GroupService = GroupService;
//# sourceMappingURL=group-service.js.map