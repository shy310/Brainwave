---
version: 1
slug: "src-features-auth-signinpage-tsx"
primary_target: "src/features/auth/SignInPage.tsx"
related_targets: ["src/app/AppShell.tsx"]
---

# Surface brief: BrainWave app and its signed-out landing (/signin)

Scope: the whole product's visual world (Operate/Read screens) and the signed-out landing at /signin (Persuade). Audience: students of every age, four languages, RTL included. Job: open BrainWave and know the next study step at once; on the landing, understand what BrainWave turns your lectures into and start (Try BrainWave / sign in). Constraints: preserve every feature, route and string; WCAG 2.2 AA; reduced motion; no invented proof.

## Direction contract

THESIS: BrainWave is a study partner with a mind of its own: a small blue brain with wavy arms and the brainwave line it draws are the living signature of every screen. It refuses the SaaS card kit (grey-blue ground, identical white cards, one soft shadow, blue as the only colour).

OWN-WORLD: Periwinkle ground #F6F8FF, Signature Blue #3268F5 owning whole regions (landing field, home hero, primary actions), Midnight Navy #172344 ink. Accent roles, never all at once: Creative Purple #9560EC (discovery, AI), Mint #32CBA0 (success, mastery), Sunshine #FFD35A (achievements, highlights), Coral #FF826F (playful accents, gentle mistakes). Subject identities: Math blue/purple, Science mint, Geography teal, History amber, Coding purple, Economics navy/gold. Tactile buttons with a darker bottom lip that compresses on press. Radii by hierarchy (12 control, 20 card, 32 hero field). The brainwave stroke (one rounded sine line) as divider, progress, loader. Bricolage Grotesque display, Rubik text. Lucide line icons at 1.75 stroke.

STORY: The visitor sees the mascot holding a lecture that becomes notes, a quiz card, flashcards and a podcast along one brainwave; reads what BrainWave does in plain words; taps Try BrainWave or signs in. Signed in, the mascot greets them and one clear next step leads the page.

FIRST VIEWPORT: Landing: a Signature Blue field fills the top. Desktop: headline and two actions on the start side; the mascot on the end side with five real study artifacts (a notes card, a quiz question, a flashcard, a podcast waveform, a formula) orbiting it, linked by a drawn brainwave. Mobile: mascot and artifacts first, headline, both actions above the fold.

FORM: seed: none (pinned) — "The central artistic direction should be called Playful Intelligence… Brainwave's blue brain mascot with expressive, wavy arms… The hero could feature an original interactive visual composition involving the Brainwave mascot, floating learning-related objects, small subject illustrations and animated brainwave patterns." Signature interaction: a pressed primary button sends a brainwave pulse; the mascot reacts at real moments (greets, thinks while AI works, celebrates a finished quiz, encourages after a mistake).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
