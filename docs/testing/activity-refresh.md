# Activity refresh — first pass

- Removed the seven-card tool grid from Practice and Library. Preserved tool access in a collapsed Library menu; no saved data deleted.
- Shared localized headers for games, code, debate, stories, presentations and SQL. Explicit RTL direction and labeled Back buttons.
- Shorter Today copy in all four languages; localized story genres, length labels and optional writing focus.
- Reduced story contribution minimums: middle school 40 words, high school 60, college 80. Younger grades unchanged. This reduces the entry barrier without removing learner writing.
- Shared language-specific response guidance for study generation, tutoring and answer feedback. Regeneration retains the set language.

## Verification

18 browser tests passed, including six activity entry pages in each of four languages at 390px, no horizontal overflow, and return navigation. Four activity checks rerun after story changes. Inspected a Hebrew phone screenshot and removed duplicate chapter/optional labels found there. TypeScript, study tests, existing learning tests and build passed before final copy cleanup.

ECC Frontend Design Direction, React Patterns and the repository frontend-design skill guided shared tokens, scannable copy and native controls.

## Still outside this pass

This is not a full rebuild of every legacy activity. In-game screens, SQL result copy, advanced settings and legacy AI prompt paths still need individual review. No live-provider or native-speaker assessment establishes translation quality yet. Existing dependency advisories and large build chunk warning remain. Production is not changed.
