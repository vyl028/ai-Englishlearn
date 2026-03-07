import { z } from 'zod';

// Base type for a captured word stored in the app
export type CapturedWord = {
  id: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  capturedAt: Date;
  photoDataUri?: string;
};

// Schema for defining a single word
export const DefineCapturedWordInputSchema = z.object({
  word: z.string().describe('The English word to define.'),
  partOfSpeech: z.string().describe('The part of speech of the word.'),
  photoDataUri: z.string().optional().describe(
    "An optional photo of something related to the word, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type DefineCapturedWordInput = z.infer<typeof DefineCapturedWordInputSchema>;

export const DefineCapturedWordOutputSchema = z.object({
  definition: z.string().describe('The Chinese definition of the word and its part of speech.'),
});
export type DefineCapturedWordOutput = z.infer<typeof DefineCapturedWordOutputSchema>;


// Schema for extracting words from a photo
export const ExtractWordAndDefineInputSchema = z.object({
  photoDataUri: z.string().describe(
    "A photo containing English words, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractWordAndDefineInput = z.infer<typeof ExtractWordAndDefineInputSchema>;

const WordDefinitionSchema = z.object({
  word: z.string().describe('The English word identified in the photo.'),
  partOfSpeech: z.string().describe('The part of speech of the identified word (e.g., noun, verb, adjective).'),
  definition: z.string().describe('The Chinese definition of the word and its part of speech.'),
});

export const ExtractWordAndDefineOutputSchema = z.array(WordDefinitionSchema);
export type ExtractWordAndDefineOutput = z.infer<typeof ExtractWordAndDefineOutputSchema>;


// Schema for generating a quiz
const WordInputSchema = z.object({
  word: z.string(),
  partOfSpeech: z.string(),
  definition: z.string(),
});

export const GenerateQuizInputSchema = z.object({
  words: z.array(WordInputSchema),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const QuizQuestionSchema = z.object({
  question: z.string().describe("The quiz question, in English, testing the word's meaning or usage."),
  options: z.array(z.string()).describe("An array of 4 possible answers, with only one being correct."),
  answer: z.string().optional().describe("The correct option from the 'options' array."),
  analysis: z.string().optional().describe("A brief explanation in Chinese of why the answer is correct and how the word is used."),
  word: z.string().describe("The target word being tested."),
});

export const GenerateQuizOutputSchema = z.array(QuizQuestionSchema);
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;


// Schema for generating a story
export const GenerateStoryInputSchema = z.object({
  words: z.array(WordInputSchema),
});
export type GenerateStoryInput = z.infer<typeof GenerateStoryInputSchema>;

export const GenerateStoryOutputSchema = z.object({
  title: z.string().describe("An appropriate title for the story in English."),
  story: z.string().describe("The generated story in English."),
  translation: z.string().describe("The Chinese translation of the story."),
});
export type GenerateStoryOutput = z.infer<typeof GenerateStoryOutputSchema>;
