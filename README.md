# BrainWave

An AI study partner for students from kindergarten to college, in **English and Hebrew**.

- **Learn** — courses K–college, short interactive lessons, quizzes whose math is checked by code, and an AI tutor (*Tutor me*, *Explain* or *Custom*).
- **Lectures** — record or upload a class and get a transcript, notes, a quiz and flashcards.
- **Video lessons** — any topic or lecture as a short animated, narrated lesson.
- **Podcasts** — two hosts talk through any topic.

> **Status:** v2 is being rebuilt from scratch in phases. Done: the foundation (app shell, design
> system, English/Hebrew, accounts, secure AI gateway) and **Learn** (42 courses / 180 topics,
> lessons, quizzes, AI tutor, progress). Lectures, Video lessons and Podcasts come next.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7 |
| Accounts & data | Supabase (Auth, Postgres with row-level security, Storage) |
| AI | OpenRouter (`google/gemini-2.5-flash`) behind a server-side gateway |
| Server | One Express app (`server/`), deployed as a single Vercel function (`api/index.ts`) |
| Tests | Vitest (unit), Playwright (end-to-end, desktop + mobile) |

## Security model

- The browser never sees the OpenRouter key or any server secret.
- Every AI request must carry a valid Supabase sign-in; the server verifies it.
- Each student has a daily AI budget and a per-minute rate limit, enforced in Postgres.
- Prompts live on the server. The browser can only call named operations with validated inputs.
- Database tables use row-level security: students can only read and write their own rows.

## Setup

### 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run each file in `supabase/migrations/` in order
   (`0001_foundation.sql`, then `0002_learning.sql`). Each one is safe to re-run.
3. **Authentication → URL Configuration**: set the Site URL to your Vercel URL and add
   `http://localhost:5173` to the redirect URLs.
4. Optional — **Authentication → Providers → Google**: enable it and add your Google OAuth client.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local development. On Vercel, add the same variables in
**Project → Settings → Environment Variables**:

| Variable | Where | What |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Supabase anon (public) key |
| `SUPABASE_URL` | server | Same project URL |
| `SUPABASE_ANON_KEY` | server | Same anon key (used to verify sign-ins) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Service-role key (quota tracking) — **never** prefix with `VITE_` |
| `OPENROUTER_API_KEY` | server | Your OpenRouter key |
| `OPENROUTER_MODEL` | server | Optional, defaults to `google/gemini-2.5-flash` |
| `AI_DAILY_LIMIT`, `AI_PER_MINUTE_LIMIT` | server | Optional per-student limits (defaults 200 / 20) |

Without the Supabase variables the app runs in **demo mode** locally (progress saved in the
browser). Demo mode is disabled in production, so the AI can never be used anonymously on the live site.

### 3. Run locally

```bash
npm install
npm run dev:all        # web on :5173, API on :3000
```

## How Learn works

- **Curriculum** — `shared/curriculumData.ts`: 6 subjects × 7 levels (K → college), every title in English and Hebrew.
- **AI operations** — `server/ai/ops/learn.ts` (`lesson`, `quiz`, `practice`, `steps`, `grade`) and `server/ai/ops/tutor.ts` (streaming chat with *Tutor me* / *Explain* / *Custom* modes and image/PDF attachments).
- **Correct answers are checked by code, not the AI** — `shared/math/check.ts` compares answers exactly (½ = 0.5 = 50%, 5 cm = 0.05 m), and `shared/math/validate.ts` verifies every generated question before a student sees it, fixing or dropping wrong ones. The AI grader is only used for worded answers.
- **Progress** — the `topic_progress` table (or the browser in demo mode). A topic is *mastered* at 80% on a quiz.
- Lessons are cached in the browser, so reopening a topic doesn't use AI budget.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:all` | Frontend + API with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the API and the built app on :3000 |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (run `npx playwright install chromium` once first) |

## Project layout

```
src/
  app/          router, shell, providers
  features/     one folder per feature (auth, home, settings, …)
  i18n/         en.ts (source of truth) + he.ts — Hebrew must match English key-for-key
  ui/           shared components
  lib/          supabase client, API helper, utilities
shared/         types and schemas used by both browser and server
server/         Express app, auth, quotas, AI gateway (named operations)
api/index.ts    Vercel entry
supabase/       SQL migrations
tests/          unit/ and e2e/
```
