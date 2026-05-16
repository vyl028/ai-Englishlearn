export interface EffectiveAiConfig {
    provider: string;
    model: string;
    visionModel: string;
    baseUrl: string;
    apiKey: string;
}
export declare class AiConfigService {
    static getEffectiveConfig(userId: string): Promise<EffectiveAiConfig>;
    static getUserConfig(userId: string): Promise<{
        provider: string;
        model: string;
        visionModel: string;
        baseUrl: string;
        apiKey: string;
    } | null>;
    static updateConfig(userId: string, data: {
        provider?: string;
        model?: string;
        visionModel?: string;
        baseUrl?: string;
        apiKey?: string;
    }): Promise<{
        model: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        baseUrl: string;
        apiKey: string;
        provider: string;
        visionModel: string;
    }>;
    static resetConfig(userId: string): Promise<{
        reset: boolean;
    }>;
}
//# sourceMappingURL=ai-config-service.d.ts.map