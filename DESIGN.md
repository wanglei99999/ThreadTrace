---
name: ThreadTrace
description: A trustworthy, technical, beautiful research cockpit for forum context intelligence.
colors:
  workspace-bg: "#e9eef1"
  workspace-surface: "#f7f9fa"
  panel: "#ffffff"
  panel-subtle: "#f6f8f8"
  sidebar: "#f7fafc"
  sidebar-raised: "#ffffff"
  text: "#17211f"
  text-strong: "#07100e"
  muted: "#60716d"
  line: "#d4ddda"
  line-strong: "#b8c9c3"
  accent: "#14725f"
  accent-strong: "#0a5848"
  accent-soft: "#e2f3ee"
  gold: "#f1bd52"
  info: "#245f9f"
  ok: "#13745f"
  warn: "#8a5712"
  fail: "#a23c3c"
typography:
  headline:
    fontFamily: "Microsoft YaHei, Segoe UI, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.22
    letterSpacing: "0"
  title:
    fontFamily: "Microsoft YaHei, Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Microsoft YaHei, Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Microsoft YaHei, Segoe UI, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "24px"
  xl: "34px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.panel}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "42px"
  card-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 11px"
    height: "42px"
---

# Design System: ThreadTrace

## 1. Overview

**Creative North Star: "The Personal Intelligence Cockpit"**

ThreadTrace should feel like a private cockpit for a young technical operator: sharp, credible, and satisfying to use without falling into hacker theatrics. The interface serves analysis, source operations, and evidence review, so it should be dense enough for real work while keeping the visual field calm and navigable.

The system rejects generic admin templates, old enterprise dashboards, dark hacker terminals, and single-color monotony. It uses a restrained technical foundation with a daylight command dock, cool work surfaces, teal operational accents, gold brand recognition, and semantic colors for status.

**Key Characteristics:**
- Dense but not cramped.
- Technical but not hostile.
- Polished but not decorative.
- Multi-source ready.
- Built for one expert operator moving quickly.

## 2. Colors

The palette is a cool technical neutral system with a light command shell, teal operational accent, gold brand marker, and clear semantic colors.

### Primary
- **Signal Teal** (`accent`): Used for primary actions, current navigation, focus energy, and compact status anchors.
- **Deep Signal Teal** (`accent-strong`): Used for hover states, active states, and stronger control surfaces.
- **Soft Signal Wash** (`accent-soft`): Used for selected chips, gentle hover fills, and low-risk emphasis.

### Secondary
- **Brand Gold** (`gold`): Used sparingly for the ThreadTrace mark and brand recognition. It must not become the main UI accent.

### Tertiary
- **Operational Blue** (`info`): Reserved for informational state and secondary diagnostics.
- **Success Green** (`ok`), **Attention Amber** (`warn`), and **Failure Red** (`fail`): Used only for semantic status, not decoration.

### Neutral
- **Daylight Command Dock** (`sidebar`, `sidebar-raised`): Used for the persistent navigation shell. It should feel light, modern, and AI-native rather than like an old dark admin sidebar. The dock uses subtle structure, compact capsules, and active-state accents instead of per-item color blocks or heavy cards.
- **Cool Work Surface** (`workspace-bg`, `workspace-surface`): Used for the main analysis canvas.
- **Raised Panel White** (`panel`, `panel-subtle`): Used for forms, result panels, and readable evidence areas.
- **Ink Text** (`text`, `text-strong`) and **Muted Text** (`muted`): Used for hierarchy and scanning.
- **Cool Dividers** (`line`, `line-strong`): Used for borders and row separation.

### Named Rules

**The No Single-Color Rule.** Never let the product become only green, only blue, or only grayscale. Teal is the operational accent, not the whole personality.

**The Gold Is A Mark Rule.** Gold belongs to identity moments. It is prohibited as a general CTA color.

## 3. Typography

**Display Font:** Microsoft YaHei / Segoe UI with system fallbacks
**Body Font:** Microsoft YaHei / Segoe UI with system fallbacks
**Label/Mono Font:** Cascadia Mono / Consolas for command and code evidence

**Character:** A single sans stack keeps the product efficient and familiar. Weight, spacing, and density create hierarchy instead of decorative font pairing.

### Hierarchy
- **Headline** (800, 24px, 1.22): Page titles and major view headings.
- **Title** (800, 15px, 1.35): Panel titles, cockpit section labels, and compact information headers.
- **Body** (400, 16px, 1.55): Evidence, descriptions, and form values.
- **Label** (800, 12px, 1.2): Field labels and compact UI metadata.
- **Mono** (12px, 1.5): Commands, JSON, and audit snippets.

### Named Rules

**The Product Type Rule.** No display typography theatrics. This is a working cockpit; type must help scanning and confidence.

## 4. Elevation

ThreadTrace uses hybrid depth: tonal layers establish the main hierarchy, while soft shadows and inner highlights give controls and panels a tactile premium feel. Elevation should be structural, not decorative.

### Shadow Vocabulary
- **Low Surface Lift** (`0 8px 20px rgba(10, 27, 24, 0.07)`): Forms, icon buttons, and panels at rest.
- **Interactive Lift** (`0 20px 46px rgba(10, 27, 24, 0.11)`): Hovered panels and elevated control states.
- **Inner Highlight** (`inset 0 1px 0 rgba(255, 255, 255, 0.74)`): Used on glossy but restrained product surfaces.

### Named Rules

**The Structural Depth Rule.** Shadows must clarify layer and interaction. If a shadow only makes the UI look expensive, remove it.

## 5. Components

### Buttons
- **Shape:** Compact, gently rounded rectangles (6px radius).
- **Primary:** Teal gradient surface, white text, strong weight, and a soft teal shadow.
- **Hover / Focus:** Primary buttons deepen in teal; focus uses a visible blue-teal ring.
- **Secondary:** White surface, teal text, cool border, and subtle wash on hover.

### Chips
- **Style:** Soft teal wash, teal ink, 6px radius, and a light border.
- **State:** Chips identify entities, evidence tags, and compact status fragments. They should not become decorative badges.

### Cards / Containers
- **Corner Style:** Gentle product radius (8px).
- **Background:** White to cool-white surfaces over a cool work canvas.
- **Shadow Strategy:** Low surface lift at rest, interactive lift only on hover or important elevation.
- **Border:** Cool neutral border; no thick side stripes.
- **Internal Padding:** 14px to 16px for dense working panels.

### Inputs / Fields
- **Style:** White or near-white surface, 6px radius, cool border, 42px minimum height.
- **Focus:** Teal border with a visible soft focus ring.
- **Error / Disabled:** Error states use semantic amber/red; disabled states lower contrast and remove interactive shadow.

### Navigation
- **Style:** Persistent daylight command dock with strong active item treatment. Navigation uses clear labels, compact spacing, soft elevation, and color only where it clarifies the current selection.
- **Mobile:** The dock collapses into a compact top command shell with two-column or four-column nav depending on width.

## 6. Do's and Don'ts

### Do:
- **Do** keep the UI young, sharp, and personally useful.
- **Do** use multiple deliberate color roles: daylight command dock, cool canvas, teal action, gold identity, semantic status.
- **Do** preserve evidence density while keeping row separation, labels, and panel titles easy to scan.
- **Do** make source operations, review flows, and analysis results feel like one coherent cockpit.
- **Do** keep focus states visible and keyboard-friendly.

### Don't:
- **Don't** make it look like a generic admin template.
- **Don't** make it look like an ordinary enterprise system with default white cards and default form controls.
- **Don't** use dark hacker terminal styling, neon cyberpunk colors, or fake command-center drama.
- **Don't** collapse the product into a single-color theme.
- **Don't** make it feel like software for old-fashioned enterprise users.
- **Don't** use loud AI SaaS landing-page tropes, decorative gradient text, gradient blobs, or marketing-first hero layouts.
- **Don't** use border-left or border-right accents greater than 1px on cards or alerts.
