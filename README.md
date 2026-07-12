# BrainWave — Personal Learning System

An AI-powered tutoring platform for students from Kindergarten through College. Multilingual, adaptive, and packed with interactive learning tools.

**Live:** deployed on [Vercel](https://vercel.com) (project `brainwave`)

---

## Features

- **AI Tutor** — Adaptive lessons and Socratic exercises powered by OpenRouter (Gemini 2.5 Flash)
- **Curriculum** — 24 courses across Math, Science, Language, History, Coding, and Economics
- **Progress Tracking** — Per-topic mastery via exponential moving average, XP, streaks, and level-ups
- **Upload & Learn** — Analyze uploaded documents (images, text) and generate custom quizzes
- **Presentation Generator** — AI-generated slide decks with speaker notes, keyboard navigation, and print/PDF export
- **Code Lab** — In-browser code editor (Monaco) with live execution via Piston API; supports Python, JavaScript, Java, C++
- **Educational Games** — Balloon Pop, Math Rush, Memory Match, Bug Fix, Cave Runner, Picture Tap, Word Scramble
- **Debate Arena** — Argue a position against an AI opponent with per-round scoring
- **Story Engine** — Collaborative AI storytelling with creativity and vocabulary evaluation
- **SQL Detective** — Solve mysteries by writing real SQL queries against a live in-browser database
- **Multilingual** — English, Russian, Hebrew (RTL), Arabic (RTL)
- **Dark mode** — System-aware with manual toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS + custom CSS animations |
| AI | OpenRouter API (`google/gemini-2.5-flash`, multimodal; `openai/gpt-4o-mini` rate-limit fallback) |
| Backend | Express.js proxy + user data persistence (`data/users.json`) |
| Charts | Recharts |
| Math | KaTeX |
| Code editor | Monaco Editor |
| Deployment | Vercel (static `dist/` + serverless `api/index.js`, auto-deploy from `main`) |

---

## Local Development

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
   Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

3. Start both the Vite dev server and Express backend:
   ```bash
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

4. TypeScript check:
   ```bash
   npx tsc --noEmit
   ```

---

## Deployment (Vercel)

1. Push to the `main` branch — Vercel auto-deploys production; every other branch gets a preview URL.
2. Set `OPENROUTER_API_KEY` in Vercel → Project → **Settings → Environment Variables**.
3. Vercel serves the built frontend (`dist/`) statically and routes `/api/*` to the serverless Express app in `api/index.js` (see `vercel.json`).

> **Note:** user data on Vercel is stored in the serverless function's ephemeral `/tmp`, so server-side progress sync and the leaderboard reset whenever the function recycles. Per-device progress still persists in the browser via localStorage. For durable cross-device data, wire `api/index.js` to a store like Vercel KV or Postgres.

---

## Project Structure

```
├── App.tsx                  # Root state, routing, session handlers
├── server.js                # Express server for local dev (OpenRouter proxy + user data)
├── api/index.js             # Vercel serverless Express app (same API, production)
├── types.ts                 # All TypeScript interfaces and enums
├── constants.ts             # Translations, curriculum tree, AI prompts
├── services/
│   └── aiService.ts         # All AI calls (lessons, quizzes, evaluation)
├── components/
│   ├── AuthView.tsx          # Login / register (local, SHA-256 hashed passwords)
│   ├── Dashboard.tsx
│   ├── LessonView.tsx        # AI lesson + upload analysis
│   ├── ExercisePanel.tsx     # MC, short answer, fill-in-blank, multi-step
│   ├── ProgressDashboard.tsx # Radar + bar charts
│   ├── PresentationView.tsx  # Slide deck generator with fullscreen + print
│   ├── CodeLab.tsx           # Monaco editor + Piston execution
│   ├── EducationalGames.tsx  # All 7 games
│   ├── DebateArena.tsx
│   ├── StoryEngine.tsx
│   ├── SqlDetective.tsx
│   └── FloatingChat.tsx      # Persistent AI tutor chat
├── index.css                # Global styles + custom keyframe animations
└── vercel.json              # Vercel build/routing config
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key — set in Vercel Environment Variables for production, `.env.local` for local dev |
| `OPENROUTER_MODEL` | No | Override the text model (default `google/gemini-2.5-flash`) |
| `OPENROUTER_VISION_MODEL` | No | Override the vision model (default `google/gemini-2.5-flash`) |
| `OPENROUTER_FALLBACK_MODEL` | No | Model used automatically when the main model is rate-limited (default `openai/gpt-4o-mini`; set empty to disable) |
| `PORT` | No | Local dev server port (defaults to `3000`) |
| `VITE_API_URL` | No | Override API base URL (for Capacitor/mobile builds) |
