# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(A responsive web app, also wrapped for Android with Capacitor; the design language is the web's.)

## Users

Students of all ages in roughly equal measure: primary and middle school, high school, and university. They study alone on phones, tablets and laptops — in class (recording a lecture), at home (reviewing notes, practising), and the night before an exam. They work in English, Hebrew, Arabic and Russian; Hebrew and Arabic read right to left. Grade is set during onboarding and kept in the profile.

## Product Purpose

BrainWave makes studying easier, more enjoyable and more memorable. It turns what a student already has — a lecture they recorded, a YouTube video, a document, a syllabus — into study material (notes, quizzes, flashcards, cheat sheets, concept maps, podcasts, video lessons), and gives them an AI tutor and a K–college curriculum to learn from. Success is a student who understands the material and does well on the exam, not one who spends the most time in the app.

## Positioning

One place that goes from "I sat in this lecture" to "I'm ready for the exam": record → notes → quiz, flashcards and spaced review → exam plan, predicted exam and mock exam. Maths answers are checked in code, not trusted to the model. Everything works in four languages including right-to-left, with right-to-left exports.

## Operating Context

- Recording live in a lecture hall (screen stays on, marks "Important" moments), or uploading audio, a YouTube link, a document or a web link afterwards.
- Reading and highlighting notes; asking the AI about a selection; editing notes with AI.
- Quizzes, flashcards (spaced repetition), games with questions (Glide, Lane Rush), weak-spot practice, exams with a day-by-day plan, a calendar fed by a syllabus.
- Podcasts and narrated video lessons; Talk mode (voice conversation with the tutor).
- Study groups with shared notes and challenges.
- Demo mode ("Try BrainWave") works without an account; real accounts use Supabase.

## Capabilities and Constraints

- React 19, TypeScript, Vite, Tailwind v4, React Router 7; Express API on Vercel; Supabase (auth, Postgres with RLS); OpenRouter for AI.
- Every UI string in en, he, ar, ru; layouts must work in RTL.
- Accessibility: reduced motion, reduced transparency and increased contrast are honoured; keyboard and screen readers work; Playwright a11y checks run in CI.
- No subscriptions or paywalls. No fabricated users, ratings, testimonials or outcomes.
- Existing routes, data, AI operations and tests must keep working.

## Brand Commitments

- Name: BrainWave. Logo: a blue rounded-square app icon with a waveform and a small accent dot (`src/ui/Logo.tsx`, `public/favicon.svg`).
- Blue is the primary brand colour.
- Creative direction "Playful Intelligence" (pinned by the owner): playful but not childish, colourful but not chaotic, animated but not distracting, professional but not boring. Suitable for every age at once.
- A blue brain mascot with expressive, wavy arms is to be created, consistent with the logo; it appears at chosen moments only.

## Evidence on Hand

Real product screens and real AI output only. There are no testimonials, user counts, ratings or outcome statistics — none may be invented.

## Product Principles

1. The student's next step is always obvious.
2. Learning content stays calm and readable; delight lives around it, not inside it.
3. Mistakes are part of learning: feedback is clear and kind, never punishing.
4. Encourage learning, not screen time: no anxiety mechanics or artificial urgency.
5. Every language is first-class, right-to-left included.

## Accessibility & Inclusion

WCAG 2.2 AA. Never rely on colour alone for right/wrong. Honour prefers-reduced-motion, -transparency and -contrast.
