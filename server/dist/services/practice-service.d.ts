export interface CreatePracticeInput {
    questionsJson: string;
    wordIds: string[];
    questionCount: number;
}
export interface SubmitAnswerInput {
    questionIndex: number;
    questionType: string;
    word: string;
    promptEn: string;
    userAnswer: string | null;
    correctAnswer: string | null;
    isCorrect: boolean;
}
export declare class PracticeService {
    static createPractice(userId: string, input: CreatePracticeInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        wordIds: string;
        questionCount: number;
        questionsJson: string;
        correctCount: number;
        totalCount: number;
        isSubmitted: boolean;
    }>;
    static listPractices(userId: string, limit?: number, offset?: number): Promise<{
        id: string;
        questionCount: number;
        correctCount: number;
        totalCount: number;
        isSubmitted: boolean;
        createdAt: string;
        updatedAt: string;
        answerCount: number;
    }[]>;
    static getPracticeById(userId: string, id: string): Promise<{
        id: string;
        questionsJson: string;
        wordIds: string[];
        questionCount: number;
        correctCount: number;
        totalCount: number;
        isSubmitted: boolean;
        createdAt: string;
        updatedAt: string;
        answers: {
            id: string;
            questionIndex: number;
            questionType: string;
            word: string;
            promptEn: string;
            userAnswer: string | null;
            correctAnswer: string | null;
            isCorrect: boolean;
        }[];
    } | null>;
    static submitPractice(userId: string, id: string, answers: SubmitAnswerInput[], correctCount: number, totalCount: number): Promise<{
        id: string;
        questionsJson: string;
        wordIds: string[];
        questionCount: number;
        correctCount: number;
        totalCount: number;
        isSubmitted: boolean;
        createdAt: string;
        updatedAt: string;
        answers: {
            id: string;
            questionIndex: number;
            questionType: string;
            word: string;
            promptEn: string;
            userAnswer: string | null;
            correctAnswer: string | null;
            isCorrect: boolean;
        }[];
    } | null>;
    static deletePractice(userId: string, id: string): Promise<{
        deleted: boolean;
    }>;
}
//# sourceMappingURL=practice-service.d.ts.map