import { GroupCreateInput, GroupUpdateInput } from '../types';
export declare class GroupService {
    static create(userId: string, data: GroupCreateInput): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        userId: string;
        order: number;
    }>;
    static findMany(userId: string): Promise<{
        wordCount: number;
        _count: undefined;
        name: string;
        id: string;
        createdAt: Date;
        userId: string;
        order: number;
    }[]>;
    static findById(userId: string, id: string): Promise<{
        wordCount: number;
        _count: undefined;
        name: string;
        id: string;
        createdAt: Date;
        userId: string;
        order: number;
    } | null>;
    static update(userId: string, id: string, data: GroupUpdateInput): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        userId: string;
        order: number;
    }>;
    static delete(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    static reorder(userId: string, groupIds: string[]): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=group-service.d.ts.map