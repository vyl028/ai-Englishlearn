import { WordCreateInput, WordUpdateInput, WordFilters } from '../types';
export declare class WordService {
    static create(userId: string, data: WordCreateInput): Promise<{
        id: string;
        word: string;
        partOfSpeech: string;
        definition: string;
        enrichment: string | null;
        userId: string;
        groupId: string | null;
        capturedAt: Date;
        isMastered: boolean;
        photoData: string | null;
    }>;
    static createBatch(userId: string, items: WordCreateInput[]): Promise<{
        created: {
            id: string;
            word: string;
            partOfSpeech: string;
            definition: string;
            enrichment: string | null;
            userId: string;
            groupId: string | null;
            capturedAt: Date;
            isMastered: boolean;
            photoData: string | null;
        }[];
        skipped: {
            word: string;
            partOfSpeech: string;
            error: string;
        }[];
    }>;
    static findMany(userId: string, filters: WordFilters): Promise<{
        words: {
            enrichment: any;
            group: {
                name: string;
                id: string;
                createdAt: Date;
                userId: string;
                order: number;
            } | null;
            id: string;
            word: string;
            partOfSpeech: string;
            definition: string;
            userId: string;
            groupId: string | null;
            capturedAt: Date;
            isMastered: boolean;
            photoData: string | null;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    static findById(userId: string, id: string): Promise<{
        enrichment: any;
        group: {
            name: string;
            id: string;
            createdAt: Date;
            userId: string;
            order: number;
        } | null;
        id: string;
        word: string;
        partOfSpeech: string;
        definition: string;
        userId: string;
        groupId: string | null;
        capturedAt: Date;
        isMastered: boolean;
        photoData: string | null;
    } | null>;
    static update(userId: string, id: string, data: WordUpdateInput): Promise<{
        enrichment: any;
        id: string;
        word: string;
        partOfSpeech: string;
        definition: string;
        userId: string;
        groupId: string | null;
        capturedAt: Date;
        isMastered: boolean;
        photoData: string | null;
    }>;
    static delete(userId: string, id: string): Promise<{
        id: string;
        word: string;
        partOfSpeech: string;
        definition: string;
        enrichment: string | null;
        userId: string;
        groupId: string | null;
        capturedAt: Date;
        isMastered: boolean;
        photoData: string | null;
    }>;
    static deleteBatch(userId: string, ids: string[]): Promise<{
        deleted: number;
    }>;
}
//# sourceMappingURL=word-service.d.ts.map