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
  GenerateStoryOutput
} from "@/lib/types";
import { defineCapturedWord } from '@/ai/flows/define-captured-word';
import { extractWordAndDefine } from '@/ai/flows/extract-word-and-define';
import { generatePractice } from '@/ai/flows/generate-practice';
import { generateQuiz } from '@/ai/flows/generate-quiz';
import { generateStory } from '@/ai/flows/generate-story';
import { generateId } from "@/lib/utils";
import { generateStoryPdf } from "@/lib/pdf-server-utils";

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
      return { success: false, error: "Could not get a definition for this word. Please try again." };
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
    return { success: false, error: error.message || "An error occurred while fetching the definition." };
  }
}

export async function extractWordAndDefineAction(
  photoDataUri: string
): Promise<{ success: boolean; data?: ExtractWordAndDefineOutput; error?: string }> {
  try {
    const result = await extractWordAndDefine({ photoDataUri });
    if (!result || result.length === 0) {
      console.log('No words found in result');
      return { success: false, error: "Could not extract any words from the image. Please try again." };
    }
    console.log('Returning success with data:', result);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('extractWordAndDefineAction error:', error);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message || "An error occurred while analyzing the image." };
  }
}

export async function generateQuizAction(
  input: GenerateQuizInput
): Promise<{ success: boolean; data?: { questions: GenerateQuizOutput }; error?: string }> {
  try {
    const result = await generateQuiz(input);
    if (!result || !result.questions || result.questions.length === 0) {
      return { success: false, error: "Could not generate a quiz. The model may have returned an empty result." };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('generateQuizAction error:', error);
    return { success: false, error: error.message || "An error occurred while generating the quiz." };
  }
}

export async function generatePracticeAction(
  input: GeneratePracticeInput
): Promise<{ success: boolean; data?: { questions: GeneratePracticeOutput }; error?: string }> {
  try {
    const result = await generatePractice(input);
    if (!result || result.length === 0) {
      return { success: false, error: "Could not generate practice questions. The model may have returned an empty result." };
    }
    return { success: true, data: { questions: result } };
  } catch (error: any) {
    console.error('generatePracticeAction error:', error);
    return { success: false, error: error.message || "An error occurred while generating practice questions." };
  }
}

export async function generateStoryAction(
  input: GenerateStoryInput
): Promise<{ success: boolean; data?: GenerateStoryOutput & { pdfDataUri?: string }; error?: string }> {
  try {
    const result = await generateStory(input);
    if (!result || !result.story) {
      return { success: false, error: "Could not generate a story. The model may have returned an empty result." };
    }
    const pdfDataUri = await generateStoryPdf(result);
    return { success: true, data: { ...result, pdfDataUri } };
  } catch (error: any) {
    console.error('generateStoryAction error:', error);
    return { success: false, error: error.message || "An error occurred while generating the story." };
  }
}
