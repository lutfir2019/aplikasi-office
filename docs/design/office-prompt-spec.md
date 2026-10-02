# Design Spec: Office Prompt Tab in OfficeDetail

**Task:** t_4c403cb6 · **Surface:** Configure  
**Handoff target:** Frontend (t_2329ae28)  
**Prototype:** `docs/design/office-prompt-prototype.html`

---

## 1. Surface Classification

This is a **Configure** surface — the user is setting up an asynchronous task.  
No hero, no decoration, no marketing framing. The form dominates.

---

## 2. Placement in OfficeDetail

Add a fourth tab alongside existing tabs:

```
[Overview]  [Folder]  [Memory]  [Run Task]
```

Tab label: `Run Task`  
Tab value in code: `DetailTab = 'Overview' | 'Folder' | 'Memory' | 'Prompt'`

The dialog width does NOT go wide for the Prompt tab (only Folder and Memory need `wide`).  
Character limit: 4,000 (from API contract).

---

## 3. Layout — Prompt Tab Body

```
┌─────────────────────────────────────────────┐
│  [Profile badge: agent name + role]         │  ← read-only, non-interactive
│                                             │
│  [Textarea — 4 rows min, auto-grow]         │
│  placeholder: describe the task…            │
│  aria-label: "Task instruction for {name}"  │
│  aria-describedby: char-counter             │
│                                             │
│  [counter: 3,847 / 4,000] ← right-aligned  │
│                                             │
│  [Send Task ▶]   [Clear]                   │  ← left-aligned, gap 10px
│                                             │
│  [Alert region: hidden by default]          │
└─────────────────────────────────────────────┘
```

### Profile Badge

```html
<div class="prompt-profile-badge">
  <PixelCharacter agent={station.id} />          <!-- existing component, zoom 0.45 -->
  <span>
    <strong>{station.name}</strong>
    <small>{station.role}</small>
  </span>
  <span class="badge {officeStateBadge(station.state).tone}">
    {station.state}
  </span>
</div>
```

- No interaction, `aria-hidden` on PixelCharacter already in place.
- Reads: "Dispatch to `{station.name}` (`{station.role}`)"

---

## 4. Design Tokens (CSS variables — already in styles.css)

| Role | Token | Dark value | Light value |
|---|---|---|---|
| Surface (form bg) | `--surface` | `var(--c-151a16)` | `var(--c-f5f6f5)` |
| Surface-2 (badge bg) | `--surface-2` | `var(--c-1a211c)` | `var(--c-f2f5f3)` |
| Border | `--border` | `var(--c-313831)` | `var(--c-eceeec)` |
| Accent (CTA / active tab) | `--accent` | `var(--c-f2b16b)` (`#f2b16b`, amber) | `var(--c-f2b16b)` (`#6e3e0a`, amber) |
| Active border | `--active-border` | `var(--c-79d6bd)` (`#79d6bd`) | `var(--c-79d6bd)` (`#1f6754`) |
| Text | `--text` | `var(--c-eeeae3)` | `var(--c-eeeae3)` (`#332c1f`) |
| Text muted | `--text-muted` | `var(--c-9ea79e)` | `var(--c-9ea79e)` (`#454c45`) |
| Danger border | `var(--c-d9695a)` | `#d9695a` | `#842a1e` |
| Success border | `--active-border` | `var(--c-79d6bd)` | `var(--c-79d6bd)` (`#1f6754`) |
| Font body | — | `'DM Sans', sans-serif` | same |
| Font mono | — | `ui-monospace, 'DM Mono'` | same |

### Counter color states

| Remaining | Color |
|---|---|
| ≥ 200 chars left | `var(--text-muted)` |
| 50–199 left | `#d59a4f` (amber, already in palette) |
| < 50 left | `#d9695a` (red, already in palette) |

---

## 5. Component States

### 5a. Default / Empty (pristine)

- Textarea: empty, placeholder visible.
- Counter: `0 / 4,000` — color `var(--text-muted)`.
- Send Task button: **disabled** (`opacity: .45; cursor: not-allowed`, `aria-disabled="true"`).
- Clear button: **disabled**.
- Alert region: hidden (`aria-hidden="true"`).
- `aria-busy="false"` on `<section>`.

### 5b. Active Typing (dirty)

- Textarea: user text, placeholder hidden.
- Counter: live update, color shifts at thresholds above.
- At 4,000 chars: textarea `border-color: #d9695a`; counter `#d9695a`.
- Send Task: **enabled** when trimmed length ≥ 1.
- Clear: **enabled**.
- Alert region: hidden.

### 5c. Submitting / Loading

- Textarea: `disabled`, visual `opacity: .7`.
- Both buttons: `disabled`.
- Send Task button text changes to spinner + `"Sending…"`:
  ```html
  <button disabled aria-disabled="true" aria-label="Sending task, please wait">
    <span class="prompt-spinner" aria-hidden="true"></span>
    Sending…
  </button>
  ```
- `aria-busy="true"` on the `<section role="tabpanel">`.
- No focus movement during submit (focus stays on button per [WCAG 3.2.2]).

### 5d. Success

- Alert region becomes visible (`aria-hidden="false"`):
  ```html
  <div class="form-success" role="alert" aria-live="polite">
    Task dispatched · <code>{task.id}</code>
    <span class="badge neutral">{task.status}</span>
    <button class="prompt-link" onClick={openTaskBoard}>View in Task Board ↗</button>
  </div>
  ```
- Textarea: cleared to empty string (auto-clear on success).
- Counter: resets to `0 / 4,000`.
- Send Task button: disabled again (empty textarea).
- Success banner auto-clears after **8 seconds** (or sooner on next keystroke).
- `aria-busy="false"`.

### 5e. Error State

- Alert region becomes visible (`aria-hidden="false"`):
  ```html
  <div class="form-error" role="alert" aria-live="assertive">
    {error.message}
    <button class="prompt-retry" onClick={retry}>Retry</button>
  </div>
  ```
- Textarea and buttons re-enabled (user can edit and resubmit).
- Textarea gets class `.textarea-error`: border becomes `var(--c-d9695a)` (`#d9695a` dark, `#842a1e` light); class is cleared on next input keystroke.
- `aria-busy="false"`.

Error message mapping (from API contract):

| HTTP status | Error shown to user |
|---|---|
| 400 validation | API message verbatim (already user-friendly) |
| 400 unknown profile | "Agent '{name}' is not in the active roster. Try refreshing." |
| 401 locked | "Ruang is locked. Enter the access code to dispatch tasks." |
| 403 CSRF | "Request rejected by the server. Refresh the page and try again." |
| 500 | "The server could not create the task. Check Logs for details." |
| Network error | "Could not reach the server. Check your connection." |

### Comprehensive Interaction Matrix (UI/UX Gate)

Every interactive control in the Prompt tab specifies all states:

| Control | Default | Hover | Focus-visible | Active / Pressed | Disabled | Error |
|---|---|---|---|---|---|---|
| **Close button** (`.office-close`) | Text muted, transparent bg | `color: var(--text)` | `outline: 2px solid var(--accent)` | `opacity: .8` | — | — |
| **Tab: Run Task** (`.detail-tabs button`) | `border-bottom: 2px solid var(--accent)`, `color: var(--text)` | — | `outline: 2px solid var(--accent)` | — | — | — |
| **Prompt textarea** (`.prompt-textarea`) | `border: 1px solid var(--border-strong)`, `background: var(--surface-3)` | `border-color: var(--text-dim)` | `border-color: var(--accent)`, `outline: 2px solid var(--accent); outline-offset: 1px` | — | `cursor: not-allowed; opacity: .7` | `border-color: var(--c-d9695a)` (`.textarea-error`) |
| **Send Task** (`.primary-button`) | Amber bg `#f2b16b`, text `#0b0e0c`, `opacity: 1` | `opacity: .88` | `outline: 2px solid var(--accent); outline-offset: 3px` | `transform: translateY(1px)` | `cursor: not-allowed; opacity: .45` | — |
| **Clear button** (`.ghost-button`) | Transparent bg, border `--border-strong`, text `--text-muted` | `border-color: var(--text-muted); color: var(--text)` | `outline: 2px solid var(--accent); outline-offset: 2px` | `background: var(--surface-2)` | `cursor: not-allowed; opacity: .4` | — |
| **"View in Task Board ↗"** (`.prompt-link`) | Accent amber, underline | `opacity: .8` | `outline: 2px solid var(--accent)` | `opacity: .6` | — | — |
| **"Retry"** (`.prompt-retry`) | Red `var(--c-d9695a)`, bold, underline | `opacity: .8` | `outline: 2px solid var(--c-d9695a)` | `opacity: .6` | — | — |

---

## 6. Accessibility Contract

### Focus Management

- When user switches to `Run Task` tab: **focus moves to the textarea** (`useEffect` with `ref.current?.focus()`).
- This replaces the existing behavior of focusing `closeRef` only on mount — the tab switch must also trigger focus.
- Existing focus trap in `OfficeDetail.onKeyDown` covers the Prompt tab without changes (it queries all focusable elements dynamically).
- Escape: closes dialog, returns focus to station trigger button (existing behavior, no change).

### Tab order within Prompt tab

```
[Close button (top)] → [Tab: Overview] → [Tab: Folder] → [Tab: Memory] → [Tab: Run Task]
  → [Textarea] → [Send Task] → [Clear]
  (→ wraps to [Close button])
```

When alert is visible and contains a "View in Task Board" or "Retry" button, those join the tab order naturally (no tabindex manipulation needed).

### ARIA

| Element | Attribute |
|---|---|
| `<section role="tabpanel">` | `aria-busy="true|false"` — flips during submit |
| Textarea | `aria-label="Task instruction for {station.name}"`, `aria-describedby="prompt-char-counter"` |
| Character counter | `id="prompt-char-counter"`, `aria-live="off"` (SR doesn't need every keystroke) |
| Success alert | `role="alert"`, `aria-live="polite"` |
| Error alert | `role="alert"`, `aria-live="assertive"` |
| Submit (loading) | `aria-label="Sending task, please wait"`, `aria-disabled="true"` |
| Profile badge container | `aria-label="Dispatching to {station.name}"` |

### Contrast (WCAG AA)

| Text | Background | Ratio | Pass |
|---|---|---|---|
| Text | `--text` `#eeeae3` on `--surface` `#151a16` | — | 14.70:1 | ✓ AAA |
| `--text-muted` `#9ea79e` on `--surface` `#151a16` | — | 7.11:1 | ✓ AAA |
| Amber counter warn `#d59a4f` on `#151a16` | — | 7.19:1 | ✓ AAA |
| Error red `#d9695a` on `#151a16` | — | 5.14:1 | ✓ AA |
| Accent `#f2b16b` on `#151a16` | — | 9.47:1 | ✓ AAA |
| Button text `#0b0e0c` on `--accent` `#f2b16b` | — | 10.42:1 | ✓ AAA |
| Body text `#332c1f` on light surface `#f5f6f5` | — | 12.75:1 | ✓ AAA |
| `--text-muted` `#454c45` on light surface `#f5f6f5` | — | 8.17:1 | ✓ AAA |
| Amber warn `#8f5f22` on light surface `#f5f6f5` | — | 5.06:1 | ✓ AA |
| Error red `#842a1e` on light surface `#f5f6f5` | — | 8.32:1 | ✓ AAA |
| Accent `#6e3e0a` on light surface `#f5f6f5` | — | 8.23:1 | ✓ AAA |

All 11 pairs verified with the WCAG 2.1 relative-luminance formula (computed via Node, not estimated). Zero failures; weakest pair is error-red-on-dark at 5.14:1, still above the 4.5:1 AA floor for body text.

Light theme: tokens invert per `:root[data-theme="light"]` in styles.css — same component, no extra rules needed.

---

## 7. CSS Additions (new classes)

All additions go in `styles.css` after the `.detail-body` block (after line ~621):

```css
/* All interactive states explicitly defined per UI/UX gates */
.prompt-textarea {
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: var(--text);
  font: 14px/1.5 'DM Sans', sans-serif;
  min-height: 96px;
  padding: 10px 12px;
  resize: vertical;
  transition: border-color .15s ease;
  width: 100%;
}
.prompt-textarea:hover:not(:disabled) { border-color: var(--text-dim); }
.prompt-textarea:focus-visible { border-color: var(--accent); outline: 2px solid var(--accent); outline-offset: 1px; }
.prompt-textarea:disabled { cursor: not-allowed; opacity: .7; }
.prompt-textarea.textarea-error { border-color: var(--c-d9695a); }

/* Primary Button (Send Task) states.
   Set opacity explicitly at rest — do NOT transition opacity, or the disabled
   affordance reads ambiguously mid-animation. */
.primary-button { opacity: 1; }
.primary-button:hover:not(:disabled) { opacity: .88; }
.primary-button:active:not(:disabled) { transform: translateY(1px); }
.primary-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.primary-button:disabled { cursor: not-allowed; opacity: .45; }

/* Secondary Button (Clear) states */
.ghost-button {
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  font: 14px 'DM Sans', sans-serif;
  padding: 9px 14px;
  transition: border-color .15s;
}
.ghost-button:hover:not(:disabled) { border-color: var(--text-muted); color: var(--text); }
.ghost-button:active:not(:disabled) { background: var(--surface-2); }
.ghost-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ghost-button:disabled { cursor: not-allowed; opacity: .4; }
```

Existing reused classes (no new CSS needed):
- `.form-error` — left-border red alert
- `.form-success` — left-border green alert
- `.primary-button` — amber CTA (`--accent` `#f2b16b`), already has `:disabled` state
- `.field-label` — uppercase monospace label
- `.badge` — status chip

---

## 8. Responsive Behavior

| Viewport | Behavior |
|---|---|
| ≥ 520px | Full layout as shown. Dialog `width: min(720px, 100%)`. |
| 480–519px | Footer stacks: counter above actions. |
| < 480px | Textarea `min-height: 80px`. Actions full-width. |

The `OfficeDetail` dialog already has `max-height: calc(100vh - 40px); overflow: auto` — scrolling works for free.

---

## 9. Interaction Contract for Frontend

### Props / State

```typescript
// State needed inside OfficeDetail when tab === 'Prompt'
const [prompt, setPrompt] = useState('')
const [submitting, setSubmitting] = useState(false)
const [result, setResult] = useState<
  | { kind: 'success'; taskId: string; status: string }
  | { kind: 'error'; message: string }
  | null
>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)

// Focus textarea when switching to Prompt tab
useEffect(() => {
  if (tab === 'Prompt') textareaRef.current?.focus()
}, [tab])
```

### Submit handler

```typescript
async function handleDispatch() {
  if (submitting || !prompt.trim()) return
  setSubmitting(true)
  setResult(null)
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ruang-request': '1' },
      body: JSON.stringify({ profile: station.id, prompt: prompt.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      setResult({ kind: 'success', taskId: json.task.id, status: json.task.status })
      setPrompt('')
      // Invalidate and re-fetch office, tasks, and dashboard
      void fetch('/api/office?fresh=1')
      void fetch('/api/tasks?fresh=1')
      void fetch('/api/dashboard?fresh=1')
    } else {
      setResult({ kind: 'error', message: friendlyError(res.status, json) })
    }
  } catch {
    setResult({ kind: 'error', message: 'Could not reach the server. Check your connection.' })
  } finally {
    setSubmitting(false)
  }
}
```

### DetailTab change

Add `'Prompt'` to `DETAIL_TABS` array.  
Add `' wide'` only for `Folder` and `Memory` (Prompt does not need wide width).

```typescript
type DetailTab = 'Overview' | 'Folder' | 'Memory' | 'Prompt'
const DETAIL_TABS: DetailTab[] = ['Overview', 'Folder', 'Memory', 'Prompt']
// in className:
const wide = tab === 'Folder' || tab === 'Memory'
```

### Double-click prevention

`setSubmitting(true)` before the `await` + `disabled={submitting}` on the button is sufficient.  
Do not use `useRef` for a flag — React state is cleaner here and already correct.

---

## 10. Test Surface (from contract)

Tests to write in `src/office-prompt.test.tsx`:

| Test | What to verify |
|---|---|
| Renders Prompt tab | Tab button with text "Run Task" exists in `DETAIL_TABS` |
| Profile badge | Station name + role + state visible |
| Textarea label | `aria-label` contains station name |
| Counter | Shows `0 / 4,000` initially |
| Send disabled when empty | Button `disabled` attr present when prompt is `''` |
| Send enabled when dirty | Button not disabled when prompt has content |
| Submit → loading state | Button text "Sending…" + `aria-busy="true"` on tabpanel |
| Submit → success | `role="alert"` contains task ID after 201 response |
| Submit → error | `role="alert"` contains error message after 400 response |
| Double-click prevention | Second click while submitting does not trigger second fetch |
| Auto-clear on success | Textarea empty after success |
| Focus on tab switch | `textareaRef.current === document.activeElement` after switching to Prompt tab |

Tests for focus trap already covered in `src/office-dialog-focus.test.tsx` — extend that file to add a "Run Task" button to the expected tab sequence.

---

*End of spec. No code written. Tokens and class names are copy-paste ready.*
