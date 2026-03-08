import { z } from 'zod';

// Base type for a captured word stored in the app
export type CapturedWord = {
  id: string;
  word: string;
  /**
   * Optional custom group id for organizing words.
   * Older localStorage entries may not have this field; treat missing as ungrouped (visible in the "All" view).
   */
  groupId?: string;
  partOfSpeech: string;
  definition: string;
  enrichment?: WordEnrichment;
  capturedAt: Date;
  photoDataUri?: string;
};

export type WordGroup = {
  id: string;
  name: string;
};

export const WordEnrichmentSchema = z.object({
  collocations: z.preprocess((v) => {
    if (!Array.isArray(v)) return v;
    return v.map((item) => (typeof item === 'string' ? { phrase: item } : item));
  }, z.array(z.object({
    phrase: z.string().describe('An English collocation phrase that commonly appears with the target word.'),
    meaningZh: z.string().optional().describe('Optional concise Chinese meaning for the collocation.'),
    exampleEn: z.string().optional().describe('Optional English example sentence for the collocation.'),
    exampleZh: z.string().optional().describe('Optional Chinese translation for the example sentence.'),
  }))).optional(),
  synonyms: z.preprocess((v) => {
    if (typeof v === 'string') return v.split(/[,，]\s*/).filter(Boolean);
    return v;
  }, z.array(z.string())).optional().describe('Common English synonyms.'),
  antonyms: z.preprocess((v) => {
    if (typeof v === 'string') return v.split(/[,，]\s*/).filter(Boolean);
    return v;
  }, z.array(z.string())).optional().describe('Common English antonyms.'),
  examples: z.preprocess((v) => {
    if (!Array.isArray(v)) return v;
    return v.map((item) => (typeof item === 'string' ? { en: item } : item));
  }, z.array(z.object({
    en: z.string().describe('An English example sentence using the target word.'),
    zh: z.string().optional().describe('Chinese translation of the example sentence.'),
  }))).optional(),
  level: z.preprocess((v) => {
    if (typeof v === 'string') return { usageZh: v };
    return v;
  }, z.object({
    cefr: z.string().optional().describe('Estimated CEFR level (e.g., A1~C2).'),
    usageZh: z.string().optional().describe('Concise Chinese usage notes, common patterns and pitfalls.'),
  })).optional(),
});
export type WordEnrichment = z.infer<typeof WordEnrichmentSchema>;

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
  enrichment: WordEnrichmentSchema.optional().describe('Optional AI-generated enrichment content for learning.'),
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
  enrichment: WordEnrichmentSchema.optional().describe('Optional AI-generated enrichment content for learning.'),
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


// Schema for generating practice questions (multiple types)
export const PracticeQuestionTypeSchema = z.enum(['mcq', 'fill_blank', 'reorder']);
export type PracticeQuestionType = z.infer<typeof PracticeQuestionTypeSchema>;

export const GeneratePracticeInputSchema = z.object({
  words: z.array(WordInputSchema),
  questionCount: z.coerce.number().int().min(1).max(30).optional(),
  allowedTypes: z.array(PracticeQuestionTypeSchema).min(1).optional(),
});
export type GeneratePracticeInput = z.infer<typeof GeneratePracticeInputSchema>;

const PracticeQuestionBaseSchema = z.object({
  type: PracticeQuestionTypeSchema,
  word: z.string().describe('The target word for this question.'),
  promptEn: z.string().describe('The question prompt in English.'),
  analysisZh: z.string().describe('Detailed explanation in Chinese.'),
  grammarZh: z.string().describe('Grammar explanation in Chinese.'),
  usageZh: z.string().describe('Vocabulary usage notes in Chinese.'),
});

const PracticeMcqQuestionSchema = PracticeQuestionBaseSchema.extend({
  type: z.literal('mcq'),
  options: z.array(z.string()).length(4).describe('4 multiple-choice options.'),
  answerIndex: z.number().int().min(0).max(3).describe('Index of the correct option (0-3).'),
});

const PracticeFillBlankQuestionSchema = PracticeQuestionBaseSchema.extend({
  type: z.literal('fill_blank'),
  sentenceEn: z.string().describe('English sentence containing a blank placeholder like ____.'),
  acceptableAnswers: z.array(z.string()).min(1).describe('List of acceptable answers for the blank.'),
});

const PracticeReorderQuestionSchema = PracticeQuestionBaseSchema.extend({
  type: z.literal('reorder'),
  parts: z.array(z.string()).min(4).describe('Shuffled sentence parts to reorder.'),
  correctOrder: z.array(z.number().int()).min(4).describe('Correct order of indices for parts.'),
  answerSentenceEn: z.string().optional().describe('Optional full correct English sentence.'),
  translationZh: z.string().optional().describe('Optional Chinese translation of the sentence.'),
});

export const PracticeQuestionSchema = z.discriminatedUnion('type', [
  PracticeMcqQuestionSchema,
  PracticeFillBlankQuestionSchema,
  PracticeReorderQuestionSchema,
]);
export type PracticeQuestion = z.infer<typeof PracticeQuestionSchema>;

export const GeneratePracticeOutputSchema = z.array(PracticeQuestionSchema);
export type GeneratePracticeOutput = z.infer<typeof GeneratePracticeOutputSchema>;


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

// Schema for reviewing an IELTS Writing Task 2 essay
export const CefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown']);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;

const IeltsBandSchema = z.preprocess((v) => {
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return v;
}, z.number().min(0).max(9));

export const ReviewEssayInputSchema = z.object({
  text: z.string().min(1).describe('The English essay text.'),
  taskPrompt: z.string().optional().describe('Optional IELTS Writing Task 2 prompt (question) in English.'),
});
export type ReviewEssayInput = z.infer<typeof ReviewEssayInputSchema>;

export const EssayIssueCategorySchema = z.enum([
  'grammar',
  'spelling',
  'tense',
  'logic',
  'coherence',
  'task_response',
  'word_choice',
  'punctuation',
  'style',
  'other',
]);
export type EssayIssueCategory = z.infer<typeof EssayIssueCategorySchema>;

export const EssayIssueSeveritySchema = z.enum(['low', 'medium', 'high']);
export type EssayIssueSeverity = z.infer<typeof EssayIssueSeveritySchema>;

export const EssayIssueSchema = z.object({
  category: EssayIssueCategorySchema,
  original: z.string().optional().describe('Original snippet from the essay (English).'),
  suggestion: z.string().describe('Suggested correction or rewrite (English).'),
  explanationZh: z.string().describe('Chinese explanation of the issue and advice.'),
  exampleEn: z.string().optional().describe('Optional example sentence in English.'),
  exampleZh: z.string().optional().describe('Optional Chinese translation for the example.'),
  severity: EssayIssueSeveritySchema.optional(),
});
export type EssayIssue = z.infer<typeof EssayIssueSchema>;

export const EssayBeforeAfterSchema = z.object({
  before: z.string().describe('Before rewrite snippet (English).'),
  after: z.string().describe('After rewrite snippet (English).'),
  reasonZh: z.string().optional().describe('Chinese reason for the change.'),
});
export type EssayBeforeAfter = z.infer<typeof EssayBeforeAfterSchema>;

export const IeltsTask2ScoreSchema = z.object({
  taskResponse: IeltsBandSchema,
  coherenceCohesion: IeltsBandSchema,
  lexicalResource: IeltsBandSchema,
  grammaticalRangeAccuracy: IeltsBandSchema,
  overallBand: IeltsBandSchema,
});
export type IeltsTask2Score = z.infer<typeof IeltsTask2ScoreSchema>;

export const ReviewEssayOutputSchema = z.object({
  kind: z.literal('ielts_task2_review'),
  overallBand: IeltsBandSchema,
  scores: IeltsTask2ScoreSchema,
  level: z.object({
    cefr: CefrLevelSchema,
    commentZh: z.string().optional(),
  }).optional(),
  summaryZh: z.string(),
  strengthsZh: z.array(z.string()).optional(),
  weaknessesZh: z.array(z.string()).optional(),
  issues: z.array(EssayIssueSchema),
  beforeAfter: z.array(EssayBeforeAfterSchema).optional(),
  revisedTextEn: z.string(),
});
export type ReviewEssayOutput = z.infer<typeof ReviewEssayOutputSchema>;

// Extra schemas used by optional AI flows (analyze-image / analyze-sentence / define-words-batch)
const CandidateWordSchema = z.object({
  surface: z.string(),
  lemma: z.string().optional(),
  partOfSpeech: z.string().optional(),
  reasonZh: z.string().optional(),
});

export const AnalyzeSentenceInputSchema = z.object({
  text: z.string().min(1),
  excludeWords: z.array(z.string()).optional(),
  maxCandidates: z.coerce.number().int().min(1).max(50).optional(),
  withExplanation: z.coerce.boolean().optional(),
});
export type AnalyzeSentenceInput = z.infer<typeof AnalyzeSentenceInputSchema>;

export const AnalyzeSentenceOutputSchema = z.object({
  textEn: z.string(),
  candidateWords: z.array(CandidateWordSchema),
  translationZh: z.string().optional(),
  grammarNotesZh: z.string().optional(),
});
export type AnalyzeSentenceOutput = z.infer<typeof AnalyzeSentenceOutputSchema>;

export const AnalyzeImageInputSchema = z.object({
  photoDataUri: z.string(),
  excludeWords: z.array(z.string()).optional(),
  maxCandidates: z.coerce.number().int().min(1).max(50).optional(),
});
export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>;

export const AnalyzeImageOutputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('word'),
    words: ExtractWordAndDefineOutputSchema,
  }),
  z.object({
    kind: z.literal('sentence'),
    textEn: z.string(),
    candidateWords: z.array(CandidateWordSchema),
  }),
]);
export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

export const DefineWordsBatchInputSchema = z.object({
  words: z.array(z.object({
    word: z.string(),
    partOfSpeech: z.string(),
  })).min(1).max(30),
});
export type DefineWordsBatchInput = z.infer<typeof DefineWordsBatchInputSchema>;

export const DefineWordsBatchOutputSchema = z.array(WordDefinitionSchema);
export type DefineWordsBatchOutput = z.infer<typeof DefineWordsBatchOutputSchema>;
