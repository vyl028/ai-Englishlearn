import prisma from '../config/database';
import { GroupCreateInput, GroupUpdateInput } from '../types';

export class GroupService {
  // 创建分组
  static async create(userId: string, data: GroupCreateInput) {
    // 获取当前最大 order
    const maxOrder = await prisma.group.aggregate({
      where: { userId },
      _max: { order: true },
    });

    const group = await prisma.group.create({
      data: {
        name: data.name,
        order: data.order ?? (maxOrder._max.order ?? 0) + 1,
        userId,
      },
    });

    return group;
  }

  // 获取列表
  static async findMany(userId: string) {
    const groups = await prisma.group.findMany({
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
  static async findById(userId: string, id: string) {
    const group = await prisma.group.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { words: true },
        },
      },
    });

    if (!group) return null;

    return {
      ...group,
      wordCount: group._count.words,
      _count: undefined,
    };
  }

  // 更新
  static async update(userId: string, id: string, data: GroupUpdateInput) {
    const group = await prisma.group.update({
      where: { id, userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });

    return group;
  }

  // 删除
  static async delete(userId: string, id: string) {
    // 删除分组后，该分组的单词变为未分组
    await prisma.group.delete({
      where: { id, userId },
    });

    return { success: true };
  }

  // 重新排序
  static async reorder(userId: string, groupIds: string[]) {
    await prisma.$transaction(
      groupIds.map((id, index) =>
        prisma.group.update({
          where: { id, userId },
          data: { order: index },
        })
      )
    );

    return { success: true };
  }
}
