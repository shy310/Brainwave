---
name: BrainWave
description: From lecture to exam-ready. Playful Intelligence for students of every age.
colors:
  primary: "#3b5cf6"
  primary-electric: "#5e7dff"
  primary-pressed: "#2f49d6"
  primary-deep: "#263cb0"
  sky: "#e2e8ff"
  navy-ink: "#141a3c"
  periwinkle-ground: "#f5f6fb"
  surface: "#ffffff"
  surface-sunk: "#eceef8"
  line: "#dce0f0"
  muted-ink: "#545c7e"
  purple: "#8b5cf6"
  mint: "#22c997"
  mint-deep: "#0d7f5e"
  sunshine: "#ffcb45"
  coral: "#ff7468"
  coral-deep: "#c43c2a"
  night-ground: "#0c0f24"
  night-surface: "#151a36"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Rubik, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, Rubik, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Rubik, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Rubik, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Rubik, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  control: "0.875rem"
  card: "1.25rem"
  field: "2rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-pressed}"
  button-sun:
    backgroundColor: "{colors.sunshine}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "36px"
---

# Design System: BrainWave

## Overview

**Creative North Star: "Playful Intelligence" (2.0)**

2.0 keeps the blue identity, the fonts and Wave, and rebuilds how the app is held together: a sidebar with every tool, a "+ New" key on every screen, Home as today's path of real study steps, keycap tiles as the signature object, and a faint dot-grid ground like squared paper. The palette leans a little toward electric indigo with a deeper ink, fresher mint, warmer sunshine and pinker coral; every value is contrast-checked.

BrainWave is a study companion that is playful but not childish, colourful but not chaotic, animated but not distracting, and professional but not boring. It has to feel right to a nine-year-old, a high-school student and a university student at the same time. The system gets there by putting its personality around the content and not inside it. There is a confident blue field, tactile buttons that press down, Wave the brain mascot at chosen moments, one signature brainwave line, and a colour field for each subject. Learning content itself (lessons, notes, questions) stays calm, readable and quiet.

Density is comfortable: generous touch targets (44px and up), roomy cards, one clear next step per screen. Motion is short and physical. Presses sink, fields lift, and pieces settle with a soft overshoot. Everything is still under reduced motion.

**Key Characteristics:**
- Blue (#3b5cf6) is the brand; sunshine yellow is the rare highlight for the single most important call to action.
- Tactile controls: a 3px "lip" under primary buttons that the press absorbs.
- Wave the mascot reacts to the moment (waving, reading, thinking, encouraging, celebrating, confused), and is decorative to assistive tech.
- The brainwave line: the field edge, the step connector, the loader.
- Each subject owns a colour field and an illustrated scene that comes alive on hover.

## Colors

A saturated blue world on a cool periwinkle ground, with four friendly accents that each have one job.

### Primary
- **BrainWave Blue** (#3b5cf6): primary buttons, active navigation, the landing hero field, the "Next up" field, selection.
- **Electric Blue** (#5e7dff): light strokes and glows on blue fields. Never a fill behind white text (3.4:1).
- **Pressed Blue** (#2f49d6): hover on blue controls. Hovers darken, so white text keeps AA (6.4:1).
- **Deep Blue** (#263cb0): the button lip and the bottom of blue gradients.
- Brand-coloured text uses #2f49d6, which passes on every surface; #3b5cf6 passes only on pure white.
- **Sky** (#e2e8ff): the active nav pill, info tints, the lesson hook callout.

### Secondary
- **Sunshine** (#ffcb45): the one big call to action on a blue field (the landing's start button), the brainwave line on blue fields, the mascot's sparks. Text on it is navy.

### Tertiary
- **Mint** (#22c997, deep #0d7f5e): correct answers, mastery progress, key points. Marks on mint use the deep shade for contrast.
- **Coral** (#ff7468, deep #c43c2a): a wrong pick in a quiz. It is kind, never alarming red. System errors keep rose.
- **Purple** (#8b5cf6): maths and coding fields, the quiz tag, the mascot's question mark.

### Neutral
- **Navy Ink** (#141a3c): all body text and headings in light mode.
- **Muted Ink** (#545c7e): secondary text (5.9:1 on the ground).
- **Periwinkle Ground** (#f5f6fb) / **Surface** (#ffffff) / **Sunk Surface** (#eceef8) / **Line** (#dce0f0): page, cards, tracks and wells, borders.
- **Night Ground** (#0c0f24) / **Night Surface** (#151a36): dark mode. Blue fields and subject fields stay saturated in dark mode.

### Named Rules
**The Right-and-Wrong-Never-By-Colour Rule.** Mint and coral always come with a mark: a check, an X, or a letter. A correct answer the student didn't pick gets a dashed mint outline.

**The One Sun Rule.** Sunshine fills at most one control per screen.

**The Fields-Carry-White Rule.** Every coloured field that carries text (the hero, Next up, course headers) passes 4.5:1 with full-opacity white. No translucent white text on colour.

### Tool Identities
Every tool owns a hue, the way every subject does (`src/ui/tools.ts`, `TOOL_META`): an icon, a header `field`, a `soft` chip tint, a `tile` gradient for icon tiles, a `spark` for its scene and a `hue` for its ink on white. Tools that appear side by side (the study tools grid, Home's quick actions) never share a hue.

| Tool | Hue | Field |
|---|---|---|
| Learn, Lectures, Search | BrainWave Blue | #3b5cf6 → #263cb0 |
| Tutor, Settings | Deep blue / navy | #2f49d6 → #141a3c |
| Videos, Weak spots | Coral (deep) | #c2412d → #9c3222 |
| Podcasts, Concept maps | Purple | #7c45db → #522b93 |
| Review flashcards | Deep purple | #6533b8 → #3f2470 |
| Exams, Cheat sheets | Sunshine (navy ink) | #ffcb45 → #ffc52e |
| Calendar, Class schedule, Grader | Mint (deep) | #0e6f55 → #0b4637 |
| Games | Orange | #c2410c → #9a3412 |
| Study groups | Teal | #0f766e → #115e59 |

Every field passes 4.5:1 with white (sunshine fields carry navy, 9.8:1). Lecture thumbnails follow the same logic by source: recordings blue, uploads purple, documents mint, photos teal, YouTube coral.

## Typography

**Display Font:** Bricolage Grotesque (with Rubik, IBM Plex Sans Arabic)
**Body Font:** Rubik (with IBM Plex Sans Arabic for Arabic)

**Character:** Bricolage's rounded, slightly quirky grotesque gives headings a voice. Rubik keeps body text friendly and highly legible in Latin, Hebrew and Cyrillic.

### Hierarchy
- **Display** (700–800, 2.25–3.75rem, 1.05–1.1): page titles (`h1`), the landing headline, quiz scores. Letter-spacing −0.02em, optical sizing on.
- **Headline** (700, 1.5rem): card titles on fields (Next up, subject cards, feedback verdicts).
- **Title** (600, 1.125rem): section headings.
- **Body** (400, 1rem, 1.6): lessons and notes; lessons cap their measure in a single column.
- **Label** (600, 0.875rem): buttons, chips, tabs. Sentence case, never all caps.

### Named Rules
**The No-Eyebrow Rule.** No uppercase micro-labels above headings. A unit number is a coloured number badge plus the heading.

## Layout

Single column on phones with a 16px gutter. The content container is max 72rem (`max-w-6xl`) with 24px gutters from `sm`. Grids step from 1 to 2 to 3 columns (`sm`, `lg`). On phones the main navigation is a floating five-tab pill at the bottom with a round **+** beside it; from `md` it is an icon rail, and from `lg` a 256px sidebar (see App shell). Behind everything is a faint dot grid (`--grid-dot`), like squared paper; reading surfaces sit on solid cards above it. Vertical rhythm is 24px between sections on phones and 32px from `sm` (`space-y-6 / sm:space-y-8`). The landing hero is a fixed 560×470 scene scaled to fit, so it composes the same at 320px and at 1920px.

## Elevation & Depth

A hybrid: surfaces are flat white cards on the periwinkle ground, with soft navy-tinted shadows. Coloured fields (the hero, Next up, subject headers) lift the most. Depth also comes from the tactile lip, a solid 3px shadow directly under a button that the press removes.

### Shadow Vocabulary
- **Soft** (`0 1px 2px rgb(23 35 68 / 0.05), 0 10px 28px -14px rgb(23 35 68 / 0.2)`): resting cards, the selected segment.
- **Lift** (`0 2px 6px rgb(23 35 68 / 0.07), 0 22px 44px -18px rgb(23 35 68 / 0.3)`): coloured fields, hovered cards, the tab bar.
- **Float** (`0 4px 10px rgb(23 35 68 / 0.08), 0 30px 60px -24px rgb(50 104 245 / 0.45)`): the sign-in panel and floating overlays.
- **Lip** (`0 3px 0 var(--lip)`): tactile buttons only; the lip colour is the button's deep shade.

## Shapes

Friendly and rounded, without becoming bubbly. Controls use 14px corners, cards 20px, large fields 32px, and chips and tabs are full pills. Answer options use 16px corners with a 2px border, so state changes read as a change of outline. The brainwave appears as a rounded sine stroke: the wavy lower edge of coloured fields, dashed step connectors and the loader.

## Components

### Buttons
- **Shape:** 14px corners (`--radius-control`), 44px tall (xl: 56px).
- **Primary:** blue with white text and a deep-blue lip. On press the button sinks 2px and the lip shrinks. A short brainwave pulse ring expands from the press.
- **Sun:** sunshine with navy text, for the single hero call to action.
- **Secondary:** white with a line border and a line-coloured lip.
- **Ghost / onColor:** text-only buttons, or a white outline on blue fields.
- **Hover:** fine pointers only, a 1px lift and a darker fill (200ms). A lighter fill would drop white text below AA.

### Chips
- **Style:** full pills, 36px. Unselected chips sit on the sunk surface (or transparent inside a sunk track); the selected chip is blue with white text and a soft shadow.

### Cards / Containers
- **Corner Style:** 20px. **Background:** surface. **Border:** 1px line. **Shadow:** soft at rest, lift on hover with a 2px rise. **Padding:** 20–24px.
- **Subject card:** a 128px subject field with its scene, then title (display), topic count, units, and a mint mastery bar.

### Inputs / Fields
- **Style:** 1px line border, surface fill, 14px corners, 44px tall. Hover tints the border blue.
- **Focus:** blue border plus a 4px blue ring at 15%. The caret is brand blue.

### App shell and navigation (`src/app/AppShell.tsx`, `Sidebar.tsx`, `CreateSheet.tsx`, `nav.tsx`)
- **Desktop (lg):** a 256px sidebar: the logo, a blue **+ New** key, then every page in three groups (Learn and create · Study · Help), each with its tool's small keycap. A soft pill slides to the open page (one layer clipped to the link, so it moves on the GPU).
- **Tablet (md–lg):** the same as a 76px icon rail; labels become tooltips and screen-reader text.
- **Top bar:** your streak sticker, Focus, language and account; on phones also the logo and a **Study** grid button that opens the study tools as a sheet.
- **Phones:** a floating pill with Home, Learn, Lectures, Video lessons and Podcasts, and a separate round **+** keycap beside it.
- **+ New** opens one sheet with every way to make something: record, upload, YouTube, a document, a video lesson, a podcast, the tutor. Its tiles settle in 40ms apart.

### Keycaps (`KeyTile`, `.key-tile`)
The 2.0 signature object. A chunky tile of colour: a two-stop gradient (the tool's or subject's `tile`), a glossy top, a darker lip along the bottom and a soft cast shadow. Inside a pressed `.group` it sinks 2px onto its lip. `IconTile` renders the same look, so every tile in the app is a keycap.

### Study paths (`StudyPath`)
Round keycap steps in a gentle zig-zag, joined by a curving line. Finished steps are mint with a check and the line up to them turns mint; the step to do now is lit in its tool's colour, pulses once and has Wave beside it; the rest are quiet outlined keys. Used for Home's "Next up" and for every course unit (topics, mastered = done). Each step is a link; the path is an ordered list.

### Stickers (`Sticker`)
Rounded badges with a white keyline and a little lift for real numbers only: streak (sunshine), minutes today, cards due (purple).

### Home
Hello and today's stickers; **Next up**, the path of today's real steps (review due cards, the latest lecture, weak spots, the exam plan, 10 minutes of study, add a lecture; finished ones first); **Quick start**, a launcher of ten keycaps; and on wide screens a side column with your week and streak, the latest lectures and Your week.

### Tool masthead (`ToolHero`)
Every tool's main page opens on a compact masthead: the tool's big keycap, tilted −6° on a soft halo of its colour with a spark, the title in the display face (extrabold, 2.1–3rem), one line about the tool, its actions (`heroAction`: a blue key, then white keys) and any stat stickers. There is no coloured field, so the page's own content starts high. The first time a tool is opened in a visit its keycap settles in and the spark twinkles; after that the masthead simply appears.

### Page header (`PageHeader`)
Item pages (a lecture, an episode, an exam, a group) use a back pill, the tool's tile, the title in the display face and chips or a line of detail. No field: the item's own content is the colour.

### Covers, thumbnails and cartridges
- **Media covers** (`Cover`): generated from the item's id. Videos are 16:9 coral with a white play disc and a sunshine brainwave; podcasts are square purple with sound bars, one of them sunshine. Three shades per kind, so a library never looks like one card repeated.
- **Lecture thumbnails** (`LectureThumb`): the source's icon tile; in lists it leans in (−6°, 1.06) when its row is hovered.
- **Game cartridges** (`GameArt`): Glide is a paper plane on a blue sky with a dashed sunshine flight path; Lane Rush is a three-lane road with a white car and coins. On hover the plane bobs and the road rolls.

### Flashcards (`FlipCard`)
A card on top of its deck (two cards peek out underneath). The front is surface with a faint purple dot grid and the question in the display face; the back is a soft purple. Turning the card plays a 260ms turn-in from the edge (a fade under reduced motion). Only the side showing is rendered.

### Players
The podcast player sits on the purple field: the two hosts' initials, the chapter in the display face, a small sunshine equaliser while it plays, a white play disc and white controls. The line being read is lit purple in the transcript.

### Loading
`Loading` / `WaveLoader`: the brainwave travelling beside the words, never a bare spinner. Where the AI is writing something big (a quiz, a video, an episode), Wave thinks beside the button.

### Wave (signature)
An SVG brain with wavy arms and the brainwave across its forehead, in ten moods: happy, excited, curious, thinking, celebrating, encouraging, confused, reading, sleeping, waving. Idle motion (bob, blink, a gesture) runs only with `prefers-reduced-motion: no-preference`. It is `aria-hidden` unless it carries a label. Where it appears:
- the landing (waving);
- Home (happy, or sleeping after midnight);
- the lesson start (reading) and lesson writing (thinking);
- quiz feedback (excited or encouraging) and results (celebrating or encouraging);
- empty states (curious);
- 404 and errors (confused);
- onboarding (waving).

### Quiz answer
- **Default:** a 2px line border and a letter badge.
- **Selected:** a blue border and a filled blue badge.
- **Correct:** mint, with a check that draws in.
- **Wrong pick:** coral, with an X and a short shake.
- **Missed correct:** a dashed mint outline.

The feedback panel slides up, with Wave and kind copy.

## Motion

Tokens live in `src/styles.css`: `--dur-press` 140ms, `--dur-hover` 200ms, `--dur-enter` 320ms, `--dur-expressive` 520ms; `--ease-out` cubic-bezier(0.23, 1, 0.32, 1) for almost everything, `--ease-drawer` for sheets, `--ease-spring` only for one-off moments.

| Moment | Motion | Frequency |
|---|---|---|
| Press a tactile button | sinks 2px onto its lip, one brainwave pulse ring | every tap, 140ms |
| Hover a card / row | lifts 2px, its tile leans in | fine pointers only, 200–240ms |
| Move between pages | content rises 8px and fades in | every navigation, 400ms, no spring |
| Sidebar | a clipped highlight slides to the open page | every navigation, 300ms clip-path |
| Open a tool | its keycap settles in, the spark twinkles twice | first visit per session only |
| Open Home or a course | the "now" step rings twice (scale + fade) | each visit, 2 rings |
| Press a keycap or path step | sinks 2–3px onto its lip | every tap, 140ms |
| Open + New / Study | the sheet slides up, its tiles settle in 40ms apart | occasional |
| Turn a flashcard | the new side turns in | 260ms |
| Pick an answer | check draws in / X shakes | per answer |
| Finish a quiz | Wave celebrates, one confetti burst | rare |
| Podcast playing | sunshine equaliser | while playing; still under reduced motion |

Everything is transform, opacity or clip-path. Under `prefers-reduced-motion` movement stops and only fades remain.

## Do's and Don'ts

### Do:
- **Do** keep each screen to one primary (blue) action. Use sunshine only for the hero action on a blue field.
- **Do** pair every right/wrong colour with a mark.
- **Do** keep motion to transform and opacity, 140–520ms, and give every animation a reduced-motion state.
- **Do** use Wave only at moments that carry a feeling (arrival, waiting, mistake, success, empty, lost), at most once per view.
- **Do** keep lesson and note text calm: no animation once content is showing.
- **Do** open every tool's main page with its `ToolHero` masthead, and every item page with a `PageHeader` and the tool's keycap.
- **Do** use keycaps (`KeyTile`/`IconTile`) for every tool, source and subject icon; never a flat icon square.
- **Do** use the tool's own hue from `TOOL_META` for its tiles, chips and fields; never pick a colour ad hoc.

### Don't:
- **Don't** use uppercase eyebrow labels, gradient text on headings, or emoji as icons in UI chrome.
- **Don't** use spring overshoot on frequent controls; it is reserved for one-off moments (the mascot popping in, a star, the hero pieces).
- **Don't** invent users, ratings, testimonials or outcome numbers anywhere.
- **Don't** add streak pressure, countdowns or other anxiety mechanics.
- **Don't** put a coloured bar down one side of a box (summary, quote, marked line); use a tint, a ring or a leading icon.
- **Don't** show a bare spinner; use the brainwave loader.
