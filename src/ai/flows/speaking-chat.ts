'use server';

/**
 * @fileOverview Speaking chat turn:
 * - User speaks (ASR transcript) or types English
 * - LLM replies as a conversation partner (English)
 * - LLM provides feedback/corrections (Simplified Chinese)
 *
 * NOTE: We do NOT have access to audio. Feedback must be based on transcript only.
 */

import { generateJsonArray } from '@/ai/llm';
import {
  SpeakingChatInput,
  SpeakingChatInputSchema,
  SpeakingChatOutput,
  SpeakingChatOutputSchema,
} from '@/lib/types';

function pickString(...values: any[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

function coerceSpeakingChatOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r: any = raw;
  const assistantReplyEn =
    pickString(r.assistantReplyEn, r.replyEn, r.assistantReply, r.assistant, r.reply) || '';
  const feedbackZh = pickString(r.feedbackZh, r.feedback, r.coachZh, r.coachingZh) || '';
  const correctedUserEn =
    pickString(r.correctedUserEn, r.correctEn, r.betterEn, r.rewriteEn, r.corrected) || undefined;

  const issues = Array.isArray(r.issues) ? r.issues : Array.isArray(r.errors) ? r.errors : undefined;
  const scoreOverallRaw = r.scoreOverall ?? r.score ?? r.overallScore;
  const scoreOverall =
    typeof scoreOverallRaw === 'number'
      ? scoreOverallRaw
      : typeof scoreOverallRaw === 'string' && scoreOverallRaw.trim() !== ''
        ? Number(scoreOverallRaw)
        : undefined;

  return {
    kind: 'speaking_chat',
    assistantReplyEn: assistantReplyEn || 'Could you say that again?',
    feedbackZh: feedbackZh || '（AI 未返回反馈）',
    correctedUserEn,
    issues,
    scoreOverall: Number.isFinite(scoreOverall as any) ? Math.max(0, Math.min(100, Math.round(scoreOverall as any))) : undefined,
  };
}

export async function speakingChat(input: SpeakingChatInput): Promise<SpeakingChatOutput> {
  const parsed = SpeakingChatInputSchema.parse(input);
  const scenario = (parsed.scenario || '').trim();
  const targetLevel = parsed.targetLevel || 'B1';

  const historyText = (parsed.history || [])
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.contentEn || '').trim()}`)
    .filter((s) => s.trim())
    .join('\n');

  const systemPrompt = `You are a friendly English conversation partner and a strict speaking coach for a Chinese learner.
You MUST output valid JSON only (no markdown, no extra commentary).

Important constraints:
- You DO NOT have access to the user's audio. Do NOT claim you heard pronunciation. Only comment on the transcribed text.
- Conversation reply language: English.
- Coaching/feedback language: Simplified Chinese.
- Keep the assistant reply natural and short (1-3 sentences), like a real conversation.
- Give practical correction suggestions, not generic praise.
`;

  const userPrompt = `Scenario (optional):
${scenario ? scenario : '(none)'}

Target level: ${targetLevel}

Conversation so far:
${historyText || '(none)'}

User's new utterance (English transcript):
${parsed.userTextEn.trim()}

Now do BOTH:
1) Reply as the assistant in English (1-3 sentences), continuing the conversation naturally.
2) Evaluate the user's utterance (based on text only) and provide feedback in Simplified Chinese:
   - point out 1-4 key issues (grammar/word choice/fluency/coherence)
   - provide a corrected, more natural version (English)
   - give 1-2 actionable tips

Return ONE JSON object with this shape:
{
  "kind": "speaking_chat",
  "assistantReplyEn": string,
  "feedbackZh": string,
  "correctedUserEn"?: string,
  "issues"?: [
    {"type"?: "grammar"|"word_choice"|"fluency"|"coherence"|"other", "original"?: string, "suggestion": string, "reasonZh"?: string}
  ],
  "scoreOverall"?: number
}

Rules:
- assistantReplyEn MUST be English only.
- feedbackZh MUST be Simplified Chinese only.
- scoreOverall (optional) is 0-100 and should reflect clarity and correctness (text only).
- Keep feedbackZh concise but specific; avoid long essays.`;

  const data = await generateJsonArray<SpeakingChatOutput>({
    systemPrompt,
    userPrompt,
    schemaHint: 'Return ONLY valid JSON. No markdown. No extra keys.',
  });

  return SpeakingChatOutputSchema.parse(coerceSpeakingChatOutput(data));
}

