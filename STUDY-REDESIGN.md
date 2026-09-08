# Brainwave study redesign

## Experience

Today, Library, Practice, and Progress replace the crowded primary navigation. Study sets connect reviewed sources, editable notes, flashcards, validated questions, tutor conversations, and saved Study Sprints. Sprints offer 5-, 10-, and 15-minute estimates, not countdowns. Existing creative tools remain available through Library and Practice.

The new interface supports English, Russian, Hebrew, and Arabic, including RTL, dark mode, reduced motion, and phone layouts. Younger grades default to five minutes and receive age-adapted generation prompts.

Tailwind is compiled locally with PostCSS instead of loading a runtime CDN script. This removes a network dependency from layout and styling; optional web fonts retain system fallbacks.

## Learning and data

- Due reviews and weak skills influence recommendations. Previously attempted questions rotate behind less-recent questions.
- Hints and revealed solutions are recorded. Revealed solutions do not update mastery; assisted answers do not count as independent success days. Teach-back assessment is coaching, not proof of mastery.
- Activity IDs prevent duplicate rewards when sessions are replayed after reload. Study results are saved before they update the existing profile's mastery/reward engines.
- IndexedDB database `brainwave-study-v1` stores one library per local profile. Shared legacy notes require explicit selection for import; originals remain untouched.
- PDFs are extracted locally with real page numbers. Sparse/scanned pages and photos use the existing multimodal API, followed by a review step. Limits are 12 MB and 20 PDF pages.
- Uploaded-source generation requires reviewed extracted text. Page references are checked against the extracted source; this validates reference existence, not semantic truth. Learners should inspect AI-generated content.
- Topics are labeled separately. Videos require pasted transcripts; URLs alone cannot generate purported video summaries.
- Failed extraction, malformed generation, and failed device saves have recovery paths. Device-save errors retain the in-memory library and provide retry; clearing browser data still removes local study sets.

## Run and verify

```sh
npm ci
npm run typecheck
npm test
npm run test:study
npm run build
npm run dev:all
```

For repeatable browser tests, start Vite on port 5173, then run:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite mocks API responses and covers material-to-recap flow, contextual help, saved-session recovery, duplicate reward prevention, four-language phone/dark layouts, rejected video URLs, generation failure, PDF/photo review, and quota-error recovery. Unit tests cover adaptive selection, validation, assisted/independent evidence, profile isolation, and opt-in migration.

## Release checks still required

- Live OpenRouter smoke test with preview credentials; no provider credentials were available locally.
- Android device/emulator smoke test after `npx cap sync android`. The Vite build and responsive browser tests do not substitute for a native-wrapper test.
- Human screen-reader and multilingual copy review; browser checks cover labels/navigation/layout, not a full assistive-technology audit.
- Existing dependency audit findings and the large legacy main bundle remain separate release risks; no forced dependency upgrades or authentication/cloud-storage redesign are included.
- Comparative usability testing before claiming improved completion, recall, or superiority over another app.

Deploy this branch to a preview only. Do not promote to production until the above release checks and user review are complete.
