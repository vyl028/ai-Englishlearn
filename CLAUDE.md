# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**LexiCapture** is an AI-powered English learning PWA targeting Chinese users. Users capture English words (via photo or manual input), get AI-generated definitions with rich enrichment data, and practice through multiple learning modes.

### Key Features
- 📷 Photo-based word capture with AI OCR + definition generation
- 📚 Word book with group management and mastery tracking
- 🧠 AI practice (MCQ / fill-in-the-blank / sentence reorder)
- 📖 AI story generation using user's vocabulary
- ✍️ IELTS Task 2 essay review with 4-dimension scoring
- 📰 Deep article analysis (structure / syntax / vocabulary)
- 🎤 AI speaking training with real-time feedback
- 🏆 Gamification: XP, levels, streaks, badges

---

## Architecture

### Dual-Server Design

```
┌──────────────────────────────────────────────┐
│          PWA (Mobile + Desktop)               │
│   Next.js 15 Frontend  (port 9002)           │
│   SPA with 7 views · Radix UI · Tailwind     │
│        ↕ Server Actions (JWT proxy)           │
└──────────────────┬───────────────────────────┘
                   │ JWT Bearer Token
                   ▼
┌──────────────────────────────────────────────┐
│     Express.js Backend  (port 4000)          │
│   Auth · Words · Groups · AI · UserStats     │
│        Prisma ORM  →  SQLite                 │
│              AI Service Layer                │
└──────────┬───────────────────┬───────────────┘
           ▼                   ▼
   Gemini 2.5 Flash       GPT-4o-mini
   (default / primary)    (switchable fallback)
```

### Key Directories

| Path | Role |
|------|------|
| `src/app/` | Next.js App Router pages, layouts, Server Actions |
| `src/app/actions.ts` | All AI Server Actions (JWT-proxied to backend) |
| `src/ai/` | AI provider abstraction layer and Genkit compat shim |
| `src/ai/flows/` | 12 individual AI flow definitions |
| `src/ai/llm.ts` | Unified AI entry point (Gemini / OpenAI routing) |
| `src/components/` | React components (35 shadcn/ui base + feature components) |
| `src/lib/` | Types (Zod schemas), API client, hooks, gamification, cache |
| `src/hooks/` | 12 custom React hooks |
| `server/src/` | Express backend (routes / services / middleware) |
| `server/prisma/` | Prisma schema + SQLite database |

---

## Development Commands

```bash
# ── Frontend ──────────────────────────────────────────
npm run dev              # Next.js dev server on port 9002 (Turbopack, binds 0.0.0.0)
npm run build            # Production build
npm run start            # Production server

# ── Backend ───────────────────────────────────────────
cd server && npm run dev # Express backend on port 4000

# ── AI layer (legacy Genkit) ──────────────────────────
npm run genkit:dev       # Genkit developer UI
npm run genkit:watch     # Genkit with file watching
npm run ai:dev           # Standalone AI service

# ── Code quality ──────────────────────────────────────
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking (run before every commit)
npm run preflight        # typecheck + lint combined
npm run smoke            # Smoke tests
```

### Full Dev Setup (two terminals)

```bash
# Terminal 1 – frontend
npm run dev

# Terminal 2 – backend
cd server && npm run dev
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
# Required – Google AI (Gemini)
GOOGLE_API_KEY=your_gemini_api_key

# Optional – switch AI provider (default: gemini)
AI_PROVIDER=gemini          # or: openai
OPENAI_API_KEY=              # required when AI_PROVIDER=openai

# Optional – legacy Genkit server URL
GENKIT_API_URL=http://127.0.0.1:3400
```

Backend environment (`server/.env`):

```env
PORT=4000
JWT_SECRET=your_jwt_secret
DATABASE_URL=file:./prisma/dev.db
GOOGLE_API_KEY=your_gemini_api_key
```

---

## AI Integration

### Call Chain

```
Frontend component
  → Server Action in src/app/actions.ts
  → POST /api/ai/* on Express backend (with JWT)
  → server/src/services/ai-service.ts
  → src/ai/llm.ts (provider router)
      ├── src/ai/gemini.ts  →  Gemini 2.5 Flash
      └── src/ai/openai.ts  →  GPT-4o-mini
```

### AI Flows (`src/ai/flows/`)

| File | Purpose |
|------|---------|
| `extract-word-and-define.ts` | Extract words from image + generate definitions |
| `analyze-image.ts` | Smart image analysis (words or sentences) |
| `define-captured-word.ts` | Define a single captured word with enrichment |
| `define-term-auto.ts` | Auto-detect part of speech, return 1–6 definitions |
| `define-words-batch.ts` | Batch word definition |
| `analyze-sentence.ts` | Identify candidate new words in a sentence |
| `generate-practice.ts` | Generate MCQ / fill-in-blank / reorder exercises |
| `generate-story.ts` | Generate English story using user's vocabulary |
| `review-essay.ts` | IELTS Task 2 essay review (4-dimension scoring) |
| `study-article.ts` | Deep article analysis (structure / syntax / vocab) |
| `speaking-chat.ts` | AI speaking practice with feedback |
| `generate-quiz.ts` | *(Deprecated – use `generate-practice.ts` instead)* |

### `llm.ts` Key Utilities

- **`generateText()`** – Raw text generation (supports image input)
- **`generateJson<T>()`** – JSON generation + Zod validation + auto-repair retry (max 1 retry)
- **`getAiProvider()`** – Selects Gemini or OpenAI based on `AI_PROVIDER` env or available API keys

### AI Caching (`src/lib/ai-cache.ts`)

Practice and story results are cached in `localStorage`:
- Key: FNV-1a hash of input parameters
- TTL: 14 days (image extraction: 7 days)
- Eviction: LRU when storage limit approached

---

## Data Flow

### Word Capture
1. User inputs text or uploads photo in `WordCaptureForm`
2. `extractWordAndDefineAction` (Server Action) calls backend `/api/ai/extract`
3. Backend AI service runs `extract-word-and-define` flow
4. Extracted words returned with definitions + enrichment
5. Words saved to SQLite via `POST /api/words`
6. `WordReviewList` renders the word book from backend

### Word Data Shape (`CapturedWord` in `src/lib/types.ts`)

```typescript
{
  id, word, partOfSpeech, definition,   // core fields
  enrichment: {
    collocations, synonyms, antonyms,
    exampleSentences, cefrLevel,         // enrichment fields
    // ...
  },
  groupId, isMastered, capturedAt, photoData
}
```

---

## Database Schema

Managed by Prisma (`server/prisma/schema.prisma`):

```
User       id · email · passwordHash · createdAt
  ├── Word[]          id · word · partOfSpeech · definition · enrichment(JSON)
  │                   groupId · isMastered · capturedAt · photoData
  ├── Group[]         id · name · order · userId
  └── LearningStats?  xp · level · streak · unlockedBadges · …
```

---

## API Routes (Backend)

Base URL: `http://localhost:4000`

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | Login, returns JWT |
| `/api/auth/me` | GET | Current user info |
| `/api/words` | GET / POST / PUT / DELETE | Word CRUD |
| `/api/words/batch` | POST | Batch create words |
| `/api/words/batch-delete` | POST | Batch delete words |
| `/api/groups` | GET / POST / PUT / DELETE | Group CRUD |
| `/api/groups/reorder` | POST | Reorder groups |
| `/api/ai/define` | POST | Define a word |
| `/api/ai/extract` | POST | Extract words from image |
| `/api/ai/practice` | POST | Generate practice exercises |
| `/api/ai/story` | POST | Generate vocabulary story |
| `/api/ai/review-essay` | POST | IELTS essay review |
| `/api/ai/study-article` | POST | Deep article analysis |
| `/api/ai/speaking-chat` | POST | Speaking practice chat |
| `/api/user-stats/*` | GET / POST | Learning stats and goals |

---

## Frontend Views (SPA)

All views live in `src/app/page.tsx` with client-side view switching:

| View Key | Component | Description |
|----------|-----------|-------------|
| `capture` | `WordCaptureForm` | Add words (manual / photo / image upload) |
| `review` | `WordReviewList` | Word book (groups / mastery / batch ops) |
| `practice` | `PracticeView` | AI-generated exercises |
| `story` | `StoryView` | AI vocabulary story |
| `essay` | `EssayReviewView` | IELTS essay review |
| `article` | `ArticleReadingView` | Deep article analysis |
| `speaking` | `SpeakingTrainingView` | AI speaking practice |

---

## Component Patterns

- **UI layer**: shadcn/ui (35 components) built on Radix UI primitives with Tailwind
- **Feature components**: own their business logic and local state
- **Server Actions** (`src/app/actions.ts`): sole bridge between frontend and backend AI; all carry JWT via httpOnly cookie
- **Types**: all Zod schemas centralized in `src/lib/types.ts`; infer TypeScript types from schemas
- **API hooks**: `src/lib/api-hooks.ts` exports `useWords`, `useGroups`, `useWordMutations`, `useGroupMutations`

### Mobile-specific Components

Eight `mobile-*` components handle mobile UX: bottom navigation bar, search overlay, word selector, batch action bar, etc.

---

## Gamification System (`src/lib/gamification.ts`)

| Action | XP |
|--------|----|
| First daily activity | +10 |
| New word captured | +5 |
| Practice session completed | +30 base + 2 per correct answer |
| Story generated | +20 |
| Word marked as mastered | +10 |

**Level formula**: Level N requires `100 × N × (N−1) / 2` total XP (arithmetic series).

**Badges**: `streak_3`, `streak_7`, `streak_14` (consecutive days); `mastered_10`, `mastered_100` (vocabulary size).

---

## Development Guidelines

1. **TypeScript strict mode** — always run `npm run typecheck` before committing
2. **Zod schemas first** — define/update schemas in `src/lib/types.ts` before writing AI flow code
3. **AI flow changes** — update flow in `src/ai/flows/`, verify schema alignment, update Server Action in `src/app/actions.ts`, test end-to-end
4. **No direct AI calls from frontend** — all AI requests must go through Server Actions → backend
5. **Cache AI results** — use `src/lib/ai-cache.ts` for expensive AI calls to avoid redundant requests
6. **Global task lock** — respect `globalTask` state in `page.tsx` to prevent concurrent AI requests
