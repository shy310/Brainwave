# Explicit learning language

The material form offers English, Hebrew, Arabic and Russian independently of the interface language. Generation, study-set tutoring, sprint tutoring and AI answer feedback use the study set's language. Legacy tutor callers continue using the interface language.

ECC React Patterns guided local form state and a native, explicitly labeled select. The choice is saved with nonempty, profile-scoped tab drafts. Older drafts still load; unrecognized language values fall back without losing text. Uploads remain uncached.

## Evidence

- RED: browser test timed out because the Learning language control did not exist (commit 30a1947).
- GREEN: mocked browser test selects Hebrew, closes and reloads, confirms restoration, checks generation and tutor prompts, and confirms navigation remains English.
- Unit checks cover all four saved languages, legacy drafts and invalid language fallback.
- All 14 browser tests passed, including the complete study journey and phone navigation in all four interface languages.
- Study tests, existing learning-engine suites, TypeScript and production build passed. Existing large-chunk build warning remains.
- No live AI translation-quality claim: these checks use repeatable mocked responses and verify request language routing.
