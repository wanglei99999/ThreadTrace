---
name: ThreadTrace
description: A trustworthy, technical, beautiful research cockpit for forum context intelligence — Notion workspace structure carried with Apple-grade restraint.
colors:
  canvas: "#ffffff"
  surface: "#f6f5f4"
  surface-soft: "#fafaf9"
  surface-sunken: "#f0eeec"
  sidebar: "#f7f6f4"
  text-strong: "#1a1a1a"
  text: "#37352f"
  text-secondary: "#5d5b54"
  text-tertiary: "#787671"
  hairline: "#e5e3df"
  hairline-strong: "#c8c4be"
  accent: "#5645d4"
  accent-strong: "#4534b3"
  accent-deep: "#3a2a99"
  accent-soft: "#ece8fb"
  link: "#0075de"
  ok: "#1a9c38"
  warn: "#cf5400"
  fail: "#d92d2d"
  info: "#0075de"
  tint-lavender: "#e6e0f5"
  tint-mint: "#d9f3e1"
  tint-peach: "#ffe8d4"
  tint-sky: "#dcecfa"
  tint-rose: "#fde0ec"
  tint-yellow: "#fef7d6"
  gold: "#f5d75e"
  gold-soft: "#fef7d6"
  # extended neutrals
  workspace: "#faf9f8"
  sidebar-soft: "#ebe9e5"
  text-muted: "#8c8983"
  muted: "#6b6862"
  line-soft: "#ede9e4"
  neutral: "#c5c4be"
  ink: "#0f0f0f"
  # accent / link ramp
  accent-wash: "#f6f4fd"
  link-strong: "#005bab"
  violet: "#7b3ff2"
  # soft semantic backgrounds
  ok-soft: "#d9f3e1"
  warn-soft: "#ffe8d4"
  fail-soft: "#fbe1e1"
  info-soft: "#dcecfa"
  # semantic inks (deep text on pastel grounds)
  info-ink: "#154d88"
  amber-ink: "#73501b"
  slate-ink: "#405a64"
  # tint base colors (used as rgba alpha overlays via *-rgb tokens)
  mint-base: "#e2f3ee"
  peach-base: "#fff6e4"
  rose-base: "#fff0f0"
  amber-base: "#8a5712"
  rust-base: "#a23c3c"
typography:
  headline:
    fontFamily: "PingFang SC, Microsoft YaHei, Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "PingFang SC, Microsoft YaHei, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  mono:
    fontFamily: "SF Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "12.5px"
    lineHeight: 1.5
rounded:
  chip: "6px"
  button: "8px"
  card: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    border: "1px solid {colors.hairline-strong}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  card-panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.card}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    border: "1px solid {colors.hairline-strong}"
    rounded: "{rounded.button}"
    padding: "9px 12px"
    height: "40px"
  chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-deep}"
    rounded: "{rounded.chip}"
    padding: "3px 8px"
---

# Design System: ThreadTrace

## 1. Overview

**Creative North Star: "The Personal Intelligence Cockpit"**

ThreadTrace should feel like a private cockpit for a young technical operator: sharp, credible, and satisfying to use without falling into hacker theatrics. The interface serves analysis, source operations, and evidence review, so it should be dense enough for real work while keeping the visual field calm and navigable.

The system is built on a **Notion + Apple** blend, with a clear priority: **Notion provides the bones** (workspace structure, warm‑neutral surfaces, a purple primary, sober rectangular geometry, database‑property color for status); **Apple provides the polish** (typographic restraint, generous breathing room around headings, committed micro‑interactions, shadows reserved for floating layers only). Notion is the basecoat because ThreadTrace is a productivity tool, not a consumer showcase; Apple is the finish that makes it feel premium.

**Key Characteristics:**
- Dense but not cramped.
- Technical but not hostile.
- Polished but not decorative.
- Multi-source ready.
- Built for one expert operator moving quickly.

## Visual References

Primary reference blend: **Notion (lead) + Apple (polish)**.

- `docs/design-references/notion.DESIGN.md` — workspace structure, warm‑neutral surfaces, purple CTA, 8px rectangular buttons / 12px cards, pastel property tints.
- `docs/design-references/apple.DESIGN.md` — typographic discipline, negative letter‑spacing on display, whitespace as pedestal, single restrained accent, `scale()` press.

These references inform visual decisions, but ThreadTrace's own tokens and component rules in this document remain the source of truth.

## 2. Colors

A warm‑neutral Notion workspace system with a single purple operational accent, a distinct link blue, clear semantic colors, and pastel property tints for low‑risk classification.

### Primary
- **Notion Purple** (`accent`): primary actions, current navigation, focus energy. Hover/active deepen to `accent-strong` / `accent-deep`.
- **Soft Purple Wash** (`accent-soft`): selected chips, gentle hover fills, low‑risk emphasis.

### Link
- **Link Blue** (`link`): inline text links and secondary informational references only. **Distinct role from the purple accent — never interchange them.**

### Neutral
- **Daylight Dock** (`sidebar`): the persistent light command dock — modern and AI‑native, never a dark admin sidebar. Grouped nav, compact items, purple active state.
- **Warm Surfaces** (`canvas`, `surface`, `surface-soft`, `surface-sunken`): white panels over a warm‑grey workspace canvas (Notion's signature).
- **Ink** (`text-strong`, `text`) and **secondary/tertiary** (`text-secondary`, `text-tertiary`): warm‑charcoal hierarchy. All pass WCAG AA on canvas.
- **Hairlines** (`hairline`, `hairline-strong`): 1px borders and row separation.

### Semantic & Tints
- **Success / Warning / Failure / Info** (`ok` / `warn` / `fail` / `info`): status only, never decoration; always paired with shape or label, never color alone.
- **Pastel Tints** (`tint-lavender|mint|peach|sky|rose`): soft backgrounds echoing Notion database properties — used for status chips, source/category coding, and overview signal cards.

### Named Rules
**The Purple Is The Action Rule.** Purple belongs to operations, selection, and focus. Don't use it for body text or large surfaces.
**The Gold Is A Mark Rule.** `gold` is reserved for brand/logo moments only — prohibited as a UI or CTA color.
**The No Single‑Color Rule.** Purple is the operational accent, not the whole personality; warmth and life come from neutrals, link blue, and pastel tints.

## 3. Typography

**Font Stack:** `PingFang SC` / `Microsoft YaHei` for Chinese + `Inter` / `system-ui` for Latin & numerals. Mono: `SF Mono` / `Cascadia Mono` / `Consolas` for commands and code evidence.

**Character:** A single well‑tuned sans carries headings, labels, body, and data. Hierarchy comes from weight, size, and spacing — not decorative font pairing.

### Hierarchy (fixed rem scale, not fluid)
- **Headline** (700, 24px, -0.01em): page titles and major view headings.
- **Title** (600, 16px): panel titles and compact section headers.
- **Body** (400, 15px, 1.6): evidence, descriptions, form values.
- **Label** (600, 12px): field labels and compact UI metadata.
- **Mono** (12.5px): commands, JSON, audit snippets.

### Named Rules
**The Weight Ladder Rule.** Ladder is **400 / 500 / 600 / 700**. Weight 800+ is banned — it reads as shouting, not hierarchy.
**The Apple‑Tight Rule.** Display/large headings carry slight negative letter‑spacing; product type stays at fixed rem, never fluid clamp.
**The Product Type Rule.** No display typography theatrics; type must help scanning and confidence.

## 4. Elevation

Notion‑flat by default: structure comes from tonal surfaces and 1px hairlines, not shadow. Apple‑restraint on depth: a real shadow appears only when something genuinely floats.

### Shadow Vocabulary
- **Resting lift** (`0 1px 2px rgba(15,15,15,0.04)`): cards, panels, and form surfaces float gently off the warm canvas — a whisper of depth, not a drop shadow.
- **Flat at rest** (`none` + hairline): rows, list items, and field groups inside a card.
- **Soft lift** (`0 4px 12px rgba(15,15,15,0.08)`): hovered tiles and elevated controls.
- **Floating layer** (`0 16px 48px -8px rgba(15,15,15,0.16)`): dropdowns, popovers, modals.

### Named Rules
**The Structural Depth Rule.** Shadows must clarify a floating layer or interaction. Cards carry one barely‑there resting lift; anything stronger is reserved for hover or true overlays. If a shadow only makes the UI look expensive, remove it. No inner‑highlight glass on static surfaces.

## 5. Components

### Buttons
- **Shape:** 8px rounded rectangles (Notion geometry — not pills).
- **Primary:** solid purple surface, white text, 600 weight; hover deepens to `accent-strong`.
- **Secondary:** white surface, ink text, hairline border, subtle surface fill on hover.
- **Press:** `transform: scale(0.97)` system‑wide; focus uses a 2px purple ring.

### Inputs / Fields
- White surface, 8px radius, `hairline-strong` border, 40px height.
- **Focus:** purple border + soft purple ring (`0 0 0 3px accent-soft`).
- Placeholder text meets contrast (tertiary, not light grey).

### Cards / Panels
- White panels on the warm canvas, 12px radius, 1px hairline, one resting lift.
- Internal padding 14–16px for dense working panels; no nested cards (inner regions are flat field groups, not sub‑cards).

### Icons
- **Line‑SVG set** (Lucide‑style, `currentColor`, 1.9 stroke): 17px in the nav, 22px in the page‑head chip, ~20px in signal chips. Structural and consistent — never emoji, never decorative.
- **Icon chips:** per‑view page‑head chip (`accent-soft` ground + purple icon, 8px radius); overview signal chips tint by state (peach / sky / mint / rose ground + matching semantic icon).

### Chips & Status
- **Tags:** Notion multi‑color pastel pills — lavender / mint / peach / sky / rose / yellow rotate by position, warm‑ink text (`--text`) kept at AA; 6px radius, for entity/evidence labels.
- **Status badges:** pastel‑tinted pill + a leading same‑color status dot + deep semantic text; carry dot + label, never color alone.

### Callout (empty & teaching states)
- Soft‑tint block (`surface-soft` + hairline, 12px radius) with a leading icon chip and caption + message — the Notion callout. Replaces dashed placeholder boxes; teaches the empty state instead of saying "nothing here".

### Navigation
- Persistent light **grouped** dock (Workspace / Operations); each item leads with a line icon and the active item turns purple (icon + ground). Clear labels, compact spacing, color only where it clarifies selection.
- **Breadcrumb:** a muted, slash‑separated trail at the page top (`语脉 / mode / focus`) with the last segment emphasized — quiet wayfinding, not colored pills.
- **Mobile:** the dock collapses into a compact top command shell.

## 6. Do's and Don'ts

### Do
- Keep the UI young, sharp, and personally useful.
- Use deliberate color roles: light dock, warm canvas, purple action, link blue, pastel status, gold identity.
- Preserve evidence density with easy‑to‑scan rows, labels, and panel titles.
- Make source operations, review flows, and analysis feel like one coherent cockpit.
- Keep focus states visible and keyboard‑friendly; every animation has a `prefers-reduced-motion` fallback.

### Don't
- Don't look like a generic admin template or an ordinary enterprise system with default white cards.
- Don't use dark hacker‑terminal styling, neon, or fake command‑center drama.
- Don't collapse the product into a single‑color theme.
- Don't use loud AI‑SaaS tropes: gradient text, gradient blobs, decorative multi‑color bars, marketing‑first hero layouts.
- Don't use `01/02/03` numbered scaffolding, per‑section eyebrow kickers, or `border-left/right` color stripes greater than 1px.
- Don't use weight 800+, fluid clamp headings, or inner‑highlight glass on static surfaces.
