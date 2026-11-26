---
name: BrainWave
description: From lecture to exam-ready. Playful Intelligence for students of every age.
colors:
  primary: "#3268f5"
  primary-electric: "#518cff"
  primary-deep: "#1f43ad"
  sky: "#dceaff"
  navy-ink: "#172344"
  periwinkle-ground: "#f6f8ff"
  surface: "#ffffff"
  surface-sunk: "#edf1fd"
  line: "#dde4f5"
  muted-ink: "#56607e"
  purple: "#9560ec"
  mint: "#32cba0"
  mint-deep: "#128a69"
  sunshine: "#ffd35a"
  coral: "#ff826f"
  coral-deep: "#f2614c"
  night-ground: "#0b1022"
  night-surface: "#131a31"
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
    backgroundColor: "{colors.primary-electric}"
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

**Creative North Star: "Playful Intelligence"**

BrainWave is a study companion that is playful but not childish, colourful but not chaotic, animated but not distracting, and professional but not boring. It has to feel right to a nine-year-old, a high-school student and a university student at the same time. The system gets there by putting its personality around the content and not inside it. There is a confident blue field, tactile buttons that press down, Wave the brain mascot at chosen moments, one signature brainwave line, and a colour field for each subject. Learning content itself (lessons, notes, questions) stays calm, readable and quiet.

Density is comfortable: generous touch targets (44px and up), roomy cards, one clear next step per screen. Motion is short and physical. Presses sink, fields lift, and pieces settle with a soft overshoot. Everything is still under reduced motion.

**Key Characteristics:**
- Blue (#3268f5) is the brand; sunshine yellow is the rare highlight for the single most important call to action.
- Tactile controls: a 3px "lip" under primary buttons that the press absorbs.
- Wave the mascot reacts to the moment (waving, reading, thinking, encouraging, celebrating, confused), and is decorative to assistive tech.
- The brainwave line: the field edge, the step connector, the loader.
- Each subject owns a colour field and an illustrated scene that comes alive on hover.

## Colors

A saturated blue world on a cool periwinkle ground, with four friendly accents that each have one job.

### Primary
- **BrainWave Blue** (#3268f5): primary buttons, active navigation, the landing hero field, the "Next up" field, selection.
- **Electric Blue** (#518cff): hover on blue controls; light strokes on blue fields.
- **Deep Blue** (#1f43ad): the button lip and the bottom of blue gradients.
- **Sky** (#dceaff): the active nav pill, info tints, the lesson hook callout.

### Secondary
- **Sunshine** (#ffd35a): the one big call to action on a blue field (the landing's start button), the brainwave line on blue fields, the mascot's sparks. Text on it is navy.

### Tertiary
- **Mint** (#32cba0, deep #128a69): correct answers, mastery progress, key points. Marks on mint use the deep shade for contrast.
- **Coral** (#ff826f, deep #f2614c): a wrong pick in a quiz. It is kind, never alarming red. System errors keep rose.
- **Purple** (#9560ec): maths and coding fields, the quiz tag, the mascot's question mark.

### Neutral
- **Navy Ink** (#172344): all body text and headings in light mode.
- **Muted Ink** (#56607e): secondary text (5.9:1 on the ground).
- **Periwinkle Ground** (#f6f8ff) / **Surface** (#ffffff) / **Sunk Surface** (#edf1fd) / **Line** (#dde4f5): page, cards, tracks and wells, borders.
- **Night Ground** (#0b1022) / **Night Surface** (#131a31): dark mode. Blue fields and subject fields stay saturated in dark mode.

### Named Rules
**The Right-and-Wrong-Never-By-Colour Rule.** Mint and coral always come with a mark: a check, an X, or a letter. A correct answer the student didn't pick gets a dashed mint outline.

**The One Sun Rule.** Sunshine fills at most one control per screen.

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

Single column on phones with a 16px gutter. The content container is max 72rem (`max-w-6xl`) with 24px gutters from `sm`. Grids step from 1 to 2 to 3 columns (`sm`, `lg`). On phones the main navigation is a floating five-tab bar at the bottom; from `md` it is a pill row in the header. Vertical rhythm is 24px between sections on phones and 32px from `sm` (`space-y-6 / sm:space-y-8`). The landing hero is a fixed 560×470 scene scaled to fit, so it composes the same at 320px and at 1920px.

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
- **Hover:** fine pointers only, a 1px lift and a lighter fill (200ms).

### Chips
- **Style:** full pills, 36px. Unselected chips sit on the sunk surface (or transparent inside a sunk track); the selected chip is blue with white text and a soft shadow.

### Cards / Containers
- **Corner Style:** 20px. **Background:** surface. **Border:** 1px line. **Shadow:** soft at rest, lift on hover with a 2px rise. **Padding:** 20–24px.
- **Subject card:** a 128px subject field with its scene, then title (display), topic count, units, and a mint mastery bar.

### Inputs / Fields
- **Style:** 1px line border, surface fill, 14px corners, 44px tall. Hover tints the border blue.
- **Focus:** blue border plus a 4px blue ring at 15%. The caret is brand blue.

### Navigation
- **Mobile:** a floating, blurred tab bar. A tinted pill slides to the active tab, whose icon is filled and slightly scaled.
- **Desktop:** header pills, with the active one in sky and blue text.

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

## Do's and Don'ts

### Do:
- **Do** keep each screen to one primary (blue) action. Use sunshine only for the hero action on a blue field.
- **Do** pair every right/wrong colour with a mark.
- **Do** keep motion to transform and opacity, 140–520ms, and give every animation a reduced-motion state.
- **Do** use Wave only at moments that carry a feeling (arrival, waiting, mistake, success, empty, lost), at most once per view.
- **Do** keep lesson and note text calm: no animation once content is showing.

### Don't:
- **Don't** use uppercase eyebrow labels, gradient text on headings, or emoji as icons in UI chrome.
- **Don't** use spring overshoot on frequent controls; it is reserved for one-off moments (the mascot popping in, a star, the hero pieces).
- **Don't** invent users, ratings, testimonials or outcome numbers anywhere.
- **Don't** add streak pressure, countdowns or other anxiety mechanics.
