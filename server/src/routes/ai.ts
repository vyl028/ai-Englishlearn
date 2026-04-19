import { Router } from 'express';
import { z } from 'zod';
import { AIService } from '../services/ai-service';
import { AiConfigService } from '../services/ai-config-service';
import prisma from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// 验证 schema
const defineSchema = z.object({
  term: z.string().min(1).max(100),
});

const extractSchema = z.object({
  imageBase64: z.string().min(1),
});

const practiceSchema = z.object({
  wordIds: z.array(z.string()).min(1).max(50),
  questionCount: z.number().min(1).max(30).optional().default(10),
  allowedTypes: z.array(z.enum(['mcq', 'fill_blank', 'reorder'])).optional().default(['mcq', 'fill_blank', 'reorder']),
});

const storySchema = z.object({
  wordIds: z.array(z.string()).min(1).max(100),
});

const essaySchema = z.object({
  title: z.string().optional(),
  essay: z.string().min(10).max(20000),
});

const articleSchema = z.object({
  article: z.string().min(10).max(50000),
  generateQuestions: z.boolean().optional().default(false),
  questionCount: z.coerce.number().int().min(1).max(12).optional().default(5),
});

const extractTextSchema = z.object({
  imageBase64: z.string().min(1),
  mode: z.enum(['article', 'essay']),
});

// 生成单词释义
router.post('/define', async (req: AuthRequest, res) => {
  try {
    const { term } = defineSchema.parse(req.body);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.defineWord(term, config);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 图片识别单词
router.post('/extract', async (req: AuthRequest, res) => {
  try {
    const { imageBase64 } = extractSchema.parse(req.body);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.extractWordsFromImage(imageBase64, config);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 图片转录文字（文章阅读 / 作文批改场景，替代前端 Tesseract OCR）
router.post('/extract-text', async (req: AuthRequest, res) => {
  try {
    const { imageBase64, mode } = extractTextSchema.parse(req.body);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.extractTextFromImage(imageBase64, mode, config);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 生成练习题
router.post('/practice', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { wordIds, questionCount, allowedTypes } = practiceSchema.parse(req.body);

    // 获取单词详情
    const words = await prisma.word.findMany({
      where: { id: { in: wordIds }, userId },
      select: { word: true, definition: true, partOfSpeech: true },
    });

    if (words.length === 0) {
      return errorResponse(res, 'WORDS_NOT_FOUND', '未找到指定单词', 404);
    }

    const config = await AiConfigService.getEffectiveConfig(userId);
    const result = await AIService.generatePractice(words, questionCount, allowedTypes, config);
    console.log('[API] Practice generated, questions count:', result.questions?.length);
    if (result.questions?.length > 0) {
      const firstQ = result.questions[0];
      console.log('[API] First question type:', firstQ.type, 'has parts:', !!firstQ.parts, 'has acceptableAnswers:', !!firstQ.acceptableAnswers);
    }
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 生成故事
router.post('/story', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { wordIds } = storySchema.parse(req.body);

    // 获取单词详情
    const words = await prisma.word.findMany({
      where: { id: { in: wordIds }, userId },
      select: { word: true, definition: true },
    });

    if (words.length === 0) {
      return errorResponse(res, 'WORDS_NOT_FOUND', '未找到指定单词', 404);
    }

    const config = await AiConfigService.getEffectiveConfig(userId);
    const result = await AIService.generateStory(words, config);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 作文批改
router.post('/review-essay', async (req: AuthRequest, res) => {
  try {
    const { title, essay } = essaySchema.parse(req.body);
    console.log('[API] Received essay review request, title:', title ? 'provided' : 'empty', 'essay length:', essay?.length);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.reviewEssay(title, essay, config);
    console.log('[API] Sending essay review response:', JSON.stringify({
      success: true,
      hasOverallBand: !!result.overallBand,
      overallBand: result.overallBand,
      hasScores: !!result.scores,
      scores: result.scores,
      issuesCount: result.issues?.length || 0,
      beforeAfterCount: result.beforeAfter?.length || 0,
      firstIssue: result.issues?.[0] || null,
    }, null, 2));
    return successResponse(res, result);
  } catch (error) {
    console.error('[API] Essay review error:', error);
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 文章分析
router.post('/study-article', async (req: AuthRequest, res) => {
  try {
    const { article, generateQuestions, questionCount } = articleSchema.parse(req.body);
    console.log('[API] Received article study request, length:', article?.length, 'generateQuestions:', generateQuestions, 'questionCount:', questionCount);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.studyArticle(article, generateQuestions, questionCount, config);
    console.log('[API] Sending article study response:', JSON.stringify({
      success: true,
      kind: result.kind,
      hasStructure: !!result.structure,
      hasSyntax: !!result.syntax,
      hardSentencesCount: result.hardSentences?.length || 0,
      keywordsCount: result.keywords?.length || 0,
    }, null, 2));
    return successResponse(res, result);
  } catch (error) {
    console.error('[API] Article study error:', error);
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// 口语对话
const speakingChatSchema = z.object({
  scenario: z.string().max(120).optional(),
  userTextEn: z.string().min(1).max(600),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    contentEn: z.string().min(1),
  })).max(20).optional(),
  targetLevel: z.enum(['A2', 'B1', 'B2', 'C1']).optional(),
});

router.post('/speaking-chat', async (req: AuthRequest, res) => {
  try {
    const { scenario, userTextEn, history, targetLevel } = speakingChatSchema.parse(req.body);
    const config = await AiConfigService.getEffectiveConfig(req.userId!);
    const result = await AIService.speakingChat({
      scenario,
      userTextEn,
      history,
      targetLevel,
    }, config);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'AI_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== AI 配置路由 =====

const aiConfigUpdateSchema = z.object({
  provider: z.string().min(1).max(20).optional(),
  model: z.string().min(1).max(100).optional(),
  visionModel: z.string().min(1).max(100).optional(),
  baseUrl: z.string().min(1).max(500).optional(),
  apiKey: z.string().max(500).optional(),
});

// GET /api/ai/config - 获取当前生效的 AI 配置
router.get('/config', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const effective = await AiConfigService.getEffectiveConfig(userId);
    const userConfig = await AiConfigService.getUserConfig(userId);
    return successResponse(res, {
      effective,
      userConfig,
    });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'CONFIG_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/ai/config - 更新用户 AI 配置
router.put('/config', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const data = aiConfigUpdateSchema.parse(req.body);
    const updated = await AiConfigService.updateConfig(userId, data);
    return successResponse(res, {
      provider: updated.provider,
      model: updated.model,
      visionModel: updated.visionModel,
      baseUrl: updated.baseUrl,
      apiKey: updated.apiKey ? '***' : '',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'CONFIG_ERROR', error.message, 500);
    }
    throw error;
  }
});

// DELETE /api/ai/config - 重置为环境变量默认值
router.delete('/config', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await AiConfigService.resetConfig(userId);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'CONFIG_ERROR', error.message, 500);
    }
    throw error;
  }
});

export { router as aiRouter };
