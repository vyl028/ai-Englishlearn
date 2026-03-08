"use server";

import {
  CapturedWord,
  DefineCapturedWordInput,
  ExtractWordAndDefineOutput,
  GeneratePracticeInput,
  GeneratePracticeOutput,
  GenerateQuizInput,
  GenerateQuizOutput,
  GenerateStoryInput,
  GenerateStoryOutput,
  GenerateStoryOutputSchema,
  ReviewEssayInput,
  ReviewEssayOutput,
  StudyArticleInput,
  StudyArticleOutput
} from "@/lib/types";
import { defineCapturedWord } from '@/ai/flows/define-captured-word';
import { extractWordAndDefine } from '@/ai/flows/extract-word-and-define';
import { generatePractice } from '@/ai/flows/generate-practice';
import { generateQuiz } from '@/ai/flows/generate-quiz';
import { generateStory } from '@/ai/flows/generate-story';
import { reviewEssay } from '@/ai/flows/review-essay';
import { studyArticle } from '@/ai/flows/study-article';
import { generateId } from "@/lib/utils";
import { generateStoryPdf } from "@/lib/pdf-server-utils";
import { extractTextFromDocx, extractTextFromPdf, extractTextFromTxtLike } from "@/lib/essay-file-utils";

// In production, this should be configured via environment variables.
// For a self-hosted setup, this will be the URL of your Genkit API service.
const GENKIT_API_URL = process.env.NEXT_PUBLIC_GENKIT_API_URL || process.env.GENKIT_API_URL || "http://127.0.0.1:3400";
const USE_LOCAL = process.env.AI_USE_LOCAL === '1' || process.env.AI_USE_LOCAL === 'true';

export async function getDefinitionAction(
  data: DefineCapturedWordInput
): Promise<{ success: boolean; data?: CapturedWord; error?: string }> {
  try {
    const result = await defineCapturedWord(data);
    if (!result.definition) {
      return { success: false, error: "无法获取该单词的释义，请重试。" };
    }

    const newWord: CapturedWord = {
      id: generateId(),
      word: data.word,
      partOfSpeech: data.partOfSpeech,
      definition: result.definition,
      enrichment: result.enrichment,
      capturedAt: new Date(),
      photoDataUri: data.photoDataUri,
    };

    return { success: true, data: newWord };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message || "获取释义时发生错误。" };
  }
}

export async function extractWordAndDefineAction(
  photoDataUri: string
): Promise<{ success: boolean; data?: ExtractWordAndDefineOutput; error?: string }> {
  try {
    const result = await extractWordAndDefine({ photoDataUri });
    if (!result || result.length === 0) {
      console.log('No words found in result');
      return { success: false, error: "无法从图片中识别到单词，请重试。" };
    }
    console.log('Returning success with data:', result);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('extractWordAndDefineAction error:', error);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message || "分析图片时发生错误。" };
  }
}

export async function generateQuizAction(
  input: GenerateQuizInput
): Promise<{ success: boolean; data?: { questions: GenerateQuizOutput }; error?: string }> {
  try {
    const result = await generateQuiz(input);
    if (!result || !result.questions || result.questions.length === 0) {
      return { success: false, error: "无法生成测验题，模型可能返回了空结果。" };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('generateQuizAction error:', error);
    return { success: false, error: error.message || "生成测验题时发生错误。" };
  }
}

export async function generatePracticeAction(
  input: GeneratePracticeInput
): Promise<{ success: boolean; data?: { questions: GeneratePracticeOutput }; error?: string }> {
  try {
    const result = await generatePractice(input);
    if (!result || result.length === 0) {
      return { success: false, error: "无法生成练习题，模型可能返回了空结果。" };
    }
    return { success: true, data: { questions: result } };
  } catch (error: any) {
    console.error('generatePracticeAction error:', error);
    return { success: false, error: error.message || "生成练习题时发生错误。" };
  }
}

export async function generateStoryAction(
  input: GenerateStoryInput
): Promise<{ success: boolean; data?: GenerateStoryOutput; error?: string }> {
  try {
    const result = await generateStory(input);
    if (!result || !result.story) {
      return { success: false, error: "无法生成故事，模型可能返回了空结果。" };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('generateStoryAction error:', error);
    return { success: false, error: error.message || "生成故事时发生错误。" };
  }
}

export async function exportStoryPdfAction(
  story: GenerateStoryOutput
): Promise<{ success: boolean; data?: { pdfDataUri: string }; error?: string }> {
  try {
    const parsed = GenerateStoryOutputSchema.parse(story);
    const pdfDataUri = await generateStoryPdf(parsed);
    return { success: true, data: { pdfDataUri } };
  } catch (error: any) {
    console.error('exportStoryPdfAction error:', error);
    return { success: false, error: error.message || "导出 PDF 时发生错误。" };
  }
}

export async function reviewEssayAction(
  input: ReviewEssayInput
): Promise<{ success: boolean; data?: ReviewEssayOutput; error?: string }> {
  try {
    const result = await reviewEssay(input);
    if (!result || !result.revisedTextEn) {
      return { success: false, error: "无法完成作文批改，模型可能返回了空结果。" };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('reviewEssayAction error:', error);
    return { success: false, error: error.message || "作文批改时发生错误。" };
  }
}

export async function extractEssayTextFromFileAction(
  formData: FormData
): Promise<{ success: boolean; data?: { text: string; warnings?: string[]; filename?: string }; error?: string }> {
  try {
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return { success: false, error: "未找到上传的文件，请重试。" };
    }

    const filename = file.name || undefined;
    const sizeLimitBytes = 8 * 1024 * 1024;
    if (typeof file.size === 'number' && file.size > sizeLimitBytes) {
      return { success: false, error: "文件过大（> 8MB）。建议复制粘贴正文或上传更小的文件。" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = (filename || '').toLowerCase().split('.').pop() || '';

    if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) {
      const text = extractTextFromTxtLike(buffer);
      return { success: true, data: { text, filename } };
    }

    if (ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const text = extractTextFromDocx(buffer);
      return { success: true, data: { text, filename } };
    }

    if (ext === 'pdf' || file.type === 'application/pdf') {
      const { text, warnings } = extractTextFromPdf(buffer);
      return { success: true, data: { text, warnings, filename } };
    }

    return { success: false, error: "不支持的文件类型。请上传 .txt / .md / .docx / .pdf，或直接粘贴作文文本。" };
  } catch (error: any) {
    console.error('extractEssayTextFromFileAction error:', error);
    return { success: false, error: error.message || "读取文件时发生错误。" };
  }
}

export async function extractTextFromFileAction(
  formData: FormData
): Promise<{ success: boolean; data?: { text: string; warnings?: string[]; filename?: string }; error?: string }> {
  return extractEssayTextFromFileAction(formData);
}

export async function studyArticleAction(
  input: StudyArticleInput
): Promise<{ success: boolean; data?: StudyArticleOutput; error?: string }> {
  try {
    const result = await studyArticle(input);
    if (!result || !result.structure || !result.syntax) {
      return { success: false, error: "无法完成文章分析，模型可能返回了空结果。" };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('studyArticleAction error:', error);
    return { success: false, error: error.message || "文章分析时发生错误。" };
  }
}
