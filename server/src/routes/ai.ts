import { Router } from 'express';
import { z } from 'zod';
import { AIService } from '../services/ai-service';
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
});

// 生成单词释义
router.post('/define', async (req: AuthRequest, res) => {
  try {
    const { term } = defineSchema.parse(req.body);
    const result = await AIService.defineWord(term);
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
    const result = await AIService.extractWordsFromImage(imageBase64);
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

    const result = await AIService.generatePractice(words, questionCount, allowedTypes);
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

    const result = await AIService.generateStory(words);
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
    const result = await AIService.reviewEssay(title, essay);
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
    const { article, generateQuestions } = articleSchema.parse(req.body);
    console.log('[API] Received article study request, length:', article?.length, 'generateQuestions:', generateQuestions);
    const result = await AIService.studyArticle(article, generateQuestions);
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
    const result = await AIService.speakingChat({
      scenario,
      userTextEn,
      history,
      targetLevel,
    });
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

export { router as aiRouter };
