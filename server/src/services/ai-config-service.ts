import prisma from '../config/database';

export interface EffectiveAiConfig {
  provider: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'openai';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'kimi-k2.5';
const DEFAULT_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'qwen3-vl:235b';
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.kimi.com/coding/';
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY || '';

export class AiConfigService {
  // 获取用户配置（含环境变量回退）
  static async getEffectiveConfig(userId: string): Promise<EffectiveAiConfig> {
    const config = await prisma.aiConfig.findUnique({
      where: { userId },
    });

    return {
      provider: config?.provider || DEFAULT_PROVIDER,
      model: config?.model || DEFAULT_MODEL,
      visionModel: config?.visionModel || DEFAULT_VISION_MODEL,
      baseUrl: config?.baseUrl || DEFAULT_BASE_URL,
      apiKey: config?.apiKey || DEFAULT_API_KEY,
    };
  }

  // 获取原始用户配置（用于回显编辑，不含环境变量回退）
  static async getUserConfig(userId: string) {
    const config = await prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return null;
    }

    return {
      provider: config.provider,
      model: config.model,
      visionModel: config.visionModel,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    };
  }

  // 更新或创建用户配置
  static async updateConfig(
    userId: string,
    data: {
      provider?: string;
      model?: string;
      visionModel?: string;
      baseUrl?: string;
      apiKey?: string;
    }
  ) {
    const existing = await prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (existing) {
      return prisma.aiConfig.update({
        where: { userId },
        data: {
          ...(data.provider !== undefined && { provider: data.provider }),
          ...(data.model !== undefined && { model: data.model }),
          ...(data.visionModel !== undefined && { visionModel: data.visionModel }),
          ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
          ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
        },
      });
    }

    return prisma.aiConfig.create({
      data: {
        userId,
        provider: data.provider || DEFAULT_PROVIDER,
        model: data.model || DEFAULT_MODEL,
        visionModel: data.visionModel || DEFAULT_VISION_MODEL,
        baseUrl: data.baseUrl || DEFAULT_BASE_URL,
        apiKey: data.apiKey || DEFAULT_API_KEY,
      },
    });
  }

  // 重置为环境变量（删除用户配置）
  static async resetConfig(userId: string) {
    await prisma.aiConfig.deleteMany({
      where: { userId },
    });
    return { reset: true };
  }
}
