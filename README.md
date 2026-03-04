# BrainWave — Personal Learning System

An AI-powered tutoring platform for students from Kindergarten through College. Multilingual, adaptive, and packed with interactive learning tools.

**Live:** [brainwave.up.railway.app](https://brainwave.up.railway.app)

---

## Features

- **AI Tutor** — Adaptive lessons and Socratic exercises powered by Groq (Llama 3.3 70B)
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
| AI | Groq API (`llama-3.3-70b-versatile` / `llama-3.2-90b-vision-preview`) |
| Backend | Express.js proxy + user data persistence (`data/users.json`) |
| Charts | Recharts |
| Math | KaTeX |
| Code editor | Monaco Editor |
| Deployment | Railway (Node 20, auto-deploy from `main`) |

---

## Local Development

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with your Groq API key:
   ```
   GROQ_API_KEY=gsk_...
   ```
   Get a free key at [console.groq.com](https://console.groq.com).

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

## Deployment (Railway)

1. Push to the `main` branch — Railway auto-deploys.
2. Set `GROQ_API_KEY` in Railway → your project → **Variables**.
3. The server builds the frontend (`npm run build`) and serves `dist/` + `/api/*` from a single Node process.

No separate database or service is needed.

---

## Project Structure

```
├── App.tsx                  # Root state, routing, session handlers
├── server.js                # Express: /api/claude proxy, /api/user persistence
├── types.ts                 # All TypeScript interfaces and enums
├── constants.ts             # Translations, curriculum tree, AI prompts
├── services/
│   └── aiService.ts         # All Groq API calls (lessons, quizzes, evaluation)
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
├── railway.toml             # Railway build/deploy config
└── nixpacks.toml            # Node 20 + npm ci
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key — set in Railway Variables for production, `.env.local` for local dev |
| `PORT` | No | Server port (Railway sets this automatically; defaults to `3000`) |
| `VITE_API_URL` | No | Override API base URL (for Capacitor/mobile builds) |
