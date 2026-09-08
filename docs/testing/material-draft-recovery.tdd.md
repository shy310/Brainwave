# Material draft recovery

## User journey and scope

Topics, pasted text, and transcripts survive closing the material form and refreshing the same tab. Drafts use sessionStorage keys scoped to the current local profile; they are not uploaded or shared across profiles. Files and extracted file contents are not cached. A successful text/topic study-set generation clears its draft.

## Test-first evidence

- RED checkpoint `2ddc4bd`: the new browser test failed after close/reload because the text form and its title were gone.
- GREEN checkpoint `f905053`: the browser journey passed after implementation, including clearing after successful creation.
- Additional regression covers blocked storage: warning appears and typed input remains.
- Unit tests cover profile isolation, missing/malformed/oversized data, clearing one profile without affecting another, and unavailable storage.

## Verification

- `npm run build`, `npm run typecheck`, and `npm run test:study` pass.
- c8 source-mapped coverage for `services/materialDraft.ts`: 100% statements, branches, functions, and lines. This is module coverage, not whole-app coverage.
- Draft messages exist in English, Russian, Hebrew, and Arabic.
- No dependencies, remote storage, authentication, or production deployment settings changed.
- Existing dependency advisories and absent lint script remain unchanged; this pass is not a comprehensive security audit.

## Limitations

Draft recovery is tab-local, not durable cross-device storage. Browser session restoration behavior varies. Clearing browser data removes drafts. If storage is blocked/full, the learner is explicitly asked to copy their text before leaving. File selection and OCR review still require re-selection after refresh.
