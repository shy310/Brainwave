# ECC study reliability pass

## Scope and user journeys

This focused upgrade was selected during review, using ECC's `tdd-workflow` and `verification-loop` skills. It does not install or trust additional hooks/MCP servers.

- A topic learner should receive a valid study set on the first request when the provider omits irrelevant page-reference arrays.
- A learner uploading a source must still receive references to real supplied pages; missing, malformed, or unknown references remain invalid.
- An invalid question must not suppress a later valid replacement solely because their wording matches.

## RED → GREEN evidence

- RED: `npm run test:study` compiled and executed, then failed with `Not enough valid study activities (0 cards, 0 questions)` for the new topic fixture. Checkpoint: `9b4f556`.
- GREEN: the same command passed after normalizing absent topic-only references and tracking duplicates only after validation. Checkpoint: `bed52d9`.
- Refactor: isolated the validator in `services/studyValidation.ts`; existing imports remain compatible through the study AI service's re-export.

## Guarantees

| Behavior | Evidence |
| --- | --- |
| Omitted topic references become empty arrays | Study unit assertions |
| Uploaded-source references remain required | Study unit assertions |
| Explicit unknown or malformed topic references remain invalid | Study unit assertions |
| Invalid duplicate does not hide valid replacement | Study unit assertion |
| Hebrew-topic form completes with one mocked provider request | Browser regression test |

## Coverage

Measured with c8 over the esbuild source map: `studyValidation.ts` reports 100% statements, branches, functions, and lines. This is coverage of the isolated validator, **not** of the whole application or live AI quality.

Reproduce:

```sh
npx esbuild tests/study.test.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=node_modules/.cache/study-coverage.mjs
npx c8 --exclude-node-modules=false --exclude-after-remap --include='**/study-coverage.mjs' --include='**/studyValidation.ts' --reporter=text --reports-dir=node_modules/.cache/study-coverage node node_modules/.cache/study-coverage.mjs
```

## Release risks and next improvements

- Dependency audit still reports 13 advisories: 2 low, 4 moderate, 4 high, 3 critical. This pass changes no dependencies. Review compatible fixes separately and retest creative tools and Android builds.
- No lint script is configured; do not report lint as passed.
- Narrow credential-pattern scan found no matching `sk-` token strings in application source; this is not a complete security audit.
- The production build retains the existing large-bundle warning.
- Browser tests mock AI to avoid consuming the account's limited credits. No paid-provider calls were made for this pass.
- Highest-value next UX work: recover material-form drafts after refresh, make learning-language selection clearer, and show request/credit recovery guidance consistently across all tools.

Keep the RED/GREEN evidence if the review branch is squash-merged. Production promotion requires separate review.
