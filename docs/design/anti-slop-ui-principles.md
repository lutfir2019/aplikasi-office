# Anti-Slop UI Design Principles

**Task:** t_7946cc31  
**Audience:** UI/UX agents, reviewers, frontend handoff recipients  
**Status:** Draft for prompt/skill integration

---

## 1. Standard

A UI is not finished because it is polished. It is finished when its composition matches the user's job, its hierarchy makes the next decision obvious, its copy names real actions and consequences, and every state remains legible and operable.

Anti-slop is not a visual style. It is a decision discipline.

### Non-negotiable outcomes

1. The surface archetype is named before layout or tokens are chosen.
2. Every visible element supports a user decision, action, orientation need, or system state.
3. One primary visual anchor exists per viewport; equal-weight repetition is justified, not automatic.
4. Typography establishes hierarchy before containers, color, icons, or effects are added.
5. Density follows task frequency and content shape, not a universal spaciousness preference.
6. Copy names the object, action, result, and recovery path precisely.
7. Contrast is measured against the final rendered background, including overlays and opacity.
8. Every flow includes loading, empty, error, partial, and success behavior where applicable.
9. Every interactive control defines default, hover, focus-visible, active, disabled, loading, and error states where applicable.
10. A design cannot be handed to frontend without implementable tokens and measured contrast pairs.

---

## 2. Surface-First Composition

Name exactly one primary surface before designing. A secondary surface may be noted, but it must not dilute the primary composition.

| Surface | User's job | Composition that follows | Avoid |
|---|---|---|---|
| **Monitor** | Notice state changes and exceptions | Dense status hierarchy, timelines, prioritized anomalies | Marketing hero, decorative KPI monuments |
| **Operate** | Act on a queue or collection | Selection, bulk actions, rows, clear action priority | Equal card mosaics, hidden actions |
| **Compare** | Evaluate alternatives | Aligned attributes, consistent columns, explicit differentiators | Structurally different cards that prevent scanning |
| **Configure** | Set up or modify something | Progressive form sections, dependencies, save/validation states | Promotional copy, decorative dashboards |
| **Decide / Learn** | Understand or be persuaded | One idea per section, narrative hierarchy, evidence near claims | Feature grids with no argument or proof |
| **Explore** | Browse an open information space | Filters, result density, preview, sort, spatial continuity | Fixed funnels that suppress discovery |
| **Command / Inspect** | Execute quickly or study one object | Keyboard-first control, inspector/detail pane, contextual actions | Large decorative chrome, buried commands |

### Composition gate

Before moving to visual styling, the design note must contain:

> This is a **[surface]** surface, so **[user priority]** beats **[competing concern]**.

If the layout would still make sense after replacing all content with unrelated SaaS copy, the composition is too generic. Recompose before styling.

---

## 3. Hierarchy Before Containers

### Rules

- Establish hierarchy with position, scale, weight, line length, and spacing first.
- Use a container only when it communicates grouping, selection, clipping, independent movement, or a distinct interaction boundary.
- A card must earn at least one of these jobs: selectable object, independently actionable object, draggable object, disclosure boundary, or genuinely separate surface.
- Use alignment, whitespace, headings, and dividers for ordinary grouping.
- Keep one dominant anchor per viewport. Supporting regions must be visibly subordinate.
- Repeated items may have equal weight only when comparison or browsing is the user's primary task.
- Do not put every section in a rounded rectangle.
- Do not center the whole composition unless the task is singular and short, such as authentication or a decisive empty state.

### Card-grid test

Before using a card grid, answer all three:

1. Does each item have an independent identity?
2. Does the user need to compare, select, open, or manipulate items independently?
3. Is a row, list, table, or prose section worse for the actual task?

If any answer is no, do not use the grid.

### Do / don't

| Do | Don't |
|---|---|
| Use a compact list for repeated operational objects | Turn each row into a large card with icon, title, sentence, and arrow |
| Let one result, alert, or action dominate when it matters most | Give all modules equal visual weight |
| Place actions next to the object they affect | Collect unrelated actions in a decorative action card |
| Use asymmetry to reflect importance | Add arbitrary asymmetry that damages scan alignment |

---

## 4. Purposeful Typography

Typography must explain the information architecture without depending on boxes or color.

### Required type roles

Every handoff maps these semantic roles to exact family, size, weight, line-height, and letter-spacing values:

| Role | Purpose | Constraint |
|---|---|---|
| `display` | One campaign or narrative statement | Decide/Learn only; never routine app chrome |
| `heading-1` | Page or object title | Normally one per view |
| `heading-2` | Major section boundary | Must not compete with `heading-1` |
| `heading-3` | Local subsection or group | Prefer hierarchy over decoration |
| `body` | Primary reading text | Minimum 16px for general reading surfaces |
| `body-small` | Dense supporting content | Minimum 14px; not for essential instructions |
| `label` | Form/control identification | Never rely on placeholder as the label |
| `meta` | Dates, IDs, secondary attributes | Must still meet body-text contrast |
| `code/numeric` | Machine values or aligned data | Monospace only where its function helps scanning |

### Hierarchy rules

- Use no more than four visibly distinct type sizes in one product viewport unless a documented data-visualization need requires more.
- Adjacent hierarchy levels must differ in at least two properties: size, weight, line-height, spacing, or placement.
- Use weight to clarify emphasis, not to make every heading bold.
- Keep prose measure at 45–75 characters; target 60–70 for sustained reading.
- Use tabular numerals for columns, changing metrics, timers, and aligned financial values.
- Use uppercase only for short labels; never for body copy or long instructions.
- Do not use monospace as decoration.
- Do not default to Inter, system UI, or oversized bold sans merely because no typography decision was made. Choose a type posture that fits the product, document it, and provide robust fallbacks.

### Failure signals

- Five text styles look nearly identical.
- Muted gray is doing the work of hierarchy.
- Every heading has an icon topper.
- Large numbers occupy space but do not change a decision.
- Labels are small, uppercase, and low contrast simply to look technical.

---

## 5. Intentional Density

Density is a workflow setting, not a personality trait.

### Choose one baseline per region

| Density | Use when | Typical rhythm |
|---|---|---|
| **Compact** | Expert, repeated, scan-heavy operation | 4px internal increments; 32–36px desktop rows; actions appear on focus/selection where discoverable |
| **Standard** | Mixed-frequency product work | 8px base rhythm; 40–44px rows/controls |
| **Comfortable** | Infrequent setup, explanation, onboarding | 12–16px internal rhythm; 44–48px controls; wider section gaps |

These values are starting points, not a license to violate 44×44px touch targets on touch surfaces.

### Rules

- Density may change between regions only when the task changes, such as a compact result list beside a comfortable inspector.
- Keep repeated rows and comparable objects on a stable vertical rhythm.
- Increase spacing at semantic boundaries, not after every element.
- Prefer progressive disclosure over blank space that hides complexity without reducing it.
- Do not use oversized cards, headings, or empty gutters to imply premium quality.
- Do not compress hit targets, focus rings, labels, or recovery controls to achieve visual density.

### Density test

At 100% zoom, a user should be able to answer within five seconds:

1. Where am I?
2. What changed or needs attention?
3. What is the primary action?
4. Which content belongs together?

If not, change grouping and hierarchy before changing padding.

---

## 6. Color, Effects, and Resilient Contrast

### Color rules

- Start with neutrals and one functional accent. Add colors only for distinct semantic roles.
- Accent means action, selection, or emphasis. It must not become background decoration everywhere.
- Gradients require a documented purpose: brand identity, spatial depth, data encoding, or state transition. "Adds energy" is not enough.
- Never use a muddy blue-purple gradient as the default signifier of technology or AI.
- Blur requires a real layered surface behind it and a fallback that preserves legibility. Do not use blur to make an empty composition feel finished.
- Shadows communicate elevation or interaction hierarchy; they are not borders with better marketing.
- Pills are reserved for tags, statuses, compact filters, and segmented choices. Ordinary buttons and containers do not all become pills.
- Status must never rely on color alone. Pair it with text, icon shape, pattern, or position.

### Contrast hard gates

| Element | Minimum measured contrast |
|---|---|
| Body text, labels, placeholder instructions, essential metadata | **4.5:1** |
| Large text (≥24px regular or ≥18.66px bold) | **3:1** |
| Icons that communicate meaning, control boundaries, focus indicators, charts, and state graphics | **3:1** against adjacent colors |
| Focus indicator | **3:1** between focused and unfocused pixels, visible on every surface |

Additional resilience rules:

- Measure the final composited color against its real background. Never validate a raw hex value while rendering it with opacity.
- Test every supported theme and every state surface: default, hover, selected, error, warning, success, modal, toast, and disabled.
- Text over images needs a stable scrim or solid text surface; sampling one favorable image area is invalid.
- Muted text is still text. If it conveys information, it must meet 4.5:1.
- Disabled controls may use reduced prominence, but any explanation or persistent status remains readable. Do not encode disabled state with low contrast alone.
- High-contrast or forced-color mode must retain boundaries, selection, focus, and error meaning.
- Record ratios in the handoff. "Looks readable" is not verification.

### Contrast handoff format

| Foreground token | Background token | Context/state | Ratio | Result |
|---|---|---|---:|---|
| `--text-primary` | `--surface-page` | Body/default | measured value | AA/Fail |

A missing pair is a failed gate, not a frontend follow-up.

---

## 7. Distinctive, Operational Microcopy

Distinctive copy is specific, not quirky.

### Rules

- Button labels use a precise verb plus object when context is not explicit: `Archive report`, `Retry upload`, `Create task`.
- Name the domain object consistently. Do not alternate between task, job, item, and request without a real distinction.
- Put consequences in risky actions: `Delete 12 files`, not `Continue`.
- Labels describe data; helper text explains format or consequence. Placeholder text shows an example only when useful.
- Empty states explain why the area is empty and identify the next valid action. Do not fabricate enthusiasm or decorative narrative.
- Loading copy names what is loading: `Loading task history…`, not `Please wait…`.
- Success copy confirms the completed result and relevant destination: `Task created in Design board`.
- Error copy states what failed, what was preserved, and what the user can do next.
- Never blame the user. Never expose stack traces, status codes without meaning, or internal service names.

### Error formula

> **What failed.** What remains safe or unchanged. **Next action.**

Example:

> **Task was not created.** Your instructions are still here. **Check the connection and retry.**

### Empty-state formula

> **State or reason.** One sentence of context. **One valid next action**, if one exists.

### Ban list unless the product genuinely defines the term

`Unlock`, `Elevate`, `Supercharge`, `Seamless`, `Effortless`, `Optimize`, `Transform`, `Insights`, `Growth`, `Scale`, `Magic`, `Powerful`, `Learn more`, `Get started`.

Replace vague claims with the action, evidence, or outcome the user can verify.

### Do / don't

| Do | Don't |
|---|---|
| `No tasks match “billing”. Clear filters.` | `Nothing here yet!` |
| `Connection lost. Your draft is saved on this device. Retry.` | `Oops! Something went wrong.` |
| `Remove access for Maya` | `Confirm` |
| `Export 243 rows as CSV` | `Unlock your data` |

---

## 8. Interaction and Flow Completeness

A static happy-path mockup is not a complete design.

### Required flow branches

For every primary flow, document:

- happy path;
- loading or pending state;
- first-use empty state;
- no-results state after search/filter;
- validation error;
- system/network failure;
- permission or authentication failure;
- partial success where multiple operations can diverge;
- success and the resulting destination/state;
- recovery path that preserves user input whenever safe.

### Required component state matrix

Every interactive element documents applicable states:

| State | Required behavior |
|---|---|
| Default | Purpose and affordance are recognizable without hover |
| Hover | Reinforces clickability; does not reveal essential information exclusively |
| Focus-visible | 2px minimum visible indicator, ≥3:1, not clipped |
| Active/pressed | Immediate tactile feedback without layout shift |
| Selected/current | Persistent state distinct from hover |
| Disabled | Reason is available where non-obvious; unavailable to pointer and keyboard activation |
| Loading | Repeat action is prevented; progress or busy state is announced |
| Error | Error is associated with the control and includes recovery |
| Success | Completion is confirmed without relying on a disappearing toast alone |

Additional rules:

- Touch targets are at least 44×44px.
- Hover-only actions must also appear on keyboard focus and remain discoverable on touch.
- Do not remove focus outlines without an equal or stronger replacement.
- Do not use color as the only change between states.
- Motion clarifies continuity or state; it never delays action. Respect `prefers-reduced-motion`.
- Use roughly 120–180ms for control feedback and 180–240ms for small panel transitions unless product motion tokens already exist.

---

## 9. Token Contract

Use the product's existing token system first. Every design handoff must still expose exact resolved values for the roles it uses.

### Required semantic tokens

```text
color.surface.page
color.surface.raised
color.surface.sunken
color.surface.overlay
color.text.primary
color.text.secondary
color.text.inverse
color.border.default
color.border.strong
color.action.primary
color.action.primary-hover
color.action.primary-active
color.focus
color.status.info
color.status.success
color.status.warning
color.status.danger

type.family.body
type.family.display
type.family.mono
type.size.display
type.size.heading-1
type.size.heading-2
type.size.heading-3
type.size.body
type.size.body-small
type.size.label
type.line-height.*
type.weight.*
type.tracking.*

space.1 = 4px
space.2 = 8px
space.3 = 12px
space.4 = 16px
space.5 = 24px
space.6 = 32px
space.7 = 48px
space.8 = 64px

radius.control
radius.container
radius.pill
border.width.default
border.width.focus
shadow.raised
shadow.overlay
motion.duration.fast
motion.duration.standard
motion.easing.standard
size.target.minimum = 44px
```

### Token rules

- Semantic tokens reference primitives; components do not hardcode ad hoc colors.
- `radius.pill` is not the default radius.
- At most three elevation levels are used in one product surface.
- Spacing exceptions are documented; values outside the scale are not improvised silently.
- State tokens are explicit. Hover and active colors are not generated by arbitrary opacity.
- Disabled appearance, focus, danger, warning, and success are first-class tokens.
- Tokens include light/dark/high-contrast values when those modes are supported.

---

## 10. Anti-Slop Diagnostic

Score each signal `1` when present. Diagnose before editing.

| # | Signal | What it usually means | Required correction |
|---:|---|---|---|
| 1 | Generic blue/violet tech gradient | Color substituted for identity | Rebuild palette from brand/content needs |
| 2 | Three or more equal icon-feature cards | No prioritization or narrative | Recompose around the primary decision |
| 3 | Colored left rail on generic cards | Decoration substituted for grouping | Remove it; use heading, spacing, or state |
| 4 | Blur/glass without a layer model | Effect has no spatial meaning | Remove blur or define actual elevation |
| 5 | Oversized metric with no decision attached | Data used as filler | Pair metric with comparison/action or remove |
| 6 | Rounded-square icon above every heading | Repeated ornament replaces hierarchy | Remove toppers; strengthen type and labels |
| 7 | Everything centered | No surface composition was chosen | Align to task and reading/scanning direction |
| 8 | Inter/system UI chosen by default | Typography decision was skipped | Choose and document a fitting type posture |
| 9 | Vague AI/SaaS microcopy | Product meaning was not specified | Name real object, action, result, and evidence |
| 10 | Composition contradicts the surface | Root task model is wrong | Return to surface selection and re-layout |

### Interpretation

- **0–1:** Pass, if no hard gate fails.
- **2:** Review each signal and document why any retained pattern is appropriate.
- **3+:** Fail; redesign before visual polish.
- Signals **2, 7, and 10** are compositional failures. Any one of them blocks handoff regardless of total score.

Do not repair a layout problem with new colors, shadows, or typography. Do not repair a copy problem with an icon.

---

## 11. Content and Decoration Budget

Every proposed element must answer one question:

- Does it help the user decide?
- Does it help the user act?
- Does it explain structure or consequence?
- Does it communicate real system state?
- Does it express an established brand asset without damaging the above?

If none apply, remove it.

Never invent:

- fake metrics;
- testimonials;
- activity feeds;
- charts with arbitrary data;
- integrations;
- customer logos;
- decorative notifications;
- AI-generated claims;
- extra feature sections outside the approved scope.

Use real content when available. Mark provisional copy and data explicitly when it is not final.

---

## 12. Review Sequence

Review in this order; do not polish a later layer while an earlier one is broken.

1. **Task:** Does the flow solve the stated user job without added scope?
2. **Surface:** Does composition match the selected archetype?
3. **Structure:** Is priority clear without color, icons, effects, or copy flourishes?
4. **Content:** Are labels, values, and actions real and specific?
5. **States:** Are happy, empty, loading, error, partial, and recovery paths defined?
6. **Accessibility:** Do semantics, keyboard flow, targets, and measured contrast pass?
7. **Tokens:** Can frontend implement values without guessing?
8. **Craft:** Only now assess color, radius, shadow, imagery, and motion.
9. **Slop diagnostic:** Score, list fired signals, repair, then score again.

---

## 13. Handoff Checklist

A design is ready only when all boxes are true.

### Purpose and composition

- [ ] Primary user and job are named.
- [ ] Primary surface archetype and rationale are written.
- [ ] One primary visual anchor exists per viewport.
- [ ] Cards and repeated modules pass the card-grid test.
- [ ] Mobile and desktop composition are defined where applicable.

### Content and density

- [ ] Real or explicitly provisional content is used.
- [ ] Microcopy names specific actions, objects, results, and recovery.
- [ ] Density choice is named for each materially different region.
- [ ] Type roles and line lengths are deliberate.

### States and accessibility

- [ ] Happy, loading, empty, no-results, error, permission, partial, and success paths are addressed where applicable.
- [ ] Every control has applicable interaction states documented.
- [ ] Keyboard order, focus entry/return, and screen-reader announcements are defined.
- [ ] Touch targets are at least 44×44px.
- [ ] Body text passes 4.5:1; large text and non-text UI pass 3:1.
- [ ] Final composited contrast ratios are recorded for every theme and state.
- [ ] Reduced-motion behavior is defined.

### Implementation readiness

- [ ] Semantic color, type, spacing, radius, border, shadow, motion, and target-size tokens have exact values.
- [ ] Component anatomy and responsive behavior are annotated.
- [ ] No frontend decision is hidden behind words such as “subtle,” “clean,” or “appropriate.”
- [ ] Anti-slop score is 0–1, or every retained signal at score 2 has written rationale.
- [ ] No compositional hard-fail signal remains.

---

## 14. Compact Policy Block for Agent Instructions

Use this shortened form when integrating the standard into an agent prompt or skill:

> Start every design by naming one primary surface: Monitor, Operate, Compare, Configure, Decide/Learn, Explore, or Command/Inspect. Compose for that job before choosing visual tokens. Establish hierarchy with position, typography, spacing, and density before adding cards, icons, color, blur, gradients, or shadows. A card must represent an independently selectable, actionable, movable, or disclosed object; otherwise use alignment, whitespace, headings, or dividers. Do not default to equal feature grids, centered stacks, blue-purple tech gradients, glassmorphism, icon toppers, monument metrics, vague AI/SaaS copy, or Inter/system UI without a deliberate rationale. Use real content and precise verb-object microcopy. Define happy, loading, empty, no-results, error, partial, permission, recovery, and success paths where applicable. Specify default, hover, focus-visible, active, selected, disabled, loading, error, and success states for every applicable interactive element. Measure final composited contrast: 4.5:1 for body text and 3:1 for large text, controls, meaningful icons, boundaries, and focus indicators. Preserve 44×44px touch targets and reduced-motion behavior. Never hand off without exact semantic tokens, responsive rules, component anatomy, state behavior, focus flow, contrast ratios, and an anti-slop audit. Any wrong-surface, equal-feature-grid, or all-centered composition blocks handoff.

---

*End of principles. This document defines design and review policy; it does not prescribe a single visual style.*
