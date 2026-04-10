export declare class AIService {
    static defineWord(term: string): Promise<any>;
    static extractWordsFromImage(imageBase64: string): Promise<any>;
    static generatePractice(words: {
        word: string;
        definition: string;
        partOfSpeech: string;
    }[], questionCount?: number, allowedTypes?: ('mcq' | 'fill_blank' | 'reorder')[]): Promise<any>;
    static generateStory(words: {
        word: string;
        definition: string;
    }[]): Promise<any>;
    static reviewEssay(title: string | undefined, essay: string): Promise<any>;
    static studyArticle(article: string, generateQuestions?: boolean): Promise<any>;
    static speakingChat(params: {
        scenario?: string;
        userTextEn: string;
        history?: Array<{
            role: 'user' | 'assistant';
            contentEn: string;
        }>;
        targetLevel?: string;
    }): Promise<{
        kind: string;
        assistantReplyEn: any;
        feedbackZh: any;
        correctedUserEn: any;
        issues: any;
        scoreOverall: any;
    }>;
}
//# sourceMappingURL=ai-service.d.ts.map