import { config } from 'dotenv';
config();

import '@/ai/flows/define-captured-word.ts';
import '@/ai/flows/extract-word-and-define.ts';

import '@/ai/flows/generate-quiz.ts';
import '@/ai/flows/generate-story.ts';
