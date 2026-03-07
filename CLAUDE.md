# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LexiCapture is a Next.js application for capturing and defining English words from photos using AI. It uses Google's Gemini AI through Firebase Genkit for word extraction and definition generation.

## Development Commands

```bash
# Development server
npm run dev                    # Start Next.js dev server on port 9002 with turbopack

# Genkit AI development
npm run genkit:dev            # Start Genkit developer UI
npm run genkit:watch          # Start Genkit with file watching

# Build and deployment
npm run build                 # Build for production
npm run start                 # Start production server

# Code quality
npm run lint                  # Run ESLint
npm run typecheck             # Run TypeScript type checking
```

## Architecture

### Core Structure
- **Next.js App Router**: Modern React framework with app directory structure
- **Firebase Genkit**: AI workflow orchestration for image analysis and text generation
- **Google AI (Gemini)**: Powers word extraction and Chinese definition generation
- **Radix UI + Tailwind**: Component library and styling system
- **Local Storage**: Client-side word persistence

### Key Directories
- `src/app/`: Next.js app router pages and layouts
- `src/ai/`: Genkit configuration and AI flows
- `src/ai/flows/`: Individual AI workflows for word processing
- `src/components/`: React components (UI and feature components)
- `src/components/ui/`: Reusable UI components (Radix-based)
- `src/lib/`: Shared utilities and type definitions
- `src/hooks/`: Custom React hooks

### AI Integration Architecture
The application uses a dual-server architecture:
1. **Next.js Server**: Main application server (port 9002)
2. **Genkit Server**: AI workflow server (port 3400, configurable via GENKIT_API_URL)

AI flows are defined in `src/ai/flows/` and called via HTTP from Next.js server actions in `src/app/actions.ts`.

### Data Flow
1. User uploads photo via `WordCaptureForm`
2. Photo processed by `extractWordAndDefineFlow` (Genkit)
3. Extracted words displayed in `WordReviewList`
4. Words persisted to localStorage
5. Individual word definitions can be regenerated via `defineCapturedWordFlow`

## Environment Setup

Required environment variables:
- `GOOGLE_API_KEY`: Google AI (Gemini) API key
- `GENKIT_API_URL`: Genkit server URL (defaults to http://127.0.0.1:3400)

## Development Workflow

1. Start both servers for full functionality:
   ```bash
   npm run dev          # Terminal 1: Next.js app
   npm run genkit:dev   # Terminal 2: Genkit AI server
   ```

2. The Genkit developer UI provides flow testing and debugging at the URL shown in terminal

3. Use TypeScript strict mode - always run `npm run typecheck` before commits

## Component Patterns

- UI components follow Radix UI patterns with Tailwind styling
- Feature components handle business logic and state management
- Server actions in `actions.ts` handle AI workflow communication
- Type definitions centralized in `src/lib/types.ts`

## AI Flow Development

When modifying AI flows:
1. Update flow definitions in `src/ai/flows/`
2. Ensure input/output schemas match TypeScript types
3. Test flows via Genkit developer UI before integration
4. Update corresponding server actions if schemas change