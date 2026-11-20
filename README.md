# BrainWave

An AI study partner for students from kindergarten to college, in **English and Hebrew**.

- **Learn** — courses K–college, short interactive lessons, quizzes whose math is checked by code, and an AI tutor (*Tutor me*, *Explain* or *Custom*).
- **Lectures** — record or upload a class and get a transcript, notes, a quiz and flashcards.
- **Video lessons** — any topic or lecture as a short animated, narrated lesson.
- **Podcasts** — two hosts talk through any topic.

> **Status:** v2 is being rebuilt from scratch in phases. Done: the foundation (app shell, design
> system, English/Hebrew, accounts, secure AI gateway), **Learn** (42 courses / 180 topics,
> lessons, quizzes, AI tutor, progress) and **Lectures** (record / upload / paste → transcript,
> notes, quiz, flashcards, lecture Q&A) and **Video lessons** (animated, narrated scenes from any topic,
> lecture or request, with "ask about this moment") and **Podcasts** (two hosts, highlighted transcript,
> chapters, tap a line to ask).

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
   (`0001_foundation.sql` … `0005_tts.sql`). Each one is safe to re-run.
3. **Authentication → URL Configuration**: set the Site URL to your Vercel URL and add
   `http://localhost:5173` to the redirect URLs.
4. Optional — **Authentication → Providers → Google**: enable it and add your Google OAuth client.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local development. On Vercel, add the same variables in
**Project → Settings → Environment Variables**:

| Variable | Where | What |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Publishable key (`sb_publishable_…`) or legacy anon key |
| `SUPABASE_URL` | server | Same project URL |
| `SUPABASE_ANON_KEY` | server | Same publishable key (used to verify sign-ins) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Secret key (`sb_secret_…`) or legacy service_role key (quota tracking) — **never** prefix with `VITE_` |
| `OPENROUTER_API_KEY` | server | Your OpenRouter key |
| `OPENROUTER_MODEL` | server | Optional, defaults to `google/gemini-2.5-flash` |
| `VITE_PUBLIC_URL` | browser | Optional public web address (e.g. `https://brainwave.app`), used for share links made in the Android app. The web app uses its own address. |
| `TRANSCRIBE_MODE` | server | Optional. `llm` (default) transcribes lectures with the chat model. `stt` uses a dedicated speech-to-text model and falls back to `llm` if it fails. |
| `TRANSCRIBE_MODEL` | server | Optional speech-to-text model for `stt` mode (default `openai/gpt-4o-mini-transcribe`). Choose it with `scripts/eval-transcription.ts` (see `eval/transcription/README.md`). |
| `TRANSCRIBE_CLEANUP` | server | Optional. `true` runs the LLM cleanup (fillers, math as LaTeX) on the speech-to-text **text** afterwards. |
| `AI_DAILY_LIMIT`, `AI_PER_MINUTE_LIMIT` | server | Optional per-student limits (defaults 200 / 20) |
| `TTS_PROVIDER` | server | Optional. Natural voices for videos and podcasts come from OpenRouter (same `OPENROUTER_API_KEY`) unless Azure is set up. `off` uses the device's built-in voice; `openrouter` or `azure` forces one. |
| `TTS_MODEL`, `TTS_VOICES` | server | Optional OpenRouter voice model (default `elevenlabs/eleven-v4-turbo`; it must speak Hebrew) and its two voices, narrator first (default `sarah,brian`). |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | server | Optional: natural voices from Azure AI Speech instead (free F0 tier works). |
| `TTS_DAILY_CHARS` | server | Optional per-student daily narration limit in characters (default 60000) |

Without the Supabase variables the app runs in **demo mode** locally (progress saved in the
browser). Demo mode is disabled in production, so the AI can never be used anonymously on the live site.

### 3. Run locally

```bash
npm install
npm run dev:all        # web on :5173, API on :3000
```

## Android app

The Android app (`android/`, Capacitor, app id `com.brainwave.app`) wraps the same web build and uses the
same backend and Supabase accounts, so lectures recorded on the phone show up on the web and the other way round.
Lectures are recorded by a native **foreground service** (type `microphone`, with a "Recording lecture"
notification), so recording keeps going with the screen off. Pieces are written to app storage and moved
into the same recovery queue as the web recorder.

```bash
# Point the app at the deployed backend, then build a debug APK (needs the Android SDK; set sdk.dir in android/local.properties)
VITE_API_URL=https://your-deployment.vercel.app npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

The server allows the app's WebView origin (`https://localhost`) by default. Change it with `CORS_ORIGINS`
(comma-separated). Email sign-in works in the app. Google sign-in in the app still needs a deep-link redirect (not set up yet).

## How Learn works

- **Curriculum** — `shared/curriculumData.ts`: 6 subjects × 7 levels (K → college), every title in English and Hebrew.
- **AI operations** — `server/ai/ops/learn.ts` (`lesson`, `quiz`, `practice`, `steps`, `grade`) and `server/ai/ops/tutor.ts` (streaming chat with *Tutor me* / *Explain* / *Custom* modes and image/PDF attachments).
- **Correct answers are checked by code, not the AI** — `shared/math/check.ts` compares answers exactly (½ = 0.5 = 50%, 5 cm = 0.05 m), and `shared/math/validate.ts` verifies every generated question before a student sees it, fixing or dropping wrong ones. The AI grader is only used for worded answers.
- **Progress** — the `topic_progress` table (or the browser in demo mode). A topic is *mastered* at 80% on a quiz.
- Lessons are cached in the browser, so reopening a topic doesn't use AI budget.

## How Lectures work

- **Audio never leaves the browser as a file.** It is decoded (uploads) or captured (live recording,
  via an AudioWorklet) as 16 kHz mono, cut into one-minute WAV pieces (~2.6 MB as base64) and sent to
  the `transcribe` operation, three at a time with retries. Silent minutes are skipped.
- Live recordings are transcribed while you record; progress is saved after every minute.
- Slides (PDF ≤ 2 MB) are read once by `slidesText` and stored as text with the lecture.
- `lectureNotes`, `lectureQuiz` and `flashcards` work from the transcript (+ slides); results are saved in
  the `lectures` table, so reopening a lecture costs no AI budget. The tutor's *Ask* tab is grounded in the lecture.
- YouTube: paste the video's transcript ("Show transcript" under the video).

## How Video lessons work

- `videoScript` writes 5–12 scenes. Each scene is one visual — title, bullets, equation, steps, graph,
  flow or summary — plus spoken narration. Graph functions are checked by `shared/math/plot.ts`
  (plain math in `x` only) and any scene that can't be drawn falls back to a simpler visual.
- The browser draws scenes with React, KaTeX and SVG, and narrates with the device's built-in voices
  (Web Speech API — free). Without a voice for the language, the lesson plays with timed captions.
- Videos are saved in the `media` table (podcasts will share it). "Ask about this moment" sends the
  paused scene and the script to the tutor.

## How Podcasts work

- `podcastScript` writes a two-host conversation (curious host + expert) in chapters, for speech:
  no Markdown or LaTeX (anything left over is stripped by `sanitizePodcast`).
- The player uses two of the device's voices when available, otherwise one voice at two pitches,
  highlights and follows the current line, and supports chapters, skipping, speed and headphone /
  lock-screen controls (Media Session API). Any line can be played from or asked about.
- Episodes are saved in the `media` table. The script can be downloaded as text, and as MP3 when
  natural voices are set up.

## Natural voices (optional)

Videos and podcasts are narrated by natural voices through `POST /api/tts`. By default these come
from OpenRouter's text-to-speech with the same `OPENROUTER_API_KEY` (ElevenLabs voices that speak
English and Hebrew; see `TTS_MODEL` / `TTS_VOICES`). With `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`
set, Azure neural voices are used instead (Ava/Andrew in English, Hila/Avri in Hebrew). Either way: signed-in only, a fixed
list of voices, at most 1,500 characters per request, and a per-student daily character allowance
(`consume_tts`, migration 0005). The browser prefetches the next sentences and keeps audio in Cache
Storage, so replays are free. If the service is missing or a sentence fails, that sentence is read by
the device's voice instead; with no credit or the daily allowance used, device voices are used for the visit.

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
