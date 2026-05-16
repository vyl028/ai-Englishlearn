export type AiRuntimeConfig = {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    visionModel?: string;
};
export declare class AIService {
    static defineWord(term: string, config?: AiRuntimeConfig): Promise<any>;
    static recognizeWordsFromImage(imageBase64: string, config?: AiRuntimeConfig): Promise<string[]>;
    static extractWordsFromImage(imageBase64: string, config?: AiRuntimeConfig): Promise<{
        words: any[];
    }>;
    static extractTextFromImage(imageBase64: string, mode: 'article' | 'essay', config?: AiRuntimeConfig): Promise<{
        text: string;
    }>;
    static generatePractice(words: {
        word: string;
        definition: string;
        partOfSpeech: string;
    }[], questionCount?: number, allowedTypes?: ('mcq' | 'fill_blank' | 'reorder')[], config?: AiRuntimeConfig): Promise<any>;
    static generateStory(words: {
        word: string;
        definition: string;
    }[], config?: AiRuntimeConfig): Promise<any>;
    static reviewEssay(title: string | undefined, essay: string, config?: AiRuntimeConfig): Promise<any>;
    static studyArticle(article: string, generateQuestions?: boolean, questionCount?: number, config?: AiRuntimeConfig): Promise<any>;
    static speakingChat(params: {
        scenario?: string;
        userTextEn: string;
        history?: Array<{
            role: 'user' | 'assistant';
            contentEn: string;
        }>;
        targetLevel?: string;
    }, config?: AiRuntimeConfig): Promise<{
        kind: string;
        assistantReplyEn: any;
        feedbackZh: any;
        correctedUserEn: any;
        issues: any;
        scoreOverall: any;
    }>;
}
//# sourceMappingURL=ai-service.d.ts.map