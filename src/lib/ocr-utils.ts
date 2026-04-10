"use client";

import Tesseract from "tesseract.js";

/**
 * 使用 Tesseract.js 从图片中提取文字
 * @param imageDataUri 图片的 data URI
 * @returns 提取的文本内容
 */
export async function extractTextFromImage(imageDataUri: string): Promise<string> {
  try {
    console.log("[OCR] Starting text extraction from image...");
    const result = await Tesseract.recognize(
      imageDataUri,
      "eng", // 使用英语语言包
      {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    const text = result.data.text.trim();
    console.log("[OCR] Extracted text:", text.substring(0, 200));
    return text;
  } catch (error) {
    console.error("[OCR] Error extracting text:", error);
    throw new Error("图片文字识别失败，请尝试手动输入或更换图片。");
  }
}

/**
 * 从文本中提取可能的单词
 * @param text 输入文本
 * @returns 单词列表
 */
export function extractWordsFromText(text: string): string[] {
  // 清理文本并提取单词
  const cleanedText = text
    .replace(/[^\w\s-]/g, " ") // 移除标点符号，保留字母、数字和连字符
    .replace(/\s+/g, " "); // 合并多个空格

  // 分割成单词并过滤
  const words = cleanedText
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => {
      // 过滤条件：
      // 1. 长度大于 2
      // 2. 只包含英文字母
      // 3. 不是常见的停用词
      const stopWords = new Set([
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our",
        "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way",
        "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use", "will", "with", "have",
        "this", "that", "from", "they", "know", "want", "been", "good", "much", "some", "time", "very",
        "when", "come", "here", "just", "like", "long", "make", "many", "over", "such", "take", "than",
        "them", "well", "were",
      ]);
      return w.length > 2 && /^[a-z-]+$/.test(w) && !stopWords.has(w);
    });

  // 去重并返回前 10 个
  return [...new Set(words)].slice(0, 10);
}
