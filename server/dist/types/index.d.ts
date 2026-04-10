import { Request } from 'express';
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export interface AuthRequest extends Request {
    userId?: string;
}
export interface UserCreateInput {
    username: string;
    password: string;
}
export interface UserLoginInput {
    username: string;
    password: string;
}
export interface WordCreateInput {
    word: string;
    partOfSpeech: string;
    definition: string;
    enrichment?: Record<string, unknown>;
    groupId?: string;
    photoData?: string;
}
export interface WordUpdateInput {
    word?: string;
    partOfSpeech?: string;
    definition?: string;
    enrichment?: Record<string, unknown>;
    groupId?: string | null;
    isMastered?: boolean;
}
export interface WordFilters {
    search?: string;
    groupId?: string;
    isMastered?: boolean;
    page?: number;
    limit?: number;
}
export interface GroupCreateInput {
    name: string;
    order?: number;
}
export interface GroupUpdateInput {
    name?: string;
    order?: number;
}
export interface DefineWordInput {
    term: string;
}
export interface ExtractWordsInput {
    imageBase64: string;
}
export interface GeneratePracticeInput {
    wordIds: string[];
    questionCount?: number;
    allowedTypes?: ('mcq' | 'fill_blank' | 'reorder')[];
}
export interface GenerateStoryInput {
    wordIds: string[];
}
export interface ReviewEssayInput {
    title?: string;
    essay: string;
}
export interface StudyArticleInput {
    article: string;
    generateQuestions?: boolean;
}
export interface LearningStatsUpdateInput {
    xpToAdd?: number;
    wordsAdded?: number;
    wordsMastered?: number;
    checkIn?: boolean;
}
//# sourceMappingURL=index.d.ts.map