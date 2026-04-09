"use server";

import {
  CapturedWord,
  DefineCapturedWordInput,
  DefineCapturedWordOutput,
  DefineTermAutoInput,
  DefineTermAutoOutput,
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
  SpeakingChatInput,
  SpeakingChatOutput,
  StudyArticleInput,
  StudyArticleOutput
} from "@/lib/types";
import { generateId } from "@/lib/utils";
import { getAiCache, setAiCache, hashAiCachePayload } from "@/lib/ai-cache";
import { generateStoryPdf } from "@/lib/pdf-server-utils";
import { extractTextFromDocx, extractTextFromPdf, extractTextFromTxtLike } from "@/lib/essay-file-utils";
import { aiDebug } from "@/ai/debug";

// 后端 API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// AI 请求超时时间（2 分钟）
const AI_TIMEOUT_MS = 120000;

// 带超时的 fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 带认证的 API 请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { timeoutMs, ...fetchOptions } = options;
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(
      url,
      {
        ...fetchOptions,
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
      },
      timeoutMs || 30000 // 默认 30 秒
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error?.message || `请求失败: ${response.status}`,
      };
    }

    return { success: true, data: result.data };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { success: false, error: "请求超时，请稍后重试" };
    }
    console.error(`API request failed: ${endpoint}`, error);
    return { success: false, error: error.message || "网络请求失败" };
  }
}

export async function getDefinitionAction(
  data: DefineCapturedWordInput
): Promise<{ success: boolean; data?: CapturedWord; error?: string }> {
  // 直接调用后端 API
  const result = await apiRequest<any>("/api/ai/define", {
    method: "POST",
    body: JSON.stringify({ term: data.word }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "无法获取该单词的释义，请重试。" };
  }

  // 构造 CapturedWord
  const def = result.data.definitions?.[0];
  if (!def) {
    return { success: false, error: "AI 返回格式不正确" };
  }

  const newWord: CapturedWord = {
    id: generateId(),
    word: data.word,
    partOfSpeech: def.partOfSpeech,
    definition: def.definition,
    enrichment: def.enrichment,
    capturedAt: new Date(),
    photoDataUri: data.photoDataUri,
  };

  return { success: true, data: newWord };
}

export async function regenerateCapturedWordAction(
  data: DefineCapturedWordInput
): Promise<{ success: boolean; data?: DefineCapturedWordOutput; error?: string }> {
  const result = await apiRequest<any>("/api/ai/define", {
    method: "POST",
    body: JSON.stringify({ term: data.word }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "无法重新生成该词条的内容，请稍后重试。" };
  }

  const def = result.data.definitions?.[0];
  if (!def) {
    return { success: false, error: "AI 返回格式不正确" };
  }

  return {
    success: true,
    data: {
      definition: def.definition,
      enrichment: def.enrichment,
    },
  };
}

export async function extractWordAndDefineAction(
  photoDataUri: string
): Promise<{ success: boolean; data?: ExtractWordAndDefineOutput; error?: string; fromCache?: boolean }> {
  try {
    // 计算图片数据的缓存key（使用前1KB数据作为特征）
    const cacheHash = hashAiCachePayload({
      image: photoDataUri.slice(0, 1024),
      type: "extract-word-and-define",
      version: "v1",
    });

    // 尝试读取缓存
    const cached = getAiCache<ExtractWordAndDefineOutput>("define", cacheHash);
    if (cached) {
      aiDebug("[extractWordAndDefineAction] Cache hit for hash=%s", cacheHash);
      return { success: true, data: cached, fromCache: true };
    }

    aiDebug("[extractWordAndDefineAction] Cache miss, calling AI...");

    const result = await apiRequest<any>("/api/ai/extract", {
      method: "POST",
      body: JSON.stringify({ imageBase64: photoDataUri }),
      timeoutMs: AI_TIMEOUT_MS,
    });

    if (!result.success || !result.data?.words) {
      aiDebug("[extractWordAndDefineAction] No words found in result");
      return { success: false, error: result.error || "无法从图片中识别到单词，请重试。" };
    }

    const words = result.data.words.map((w: any) => ({
      word: w.word,
      partOfSpeech: w.partOfSpeech,
      definition: w.definition,
      enrichment: w.enrichment,
    }));

    aiDebug("[extractWordAndDefineAction] Returning %s items", words.length);

    // 保存到缓存（TTL 7天）
    setAiCache("define", cacheHash, words, { ttlMs: 7 * 24 * 60 * 60 * 1000 });

    return { success: true, data: words };
  } catch (error: any) {
    console.error("extractWordAndDefineAction error:", error);
    aiDebug("[extractWordAndDefineAction] stack=%s", error?.stack || "");
    return { success: false, error: error.message || "分析图片时发生错误。" };
  }
}

export async function defineTermAutoAction(
  input: DefineTermAutoInput
): Promise<{ success: boolean; data?: DefineTermAutoOutput; error?: string }> {
  const result = await apiRequest<any>("/api/ai/define", {
    method: "POST",
    body: JSON.stringify({ term: input.term }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data?.definitions) {
    return { success: false, error: result.error || "无法获取该词条的释义，请重试。" };
  }

  const definitions = result.data.definitions.map((def: any) => ({
    word: def.word,
    partOfSpeech: def.partOfSpeech,
    definition: def.definition,
    enrichment: def.enrichment,
  }));

  return { success: true, data: definitions };
}

export async function generateQuizAction(
  input: GenerateQuizInput
): Promise<{ success: boolean; data?: { questions: GenerateQuizOutput }; error?: string }> {
  // 复用 practice API - 后端需要 wordIds，但前端传入的是 words 数组
  // 这里需要先从 words 中提取信息，然后调用后端
  // 暂时返回错误，需要 page.tsx 传入 wordIds
  return { success: false, error: "请使用 generatePracticeAction 代替" };
}

export async function generatePracticeAction(
  wordIds: string[],
  options?: { questionCount?: number; allowedTypes?: string[] }
): Promise<{ success: boolean; data?: { questions: GeneratePracticeOutput }; error?: string }> {
  const result = await apiRequest<any>("/api/ai/practice", {
    method: "POST",
    body: JSON.stringify({
      wordIds,
      questionCount: options?.questionCount ?? 10,
      allowedTypes: options?.allowedTypes ?? ["mcq", "fill_blank", "reorder"],
    }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data?.questions) {
    return { success: false, error: result.error || "无法生成练习题，请重试。" };
  }

  return { success: true, data: { questions: result.data.questions } };
}

export async function generateStoryAction(
  wordIds: string[]
): Promise<{ success: boolean; data?: GenerateStoryOutput; error?: string }> {
  const result = await apiRequest<any>("/api/ai/story", {
    method: "POST",
    body: JSON.stringify({ wordIds }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "无法生成故事，请重试。" };
  }

  return { success: true, data: result.data };
}

export async function exportStoryPdfAction(
  story: GenerateStoryOutput
): Promise<{ success: boolean; data?: { pdfDataUri: string }; error?: string }> {
  try {
    const parsed = GenerateStoryOutputSchema.parse(story);
    const pdfDataUri = await generateStoryPdf(parsed);
    return { success: true, data: { pdfDataUri } };
  } catch (error: any) {
    console.error("exportStoryPdfAction error:", error);
    return { success: false, error: error.message || "导出 PDF 时发生错误。" };
  }
}

export async function reviewEssayAction(
  input: ReviewEssayInput
): Promise<{ success: boolean; data?: ReviewEssayOutput; error?: string }> {
  const result = await apiRequest<any>("/api/ai/review-essay", {
    method: "POST",
    body: JSON.stringify({ title: input.taskPrompt, essay: input.text }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data?.revisedTextEn) {
    return { success: false, error: result.error || "无法完成作文批改，请重试。" };
  }

  return { success: true, data: result.data };
}

export async function speakingChatAction(
  input: SpeakingChatInput
): Promise<{ success: boolean; data?: SpeakingChatOutput; error?: string }> {
  const result = await apiRequest<any>("/api/ai/speaking-chat", {
    method: "POST",
    body: JSON.stringify({
      scenario: input.scenario,
      userTextEn: input.userTextEn,
      history: input.history,
      targetLevel: input.targetLevel,
    }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "口语对话失败，请稍后重试。" };
  }

  return {
    success: true,
    data: {
      kind: "speaking_chat",
      assistantReplyEn: result.data.assistantReplyEn,
      feedbackZh: result.data.feedbackZh,
      correctedUserEn: result.data.correctedUserEn,
      issues: result.data.issues,
      scoreOverall: result.data.scoreOverall,
    },
  };
}

export async function extractEssayTextFromFileAction(
  formData: FormData
): Promise<{ success: boolean; data?: { text: string; warnings?: string[]; filename?: string }; error?: string }> {
  try {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "未找到上传的文件，请重试。" };
    }

    const filename = file.name || undefined;
    const sizeLimitBytes = 8 * 1024 * 1024;
    if (typeof file.size === "number" && file.size > sizeLimitBytes) {
      return { success: false, error: "文件过大（> 8MB）。建议复制粘贴正文或上传更小的文件。" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = (filename || "").toLowerCase().split(".").pop() || "";

    if (ext === "txt" || ext === "md" || file.type.startsWith("text/")) {
      const text = extractTextFromTxtLike(buffer);
      return { success: true, data: { text, filename } };
    }

    if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const text = extractTextFromDocx(buffer);
      return { success: true, data: { text, filename } };
    }

    if (ext === "pdf" || file.type === "application/pdf") {
      const { text, warnings } = extractTextFromPdf(buffer);
      return { success: true, data: { text, warnings, filename } };
    }

    // 图片文件：调用后端 OCR
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || file.type.startsWith("image/")) {
      const mime =
        file.type && file.type.startsWith("image/")
          ? file.type
          : ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

      const photoDataUri = `data:${mime};base64,${buffer.toString("base64")}`;

      const result = await apiRequest<any>("/api/ai/extract", {
        method: "POST",
        body: JSON.stringify({ imageBase64: photoDataUri }),
      });

      if (result.success && result.data?.words?.length > 0) {
        // 将识别的单词拼接成文本
        const words = result.data.words.map((w: any) => w.word).join(" ");
        return {
          success: true,
          data: {
            text: words,
            warnings: ["已从图片识别文字（OCR）。建议检查是否有漏字/换行错误，并按需手动修正。"],
            filename,
          },
        };
      }

      return {
        success: false,
        error: "未能从图片中识别到连贯的英文正文。请尝试更清晰的图片，或改用文本粘贴/文件上传。",
      };
    }

    return {
      success: false,
      error: "不支持的文件类型。请上传 .txt / .md / .docx / .pdf / 图片（.png/.jpg/.jpeg/.webp），或直接粘贴英文正文。",
    };
  } catch (error: any) {
    console.error("extractEssayTextFromFileAction error:", error);
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
  const result = await apiRequest<any>("/api/ai/study-article", {
    method: "POST",
    body: JSON.stringify({ article: input.text, generateQuestions: input.includeQuestions }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success || !result.data?.structure) {
    return { success: false, error: result.error || "无法完成文章分析，请重试。" };
  }

  return { success: true, data: result.data };
}
